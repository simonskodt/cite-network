package com.simonskodt.citenetwork.services;

import org.springframework.stereotype.Service;
import org.springframework.data.neo4j.core.Neo4jClient;

@Service
public class HealthCheckService {

    private final Neo4jClient neo4jClient;

    public HealthCheckService(Neo4jClient neo4jClient) {
        this.neo4jClient = neo4jClient;
    }

    public boolean isDatabaseUp() {
        try {
            neo4jClient.query("RETURN 1").run();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}