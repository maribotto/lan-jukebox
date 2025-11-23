const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const dns = require('dns').promises;
const os = require('os');
const app = express();

// --- LOAD CONFIGURATION ---
// Detect if running as pkg executable
// When packaged with pkg, __dirname points to the snapshot filesystem
// We need to read config.json from the executable's directory instead
const configDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const configPath = path.join(configDir, 'config.json');

let config;
try {
    console.log(`Loading config from: ${configPath}`);
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
    if (!config.hostIp) {
        throw new Error('config.json is missing "hostIp"');
    }
} catch (error) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('ERROR: Could not load config.json.');
    console.error(`Expected location: ${configPath}`);
    console.error('Ensure the file exists and contains: { "hostIp": "YOUR_IP_HERE" }');
    console.error(error.message);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    process.exit(1); // Stop the server because config is missing
}

// Resolve hostname to IP if needed
let resolvedHostIp = null;

async function resolveHostIp() {
    // Check if hostIp looks like a hostname (not an IP address)
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    if (!ipv4Pattern.test(config.hostIp) && !ipv6Pattern.test(config.hostIp)) {
        // It's likely a hostname, try to resolve it
        try {
            const addresses = await dns.resolve4(config.hostIp);
            if (addresses && addresses.length > 0) {
                resolvedHostIp = addresses[0];
                console.log(`✓ Resolved hostname "${config.hostIp}" to IP: ${resolvedHostIp}`);
                return;
            }
        } catch (error) {
            console.warn(`⚠️  Could not resolve hostname "${config.hostIp}": ${error.message}`);
            console.warn(`   Will use "${config.hostIp}" as-is for comparison`);
        }
    }

    // If it's already an IP or resolution failed, use it as-is
    resolvedHostIp = config.hostIp;
}

// ------------------------------

// --- PORT CONFIGURATION ---
const PORT = config.port || 3000;
console.log(`📡 Server will run on port: ${PORT}`);
// ------------------------------

// --- TRUST PROXY CONFIGURATION ---
// Enable this when using a reverse proxy (e.g., Caddy, Nginx)
// This allows Express to read X-Forwarded-For headers
if (config.trustProxy === true) {
    app.set('trust proxy', true);
    console.log('⚠️  Trust proxy enabled - suitable for reverse proxy setups');
} else {
    console.log('✓ Trust proxy disabled - suitable for direct LAN usage');
}
// ------------------------------

let queue = [];
let currentlyPlaying = null; // Track the currently playing video

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SESSION CONFIGURATION ---
if (config.requireLogin === true) {
    app.use(session({
        secret: config.sessionSecret || 'lan-jukebox-secret-' + Math.random().toString(36),
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // Allow cookies over HTTP for LAN usage
            httpOnly: true,
            sameSite: 'lax', // Allow cookies across same-site requests
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));
    console.log('🔐 Login authentication enabled');
} else {
    console.log('✓ Login authentication disabled (open access)');
}
// ------------------------------

// --- STATIC FILES CONFIGURATION ---
// Serve static files from the public directory
// When packaged with pkg, serve from the executable's directory
const publicDir = process.pkg ? path.join(path.dirname(process.execPath), 'public') : path.join(__dirname, 'public');
console.log(`Serving static files from: ${publicDir}`);

// --- MOBILE DETECTION AND REDIRECT ---
app.get('/', (req, res) => {
    return res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(express.static(publicDir));

// --- HELPER FUNCTION: Auth Check ---
// Middleware to check if user is authenticated (if login is required)
function requireAuth(req, res, next) {
    if (config.requireLogin === true) {
        if (!req.session || !req.session.authenticated) {
            return res.status(401).json({ message: 'Authentication required' });
        }
    }
    next();
}

// --- HELPER FUNCTION: IP Check ---
// Checks if the request sender is the allowed "host"
function isHost(req) {
    let clientIp = req.ip;

    // Handles IPv6-formatted IPv4 addresses (e.g., ::ffff:192.168.1.10)
    if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
    }

    // Allow both localhost (for testing) and the configured/resolved host IP
    const allowedIps = ['127.0.0.1', '::1', resolvedHostIp];

    return allowedIps.includes(clientIp);
}


// ------ API ROUTES ------

// LOGIN ROUTE
app.post('/api/login', async (req, res) => {
    if (config.requireLogin !== true) {
        return res.status(400).json({ success: false, message: 'Login is not enabled' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Check username
    if (username !== config.username) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const match = await bcrypt.compare(password, config.passwordHash);
    if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Set session
    req.session.authenticated = true;
    req.session.username = username;

    // Save session before responding
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ success: false, message: 'Session error' });
        }
        console.log(`✓ User logged in: ${username}`);
        res.json({ success: true, message: 'Login successful' });
    });
});

// LOGOUT ROUTE
// --- CHECK AUTH STATUS ENDPOINT ---
app.get('/api/check-auth', (req, res) => {
    res.json({
        authenticated: req.session && req.session.authenticated === true,
        requireLogin: config.requireLogin === true,
        username: req.session?.username || null
    });
});

app.post('/api/logout', (req, res) => {
    if (req.session) {
        const username = req.session.username || 'unknown';
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ success: false, message: 'Logout failed' });
            }
            console.log(`✓ User logged out: ${username}`);
            res.json({ success: true, message: 'Logged out successfully' });
        });
    } else {
        res.json({ success: true, message: 'Already logged out' });
    }
});

// CHECK AUTH STATUS
app.get('/api/auth-status', (req, res) => {
    res.json({
        requireLogin: config.requireLogin === true,
        authenticated: req.session && req.session.authenticated === true
    });
});

// NEW ROUTE: Tells the browser if it's "host" or "guest"
app.get('/api/status', requireAuth, (req, res) => {
    // Log the client IP and the resolved host IP for debugging
    console.log(`[API/Status] Client IP: ${req.ip}, Resolved Host IP: ${resolvedHostIp}`);
    res.json({
        isHost: isHost(req),
        yourIp: req.ip // Sending the user's IP for info
    });
});

// NEW ROUTE: Image Proxy for Jellyfin
app.get('/api/jellyfin/image-proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('Missing url parameter');
    }

    // console.log(`[Image Proxy] Fetching: ${url}`); // Removed for security

    try {
        const response = await fetch(url);
        
        // console.log(`[Image Proxy] Status: ${response.status}`); // Removed for security

        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch image');
        }

        // Forward headers
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Pipe the image data
        response.body.pipe(res);

    } catch (error) {
        console.error('Image Proxy Error:', error.message);
        res.status(500).send('Image proxy failed');
    }
});

// NEW ROUTE: Jellyfin Proxy to bypass CORS
app.post('/api/jellyfin/proxy', async (req, res) => {
    const { baseUrl, endpoint, method, headers, body } = req.body;

    if (!baseUrl || !endpoint) {
        return res.status(400).json({ success: false, message: 'Missing baseUrl or endpoint' });
    }

    try {
        const targetUrl = `${baseUrl}${endpoint}`;
        
        const fetchOptions = {
            method: method || 'GET',
            headers: headers || {}
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            fetchOptions.body = JSON.stringify(body);
        }

        console.log(`--- PROXY REQUEST ---`);
        console.log(`URL: ${targetUrl}`);
        console.log(`Method: ${fetchOptions.method}`);
        // Sensitive Headers and Body logging removed
        // console.log(`Headers:`, fetchOptions.headers);
        // console.log(`Body:`, fetchOptions.body);

        const response = await fetch(targetUrl, fetchOptions);
        
        console.log(`--- PROXY RESPONSE ---`);
        console.log(`Status: ${response.status}`);

        // Forward status
        res.status(response.status);

        // Attempt to parse as JSON, fallback to text
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            // Sensitive Response Data logging removed
            // console.log(`Response Data:`, JSON.stringify(data).substring(0, 200) + '...');
            res.json(data);
        } else {
            const text = await response.text();
            // Sensitive Response Text logging removed
            // console.log(`Response Text:`, text.substring(0, 200) + '...');
            res.send(text);
        }

    } catch (error) {
        console.error('Jellyfin Proxy Error:', error.message);
        res.status(500).json({ success: false, message: 'Proxy failed: ' + error.message });
    }
});

// MODIFIED: Now fetches the video title and validates embeddability
app.post('/api/add', requireAuth, async (req, res) => { // Changed to async function
    // NEW: Support for generic items (Hybrid Player)
    if (req.body.item) {
        const item = req.body.item;
        queue.push(item);
        console.log(`Added generic item to queue (requester: ${req.ip}): ${item.title}`);
        return res.status(201).json({
            success: true,
            message: 'Item added',
            video: item
        });
    }

    const { videoUrl } = req.body;

    if (!videoUrl || !(videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        return res.status(400).json({ success: false, message: 'Invalid URL - must be a YouTube link' });
    }

    // Try to extract video ID first
    let videoId = null;
    try {
        const urlObj = new URL(videoUrl);
        if (urlObj.hostname.includes('youtu.be')) {
            videoId = urlObj.pathname.slice(1);
        } else {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (e) {
        // Fallback regex
        const match = videoUrl.match(/[?&]v=([^&]+)/);
        if (match) videoId = match[1];
    }

    let title = `YouTube Video (${videoId || 'Unknown'})`;
    let embedCheckPassed = false;

    // NEW: Try to fetch video title from YouTube's oEmbed API
    // oEmbed will fail (4xx) if video is private, deleted, or embed-disabled
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
        const oembedRes = await fetch(oembedUrl);

        if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            title = oembedData.title; // Fetched title!
            embedCheckPassed = true;
        } else {
            console.warn(`YouTube oEmbed failed (${oembedRes.status}), trying NoEmbed fallback...`);
            try {
                const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`;
                const noembedRes = await fetch(noembedUrl);
                if (noembedRes.ok) {
                    const noembedData = await noembedRes.json();
                    if (noembedData.title) {
                        title = noembedData.title;
                        console.log(`Fetched title via NoEmbed: ${title}`);
                    }
                }
            } catch (err) {
                console.error('NoEmbed fallback failed:', err.message);
            }
        }
    } catch (e) {
        console.error('Title fetch failed:', e.message);
        // Keep fallback title
    }

    const videoObject = { type: 'youtube', url: videoUrl, title: title, id: videoId };
    queue.push(videoObject);
    console.log(`Added to queue (requester: ${req.ip}): ${title}`);

    // Warn user if embed check didn't pass
    const message = embedCheckPassed
        ? 'Video added successfully'
        : 'Video added (⚠️ Warning: Could not verify embedding permissions. Video may fail to play if restricted by owner, age-gated, or Premium-only.)';

    res.status(201).json({
        success: true,
        message: message,
        video: videoObject,
        embedVerified: embedCheckPassed // Add this flag for frontend to use
    });
});

// Get next video (HOST ONLY)
app.post('/api/next', requireAuth, (req, res) => {
    if (!isHost(req)) {
        return res.status(403).json({ message: 'Only the host machine can control playback.' });
    }
    const nextVideo = queue.shift();
    if (nextVideo) {
        currentlyPlaying = nextVideo; // Track the currently playing video
        console.log(`Playing (host): ${nextVideo.title}`);
        res.json({ nextVideo: nextVideo });
    } else {
        currentlyPlaying = null; // Clear when queue is empty
        console.log('Queue is empty.');
        res.json({ nextVideo: null });
    }
});

// NEW ROUTE: Delete a specific video from queue (HOST ONLY)
app.post('/api/delete', requireAuth, (req, res) => {
    if (!isHost(req)) {
        return res.status(403).json({ message: 'Only the host machine can delete videos.' });
    }
    
    const { index } = req.body;

    // Ensure the index is valid
    // (We only allow deleting items later in the queue, index 0 is removed via "next")
    if (index > 0 && index < queue.length) {
        const deleted = queue.splice(index, 1); // Removes 1 element at the index
        console.log(`Host removed video: ${deleted[0].title}`);
        res.json({ success: true, message: 'Video removed' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid index' });
    }
});

// Get current queue (for all)
app.get('/api/queue', requireAuth, (req, res) => {
    res.json({
        queue: queue,
        currentlyPlaying: currentlyPlaying
    });
});

// ------ STARTUP ------
// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
    resolveHostIp().then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            const hostname = os.hostname();
            console.log('===========================================================');
            console.log(`🚀 Jukebox API running at: http://localhost:${PORT}`);
            console.log(`🔒 Host (player) locked to: ${config.hostIp}${resolvedHostIp !== config.hostIp ? ` (${resolvedHostIp})` : ''}`);
            console.log(`📡 LAN access: http://${hostname}.local:${PORT}`);
            console.log(`   Guests can also use: http://${config.hostIp}:${PORT}`);
            console.log('===========================================================');
        });
    });
}

// Export for testing
module.exports = app;
