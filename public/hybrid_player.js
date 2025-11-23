// Hybrid Player Logic

// --- State ---
let playlist = [
    { type: 'youtube', id: '5qap5aO4i9A', title: 'Lofi Girl - beats to relax/study to' },
    // Jellyfin items will be added dynamically or hardcoded for test
    // { type: 'jellyfin', id: 'ITEM_ID', title: 'Jellyfin Song', artist: 'Artist' } 
];

let currentIndex = -1;
let youtubePlayer;
let jellyfinServer = { url: '', token: '', userId: '' };
const audioPlayer = document.getElementById('audio-player');

// --- Initialization ---

function onYouTubeIframeAPIReady() {
    youtubePlayer = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'playsinline': 1,
            'controls': 0, // We use custom controls
            'disablekb': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    console.log("YouTube Player Ready");
    renderPlaylist();
}

function onPlayerStateChange(event) {
    // YT.PlayerState.ENDED = 0
    if (event.data === 0) {
        playNext();
    }
}

// --- Audio Player (Jellyfin) Events ---
audioPlayer.addEventListener('ended', () => {
    playNext();
});

// --- Controller Logic ---

function loadMedia(index) {
    if (index < 0 || index >= playlist.length) return;
    
    currentIndex = index;
    const item = playlist[currentIndex];
    renderPlaylist();

    // Reset UI
    document.getElementById('youtube-player').style.display = 'none';
    document.getElementById('jellyfin-player-visual').style.display = 'none';
    
    // Stop both initially
    if(youtubePlayer && youtubePlayer.stopVideo) youtubePlayer.stopVideo();
    audioPlayer.pause();

    if (item.type === 'youtube') {
        // Play YouTube
        document.getElementById('youtube-player').style.display = 'block';
        youtubePlayer.loadVideoById(item.id);
    } else if (item.type === 'jellyfin') {
        // Play Jellyfin
        playJellyfinItem(item);
    }
}

function playNext() {
    if (currentIndex + 1 < playlist.length) {
        loadMedia(currentIndex + 1);
    } else {
        console.log("End of playlist");
    }
}

function playPrev() {
    if (currentIndex - 1 >= 0) {
        loadMedia(currentIndex - 1);
    }
}

// --- Jellyfin Integration ---

async function connectJellyfin() {
    const url = document.getElementById('jf-url').value.replace(/\/$/, "");
    const username = document.getElementById('jf-user').value;
    const password = document.getElementById('jf-pass').value;

    if (!url || !username) {
        alert("Please enter URL and Username");
        return;
    }

    try {
        // Authenticate
        const authResponse = await fetch(`${url}/Users/AuthenticateByName`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Emby-Authorization': 'MediaBrowser Client="HybridPlayer", Device="Web", DeviceId="random-id", Version="1.0.0"'
            },
            body: JSON.stringify({ Username: username, Password: password })
        });

        if (!authResponse.ok) throw new Error("Authentication failed");

        const authData = await authResponse.json();
        jellyfinServer = {
            url: url,
            token: authData.AccessToken,
            userId: authData.User.Id
        };

        alert(`Connected to ${authData.ServerId}! Loading music...`);
        
        // Fetch random music to interleave
        await fetchAndInterleaveMusic();

    } catch (e) {
        console.error(e);
        alert("Jellyfin Connection Failed: " + e.message);
    }
}

async function fetchAndInterleaveMusic() {
    // Fetch latest music or favorites
    const url = `${jellyfinServer.url}/Users/${jellyfinServer.userId}/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=Random&Limit=10`;
    
    const response = await fetch(url, {
        headers: { 'X-MediaBrowser-Token': jellyfinServer.token }
    });
    
    const data = await response.json();
    const jfItems = data.Items;

    // Interleave logic: Insert a JF song after every YouTube song
    let newPlaylist = [];
    let jfIndex = 0;
    
    // Keep existing items, interleave new ones
    // For this prototype, we just rebuild the playlist
    // Start with a default YouTube video if empty
    if (playlist.length === 0) {
         playlist.push({ type: 'youtube', id: '5qap5aO4i9A', title: 'Lofi Girl' });
    }

    playlist.forEach((ytItem) => {
        newPlaylist.push(ytItem);
        if (jfIndex < jfItems.length) {
            const jfItem = jfItems[jfIndex];
            newPlaylist.push({
                type: 'jellyfin',
                id: jfItem.Id,
                title: jfItem.Name,
                artist: jfItem.AlbumArtist || 'Unknown',
                coverId: jfItem.Id // Usually same ID for primary image
            });
            jfIndex++;
        }
    });

    // Add remaining JF items
    while (jfIndex < jfItems.length) {
        const jfItem = jfItems[jfIndex];
        newPlaylist.push({
            type: 'jellyfin',
            id: jfItem.Id,
            title: jfItem.Name,
            artist: jfItem.AlbumArtist || 'Unknown',
            coverId: jfItem.Id
        });
        jfIndex++;
    }

    playlist = newPlaylist;
    renderPlaylist();
}

function playJellyfinItem(item) {
    const streamUrl = `${jellyfinServer.url}/Audio/${item.id}/stream?static=true&api_key=${jellyfinServer.token}`;
    const coverUrl = `${jellyfinServer.url}/Items/${item.coverId}/Images/Primary?maxHeight=400&maxWidth=400&quality=90`;

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

// --- UI Rendering ---

function renderPlaylist() {
    const list = document.getElementById('playlist');
    list.innerHTML = '';
    
    playlist.forEach((item, index) => {
        const li = document.createElement('li');
        if (index === currentIndex) li.classList.add('active');
        
        const badge = item.type === 'youtube' ? '<span class="badge badge-yt">YT</span>' : '<span class="badge badge-jf">JF</span>';
        
        li.innerHTML = `
            <div>
                ${badge} <strong>${item.title}</strong> ${item.artist ? '- ' + item.artist : ''}
            </div>
        `;
        li.onclick = () => loadMedia(index);
        list.appendChild(li);
    });
}

// --- Event Listeners ---
document.getElementById('jf-connect').addEventListener('click', connectJellyfin);
document.getElementById('btn-prev').addEventListener('click', playPrev);
document.getElementById('btn-next').addEventListener('click', playNext);
document.getElementById('btn-play').addEventListener('click', () => {
    if (currentIndex === -1) loadMedia(0);
    else {
        if (playlist[currentIndex].type === 'youtube') youtubePlayer.playVideo();
        else audioPlayer.play();
    }
});
document.getElementById('btn-pause').addEventListener('click', () => {
    if (playlist[currentIndex].type === 'youtube') youtubePlayer.pauseVideo();
    else audioPlayer.pause();
});

renderPlaylist();
