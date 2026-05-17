package com.simonskodt.citenetwork.controllers;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Transparent proxy for the Semantic Scholar Graph API.
 *
 * All frontend calls to /api/s2/** are forwarded to
 * https://api.semanticscholar.org/graph/v1/** so the browser
 * never makes cross-origin requests (avoids CORS and shared-IP rate limits).
 *
 * An optional x-api-key header is forwarded to S2 for higher rate limits.
 */
@RestController
@RequestMapping("/api/s2")
public class SemanticScholarProxyController {

    private static final String S2_BASE = "https://api.semanticscholar.org/graph/v1";

    private final WebClient webClient = WebClient.builder()
            .baseUrl(S2_BASE)
            .build();

    @GetMapping("/**")
    public Mono<ResponseEntity<String>> proxy(
            ServerWebExchange exchange,
            @RequestHeader(value = "x-api-key", required = false) String apiKey) {

        // Strip the /api/s2 prefix to get the S2 path + query string
        String requestUri = exchange.getRequest().getURI().toString();
        String s2Suffix   = requestUri.replaceFirst(".*/api/s2", "");

        WebClient.RequestHeadersSpec<?> req = webClient.get().uri(s2Suffix);
        if (apiKey != null && !apiKey.isBlank()) {
            req = req.header("x-api-key", apiKey);
        }

        return req.retrieve()
                .toEntity(String.class)
                .map(resp -> ResponseEntity
                        .status(resp.getStatusCode())
                        .header(HttpHeaders.CONTENT_TYPE, "application/json")
                        .body(resp.getBody()));
    }
}
