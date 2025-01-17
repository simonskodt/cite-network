package com.simonskodt.citenetwork.repositories;

import java.util.List;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;

public interface InstitutionRepository extends Neo4jRepository<Institution, Long> {
    @Query("""
        MATCH (i:Institution)<-[:AFFILIATED_WITH]-(a:Author)
        WHERE i.name = $institutionName
        RETURN a
    """)    
    List<Author> findAuthorsByInstitutionName(String institutionName);

    @Query("""
        MATCH (i:Institution)<-[:AFFILIATED_WITH]-(a:Author)-[:WRITTEN_BY]->(p:Paper)
        WHERE i.name = $institutionName
        RETURN p
    """)    
    List<Paper> findPapersByInstitutionName(String institutionName);

    @Query("""
        MATCH (a:Author)-[:AFFILIATED_WITH]->(i:Institution)
        WHERE a.name = $authorName
        RETURN i
    """)
    List<Institution> findInstitutionsByAuthorName(String authorName);
}
