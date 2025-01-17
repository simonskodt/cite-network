package com.simonskodt.citenetwork.repositories;

import java.util.List;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import com.simonskodt.citenetwork.entities.Author;

public interface AuthorRepository extends Neo4jRepository<Author, Long> {
    @Query("MATCH (p:Paper)-[:WRITTEN_BY]->(a:Author) WHERE p.title = $title RETURN a")
    List<Author> findAuthorsByPaperTitle(String title);

    @Query("""
        MATCH (a1:Author)-[:WRITTEN_BY]->(p:Paper)<-[:WRITTEN_BY]-(a2:Author) 
        WHERE a1.name = $authorName 
        RETURN DISTINCT a2
    """)
    List<Author> findCoAuthors(String authorName);
}
