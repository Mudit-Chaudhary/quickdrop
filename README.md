# ⚡ QuickDrop

> **Share files instantly. Directly. Privately.**  
> No uploads. No servers. No limits. Just pure peer-to-peer magic.

---

## ✨ What is QuickDrop?

QuickDrop is a **browser-to-browser file sharing app** — like ToffeeShare, but yours.  
Drop a file, share the link, and it streams **directly** to the other person. Nothing touches a server. Your data never leaves your devices.

📁 **No file size limits**  
🔒 **End-to-end encrypted** (DTLS via WebRTC)  
🌍 **Works across the globe**  
⚡ **Blazing fast** — the shortest path between peers  

---

## 💡 How it works

```
Sender                    Receiver
  │                          │
  ├─ Create Room ───────────►│
  │     WebSocket            │
  │     Signaling            │
  │◄── Join Room ────────────┤
  │                          │
  ├─── WebRTC Handshake ────►│
  │   (SDP + ICE)            │
  │◄── Answer ───────────────┤
  │                          │
  ├─── DataChannel Open ────►│
  │   Connected              │
  │                          │
  │   ┌──────────────────┐   │
  │   │  FILE STREAMS    │   │
  │   │  P2P DIRECTLY   │   │
  │   └──────────────────┘   │
  │◄─────────────────────────►│
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 + Spring Boot 3.2.5 |
| Signaling | WebSocket (Spring WebSocket support) |
| Frontend | HTML5 + CSS3 + Vanilla JS |
| P2P Transfer | WebRTC (RTCDataChannel) |
| Build | Maven |
| Container | Docker / multi-stage build |
| Deploy | Render / Koyeb / any cloud |

---

## 🚀 Run it yourself

QuickDrop runs two ways — build with **Maven**, or use **Docker**.

### 1. Maven

```bash
# Build
mvn clean package -DskipTests

# Run
java -jar target/quickdrop-1.0.0.jar

# Open -> http://localhost:8080
```

### 2. Docker

```bash
# Build
docker build -t quickdrop .

# Run
docker run -p 8080:8080 quickdrop

# Open -> http://localhost:8080
```

### Test across devices

Open on **two devices** (or two tabs on the same device) -> create a room on one -> open the link on the other -> files transfer directly!

To test across devices on the same WiFi, find your local IP:

- **Linux:** `ip addr show | grep 'inet ' | grep -v 127.0.0.1`
- **macOS:** `ifconfig | grep 'inet ' | grep -v 127.0.0.1`
- **Windows:** `ipconfig`

Then open `http://<your-local-ip>:8080` on the other device.

### Deploy to Render

1. Push to GitHub
2. Render Dashboard -> **New Web Service** -> Connect your repo
3. Use **Docker** runtime
4. Add env vars:
   - `KEEPALIVE_INTERVAL` -> `600000`
5. Set up **cron-job.org** to ping `/health` every 10 min -> keeps it awake

### Deploy to Koyeb

1. Push to GitHub
2. Koyeb Dashboard -> **Create Web Service** -> Connect repo
3. Auto-detects Java/Maven -- no config needed

---

## 📁 Project Structure

```
src/main/
├── java/com/quickdrop/
│   ├── QuickDropApplication.java     # Entry point
│   ├── config/
│   │   └── WebSocketConfig.java      # WS mapping (/signal)
│   ├── controller/
│   │   └── PageController.java       # Pages + /health
│   ├── model/
│   │   └── Room.java                 # Room model
│   ├── service/
│   │   ├── RoomService.java          # Room lifecycle
│   │   └── KeepaliveService.java     # Self-ping (anti-sleep)
│   └── websocket/
│       └── SignalingHandler.java     # WebRTC signaling relay
└── resources/
    ├── application.properties
    └── static/
        ├── index.html                # UI
        ├── css/style.css             # Dark theme
        └── js/app.js                 # WebRTC + WS client
```

---

## Why QuickDrop?

- 🔒 **Privacy first** -- No files ever touch a server
- 🆓 **Completely free** -- No signups, no limits
- 🌍 **Universal** -- Works on any modern browser
- ✨ **Ephemeral** -- Close the tab, it's gone forever

---

## License

MIT -- do whatever you want, just don't be evil.

---

<p align="center">
  Made by <a href="https://github.com/Mudit-Chaudhary">Mudit-Chaudhary</a>
  <br>
  <sub>Files should fly, not be stored in the cloud.</sub>
</p>
