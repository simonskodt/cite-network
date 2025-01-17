package com.simonskodt.citenetwork.repositories;

import java.util.List;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import com.simonskodt.citenetwork.entities.Paper;

public interface PaperRepository extends Neo4jRepository<Paper, Long> {
    @Query("MATCH (p:Paper) WHERE p.title = $title RETURN p")
    Paper findPaperByTitle(String title);

    @Query("MATCH (p:Paper)-[:CITES]->(cited:Paper) WHERE p.id = $paperId RETURN cited")
    List<Paper> findPapersCitedByPaper(Long paperId);

    @Query("MATCH (citing:Paper)-[:CITES]->(p:Paper) WHERE p.id = $paperId RETURN citing")
    List<Paper> findPapersCitingPaper(Long paperId);

    @Query("MATCH (p:Paper) WHERE p.publicationYear = $year RETURN p")
    List<Paper> findPapersByPublicationYear(int year);

    @Query("""
        MATCH (i:Institution)<-[:AFFILIATED_WITH]-(a:Author)-[:WRITTEN_BY]->(p:Paper) 
        WHERE i.name = $institutionName 
        RETURN p
    """)
    List<Paper> findPapersByInstitutionName(String institutionName);

    @Query("MATCH (a:Author)-[:WRITTEN_BY]->(p:Paper) WHERE a.name = $authorName RETURN p")
    List<Paper> findPapersByAuthorName(String authorName);
}
