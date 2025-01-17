package com.simonskodt.citenetwork.controllers;

import com.simonskodt.citenetwork.services.HealthCheckService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/health")
public class HealthCheckController {

    private final HealthCheckService healthCheckService;

    public HealthCheckController(HealthCheckService healthCheckService) {
        this.healthCheckService = healthCheckService;
    }

    @GetMapping("/db")
    public String checkDatabaseConnection() {
        return healthCheckService.isDatabaseUp() ? "Database is up" : "Database is down";
    }
}