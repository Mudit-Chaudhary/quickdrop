package com.quickdrop.model;

import org.springframework.web.socket.WebSocketSession;

import java.util.concurrent.CopyOnWriteArrayList;

public class Room {
    private final String roomId;
    private final CopyOnWriteArrayList<WebSocketSession> sessions;
    private final int MAX_PEERS = 2;

    public Room(String roomId) {
        this.roomId = roomId;
        this.sessions = new CopyOnWriteArrayList<>();
    }

    public String getRoomId() {
        return roomId;
    }

    public CopyOnWriteArrayList<WebSocketSession> getSessions() {
        return sessions;
    }

    public void addSession(WebSocketSession session) {
        sessions.add(session);
    }

    public void removeSession(WebSocketSession session) {
        sessions.remove(session);
    }

    public boolean isEmpty() {
        return sessions.isEmpty();
    }

    public int getPeerCount() {
        return sessions.size();
    }

    public boolean isFull() {
        return sessions.size() >= MAX_PEERS;
    }
}
