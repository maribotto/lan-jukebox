LAN YouTube Jukebox - Windows Executable
=========================================

Quick Start:
------------
1. Copy config.example.json to config.json
2. Edit config.json and set your host machine's IP address
3. Run lan-jukebox.exe
4. Open http://localhost:3000 in your browser

Configuration:
--------------
The config.json file must be in the same directory as lan-jukebox.exe

Example config.json:
{
  "hostIp": "192.168.1.100",
  "trustProxy": false
}

- hostIp: Replace "192.168.1.100" with your actual host machine's IP address
- trustProxy: Set to true ONLY when using a reverse proxy (Caddy/Nginx).
  WARNING: Enabling this without a proxy is a security risk!
- requireLogin: Set to true to enable login authentication (recommended for internet use)
- username: Login username (only used if requireLogin is true)
- passwordHash: Bcrypt password hash (default password is "admin")
  Use generate-password.js to create your own secure password hash!

Finding Your IP Address:
-------------------------
Open Command Prompt and run: ipconfig
Look for "IPv4 Address" under your network adapter.

Usage:
------
- Host machine: Click "START PLAYER" to begin playback
- All users: Can add YouTube videos to the queue
- Host only: Can skip and remove videos

Port Configuration:
-------------------
Default port is 3000. To change it, you'll need to run from source.

For more information, visit:
https://github.com/maribotto/lan-jukebox
