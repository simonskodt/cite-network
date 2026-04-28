package com.simonskodt.citenetwork;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Requires a running Neo4j instance — use repository/service/controller slice tests instead")
class CitenetworkApplicationTests {

    @Test
    void contextLoads() {
    }
}
