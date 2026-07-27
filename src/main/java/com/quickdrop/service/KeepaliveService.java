package com.quickdrop.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class KeepaliveService {

    private static final Logger log = LoggerFactory.getLogger(KeepaliveService.class);
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Value("${app.base-url:}")
    private String baseUrl;

    @Scheduled(fixedRateString = "${app.keepalive-interval:600000}")
    public void pingSelf() {
        if (baseUrl == null || baseUrl.isBlank()) return;
        String url = baseUrl + "/health";
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            client.send(req, HttpResponse.BodyHandlers.discarding());
            log.debug("Keepalive ping to {}", url);
        } catch (Exception e) {
            log.debug("Keepalive ping failed: {}", e.getMessage());
        }
    }
}
