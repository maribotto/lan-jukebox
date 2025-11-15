# 🎬 LAN YouTube Jukebox

A web application that allows LAN party guests to add YouTube videos to a shared playback queue. The host machine (identified by IP address) automatically plays the videos in sequence.

- Utilizes [node.js](https://nodejs.org) (`npm` and `node` commands)
- Install easily using [Docker](https://www.docker.com/)
- Windows `.exe` provided in the **Releases** section

![LAN Jukebox Screenshot](images/screenshot.jpg)

[![Tests](https://github.com/maribotto/lan-jukebox/actions/workflows/test.yml/badge.svg)](https://github.com/maribotto/lan-jukebox/actions/workflows/test.yml)
[![Docker Hub](https://img.shields.io/docker/pulls/maribotto/lan-jukebox?logo=docker)](https://hub.docker.com/r/maribotto/lan-jukebox)

## ✨ Features

- 🎵 **Automatic playback** - Host machine plays videos in order
- 🚫 **Embed validation** - Blocks non-embeddable videos at submission time
- ⏭️ **Auto-skip** - Automatically skips videos that fail to start within 10 seconds
- ❌ **Clear error messages** - Displays YouTube error codes with explanations
- 🔒 **IP-based authentication** - Only the host can control playback
- 📱 **Responsive design** - Works on mobile devices

## 🧩 Browser Extensions

Add YouTube videos to your LAN Jukebox directly from the YouTube website:

- **Chrome/Edge Extension**: [lan-jukebox-extension](https://github.com/maribotto/lan-jukebox-extension)
- **Firefox Extension**: [lan-jukebox-extension-firefox](https://github.com/maribotto/lan-jukebox-extension-firefox)

## 🚀 Quick Start

### How to figure out your LAN IP address

  **Windows**:
  ```
  ipconfig
  ```

  **Linux**:
  ```
  ip addr show
  ```

  **Mac**:
  ```
  ifconfig | grep "inet"
  ```

  **💡 Tip**: Instead of using IP addresses, you can use your computer's hostname! Most systems support `.local` mDNS names (e.g., `my-computer.local`). The server will display this address when it starts.

### Docker Hub (Easiest)

Pull and run the pre-built image directly from [Docker Hub](https://hub.docker.com/r/maribotto/lan-jukebox):

1. **Download and create config.json**
   ```
   curl -o config.json https://raw.githubusercontent.com/maribotto/lan-jukebox/main/config.example.json
   ```
   Then edit `config.json` and replace the IP with your host machine's IP address.

2. **Pull and run**
   ```
   docker pull maribotto/lan-jukebox:latest
   docker run -d -p 3000:3000 -v $(pwd)/config.json:/app/config.json:ro maribotto/lan-jukebox:latest
   ```

### Docker Compose (Recommended)

1. **Create config.json**
   ```
   cp config.example.json config.json
   ```
   Then edit `config.json` and replace the IP with your host machine's IP address.

2. **Start the container**
   ```
   docker compose up -d
   ```

3. **Open in browser**
   - Host: `http://localhost:3000`
   - Guests: `http://YOUR-HOST-IP:3000`

4. **Stop the container**
   ```
   docker compose down
   ```

### Docker CLI (without compose)

1. **Create config.json**

   If you cloned the repository:
   ```
   cp config.example.json config.json
   ```

   Or download directly:
   ```
   curl -o config.json https://raw.githubusercontent.com/maribotto/lan-jukebox/main/config.example.json
   ```

   Then edit `config.json` and replace the IP with your host machine's IP address.

2. **Build image**
   ```
   docker build -t lan-jukebox .
   ```

3. **Run container**
   ```
   docker run -d \
     -p 3000:3000 \
     -v $(pwd)/config.json:/app/config.json:ro \
     --name lan-jukebox \
     lan-jukebox
   ```

4. **Stop**
   ```
   docker stop lan-jukebox
   docker rm lan-jukebox
   ```

### Traditional Node.js Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create config.json**
   ```
   cp config.example.json config.json
   ```
   Then edit `config.json` with your host machine's IP address.

3. **Start the server**
   ```
   node server.js
   ```

## 🎮 Usage

1. **On host machine**: Press "START PLAYER" to initialize the player
2. **Anyone can**: Add YouTube links to the queue
3. **Host can**: Skip videos and remove videos from the queue

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, YouTube IFrame API
- **Validation**: YouTube oEmbed API
- **Container**: Docker

## 📝 API Endpoints

- `GET /api/status` - Returns whether requester is host or guest
- `POST /api/add` - Add video to queue (all users)
- `POST /api/next` - Get next video (host only)
- `POST /api/delete` - Remove video from queue (host only)
- `GET /api/queue` - Get current queue (all users)

## 🔧 Configuration

**config.json**:
```
{
  "hostIp": "192.168.50.200",
  "port": 3000
}
```

- `hostIp`: IP address or hostname of the host machine that controls playback (e.g., `"192.168.1.100"` or `"my-computer.local"`)
- `port` (optional): Port number for the server. Default: `3000`
- `trustProxy` (optional): Set to `true` when using a reverse proxy like Caddy or Nginx. Default: `false`
- `requireLogin` (optional): Set to `true` to require authentication. Default: `false`
- `username` (optional): Username for login. Only used if `requireLogin` is `true`
- `passwordHash` (optional): Bcrypt hash of the password. Only used if `requireLogin` is `true`
- `sessionSecret` (optional): Secret key for session encryption. Auto-generated if not provided

### Login Authentication

Enable login authentication to protect your jukebox when exposed to the internet:

**1. Generate a password hash:**

Choose one of the following methods:

**Method A: Using Node.js (if installed)**
```bash
node generate-password.js yourSecurePassword123
```

**Method B: Using standalone executable (Windows/Linux/macOS)**

If you're using the .exe version or don't have Node.js installed, use the standalone password generator:

- **Windows**: `generate-password.exe yourSecurePassword123`
- **Linux/macOS**: `./generate-password yourSecurePassword123`

The executables are included in the releases or can be built with:
```bash
npm run build:password-gen
```

**Method C: Online bcrypt generator**

Visit: https://bcrypt-generator.com/
- Enter your password
- Use cost factor: **10**
- Copy the generated hash

**Method D: Using Python**
```bash
pip install bcrypt
python -c "import bcrypt; print(bcrypt.hashpw(b'yourPassword', bcrypt.gensalt(rounds=10)).decode())"
```

**2. Update config.json:**
```
{
  "hostIp": "192.168.1.100",
  "trustProxy": false,
  "requireLogin": true,
  "username": "admin",
  "passwordHash": "$2b$10$...",
  "sessionSecret": "your-random-secret-key"
}
```

**3. Default credentials (for testing):**
- Username: `admin`
- Password: `admin`
- Hash in `config.example.json`

> [!WARNING]
> Always change the default password in production! Use `generate-password.js` to create a secure password hash.

### Using with Reverse Proxy (Caddy)

To expose the jukebox to the internet with HTTPS:

1. **Install Caddy** on your server
   ```
   https://caddyserver.com/docs/install
   ```

2. **Update config.json**
   ```
   {
     "hostIp": "YOUR_PUBLIC_IP_OR_DOMAIN",
     "trustProxy": true,
     "requireLogin": true,
     "username": "admin",
     "passwordHash": "$2b$10$...",
     "sessionSecret": "your-random-secret-key"
   }
   ```

   > Use `generate-password.js` to create your password hash

3. **Create Caddyfile** (see `Caddyfile.example`)
   ```
   yourdomain.com {
       reverse_proxy localhost:3000
   }
   ```

4. **Start Caddy**
   ```
   caddy run
   ```

Caddy automatically:
- Obtains SSL certificates from Let's Encrypt
- Redirects HTTP to HTTPS
- Forwards client IP addresses to the app

> [!WARNING]
> Only enable `trustProxy: true` when using a reverse proxy. Enabling it without a proxy is a **security risk** as clients can spoof their IP addresses.

## 🐛 Troubleshooting

**Videos won't play:**
- Verify you're on the host machine (IP matches config.json)
- Click the "START PLAYER" button
- Check browser console (F12) for errors
- **See [Video Restrictions](#️-video-restrictions)** for common reasons videos fail

**"Video embedding not allowed" or Error 101/150:**
- Video owner has disabled embedding, or video is age-restricted/region-locked
- Try finding an alternative version (lyric video, cover, or re-upload)
- Application attempts to block these during submission, but some slip through
- **Full details:** [Video Restrictions](#️-video-restrictions)

**Videos auto-skip after 10 seconds:**
- This is normal behavior for videos that fail to start playback
- Usually caused by age restrictions, embedding restrictions, or Premium content
- Check the error code displayed on screen (see [Error Codes Reference](#error-codes-reference))

**Container won't start:**
- Check if port 3000 is available: `lsof -i :3000`
- Verify config.json exists and is valid JSON
- Ensure public/ folder is in the correct location

**Authentication not working:**
- Verify `requireLogin: true` in config.json
- Check password hash was generated correctly with bcrypt cost factor 10
- Clear browser cookies and try logging in again
- Check server logs for authentication errors

## ⚠️ Video Restrictions

Due to YouTube's embedding limitations, **some videos cannot be played** in the jukebox. The application validates videos before adding them to the queue, but certain restrictions cannot be detected in advance.

### Videos That Won't Work

The following types of videos will fail to play or auto-skip:

- **🔞 Age-restricted content** - Requires YouTube login (not possible in embedded player)
- **🎵 Music videos with restrictions** - Many music videos are blocked by record labels (VEVO, UMG, etc.)
- **💎 YouTube Premium/Music exclusive content** - Requires paid subscription
- **🚫 Embedding disabled by owner** - Video owner has explicitly disabled embedding
- **🌍 Region-locked content** - Videos restricted to certain countries
- **🔒 Private or unlisted videos** - Not accessible through embed player
- **❌ Deleted or removed videos** - No longer available

### What Happens When a Video Can't Play

1. **At submission:** Videos that are clearly non-embeddable are rejected with an error message
2. **At playback:** If a video fails to start within 10 seconds, it automatically skips to the next video
3. **On error:** YouTube error codes are displayed with explanations (e.g., Error 101: Embedding disabled)

### Tips for Best Results

- ✅ **Use official music uploads** from artists' channels rather than topic channels
- ✅ **Test videos first** by checking if they can be embedded on other websites
- ✅ **Avoid "Auto-Generated" topic videos** - these are often restricted
- ✅ **Use lyric videos or covers** as alternatives to official music videos
- ✅ **Check for "Made for Kids" restrictions** - these may have limited embedding

### Error Codes Reference

Common YouTube player error codes:

- **Error 2:** Invalid video ID or malformed URL
- **Error 5:** HTML5 player error (browser compatibility)
- **Error 100:** Video not found, private, or deleted
- **Error 101:** Embedding disabled or age-restricted
- **Error 150:** Embedding disabled or region-locked

## 📄 License

Free to use for LAN parties and other fun projects!
