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
