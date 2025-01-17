package com.simonskodt.citenetwork.entities;

import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Property;
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
    private Long paperId;
    @Property("title") // does not work
    private String title;
    @Property("publicationYear") // same
    private int publicationYear;
    @Property("doi") // same
    private String doi;

    @Relationship(type = "CITES", direction = Relationship.Direction.OUTGOING)
    private List<Paper> cites;

    @Relationship(type = "WRITTEN_BY", direction = Relationship.Direction.OUTGOING)
    private List<Author> authors;
}
