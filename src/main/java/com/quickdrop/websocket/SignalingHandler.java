package com.quickdrop.websocket;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.quickdrop.model.Room;
import com.quickdrop.service.RoomService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SignalingHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SignalingHandler.class);
    private final RoomService roomService;
    private final Map<String, String> sessionRooms = new ConcurrentHashMap<>();

    public SignalingHandler(RoomService roomService) {
        this.roomService = roomService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket connected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        JsonObject json = JsonParser.parseString(message.getPayload()).getAsJsonObject();
        String type = json.get("type").getAsString();
        switch (type) {
            case "create-room" -> handleCreateRoom(session);
            case "join-room" -> handleJoinRoom(session, json);
            case "offer" -> relayMessage(session, json, "offer");
            case "answer" -> relayMessage(session, json, "answer");
            case "ice-candidate" -> relayMessage(session, json, "ice-candidate");
            default -> log.warn("Unknown message type: {}", type);
        }
    }

    private void handleCreateRoom(WebSocketSession session) throws IOException {
        Room room = roomService.createRoom();
        room.addSession(session);
        sessionRooms.put(session.getId(), room.getRoomId());
        JsonObject response = new JsonObject();
        response.addProperty("type", "room-created");
        response.addProperty("roomId", room.getRoomId());
        sendMessage(session, response);
        log.info("Room created: {}", room.getRoomId());
    }

    private void handleJoinRoom(WebSocketSession session, JsonObject json) throws IOException {
        String roomId = json.get("roomId").getAsString();
        Room room = roomService.joinRoom(roomId, session);
        JsonObject response = new JsonObject();
        if (room == null) {
            response.addProperty("type", "error");
            response.addProperty("message", "Room not found");
            sendMessage(session, response);
            return;
        }
        sessionRooms.put(session.getId(), roomId);
        response.addProperty("type", "room-joined");
        response.addProperty("roomId", roomId);
        sendMessage(session, response);
        JsonObject peerJoined = new JsonObject();
        peerJoined.addProperty("type", "peer-joined");
        broadcastToPeer(room, session, peerJoined);
    }

    private void relayMessage(WebSocketSession session, JsonObject json, String msgType) throws IOException {
        String roomId = sessionRooms.get(session.getId());
        if (roomId == null) return;
        Room room = roomService.getRoom(roomId);
        if (room == null) return;
        JsonObject message = new JsonObject();
        message.addProperty("type", msgType);
        if (json.has("sdp")) message.addProperty("sdp", json.get("sdp").getAsString());
        if (json.has("candidate")) message.addProperty("candidate", json.get("candidate").getAsString());
        broadcastToPeer(room, session, message);
    }

    private void broadcastToPeer(Room room, WebSocketSession sender, JsonObject message) throws IOException {
        for (WebSocketSession peer : room.getSessions()) {
            if (!peer.getId().equals(sender.getId()) && peer.isOpen()) {
                sendMessage(peer, message);
            }
        }
    }

    private void sendMessage(WebSocketSession session, JsonObject message) throws IOException {
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(message.toString()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = sessionRooms.remove(session.getId());
        if (roomId != null) {
            roomService.leaveRoom(roomId, session);
            Room room = roomService.getRoom(roomId);
            if (room != null) {
                JsonObject msg = new JsonObject();
                msg.addProperty("type", "peer-disconnected");
                for (WebSocketSession peer : room.getSessions()) {
                    if (peer.isOpen()) {
                        try {
                            sendMessage(peer, msg);
                        } catch (IOException e) {
                            log.error("Error sending disconnect to peer", e);
                        }
                    }
                }
            }
            log.info("WebSocket disconnected: {}", session.getId());
        }
    }

}
