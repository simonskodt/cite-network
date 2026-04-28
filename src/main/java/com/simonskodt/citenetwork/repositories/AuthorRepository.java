package com.simonskodt.citenetwork.repositories;

import java.util.List;

import org.springframework.data.neo4j.repository.ReactiveNeo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;

import com.simonskodt.citenetwork.entities.Author;

import reactor.core.publisher.Flux;

public interface AuthorRepository extends ReactiveNeo4jRepository<Author, Long> {
    @Query("MATCH (p:Paper)-[:WRITTEN_BY]->(a:Author) WHERE p.title = $title RETURN a")
    Flux<Author> findAuthorsByPaperTitle(@Param("title") String title);

    @Query("""
        MATCH (a1:Author)<-[:WRITTEN_BY]-(p:Paper)-[:WRITTEN_BY]->(a2:Author)
        WHERE a1.name = $authorName
        RETURN DISTINCT a2
    """)
    Flux<Author> findCoAuthors(@Param("authorName") String authorName);
}
