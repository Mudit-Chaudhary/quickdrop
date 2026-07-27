package com.quickdrop.websocket;

import com.google.gson.JsonParser;
import com.quickdrop.service.RoomService;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class SignalingHandlerTest {

    private SignalingHandler handler;
    private RoomService roomService;
    private WebSocketSession session;

    @BeforeEach
    void setUp() throws Exception {
        roomService = new RoomService();
        handler = new SignalingHandler(roomService);
        session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(session.isOpen()).thenReturn(true);
    }

    @Test
    void handleTextMessage_createRoom_sendsRoomCreated() throws Exception {
        String payload = "{\"type\":\"create-room\"}";
        TextMessage message = new TextMessage(payload);
        handler.handleTextMessage(session, message);
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());
        String json = captor.getValue().getPayload();
        assertEquals("room-created", JsonParser.parseString(json).getAsJsonObject().get("type").getAsString());
        assertNotNull(JsonParser.parseString(json).getAsJsonObject().get("roomId"));
    }

    @Test
    void handleTextMessage_joinRoom_sendsRoomJoined() throws Exception {
        String roomId = roomService.createRoom().getRoomId();
        String payload = "{\"type\":\"join-room\",\"roomId\":\"" + roomId + "\"}";
        handler.handleTextMessage(session, new TextMessage(payload));
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());
        String json = captor.getValue().getPayload();
        assertEquals("room-joined", JsonParser.parseString(json).getAsJsonObject().get("type").getAsString());
    }

    @Test
    void handleTextMessage_joinUnknownRoom_sendsError() throws Exception {
        String payload = "{\"type\":\"join-room\",\"roomId\":\"unknown\"}";
        handler.handleTextMessage(session, new TextMessage(payload));
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());
        String json = captor.getValue().getPayload();
        assertEquals("error", JsonParser.parseString(json).getAsJsonObject().get("type").getAsString());
    }

    @Test
    void handleTextMessage_unknownType_doesNothing() throws Exception {
        handler.handleTextMessage(session, new TextMessage("{\"type\":\"foo\"}"));
        verify(session, never()).sendMessage(any(TextMessage.class));
    }

}
