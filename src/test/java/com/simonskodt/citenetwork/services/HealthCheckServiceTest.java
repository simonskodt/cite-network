package com.simonskodt.citenetwork.services;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.neo4j.driver.summary.ResultSummary;
import org.springframework.data.neo4j.core.Neo4jClient;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HealthCheckServiceTest {

    @Mock
    Neo4jClient neo4jClient;

    @Mock
    Neo4jClient.UnboundRunnableSpec runnableSpec;

    @InjectMocks
    HealthCheckService healthCheckService;

    @Test
    void isDatabaseUp_returnsTrue_whenQuerySucceeds() {
        when(neo4jClient.query(anyString())).thenReturn(runnableSpec);
        when(runnableSpec.run()).thenReturn(mock(ResultSummary.class));

        assertTrue(healthCheckService.isDatabaseUp());
    }

    @Test
    void isDatabaseUp_returnsFalse_whenExceptionThrown() {
        when(neo4jClient.query(anyString())).thenReturn(runnableSpec);
        when(runnableSpec.run()).thenThrow(new RuntimeException("Connection refused"));

        assertFalse(healthCheckService.isDatabaseUp());
    }
}
