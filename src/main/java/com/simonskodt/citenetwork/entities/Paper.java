package com.simonskodt.citenetwork.entities;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node
public class Paper {
    @Id private Long id;
    private String title;
    private int publicationYear;
    private String doi;
    

    
}
