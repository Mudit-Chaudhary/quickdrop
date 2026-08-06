<h1 align="center" style="font-size: 42px">
  <img src="src/main/resources/static/img/README-brand.svg" alt="QuickDrop" width="420" style="vertical-align: middle">
</h1>

> Share files directly, browser-to-browser. No uploads, no file-size limits, nothing stored on a server.

QuickDrop is a peer-to-peer file sharing app: drop a file, share the room link, and it streams **directly** to the other person over WebRTC. The server only helps two browsers find each other — the file itself never touches it.

- 📁 **No file size limits** — files stream in chunks straight from disk
- 🔒 **Encrypted in transit** — WebRTC data channels are encrypted by default (DTLS)
- 🌓 **Light/dark theme**, drag-and-drop upload
- ⚡ **Direct transfer** — no upload-then-download round trip through a server

---

## How it works

```
Sender              Server              Receiver
  │                    │                    │
  ├── create room ────►│                    │
  │                    │◄──── join room ────┤
  │                    │                    │
  ├──── WebRTC signaling (SDP + ICE) ───────┤
  │                    │                    │
  ├════ direct P2P connection, file streams ═┤
```

The Spring Boot backend's only job is **signaling**: a `/signal` WebSocket endpoint relays room creation, joins, and WebRTC offer/answer/ICE-candidate messages between the two browsers. Once the `RTCDataChannel` is open, the file is sliced into 16 KB chunks on the sender's side and streamed straight to the peer.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Java 21 + Spring Boot 3.2.5 (virtual threads enabled) |
| Signaling | Spring WebSocket (`/signal`), JSON messages via Gson |
| Frontend | HTML + Tailwind CSS (Material 3 design tokens) + vanilla JS |
| P2P transfer | WebRTC (`RTCPeerConnection` + `RTCDataChannel`) |
| NAT traversal | Google public STUN servers only — **no TURN server** (see Limitations) |
| Build | Maven |
| Container | Docker, multi-stage build, runs as non-root user |
| Tests | JUnit 5 + Mockito unit tests (controller, service, signaling, keepalive) |

---

## Run it yourself

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

Or with Docker Compose: `docker compose up`.

### Test across devices

Open QuickDrop on **two devices** (or two tabs on the same device) → create a room on one → open the room link on the other → the file streams directly between them.

To test across devices on the same network, find your local IP:

- **Linux:** `ip addr show | grep 'inet ' | grep -v 127.0.0.1`
- **macOS:** `ifconfig | grep 'inet ' | grep -v 127.0.0.1`
- **Windows:** `ipconfig`

Then open `http://<your-local-ip>:8080` on the other device.

### Run the tests

```bash
mvn test
```

### Deploy to Render

The repo includes a `render.yaml` Blueprint, so Render can pick up most config automatically:

1. Push to GitHub
2. Render Dashboard → **New Blueprint** (or **New Web Service**) → connect your fork of the repo
3. Render provisions it with the **Docker** runtime and wires up `BASE_URL` and `KEEPALIVE_INTERVAL` automatically from `render.yaml`
4. Optionally set up an external cron ping (e.g. cron-job.org) to hit `/health` periodically — Render's free tier spins down idle services, and the built-in keepalive only helps once the app is already awake

---

## Project structure

```
src/
├── main/
│   ├── java/com/quickdrop/
│   │   ├── QuickDropApplication.java     # Entry point
│   │   ├── config/
│   │   │   └── WebSocketConfig.java      # WS mapping (/signal)
│   │   ├── controller/
│   │   │   └── PageController.java       # Pages + /health
│   │   ├── model/
│   │   │   └── Room.java                 # Room model
│   │   ├── service/
│   │   │   ├── RoomService.java          # Room lifecycle
│   │   │   └── KeepaliveService.java     # Self-ping (anti-sleep)
│   │   └── websocket/
│   │       └── SignalingHandler.java     # WebRTC signaling relay
│   └── resources/
│       ├── application.properties
│       └── static/
│           ├── index.html                # UI (home / room / joining views)
│           ├── css/                      # Compiled Tailwind + custom styles
│           └── js/app.js                 # WebRTC + WebSocket client
└── test/java/com/quickdrop/              # JUnit tests (controller, service, WebSocket)
```

---

## Known limitations

- **No TURN server.** Only public STUN servers are configured, so peer discovery works but there's no relay fallback. Two peers behind strict/symmetric NATs or restrictive corporate firewalls may fail to connect directly.
- **Rooms are in-memory.** Room state lives in the Spring Boot process (`ConcurrentHashMap`), so it doesn't survive a restart and won't scale across multiple instances without a shared store.
- **Free-tier hosting sleeps.** On Render's free plan the service spins down after inactivity; the built-in `KeepaliveService` only pings once already running, so an external cron ping is still needed to prevent the initial cold start.

---

## Why QuickDrop?

- 🔒 **Privacy first** — files never touch a server, only signaling metadata does
- 🆓 **Free and open** — no signups, no limits
- ✨ **Ephemeral** — close the tab and the room is gone

---

## License

[MIT](LICENSE) — do whatever you want, just don't be evil.

---

<p align="center">
  Made by <a href="https://github.com/Mudit-Chaudhary">Mudit-Chaudhary</a>
  <br>
  <sub>Files should fly, not be stored in the cloud.</sub>
</p>
