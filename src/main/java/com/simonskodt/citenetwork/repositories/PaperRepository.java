package com.simonskodt.citenetwork.repositories;

import java.util.List;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import com.simonskodt.citenetwork.entities.Paper;

public interface PaperRepository extends Neo4jRepository<Paper, Long> {
    @Query("MATCH (p1:Paper)-[:CITES]->(p2:Paper) WHERE p.title = $title RETURN p2")
    Paper findPaperByTitle(String title);
}
