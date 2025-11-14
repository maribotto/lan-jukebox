# 🎬 LAN YouTube Jukebox

A web application that allows LAN party guests to add YouTube videos to a shared playback queue. The host machine (identified by IP address) automatically plays the videos in sequence.

- Utilizes [node.js](https://nodejs.org) (`npm` and `node` commands)
- Install easily using [Docker](https://www.docker.com/)

![LAN Jukebox Screenshot](images/screenshot.jpg)

[![Docker Hub](https://img.shields.io/docker/pulls/kaanders/lan-jukebox?logo=docker)](https://hub.docker.com/r/kaanders/lan-jukebox)

## ✨ Features

- 🎵 **Automatic playback** - Host machine plays videos in order
- 🚫 **Embed validation** - Blocks non-embeddable videos at submission time
- ⏭️ **Auto-skip** - Automatically skips videos that fail to start within 10 seconds
- ❌ **Clear error messages** - Displays YouTube error codes with explanations
- 🔒 **IP-based authentication** - Only the host can control playback
- 📱 **Responsive design** - Works on mobile devices

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

### Docker Hub (Easiest)

Pull and run the pre-built image directly from [Docker Hub](https://hub.docker.com/r/kaanders/lan-jukebox):

```
docker pull kaanders/lan-jukebox:latest
docker run -d -p 3000:3000 -v $(pwd)/config.json:/app/config.json:ro kaanders/lan-jukebox:latest
```

### Docker Compose (Recommended)

1. **Create config.json**
   ```
   echo '{"hostIp":"192.168.1.100"}' > config.json
   ```
   Replace the IP with your host machine's IP address.

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

1. **Build image**
   ```
   docker build -t lan-jukebox .
   ```

2. **Run container**
   ```
   docker run -d \
     -p 3000:3000 \
     -v $(pwd)/config.json:/app/config.json:ro \
     --name lan-jukebox \
     lan-jukebox
   ```

3. **Stop**
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
   {"hostIp":"192.168.1.100"}
   ```

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
  "hostIp": "192.168.50.200"
}
```

- `hostIp`: IP address of the host machine that controls playback

## 🐛 Troubleshooting

**Videos won't play:**
- Verify you're on the host machine (IP matches config.json)
- Click the "START PLAYER" button
- Check browser console (F12) for errors

**"Video embedding not allowed":**
- Video owner has disabled embedding
- Application blocks these automatically during submission

**Container won't start:**
- Check if port 3000 is available: `lsof -i :3000`
- Verify config.json exists and is valid JSON

## 📄 License

Free to use for LAN parties and other fun projects!
