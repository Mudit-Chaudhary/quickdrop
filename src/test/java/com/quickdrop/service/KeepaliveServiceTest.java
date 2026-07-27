package com.quickdrop.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class KeepaliveServiceTest {

    @Test
    void pingSelf_blankBaseUrl_doesNothing() {
        KeepaliveService service = new KeepaliveService();
        ReflectionTestUtils.setField(service, "baseUrl", "");
        assertDoesNotThrow(service::pingSelf);
    }

    @Test
    void pingSelf_hitsHealthEndpoint() throws Exception {
        AtomicReference<String> hitPath = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/health", exchange -> {
            hitPath.set(exchange.getRequestURI().getPath());
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();
        try {
            String base = "http://localhost:" + server.getAddress().getPort();
            KeepaliveService service = new KeepaliveService();
            ReflectionTestUtils.setField(service, "baseUrl", base);

            service.pingSelf();

            assertEquals("/health", hitPath.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void pingSelf_nullBaseUrl_doesNothing() {
        KeepaliveService service = new KeepaliveService();
        ReflectionTestUtils.setField(service, "baseUrl", null);
        assertDoesNotThrow(service::pingSelf);
    }

}
