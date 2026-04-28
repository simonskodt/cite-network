package com.simonskodt.citenetwork.entities;

import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node
public class Author {
    @Id
    private Long authorId;
    private String name;

    @Relationship(type = "AFFILIATED_WITH", direction = Relationship.Direction.OUTGOING)
    private List<Institution> institutions;

    public Author() {}

    public Author(Long authorId, String name) {
        this.authorId = authorId;
        this.name = name;
    }

    public Author(Long authorId, String name, List<Institution> institutions) {
        this.authorId = authorId;
        this.name = name;
        this.institutions = institutions;
    }

    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<Institution> getInstitutions() { return institutions; }
    public void setInstitutions(List<Institution> institutions) { this.institutions = institutions; }
}
