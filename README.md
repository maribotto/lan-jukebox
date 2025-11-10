# lan-jukebox
![Screenshot](https://i.imgur.com/9ESDCbO.png)
This program utilizes [node.js](https://nodejs.org/en).
### Installation
```
git clone https://github.com/maribotto/lan-jukebox
cd lan-jukebox
```
```
npm install
```
To figure out your LAN IP address type:</br>
</br>
**Windows**: `ipconfig`</br>
**Linux**: `ip a`</br>
**Mac**: `ifconfig`</br>
</br>
Edit `config.json` and enter your LAN IP address. Then run:
```
node server.js
```
Open your web browser and enter `localhost:3000`. Others should use your LAN IP address.
>[!NOTE]
>Alternative port number can be configured in `server.js`.
