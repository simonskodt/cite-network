package com.simonskodt.citenetwork.repositories;

import com.simonskodt.citenetwork.entities.Institution;
import org.junit.jupiter.api.*;
import org.neo4j.driver.Driver;
import org.neo4j.harness.Neo4j;
import org.neo4j.harness.Neo4jBuilders;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.neo4j.DataNeo4jTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import reactor.test.StepVerifier;

@DataNeo4jTest
@Import(Neo4jTestConfig.class)
class InstitutionRepositoryTest {

    static Neo4j embeddedDatabaseServer;

    @DynamicPropertySource
    static void neo4jProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.neo4j.uri", embeddedDatabaseServer::boltURI);
        registry.add("spring.neo4j.authentication.username", () -> "neo4j");
        registry.add("spring.neo4j.authentication.password", () -> "");
    }

    @BeforeAll
    static void startNeo4j() {
        embeddedDatabaseServer = Neo4jBuilders.newInProcessBuilder()
                .withDisabledServer()
                .build();
    }

    @AfterAll
    static void stopNeo4j() {
        embeddedDatabaseServer.close();
    }

    @Autowired
    InstitutionRepository institutionRepository;

    @Autowired
    Driver driver;

    @BeforeEach
    void clearDatabase() {
        try (var session = driver.session()) {
            session.run("MATCH (n) DETACH DELETE n");
        }
    }

    @Test
    void findAuthorsByInstitutionName_returnsAffiliatedAuthors() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (i:Institution {institutionId: 1, name: 'USI', location: 'Lugano'})
                CREATE (a:Author {authorId: 1, name: 'Alice'})
                CREATE (a)-[:AFFILIATED_WITH]->(i)
            """);
        }

        // Cross-entity @Query results: SDN maps the node back to a different entity type than
        // the repository's own. Count assertions are used here; property assertions live in
        // AuthorRepositoryTest where SDN uses the correct entity mapper.
        StepVerifier.create(institutionRepository.findAuthorsByInstitutionName("USI"))
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    void findAuthorsByInstitutionName_returnsEmptyForUnknownInstitution() {
        StepVerifier.create(institutionRepository.findAuthorsByInstitutionName("Unknown"))
                .verifyComplete();
    }

    @Test
    void findPapersByInstitutionName_returnsPapersViaAuthorAffiliation() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (i:Institution {institutionId: 1, name: 'MIT', location: 'Cambridge'})
                CREATE (a:Author {authorId: 1, name: 'Bob'})
                CREATE (p:Paper {paperId: 1, title: 'MIT Research', publicationYear: 2023, doi: 'doi/1'})
                CREATE (a)-[:AFFILIATED_WITH]->(i)
                CREATE (p)-[:WRITTEN_BY]->(a)
            """);
        }

        // Cross-entity @Query result; count assertion used — property assertions in PaperRepositoryTest.
        StepVerifier.create(institutionRepository.findPapersByInstitutionName("MIT"))
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    void findPapersByInstitutionName_returnsEmptyForUnknownInstitution() {
        StepVerifier.create(institutionRepository.findPapersByInstitutionName("Unknown"))
                .verifyComplete();
    }

    @Test
    void findInstitutionsByAuthorName_returnsInstitutionsForAuthor() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (i:Institution {institutionId: 1, name: 'ETH Zurich', location: 'Zurich'})
                CREATE (a:Author {authorId: 1, name: 'Carol'})
                CREATE (a)-[:AFFILIATED_WITH]->(i)
            """);
        }

        StepVerifier.create(institutionRepository.findInstitutionsByAuthorName("Carol"))
                .assertNext(i -> {
                    Assertions.assertEquals("ETH Zurich", i.getName());
                    Assertions.assertEquals("Zurich", i.getLocation());
                })
                .verifyComplete();
    }

    @Test
    void findInstitutionsByAuthorName_returnsEmptyForUnknownAuthor() {
        StepVerifier.create(institutionRepository.findInstitutionsByAuthorName("Unknown"))
                .verifyComplete();
    }

    @Test
    void findInstitutionsByAuthorName_returnsMultipleInstitutions() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (i1:Institution {institutionId: 1, name: 'USI', location: 'Lugano'})
                CREATE (i2:Institution {institutionId: 2, name: 'ETH Zurich', location: 'Zurich'})
                CREATE (a:Author {authorId: 1, name: 'Dave'})
                CREATE (a)-[:AFFILIATED_WITH]->(i1)
                CREATE (a)-[:AFFILIATED_WITH]->(i2)
            """);
        }

        StepVerifier.create(institutionRepository.findInstitutionsByAuthorName("Dave"))
                .expectNextCount(2)
                .verifyComplete();
    }

    @Test
    void saveAndDeleteInstitution_works() {
        Institution inst = new Institution(99L, "Test University", "Testville");
        Institution saved = institutionRepository.save(inst).block();
        Assertions.assertNotNull(saved);
        Assertions.assertEquals("Test University", saved.getName());

        StepVerifier.create(institutionRepository.deleteById(99L)
                .then(institutionRepository.findById(99L)))
                .verifyComplete();
    }
}
