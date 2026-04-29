package com.simonskodt.citenetwork.repositories;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
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

import java.util.List;

@DataNeo4jTest
@Import(Neo4jTestConfig.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PaperRepositoryTest {

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
    PaperRepository paperRepository;

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

    private Paper savePaper(Long id, String title, int year, String doi) {
        Paper paper = new Paper(id, title, year, doi);
        return paperRepository.save(paper).block();
    }

    @Test
    void findFirstTenPapers_returnsUpToTenPapers() {
        for (int i = 1; i <= 12; i++) {
            savePaper((long) i, "Paper " + i, 2020 + i, "doi/" + i);
        }

        StepVerifier.create(paperRepository.findFirstTenPapers())
                .expectNextCount(10)
                .verifyComplete();
    }

    @Test
    void findPapersByTitle_returnsExactMatch() {
        savePaper(1L, "Graph Theory Basics", 2021, "doi/1");

        StepVerifier.create(paperRepository.findPapersByTitle("Graph Theory Basics"))
                .assertNext(p -> {
                    Assertions.assertEquals("Graph Theory Basics", p.getTitle());
                    Assertions.assertEquals(2021, p.getPublicationYear());
                })
                .verifyComplete();
    }

    @Test
    void findPapersByTitle_returnsPartialMatch() {
        savePaper(1L, "dette er en test", 2024, "doi/1");
        savePaper(2L, "another test paper", 2023, "doi/2");
        savePaper(3L, "unrelated work", 2022, "doi/3");

        StepVerifier.create(paperRepository.findPapersByTitle("test"))
                .expectNextCount(2)
                .verifyComplete();
    }

    @Test
    void findPapersByTitle_isCaseInsensitive() {
        savePaper(1L, "Graph Theory Basics", 2021, "doi/1");

        StepVerifier.create(paperRepository.findPapersByTitle("GRAPH THEORY"))
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    void findPapersByTitle_returnsEmptyForUnknown() {
        StepVerifier.create(paperRepository.findPapersByTitle("Nonexistent"))
                .verifyComplete();
    }

    @Test
    void findPapersByPublicationYear_returnsCorrectPapers() {
        savePaper(1L, "Old Paper", 2000, "doi/1");
        savePaper(2L, "New Paper", 2023, "doi/2");
        savePaper(3L, "Also New", 2023, "doi/3");

        StepVerifier.create(paperRepository.findPapersByPublicationYear(2023))
                .expectNextCount(2)
                .verifyComplete();
    }

    @Test
    void findPapersCitedByPaper_returnsCitedPapers() {
        Paper citing = savePaper(1L, "Citing Paper", 2022, "doi/1");
        Paper cited  = savePaper(2L, "Cited Paper",  2020, "doi/2");

        try (var session = driver.session()) {
            session.run("MATCH (a:Paper {paperId: 1}), (b:Paper {paperId: 2}) CREATE (a)-[:CITES]->(b)");
        }

        StepVerifier.create(paperRepository.findPapersCitedByPaper(1L))
                .assertNext(p -> Assertions.assertEquals("Cited Paper", p.getTitle()))
                .verifyComplete();
    }

    @Test
    void findPapersCitingPaper_returnsCitingPapers() {
        savePaper(1L, "Citing Paper", 2022, "doi/1");
        savePaper(2L, "Cited Paper",  2020, "doi/2");

        try (var session = driver.session()) {
            session.run("MATCH (a:Paper {paperId: 1}), (b:Paper {paperId: 2}) CREATE (a)-[:CITES]->(b)");
        }

        StepVerifier.create(paperRepository.findPapersCitingPaper(2L))
                .assertNext(p -> Assertions.assertEquals("Citing Paper", p.getTitle()))
                .verifyComplete();
    }

    @Test
    void findPapersByAuthorName_returnsPapersForAuthor() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (p:Paper {paperId: 1, title: 'Author Test', publicationYear: 2021, doi: 'doi/1'})
                CREATE (a:Author {authorId: 1, name: 'Alice'})
                CREATE (p)-[:WRITTEN_BY]->(a)
            """);
        }

        StepVerifier.create(paperRepository.findPapersByAuthorName("Alice"))
                .assertNext(p -> Assertions.assertEquals("Author Test", p.getTitle()))
                .verifyComplete();
    }

    @Test
    void findPapersByInstitutionName_returnsPapersForInstitution() {
        try (var session = driver.session()) {
            session.run("""
                CREATE (i:Institution {institutionId: 1, name: 'USI', location: 'Lugano'})
                CREATE (a:Author {authorId: 1, name: 'Bob'})
                CREATE (p:Paper {paperId: 1, title: 'Inst Paper', publicationYear: 2022, doi: 'doi/1'})
                CREATE (a)-[:AFFILIATED_WITH]->(i)
                CREATE (p)-[:WRITTEN_BY]->(a)
            """);
        }

        StepVerifier.create(paperRepository.findPapersByInstitutionName("USI"))
                .assertNext(p -> Assertions.assertEquals("Inst Paper", p.getTitle()))
                .verifyComplete();
    }

    @Test
    void addCitation_createsCitesRelationship() {
        savePaper(1L, "Paper A", 2021, "doi/1");
        savePaper(2L, "Paper B", 2022, "doi/2");

        StepVerifier.create(paperRepository.addCitation(1L, 2L))
                .verifyComplete();

        StepVerifier.create(paperRepository.findPapersCitedByPaper(1L))
                .assertNext(p -> Assertions.assertEquals("Paper B", p.getTitle()))
                .verifyComplete();
    }

    @Test
    void savePaper_persistsAndRetrievesById() {
        Paper saved = savePaper(42L, "Saved Paper", 2024, "doi/42");
        Assertions.assertNotNull(saved);
        Assertions.assertEquals("Saved Paper", saved.getTitle());
    }

    @Test
    void deleteById_removesPaper() {
        savePaper(1L, "Deletable", 2020, "doi/1");

        StepVerifier.create(paperRepository.deleteById(1L)
                .then(paperRepository.findPaperByTitle("Deletable")))
                .verifyComplete();
    }

    @Test
    void deleteById_detachesCitationRelationships() {
        savePaper(1L, "Citing", 2021, "doi/1");
        savePaper(2L, "Cited",  2020, "doi/2");

        try (var session = driver.session()) {
            session.run("MATCH (a:Paper {paperId: 1}), (b:Paper {paperId: 2}) CREATE (a)-[:CITES]->(b)");
        }

        StepVerifier.create(paperRepository.deleteById(1L))
                .verifyComplete();

        // Citing paper is gone
        StepVerifier.create(paperRepository.findPaperByTitle("Citing"))
                .verifyComplete();

        // Cited paper still exists — only the citing node was deleted
        StepVerifier.create(paperRepository.findPaperByTitle("Cited"))
                .assertNext(p -> Assertions.assertEquals("Cited", p.getTitle()))
                .verifyComplete();

        // No paper is citing "Cited" anymore — relationship was detached
        StepVerifier.create(paperRepository.findPapersCitingPaper(2L))
                .verifyComplete();
    }
}
