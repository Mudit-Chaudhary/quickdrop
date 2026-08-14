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
let pendingCreate = false;

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
        if (pendingCreate) {
            pendingCreate = false;
            sendSignal({ type: 'create-room' });
        } else if (roomId) {
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
    if (!el) return;
    el.textContent = text;
    el.classList.remove('text-primary', 'text-error');
    if (className === 'connected') {
        el.classList.add('text-primary');
    } else if (className === 'disconnected') {
        el.classList.add('text-error');
    }
}

function updatePeerStatus(text, className) {
    const el = document.getElementById('peer-status');
    if (!el) return;
    if (!text) {
        el.textContent = '';
        el.classList.remove('text-primary');
        return;
    }
    el.textContent = text;
    el.classList.remove('text-primary');
    if (className === 'connected') {
        el.classList.add('text-primary');
    }
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
            resetCreateButton();
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
                    updateTransferStatus(currentTransfer, 'Cancelled', 'cancelled');
                    currentTransfer.el.classList.add('cancelled');
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

function createOffer() {
    if (!pc) return;
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
            sendSignal({ type: 'offer', sdp: pc.localDescription.sdp });
        })
        .catch(err => console.error('Error creating offer:', err));
}

function finishReceive() {
    if (!currentTransfer || currentTransfer.cancelled) return;
    const blob = new Blob(currentTransfer.chunks, { type: currentTransfer.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentTransfer.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateTransferStatus(currentTransfer, 'Complete', '');
    updateTransferProgress(currentTransfer, 100, true);
    currentTransfer = null;
}

document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            syncThemeIcon();
            updateFavicon();
        });
    }
    syncThemeIcon();
    updateFavicon();

    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        if (!header) return;
        if (window.scrollY > 20) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    });

    const path = location.pathname;
    const roomMatch = path.match(/^\/room\/([a-zA-Z0-9-]+)$/);
    if (roomMatch) {
        roomId = roomMatch[1];
        isCreator = false;
        document.getElementById('room-link').value = `${location.origin}/room/${roomId}`;
        showView('joining-view');
    }

    document.getElementById('create-room-btn').addEventListener('click', () => {
        const btn = document.getElementById('create-room-btn');
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('opacity-80', 'cursor-not-allowed');
        const ctaIcon = document.getElementById('cta-icon');
        const ctaText = document.getElementById('cta-text');
        ctaIcon.textContent = 'sync';
        ctaIcon.classList.add('animate-spin');
        ctaText.textContent = 'Initializing Secure Room...';

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            pendingCreate = true;
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            intentionalClose = false;
            connectWebSocket();
        } else {
            sendSignal({ type: 'create-room' });
        }
    });

    document.getElementById('copy-link-btn').addEventListener('click', (e) => {
        const input = document.getElementById('room-link');
        input.select();
        navigator.clipboard.writeText(input.value).catch(() => {
            document.execCommand('copy');
        });

        const btn = e.currentTarget;
        const icon = btn.querySelector('.material-symbols-outlined');
        const label = btn.childNodes[btn.childNodes.length - 1];
        btn.classList.add('text-primary', 'border-primary');
        icon.textContent = 'check';
        label.textContent = 'Copied!';

        setTimeout(() => {
            btn.classList.remove('text-primary', 'border-primary');
            icon.textContent = 'content_copy';
            label.textContent = 'Copy';
        }, 2000);
    });

    document.getElementById('browse-link').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
        const files = e.target.files;
        for (const file of files) {
            pendingFileQueue.push(file);
        }
        e.target.value = '';
        processQueue();
    });

    const dropZone = document.getElementById('drop-zone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        for (const file of files) {
            pendingFileQueue.push(file);
        }
        processQueue();
    });

    dropZone.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
});

function syncThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.textContent = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
}

function updateFavicon() {
    const isDark = document.documentElement.classList.contains('dark');
    const favicon = document.getElementById('favicon');
    if (favicon) {
        favicon.setAttribute('href', isDark ? '/img/favicon-dark.svg' : '/img/favicon-light.svg');
    }
    const themeColor = document.getElementById('theme-color');
    if (themeColor) {
        themeColor.setAttribute('content', isDark ? '#1C2026' : '#ECEEEA');
    }
}

function resetCreateButton() {
    const btn = document.getElementById('create-room-btn');
    if (!btn || !btn.disabled) return;
    btn.disabled = false;
    btn.classList.remove('opacity-80', 'cursor-not-allowed');
    const ctaIcon = document.getElementById('cta-icon');
    const ctaText = document.getElementById('cta-text');
    if (ctaIcon) {
        ctaIcon.textContent = 'link';
        ctaIcon.classList.remove('animate-spin');
    }
    if (ctaText) ctaText.textContent = 'Create a Share Link';
}

function processQueue() {
    if (!peerConnected || !dc || dc.readyState !== 'open') return;
    if (currentTransfer) return;

    const file = pendingFileQueue.shift();
    if (!file) return;

    sendFile(file);
}

function sendFile(file) {
    if (!dc || dc.readyState !== 'open') return;

    currentTransfer = { name: file.name, size: file.size, sent: 0 };
    addTransferUI(currentTransfer, 'sending');

    const metadata = JSON.stringify({
        type: 'metadata',
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
    });
    dc.send(metadata);

    const CHUNK_SIZE = 16384;
    const reader = new FileReader();
    let offset = 0;

    currentTransfer.reader = reader;
    currentTransfer.file = file;

    reader.onload = (e) => {
        if (currentTransfer.cancelled) return;

        dc.send(e.target.result);
        offset += e.target.result.byteLength;
        currentTransfer.sent = offset;
        const pct = Math.min(100, Math.round((offset / file.size) * 100));
        updateTransferProgress(currentTransfer, pct);

        if (offset < file.size) {
            readSlice(offset);
        } else {
            dc.send(JSON.stringify({ type: 'transfer-complete' }));
            updateTransferStatus(currentTransfer, 'Complete', '');
            currentTransfer.el.classList.add('complete');
            updateTransferProgress(currentTransfer, 100, true);
            currentTransfer = null;
            processQueue();
        }
    };

    reader.onerror = () => {
        updateTransferStatus(currentTransfer, 'Error reading file', 'error');
        currentTransfer = null;
        dc.send(JSON.stringify({ type: 'cancel' }));
    };

    function readSlice(start) {
        const slice = file.slice(start, start + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
    }

    readSlice(0);
}

function cancelTransfer() {
    if (!currentTransfer) return;
    currentTransfer.cancelled = true;
    if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'cancel' }));
    }
    updateTransferStatus(currentTransfer, 'Cancelled', 'cancelled');
    currentTransfer.el.classList.add('cancelled');
    currentTransfer = null;
    processQueue();
}

function addTransferUI(transfer, direction) {
    const container = document.getElementById('transfers');
    const empty = container.querySelector('.transfer-empty');
    if (empty) empty.style.display = 'none';

    const el = document.createElement('div');
    el.className = 'transfer-item';
    el.id = `transfer-${Date.now()}`;
    transfer.el = el;

    const cancelBtnHtml = `
        <button class="transfer-cancel-btn" aria-label="Cancel transfer" title="Cancel">✕</button>
    `;

    el.innerHTML = `
        <div class="transfer-header">
            <span class="transfer-name">${escapeHtml(transfer.name)}</span>
            <span class="transfer-size">${formatSize(transfer.size)}</span>
            ${cancelBtnHtml}
        </div>
        <div class="transfer-progress-bar">
            <div class="transfer-progress-fill"></div>
        </div>
        <div class="transfer-status">${direction === 'sending' ? 'Sending...' : 'Receiving...'}</div>
    `;

    const cancelBtn = el.querySelector('.transfer-cancel-btn');
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelTransfer();
    });

    container.prepend(el);

    const count = container.querySelectorAll('.transfer-item').length;
    const countEl = document.getElementById('transfer-count');
    if (countEl) countEl.textContent = count + (count === 1 ? ' file transferred' : ' files transferred');
}

function updateTransferProgress(transfer, pct, complete) {
    if (!transfer.el) return;
    const fill = transfer.el.querySelector('.transfer-progress-fill');
    if (fill) {
        fill.style.width = pct + '%';
        if (complete) fill.classList.add('complete');
    }
}

function updateTransferStatus(transfer, text, className) {
    if (!transfer.el) return;
    const status = transfer.el.querySelector('.transfer-status');
    if (status) {
        status.textContent = text;
        status.className = 'transfer-status' + (className ? ' ' + className : '');
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
