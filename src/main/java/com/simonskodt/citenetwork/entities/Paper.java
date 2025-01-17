package com.simonskodt.citenetwork.entities;

import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.With;

@Getter
@Setter
@With
@AllArgsConstructor
@Node
public class Paper {
    @Id
    private Long id;
    private String title;
    private int publicationYear;
    private String doi;

    @Relationship(type = "CITES")
    private List<Paper> cites;

    @Relationship(type = "WRITTEN_BY")
    private List<Author> authors;
}
