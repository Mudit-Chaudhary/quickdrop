package com.quickdrop.service;

import com.quickdrop.model.Room;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.web.socket.WebSocketSession;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class RoomServiceTest {

    private RoomService roomService;

    @BeforeEach
    void setUp() {
        roomService = new RoomService();
    }

    @Test
    void createRoom_returnsRoomWith8CharId() {
        Room room = roomService.createRoom();
        assertNotNull(room);
        assertEquals(8, room.getRoomId().length());
    }

    @Test
    void getRoom_returnsRoomAfterCreate() {
        Room room = roomService.createRoom();
        assertNotNull(roomService.getRoom(room.getRoomId()));
    }

    @Test
    void getRoom_returnsNullForUnknownRoom() {
        assertNull(roomService.getRoom("unknown"));
    }

    @Test
    void joinRoom_addsSessionToExistingRoom() {
        Room room = roomService.createRoom();
        WebSocketSession session = mock(WebSocketSession.class);
        Room joined = roomService.joinRoom(room.getRoomId(), session);
        assertNotNull(joined);
        assertEquals(1, joined.getPeerCount());
    }

    @Test
    void joinRoom_returnsNullForUnknownRoom() {
        WebSocketSession session = mock(WebSocketSession.class);
        Room joined = roomService.joinRoom("unknown", session);
        assertNull(joined);
    }

    @Test
    void leaveRoom_removesRoomWhenEmpty() {
        Room room = roomService.createRoom();
        WebSocketSession session = mock(WebSocketSession.class);
        roomService.joinRoom(room.getRoomId(), session);
        roomService.leaveRoom(room.getRoomId(), session);
        assertFalse(roomService.roomExists(room.getRoomId()));
    }

    @Test
    void leaveRoom_keepsRoomWhenPeersRemain() {
        Room room = roomService.createRoom();
        WebSocketSession session1 = mock(WebSocketSession.class);
        WebSocketSession session2 = mock(WebSocketSession.class);
        roomService.joinRoom(room.getRoomId(), session1);
        roomService.joinRoom(room.getRoomId(), session2);
        roomService.leaveRoom(room.getRoomId(), session1);
        assertNotNull(roomService.getRoom(room.getRoomId()));
    }

    @Test
    void roomExists_isFalseBeforeCreate() {
        assertFalse(roomService.roomExists("does-not-exist"));
    }

}
