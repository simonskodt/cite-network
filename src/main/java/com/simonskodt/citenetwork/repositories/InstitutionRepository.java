package com.simonskodt.citenetwork.repositories;

import org.springframework.data.neo4j.repository.ReactiveNeo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;

import reactor.core.publisher.Flux;

public interface InstitutionRepository extends ReactiveNeo4jRepository<Institution, Long> {
    @Query("""
        MATCH (i:Institution)<-[:AFFILIATED_WITH]-(a:Author)
        WHERE i.name = $institutionName
        RETURN a
    """)    
    Flux<Author> findAuthorsByInstitutionName(@Param("institutionName") String institutionName);

    @Query("""
        MATCH (i:Institution)<-[:AFFILIATED_WITH]-(a:Author)<-[:WRITTEN_BY]-(p:Paper)
        WHERE i.name = $institutionName
        RETURN p
    """)    
    Flux<Paper> findPapersByInstitutionName(@Param("institutionName") String institutionName);

    @Query("""
        MATCH (a:Author)-[:AFFILIATED_WITH]->(i:Institution)
        WHERE a.name = $authorName
        RETURN i
    """)
    Flux<Institution> findInstitutionsByAuthorName(@Param("authorName") String authorName);
}
