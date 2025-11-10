const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch'); // NEW: Import fetch
const app = express();
const PORT = 3000;

// --- LOAD CONFIGURATION ---
let config;
try {
    const configData = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    config = JSON.parse(configData);
    if (!config.hostIp) {
        throw new Error('config.json is missing "hostIp"');
    }
} catch (error) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('ERROR: Could not load config.json.');
    console.error('Ensure the file exists and contains: { "hostIp": "YOUR_IP_HERE" }');
    console.error(error.message);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    process.exit(1); // Stop the server because config is missing
}
// ------------------------------

let queue = [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- HELPER FUNCTION: IP Check ---
// Checks if the request sender is the allowed "host"
function isHost(req) {
    let clientIp = req.ip;
    
    // Handles IPv6-formatted IPv4 addresses (e.g., ::ffff:192.168.1.10)
    if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
    }
    
    // Allow both localhost (for testing) and the configured host IP
    const allowedIps = ['127.0.0.1', '::1', config.hostIp];
    
    return allowedIps.includes(clientIp);
}


// ------ API ROUTES ------

// NEW ROUTE: Tells the browser if it's "host" or "guest"
app.get('/api/status', (req, res) => {
    res.json({
        isHost: isHost(req),
        yourIp: req.ip // Sending the user's IP for info
    });
});

// MODIFIED: Now fetches the video title
app.post('/api/add', async (req, res) => { // Changed to async function
    const { videoUrl } = req.body;

    if (!videoUrl || !(videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        return res.status(400).json({ success: false, message: 'Invalid URL' });
    }

    let title = 'Untitled video';

    // NEW: Try to fetch video title from YouTube's oEmbed API
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        
        if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            title = oembedData.title; // Fetched title!
        } else {
            // If oEmbed fails, use old fallback logic
            const urlObj = new URL(videoUrl);
            if (urlObj.hostname.includes('youtu.be')) {
                title = urlObj.pathname.slice(1);
            } else {
                title = urlObj.searchParams.get('v') || 'Untitled video';
            }
        }
    } catch (e) {
        console.error('oEmbed fetch failed:', e.message);
        title = videoUrl.split('v=')[1] || 'ID parsed from URL';
    }
    
    const videoObject = { url: videoUrl, title: title };
    queue.push(videoObject);
    console.log(`Added to queue (requester: ${req.ip}): ${title}`);
    res.status(201).json({ success: true, message: 'Video added', video: videoObject });
});

// Get next video (HOST ONLY)
app.post('/api/next', (req, res) => {
    if (!isHost(req)) {
        return res.status(403).json({ message: 'Only the host machine can control playback.' });
    }
    const nextVideo = queue.shift();
    if (nextVideo) {
        console.log(`Playing (host): ${nextVideo.title}`);
        res.json({ nextVideo: nextVideo });
    } else {
        console.log('Queue is empty.');
        res.json({ nextVideo: null });
    }
});

// NEW ROUTE: Delete a specific video from queue (HOST ONLY)
app.post('/api/delete', (req, res) => {
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
app.get('/api/queue', (req, res) => {
    res.json(queue);
});

// ------ STARTUP ------
app.listen(PORT, '0.0.0.0', () => {
    console.log('===========================================================');
    console.log(`🚀 Jukebox API running at: http://localhost:${PORT}`);
    console.log(`🔒 Host (player) locked to IP: ${config.hostIp}`);
    console.log(`Guests can add videos at: http://${config.hostIp}:${PORT}`);
    console.log('===========================================================');
});
