const STUN_SERVERS = [
    { url: 'stun:stun.l.google.com:19302', priority: 1 },
    { url: 'stun:stun1.l.google.com:19302', priority: 2 },
];

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

let ws = null;
let pc = null;
let dc = null;
let roomId = null;
let isCreator = null;
let pendingFileQueue = [];
let currentTransfer = null;
let peerConnected = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let intentionalClose = false;

const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${location.host}/signal`;

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function connectWebSocket() {
    if (ws) return;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        reconnectAttempts = 0;
        updateStatus('Connected', 'connected');
        if (roomId) {
            if (isCreator) {
                sendSignal({ type: 'create-room' });
            } else {
                sendSignal({ type: 'join-room', roomId });
            }
        }
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleSignalMessage(msg);
    };

    ws.onclose = () => {
        ws = null;
        updateStatus('Disconnected', 'disconnected');
        peerConnected = false;
        updatePeerStatus('');
        if (pc) { pc.close(); pc = null; dc = null; }

        if (!intentionalClose && (roomId || document.querySelector('#room-view.active') || document.querySelector('#joining-view.active'))) {
            scheduleReconnect();
        }
    };

    ws.onerror = () => {
        updateStatus('Connection error', 'disconnected');
    };
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    updateStatus(`Reconnecting in ${Math.round(delay/1000)}s...`, 'disconnected');
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
    }, delay);
}

function updateStatus(text, className) {
    const el = document.getElementById('room-status');
    el.textContent = text;
    el.className = className || '';
}

function updatePeerStatus(text, className) {
    const el = document.getElementById('peer-status');
    if (!text) {
        el.textContent = '';
        el.className = '';
        return;
    }
    el.textContent = text;
    el.className = className || '';
}

function handleSignalMessage(msg) {
    switch (msg.type) {
        case 'room-created':
            roomId = msg.roomId;
            isCreator = true;
            const link = `${location.origin}/room/${roomId}`;
            document.getElementById('room-link').value = link;
            showView('room-view');
            updateStatus('Waiting for peer...');
            createPeerConnection();
            break;

        case 'room-joined':
            roomId = msg.roomId;
            isCreator = false;
            document.getElementById('room-link').value = `${location.origin}/room/${roomId}`;
            showView('room-view');
            updateStatus('Connected to room');
            createPeerConnection();
            break;

        case 'peer-joined':
            updatePeerStatus('Peer connected', 'connected');
            updateStatus('Peer joined');
            if (isCreator) {
                createOffer();
            }
            break;

        case 'offer':
            if (!isCreator && msg.sdp) {
                pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }))
                    .then(() => pc.createAnswer())
                    .then(answer => pc.setLocalDescription(answer))
                    .then(() => {
                        sendSignal({ type: 'answer', sdp: pc.localDescription.sdp });
                    })
                    .catch(err => console.error('Error handling offer:', err));
            }
            break;

        case 'answer':
            if (isCreator && msg.sdp) {
                pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }))
                    .catch(err => console.error('Error setting remote description:', err));
            }
            break;

        case 'ice-candidate':
            if (msg.candidate && pc) {
                pc.addIceCandidate(new RTCIceCandidate(JSON.parse(msg.candidate)))
                    .catch(err => console.error('Error adding ICE candidate:', err));
            }
            break;

        case 'peer-disconnected':
            updatePeerStatus('Peer disconnected', '');
            updateStatus('Peer left');
            peerConnected = false;
            if (pc) {
                pc.close();
                pc = null;
            }
            break;

        case 'error':
            alert(msg.message || 'An error occurred');
            showView('home-view');
            break;
    }
}

function sendSignal(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function createPeerConnection() {
    const config = { iceServers: STUN_SERVERS };
    pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignal({
                type: 'ice-candidate',
                candidate: JSON.stringify(event.candidate),
            });
        }
    };

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            peerConnected = true;
            updatePeerStatus('Peer connected', 'connected');
            processQueue();
        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            peerConnected = false;
            updatePeerStatus('Peer disconnected');
        }
    };

    pc.ondatachannel = (event) => {
        dc = event.channel;
        setupDataChannel();
    };

    if (isCreator) {
        dc = pc.createDataChannel('filedrop', { ordered: true });
        setupDataChannel();
    }
}

function setupDataChannel() {
    if (!dc) return;

    dc.onopen = () => {
        peerConnected = true;
        updatePeerStatus('Peer connected', 'connected');
        processQueue();
    };

    dc.onclose = () => {
        peerConnected = false;
        updatePeerStatus('Peer disconnected');
    };

    dc.onmessage = (event) => {
        const data = event.data;
        if (typeof data === 'string') {
            const msg = JSON.parse(data);
            if (msg.type === 'metadata') {
                currentTransfer = {
                    name: msg.name,
                    size: msg.size,
                    mime: msg.mime,
                    received: 0,
                    chunks: [],
                };
                addTransferUI(currentTransfer, 'receiving');
            } else if (msg.type === 'transfer-complete') {
                if (currentTransfer) {
                    finishReceive();
                }
            } else if (msg.type === 'cancel') {
                if (currentTransfer) {
                    currentTransfer.cancelled = true;
                    updateTransferStatus(currentTransfer, 'Cancelled', 'error');
                    currentTransfer = null;
                }
            }
        } else {
            if (currentTransfer && !currentTransfer.cancelled) {
                currentTransfer.chunks.push(data);
                currentTransfer.received += data.byteLength;
                const pct = Math.min(100, Math.round((currentTransfer.received / currentTransfer.size) * 100));
                updateTransferProgress(currentTransfer, pct);
            }
        }
    };
}
