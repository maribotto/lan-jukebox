# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LAN Jukebox is a web application that allows LAN party guests to add YouTube videos to a shared playback queue. The host machine (identified by IP address) automatically plays videos in sequence. Also supports Jellyfin integration for hybrid playback.

## Development Commands

```bash
# Install dependencies
npm install

# Run the server
node server.js

# Run tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Build Windows executable
npm run build:win

# Build for all platforms (Windows/Linux/macOS)
npm run build:all
```

## Architecture

### Server (`server.js`)
- Express.js server with in-memory queue storage
- IP-based host identification (configured via `config.json`)
- Optional session-based authentication with bcrypt password hashing
- Serves static files from `public/` directory
- Handles both packaged (`pkg`) and development environments

### Frontend (`public/`)
- `index.html` - Main application UI
- `hybrid_player.js` - Player logic supporting YouTube and Jellyfin
- `login.html` - Authentication page (when `requireLogin` enabled)

### API Endpoints
- `GET /api/status` - Returns host/guest status based on client IP
- `POST /api/add` - Add video/item to queue (validates YouTube embeddability via oEmbed)
- `POST /api/next` - Get next video (host only)
- `POST /api/delete` - Remove video from queue (host only)
- `GET /api/queue` - Get current queue and currently playing item
- `POST /api/login` / `POST /api/logout` - Authentication
- `POST /api/jellyfin/proxy` - CORS bypass for Jellyfin API calls
- `GET /api/jellyfin/image-proxy` - Image proxy for Jellyfin thumbnails

### Tests (`__tests__/`)
- `api.test.js` - Core API endpoint tests
- `auth.test.js` - Authentication flow tests
- `auth-disabled.test.js` - Tests with auth disabled
- Uses Jest and Supertest

### Configuration
`config.json` (copy from `config.example.json`):
- `hostIp` - Required. IP/hostname of machine that controls playback
- `port` - Optional. Default: 3000
- `trustProxy` - Set `true` when behind reverse proxy
- `requireLogin`, `username`, `passwordHash`, `sessionSecret` - Authentication options

## Key Implementation Details

- Host identification uses `resolvedHostIp` which can be either direct IP or resolved from hostname
- Queue is stored in memory (`queue` array, `currentlyPlaying` object)
- YouTube video validation uses oEmbed API with NoEmbed fallback
- The `requireAuth` middleware protects routes when login is enabled
- The `isHost()` function checks client IP against configured host IP and localhost variants
