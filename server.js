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
            secure: config.trustProxy === true, // Use secure cookies with HTTPS
            httpOnly: true,
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

    console.log(`✓ User logged in: ${username}`);
    res.json({ success: true, message: 'Login successful' });
});

// LOGOUT ROUTE
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
    res.json({
        isHost: isHost(req),
        yourIp: req.ip // Sending the user's IP for info
    });
});

// MODIFIED: Now fetches the video title and validates embeddability
app.post('/api/add', requireAuth, async (req, res) => { // Changed to async function
    const { videoUrl } = req.body;

    if (!videoUrl || !(videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        return res.status(400).json({ success: false, message: 'Invalid URL - must be a YouTube link' });
    }

    let title = 'Untitled video';
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
        } else if (oembedRes.status === 401 || oembedRes.status === 404) {
            // Video not embeddable or not found
            console.warn(`Video not embeddable or unavailable: ${videoUrl} (status ${oembedRes.status})`);
            return res.status(400).json({
                success: false,
                message: 'Video is private, deleted, or embedding is disabled by the owner'
            });
        } else {
            // Other errors - try fallback
            console.warn(`oEmbed returned ${oembedRes.status}, trying fallback`);
            const urlObj = new URL(videoUrl);
            if (urlObj.hostname.includes('youtu.be')) {
                title = urlObj.pathname.slice(1);
            } else {
                title = urlObj.searchParams.get('v') || 'Untitled video';
            }
        }
    } catch (e) {
        console.error('oEmbed fetch failed:', e.message);
        // Still allow adding, but with fallback title
        title = videoUrl.split('v=')[1] || 'ID parsed from URL';
    }

    const videoObject = { url: videoUrl, title: title };
    queue.push(videoObject);
    console.log(`Added to queue (requester: ${req.ip}): ${title}`);

    // Warn user if embed check didn't pass
    const message = embedCheckPassed
        ? 'Video added successfully'
        : 'Video added (warning: could not verify if embedding is allowed)';

    res.status(201).json({ success: true, message: message, video: videoObject });
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
