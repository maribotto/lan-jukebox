# LAN Jukebox

A collaborative YouTube jukebox designed for LAN parties and local networks. Guests can add videos to a shared queue, and the host machine automatically plays them in sequence.

## Project Overview

This is a **Node.js** web application built with **Express**. It serves a frontend that uses the **YouTube IFrame API** for playback and queue management.

### Key Features
- **Shared Queue:** Multiple users (guests) can add videos.
- **Host Playback:** Only the host machine plays the video content.
- **Validation:** Checks for embeddable videos before adding to the queue.
- **Hybrid Player (Prototype):** Experimental feature to interleave local media (Jellyfin) with YouTube videos.

## Architecture

- **Backend:** `server.js` - Handles API requests, queue management, and serving static files.
- **Frontend:** `public/` - Vanilla JavaScript and HTML.
  - `index.html`: Main player and queue interface.
  - `hybrid_player.html`: **(New)** Prototype for mixed YouTube/Jellyfin playback.
- **Configuration:** `config.json` - Stores host IP, port, and authentication settings.
- **Deployment:** Docker support via `Dockerfile` and `docker-compose.yml`.

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- NPM

### Installation

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Configuration:**
    Copy `config.example.json` to `config.json` and update the `hostIp` to your machine's LAN IP address.
    ```bash
    cp config.example.json config.json
    # Edit config.json
    ```

3.  **Run the Server:**
    ```bash
    node server.js
    ```
    The server typically runs on `http://localhost:3000`.

### Testing
Run the Jest test suite:
```bash
npm test
```

## Hybrid Player (Experimental)

A new "Hybrid Player" is being developed to support Jellyfin integration.
- **Location:** `public/hybrid_player.html`
- **Logic:** `public/hybrid_player.js`
- **Functionality:** Connects to a Jellyfin server, fetches music, and interleaves it with the YouTube queue.

## Build

The project uses `pkg` to create standalone executables:
```bash
npm run build:all
```
Output binaries will be in the `dist/` folder.
