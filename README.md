# lan-jukebox
![Screenshot](https://i.imgur.com/9ESDCbO.png)
This program utilizes [node.js](https://nodejs.org/en).
### Installation
```
git clone https://github.com/maribotto/lan-jukebox && cd lan-jukebox
```
```
npm install
node server.js
``````
To figure out your LAN IP address type:</br>
</br>
**Windows**: `ipconfig`</br>
**Linux**: `ip a`</br>
**Mac**: `ifconfig`</br>
</br>
Edit `config.json` and enter your LAN IP address. Open your web browser and enter `localhost:3000`. Others should use your LAN IP address.</br>
</br>
Alternative port number can be configured in `server.js`. Theoretically nothing prevents you from hosting this online.
