package com.quickdrop.websocket;

import com.google.gson.JsonParser;
import com.quickdrop.service.RoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class WebSocketIntegrationTest {

    private SignalingHandler handler;
    private RoomService roomService;
    private WebSocketSession creator;
    private WebSocketSession joiner;

    @BeforeEach
    void setUp() {
        roomService = new RoomService();
        handler = new SignalingHandler(roomService);
        creator = mock(WebSocketSession.class);
        joiner = mock(WebSocketSession.class);
        when(creator.getId()).thenReturn("creator");
        when(joiner.getId()).thenReturn("joiner");
        when(creator.isOpen()).thenReturn(true);
        when(joiner.isOpen()).thenReturn(true);
    }

    @Test
    void fullFlow_createJoinAndOffer_reachesPeer() throws Exception {
        handler.handleTextMessage(creator, new TextMessage("{\"type\":\"create-room\"}"));

        ArgumentCaptor<TextMessage> createCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(creator).sendMessage(createCaptor.capture());
        String roomId = JsonParser.parseString(createCaptor.getValue().getPayload())
                .getAsJsonObject().get("roomId").getAsString();

        handler.handleTextMessage(joiner, new TextMessage("{\"type\":\"join-room\",\"roomId\":\"" + roomId + "\"}"));

        ArgumentCaptor<TextMessage> joinCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(joiner).sendMessage(joinCaptor.capture());
        assertEquals("room-joined", JsonParser.parseString(joinCaptor.getValue().getPayload())
                .getAsJsonObject().get("type").getAsString());

        handler.handleTextMessage(creator, new TextMessage(
                "{\"type\":\"offer\",\"sdp\":\"hello\"}"));

        ArgumentCaptor<TextMessage> relayCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(joiner).sendMessage(relayCaptor.capture());
        String relayed = relayCaptor.getValue().getPayload();
        assertEquals("offer", JsonParser.parseString(relayed).getAsJsonObject().get("type").getAsString());
    }

    @Test
    void roomCreated_sentToCreatorOnCreate() throws Exception {
        handler.handleTextMessage(creator, new TextMessage("{\"type\":\"create-room\"}"));
        verify(creator).sendMessage(any(TextMessage.class));
        verify(joiner, never()).sendMessage(any(TextMessage.class));
    }
}
