// Hybrid Player Logic with Server Sync

// --- State ---
let playlist = []; // Represents the queue on server
let currentItem = null;
let isHost = false;
let youtubePlayer;
let isYoutubePlayerReady = false; // Track YouTube player state
let jellyfinServer = { url: '', token: '', userId: '' };
const audioPlayer = document.getElementById('audio-player');

// --- Initialization ---

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Check authentication status first
    try {
        const authResponse = await fetch('/api/auth-status', { credentials: 'include' });
        const authData = await authResponse.json();

        if (authData.requireLogin && !authData.authenticated) {
            window.location.href = '/login.html';
            return;
        }

        // If login is required and user is authenticated, show logout button
        if (authData.requireLogin && authData.authenticated) {
            const logoutButton = document.createElement('button');
            logoutButton.id = 'logout-btn';
            logoutButton.textContent = 'Logout';
            logoutButton.style.cssText = 'background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; position: absolute; top: 20px; right: 20px;';
            document.body.prepend(logoutButton);
            logoutButton.addEventListener('click', async () => {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/login.html';
            });
        }

    } catch (error) {
        console.error('Error checking auth status:', error);
        alert("Error checking authentication status. Please try again.");
        return; // Stop initialization if auth check fails
    }

    // 1. Check Host Status
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        isHost = data.isHost;
        
        console.log("Current User Role:", isHost ? "HOST" : "GUEST");

        const h1 = document.querySelector('h1');
        if (isHost) {
            // Host Setup
            document.getElementById('player-container').style.display = 'block';
            document.querySelector('.controls').style.display = 'flex';
            
            const hostMsg = document.createElement('div');
            hostMsg.innerHTML = `<p style="background:#28a745; color:white; padding:10px; border-radius:4px;">👑 You are the Host. Control playback and manage the queue!</p>`;
            h1.parentNode.insertBefore(hostMsg, h1.nextSibling);

            // Load YouTube API dynamically
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        } else {
            // Guest Setup
            document.getElementById('player-container').style.display = 'none';
            document.querySelector('.controls').style.display = 'none';
            
            const guestMsg = document.createElement('div');
            guestMsg.innerHTML = `<p style="background:#007bff; color:white; padding:10px; border-radius:4px;">👋 You are a Guest. You can add songs to the queue!</p>`;
            h1.parentNode.insertBefore(guestMsg, h1.nextSibling);
        }
        
        // Load saved Jellyfin URL
        const savedUrl = localStorage.getItem('jellyfin_url');
        if (savedUrl) {
            document.getElementById('jf-url').value = savedUrl;
        }

        // Start Sync Loop
        syncQueue();
        setInterval(syncQueue, 2000);

    } catch (e) {
        console.error("Init failed:", e);
    }
}

// --- Server Sync ---

async function syncQueue() {
    try {
        const response = await fetch('/api/queue');
        const data = await response.json();
        
        playlist = data.queue || [];
        const serverPlaying = data.currentlyPlaying;
        
        // Update currentItem based on server state
        if (serverPlaying && (!currentItem || currentItem.id !== serverPlaying.id)) {
            currentItem = serverPlaying;
            if (isHost) { // Only Host loads media
                loadMedia(currentItem);
            }
        } else if (!serverPlaying && currentItem) {
            currentItem = null;
            if (isHost) { // Only Host stops media
                stopPlayers();
            }
        }

        // Auto-play logic for Host
        if (isHost && !currentItem && playlist.length > 0) {
            const nextItem = playlist[0];
            
            // If next item is YouTube, wait for player readiness
            if (nextItem.type === 'youtube' && !isYoutubePlayerReady) {
                console.log("Host: Waiting for YouTube player to be ready...");
                return;
            }

            console.log("Host: Auto-starting playback...");
            playNext();
        }

        // Update "Now Playing" UI (for everyone)
        if (serverPlaying) {
            // If we are guest, show what's playing
            if (!isHost) {
                const guestNp = document.getElementById('guest-now-playing');
                guestNp.style.display = 'block';
                document.getElementById('guest-np-title').innerText = serverPlaying.title;
                
                const artistElem = document.getElementById('guest-np-artist');
                if (serverPlaying.type === 'jellyfin') {
                    artistElem.style.display = 'block';
                    artistElem.innerText = serverPlaying.artist || 'Unknown Artist';
                } else {
                    artistElem.style.display = 'none';
                }
            }
        } else {
            if (!isHost) {
                const guestNp = document.getElementById('guest-now-playing');
                if (guestNp) guestNp.style.display = 'none';
            }
        }

        renderPlaylist(serverPlaying);

    } catch (e) {
        console.error("Sync error:", e);
    }
}

// --- Playback Control (Host Only) ---

async function playNext() {
    if (!isHost) return;

    try {
        const response = await fetch('/api/next', { method: 'POST' });
        const data = await response.json();
        
        if (data.nextVideo) {
            loadMedia(data.nextVideo);
        } else {
            console.log("Queue empty.");
            currentItem = null;
            stopPlayers();
        }
    } catch (e) {
        console.error("PlayNext error:", e);
    }
}

function loadMedia(item) {
    currentItem = item;
    console.log("Loading:", item.title);

    // Reset UI
    document.getElementById('youtube-player').style.display = 'none';
    document.getElementById('jellyfin-player-visual').style.display = 'none';
    
    stopPlayers();

    // Default to YouTube if type is missing (legacy support)
    const type = item.type || 'youtube';

    if (type === 'youtube') {
        document.getElementById('youtube-player').style.display = 'block';
        if (youtubePlayer && youtubePlayer.loadVideoById) {
            // Legacy items might have 'url' but no 'id'
            let videoId = item.id;
            if (!videoId && item.url) {
                videoId = extractVideoID(item.url);
            }
            
            if (videoId) {
                youtubePlayer.loadVideoById(videoId);
            } else {
                console.error("Could not extract video ID for playback:", item);
                playNext(); // Skip if invalid
            }
        }
    } else if (type === 'jellyfin') {
        playJellyfinItem(item);
    }
}

function stopPlayers() {
    if(youtubePlayer && youtubePlayer.stopVideo) youtubePlayer.stopVideo();
    audioPlayer.pause();
    // Clear visuals
    document.getElementById('jf-cover').src = "";
    document.getElementById('jf-title').innerText = "No Song Playing";
    document.getElementById('jf-artist').innerText = "Unknown Artist";
}

// Make available globally for YouTube API
window.onYouTubeIframeAPIReady = function() {
    youtubePlayer = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: { 'playsinline': 1, 'controls': 1, 'disablekb': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    console.log("YouTube Player Ready");
    isYoutubePlayerReady = true;
    // If queue has items, syncQueue loop will trigger playNext
}

function onPlayerStateChange(event) {
    if (event.data === 0) { // Ended
        playNext();
    } else if (event.data === 1) { // Playing
        // Try to update title from player if it's generic
        if (youtubePlayer && currentItem && currentItem.type === 'youtube') {
            const videoData = youtubePlayer.getVideoData();
            if (videoData && videoData.title) {
                console.log("Updating title from player:", videoData.title);
                currentItem.title = videoData.title;
                // Update the "Now Playing" item in the list
                const list = document.getElementById('playlist');
                const nowPlayingItem = list.querySelector('li.active strong');
                if (nowPlayingItem) {
                    nowPlayingItem.innerText = videoData.title;
                }
            }
        }
    }
}

function onPlayerError(event) {
    console.error("YouTube Player Error:", event.data);
    console.log("Skipping invalid video in 3 seconds...");
    setTimeout(() => { playNext(); }, 3000);
}

// Jellyfin Audio Events
audioPlayer.addEventListener('ended', () => {
    if (isHost) playNext();
});

function playJellyfinItem(item) {
    // Check if we have a token. If not, we can't play protected JF content unless we proxy auth?
    // For now, assume Host is logged in.
    if (!jellyfinServer.token) {
        console.error("Host not connected to Jellyfin! Cannot play item.");
        // Try to auto-skip or alert
        return;
    }

    const streamUrl = `${jellyfinServer.url}/Audio/${item.id}/stream?static=true&api_key=${jellyfinServer.token}`;
    const originalCoverUrl = `${jellyfinServer.url}/Items/${item.coverId}/Images/Primary?maxHeight=400&maxWidth=400&quality=90&api_key=${jellyfinServer.token}`;
    const coverUrl = `/api/jellyfin/image-proxy?url=${encodeURIComponent(originalCoverUrl)}`;

    // Update Visuals
    const visualContainer = document.getElementById('jellyfin-player-visual');
    document.getElementById('jf-cover').src = coverUrl;
    document.getElementById('jf-title').innerText = item.title;
    document.getElementById('jf-artist').innerText = item.artist;
    visualContainer.style.display = 'flex';

    // Play Audio
    audioPlayer.src = streamUrl;
    audioPlayer.play().catch(e => console.error("Audio play error:", e));
}

// --- Adding Items (Server Side) ---

async function addItemToServer(item) {
    try {
        const response = await fetch('/api/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: item })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || response.statusText);
        }
        
        // syncQueue will refresh immediately, no need to call renderPlaylist directly
    } catch (e) {
        console.error("Add item failed:", e);
        alert("Failed to add item: " + e.message);
    }
}

// YouTube Add
function addYouTubeVideo() {
    const input = document.getElementById('videoUrl');
    const url = input.value.trim();
    if (!url) return;

    const videoId = extractVideoID(url);
    if (!videoId) { alert("Invalid YouTube URL"); return; }

    addItemToServer({
        type: 'youtube',
        id: videoId,
        title: `YouTube Video (${videoId})`
    });
    input.value = '';
}

// Jellyfin Add
async function addRandomJellyfinSong() {
    if (!jellyfinServer.token) { alert("Please connect to Jellyfin first."); return; }
    try {
        const endpoint = `/Users/${jellyfinServer.userId}/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=Random&Limit=1`;
        const items = await fetchJellyfinItems(endpoint);
        if (items.length > 0) {
            addItemToServer(convertJfItem(items[0]));
        } else {
            alert("No songs found.");
        }
    } catch (e) { console.error(e); alert("Error: " + e.message); }
}

async function searchJellyfin() {
    if (!jellyfinServer.token) {
        alert("Please connect to Jellyfin first.");
        return;
    }

    const query = document.getElementById('jf-search-input').value.trim();
    if (!query) return;

    const list = document.getElementById('jf-search-results');
    list.style.display = 'block';
    list.innerHTML = '<li style="color: #aaa; text-align: center;">Searching...</li>';

    try {
        // Search for Audio items matching the term
        const endpoint = `/Users/${jellyfinServer.userId}/Items?Recursive=true&IncludeItemTypes=Audio&SearchTerm=${encodeURIComponent(query)}&Limit=20`;
        const items = await fetchJellyfinItems(endpoint);
        renderSearchResults(items);
    } catch (e) {
        console.error(e);
        list.innerHTML = `<li style="color: red;">Error: ${e.message}</li>`;
    }
}

function renderSearchResults(items) {
    const list = document.getElementById('jf-search-results');
    list.innerHTML = '';
    
    if (!items || items.length === 0) {
        list.style.display = 'block';
        list.innerHTML = '<li style="color: #aaa; text-align: center;">No results found.</li>';
        return;
    }

    list.style.display = 'block';

    items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                 <strong>${item.Name}</strong> - ${item.AlbumArtist || 'Unknown'}
            </div>
            <button class="btn-sm" style="padding: 5px 10px; font-size: 0.8em; margin-left: 10px;">Add</button>
        `;
        
        // Add click listener to the button specifically
        li.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent any parent clicks
            e.preventDefault(); // Prevent form submit if button inside form (it shouldn't be)
            
            addItemToServer(convertJfItem(item));
            
            e.target.innerText = "Added!";
            e.target.disabled = true;
            e.target.style.backgroundColor = "#28a745";
            setTimeout(() => {
                e.target.innerText = "Add";
                e.target.disabled = false;
                e.target.style.backgroundColor = "";
            }, 1000);
        });

        list.appendChild(li);
    });
}

// --- Helpers & Connect ---

async function connectJellyfin() {
    let url = document.getElementById('jf-url').value.replace(/\/$/, "");
    const username = document.getElementById('jf-user').value;
    const password = document.getElementById('jf-pass').value;

    if (!url || !username) { alert("Please enter URL and Username"); return; }
    if (!url.match(/^https?:\/\//)) { url = 'http://' + url; }

    try {
        const authResponse = await fetch('/api/jellyfin/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseUrl: url,
                endpoint: '/Users/AuthenticateByName',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': 'MediaBrowser Client="HybridPlayer", Device="Web", DeviceId="random-id", Version="1.0.0"' },
                body: { Username: username, Pw: password }
            })
        });
        if (!authResponse.ok) throw new Error("Authentication failed");
        const authData = await authResponse.json();
        jellyfinServer = { url: url, token: authData.AccessToken, userId: authData.User.Id };
        
        // Update UI on success
        const btn = document.getElementById('jf-connect');
        btn.textContent = "Connected!";
        btn.style.backgroundColor = "#28a745";
        
        localStorage.setItem('jellyfin_url', url);
        
        // We don't fetchAndInterleaveMusic anymore, we just wait for user actions

    } catch (e) { console.error(e); alert("Connection Failed: " + e.message); }
}

async function fetchJellyfinItems(endpoint) {
    const response = await fetch('/api/jellyfin/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            baseUrl: jellyfinServer.url,
            endpoint: endpoint,
            method: 'GET',
            headers: { 'X-MediaBrowser-Token': jellyfinServer.token }
        })
    });
    const data = await response.json();
    return data.Items || [];
}

function convertJfItem(item) {
    return {
        type: 'jellyfin',
        id: item.Id,
        title: item.Name,
        artist: item.AlbumArtist || 'Unknown',
        coverId: (item.ImageTags && item.ImageTags.Primary) ? item.Id : (item.AlbumId || item.Id)
    };
}

function extractVideoID(url) {
    let videoId = null;
    try {
        // Ensure protocol is present for URL constructor
        if (!url.match(/^https?:\/\//)) {
            url = 'https://' + url;
        }

        const urlObj = new URL(url); 
        const hostname = urlObj.hostname; 
        const pathname = urlObj.pathname;
        
        if (hostname.includes('youtu.be')) { 
            videoId = pathname.slice(1); 
        } else if (hostname.includes('youtube.com')) {
            if (pathname.startsWith('/watch')) { 
                videoId = urlObj.searchParams.get('v'); 
            } else if (pathname.startsWith('/embed/')) { 
                videoId = pathname.split('/')[2]; 
            } else if (pathname.startsWith('/shorts/')) { 
                videoId = pathname.split('/')[2]; 
            }
        }
        if (videoId) { videoId = videoId.split('?')[0].split('&')[0]; }
        
        console.log(`Extracted ID: ${videoId} from URL: ${url}`);
        return videoId;
    } catch (e) { 
        console.error("ID Extraction failed:", e);
        return null; 
    }
}

// --- Render ---

function renderPlaylist(serverPlaying) {
    const list = document.getElementById('playlist');
    list.innerHTML = '';

    // Show currently playing at top if exists
    if (serverPlaying) {
        const li = document.createElement('li');
        li.classList.add('active');
        const badge = serverPlaying.type === 'youtube' ? '<span class="badge badge-yt">YT</span>' : '<span class="badge badge-jf">JF</span>';
        li.innerHTML = `<div>${badge} <strong>${serverPlaying.title}</strong> <span style="font-size:0.8em">(Now Playing)</span></div>`;
        list.appendChild(li);
    }
    
    playlist.forEach((item, index) => {
        const li = document.createElement('li');
        const badge = item.type === 'youtube' ? '<span class="badge badge-yt">YT</span>' : '<span class="badge badge-jf">JF</span>';
        li.innerHTML = `<div>${badge} <strong>${item.title}</strong> ${item.artist ? '- ' + item.artist : ''}</div>`;
        list.appendChild(li);
    });
    
    if (!serverPlaying && playlist.length === 0) {
        list.innerHTML = '<li style="text-align:center; color:#666;">Queue is empty</li>';
    }
}

// Event Listeners
// Jellyfin Connect Form
document.getElementById('jf-connect-form').addEventListener('submit', (e) => {
    e.preventDefault();
    connectJellyfin();
});

document.getElementById('btn-prev').addEventListener('click', () => { /* Not supported in simple queue */ });
document.getElementById('btn-next').addEventListener('click', () => { if(isHost) playNext(); });
document.getElementById('btn-play').addEventListener('click', () => { 
    if(isHost && !currentItem) playNext(); 
    else if (isHost) { 
         if(currentItem.type==='youtube') youtubePlayer.playVideo(); 
         else audioPlayer.play(); 
    }
});
document.getElementById('btn-pause').addEventListener('click', () => { 
    if(isHost) {
         if(currentItem && currentItem.type==='youtube') youtubePlayer.pauseVideo(); 
         else audioPlayer.pause(); 
    }
});

// YouTube Add Form
document.getElementById('add-form').addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent page reload on form submit
    addYouTubeVideo();
});

document.getElementById('btn-jf-random').addEventListener('click', addRandomJellyfinSong);

// Jellyfin Search Form
document.getElementById('jf-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    searchJellyfin();
});