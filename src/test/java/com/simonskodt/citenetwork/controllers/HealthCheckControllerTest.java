package com.simonskodt.citenetwork.controllers;

import com.simonskodt.citenetwork.services.HealthCheckService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.reactive.server.WebTestClient;

import static org.mockito.Mockito.when;

@WebFluxTest(HealthCheckController.class)
class HealthCheckControllerTest {

    @Autowired
    WebTestClient webTestClient;

    @MockBean
    HealthCheckService healthCheckService;

    @Test
    void GET_healthDb_returnsDatabaseIsUp_whenConnected() {
        when(healthCheckService.isDatabaseUp()).thenReturn(true);

        webTestClient.get().uri("/health/db")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class).isEqualTo("Database is up");
    }

    @Test
    void GET_healthDb_returnsDatabaseIsDown_whenDisconnected() {
        when(healthCheckService.isDatabaseUp()).thenReturn(false);

        webTestClient.get().uri("/health/db")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class).isEqualTo("Database is down");
    }
}
