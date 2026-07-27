package com.quickdrop.service;

import com.quickdrop.model.Room;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();

    public Room createRoom() {
        String roomId = generateRoomId();
        Room room = new Room(roomId);
        rooms.put(roomId, room);
        return room;
    }

    public Room getRoom(String roomId) {
        return rooms.get(roomId);
    }

    public Room joinRoom(String roomId, WebSocketSession session) {
        Room room = rooms.get(roomId);
        if (room == null) {
            return null;
        }
        room.addSession(session);
        return room;
    }

    public void leaveRoom(String roomId, WebSocketSession session) {
        Room room = rooms.get(roomId);
        if (room != null) {
            room.removeSession(session);
            if (room.isEmpty()) {
                rooms.remove(roomId);
            }
        }
    }

    public boolean roomExists(String roomId) {
        return rooms.containsKey(roomId);
    }

    private String generateRoomId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
