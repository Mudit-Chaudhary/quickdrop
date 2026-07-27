package com.quickdrop.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PageControllerTest {

    private final PageController controller = new PageController();

    @Test
    void index_forwardsToIndexHtml() {
        assertEquals("forward:/index.html", controller.index());
    }

    @Test
    void room_forwardsToIndexHtml() {
        assertEquals("forward:/index.html", controller.room("12ab34cd"));
    }

    @Test
    void health_returnsOkStatus() {
        ResponseEntity<Map<String, String>> response = controller.health();
        assertEquals(200, response.getStatusCode().value());
        assertEquals(Map.of("status", "ok"), response.getBody());
    }
}
