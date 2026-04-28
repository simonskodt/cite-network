package com.simonskodt.citenetwork.repositories;

import com.simonskodt.citenetwork.entities.Author;
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
class AuthorRepositoryTest {

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
    AuthorRepository authorRepository;

    @Autowired
    Driver driver;

    @BeforeEach
    void clearDatabase() {
        try (var session = driver.session()) {
            session.run("MATCH (n) DETACH DELETE n");
        }
    }

    @Test
    void findAuthorsByPaperTitle_returnsAuthors() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (p:Paper {paperId: 1, title: 'Shared Work', publicationYear: 2021, doi: 'doi/1'})
                CREATE (a:Author {authorId: 1, name: 'Alice'})
                CREATE (p)-[:WRITTEN_BY]->(a)
            """);
        }

        StepVerifier.create(authorRepository.findAuthorsByPaperTitle("Shared Work"))
                .assertNext(a -> Assertions.assertEquals("Alice", a.getName()))
                .verifyComplete();
    }

    @Test
    void findAuthorsByPaperTitle_returnsEmptyForUnknownTitle() {
        StepVerifier.create(authorRepository.findAuthorsByPaperTitle("Nonexistent"))
                .verifyComplete();
    }

    @Test
    void findCoAuthors_returnsOtherAuthorsOnSamePaper() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (p:Paper {paperId: 1, title: 'Joint Paper', publicationYear: 2022, doi: 'doi/1'})
                CREATE (a1:Author {authorId: 1, name: 'Alice'})
                CREATE (a2:Author {authorId: 2, name: 'Bob'})
                CREATE (p)-[:WRITTEN_BY]->(a1)
                CREATE (p)-[:WRITTEN_BY]->(a2)
            """);
        }

        StepVerifier.create(authorRepository.findCoAuthors("Alice"))
                .assertNext(a -> Assertions.assertEquals("Bob", a.getName()))
                .verifyComplete();
    }

    @Test
    void findCoAuthors_returnsEmptyWhenNoCoAuthors() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (p:Paper {paperId: 1, title: 'Solo', publicationYear: 2020, doi: 'doi/1'})
                CREATE (a:Author {authorId: 1, name: 'Alice'})
                CREATE (p)-[:WRITTEN_BY]->(a)
            """);
        }

        StepVerifier.create(authorRepository.findCoAuthors("Alice"))
                .verifyComplete();
    }

    @Test
    void saveAndDeleteAuthor_works() {
        Author author = new Author(99L, "Test Author");
        Author saved = authorRepository.save(author).block();
        Assertions.assertNotNull(saved);
        Assertions.assertEquals("Test Author", saved.getName());

        StepVerifier.create(authorRepository.deleteById(99L)
                .then(authorRepository.findById(99L)))
                .verifyComplete();
    }
}
