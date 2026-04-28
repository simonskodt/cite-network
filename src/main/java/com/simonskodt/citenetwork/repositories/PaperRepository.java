package com.simonskodt.citenetwork.repositories;

import org.springframework.data.neo4j.repository.ReactiveNeo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;

import com.simonskodt.citenetwork.entities.Paper;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface PaperRepository extends ReactiveNeo4jRepository<Paper, Long> {
    @Query("MATCH (p:Paper) RETURN p LIMIT 10")
    Flux<Paper> findFirstTenPapers();

    @Query("MATCH (p:Paper) WHERE p.title = $title RETURN p")
    Mono<Paper> findPaperByTitle(@Param("title") String title);

    @Query("MATCH (p:Paper)-[:CITES]->(cited:Paper) WHERE p.paperId = $paperId RETURN cited")
    Flux<Paper> findPapersCitedByPaper(@Param("paperId") Long paperId);

    @Query("MATCH (citing:Paper)-[:CITES]->(p:Paper) WHERE p.paperId = $paperId RETURN citing")
    Flux<Paper> findPapersCitingPaper(@Param("paperId") Long paperId);

    @Query("MATCH (p:Paper) WHERE p.publicationYear = $year RETURN p")
    Flux<Paper> findPapersByPublicationYear(@Param("year") int year);

    @Query("MATCH (citing:Paper {paperId: $citingId}), (cited:Paper {paperId: $citedId}) CREATE (citing)-[:CITES]->(cited)")
    Mono<Void> addCitation(@Param("citingId") Long citingId, @Param("citedId") Long citedId);

    @Query("""
        MATCH (i:Institution)<-[:AFFILIATED_WITH]-(a:Author)<-[:WRITTEN_BY]-(p:Paper)
        WHERE i.name = $institutionName
        RETURN p
    """)
    Flux<Paper> findPapersByInstitutionName(@Param("institutionName") String institutionName);

    @Query("MATCH (p:Paper)-[:WRITTEN_BY]->(a:Author) WHERE a.name = $authorName RETURN p")
    Flux<Paper> findPapersByAuthorName(@Param("authorName") String authorName);
}
