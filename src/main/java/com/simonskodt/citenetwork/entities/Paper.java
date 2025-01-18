package com.simonskodt.citenetwork.entities;

import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Property;
import org.springframework.data.neo4j.core.schema.Relationship;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.With;

@Getter
@Setter
@With
@AllArgsConstructor
@NoArgsConstructor
@Node
public class Paper {
    @Id
    private Long paperId;
    private String title;
    private int publicationYear;
    private String doi;

    @Relationship(type = "CITES", direction = Relationship.Direction.OUTGOING)
    private List<Paper> cites;

    @Relationship(type = "WRITTEN_BY", direction = Relationship.Direction.OUTGOING)
    private List<Author> authors;

	public Paper(Long paperId, String title, int publicationYear, String doi) {
		this.paperId = paperId;
		this.title = title;
		this.publicationYear = publicationYear;
		this.doi = doi;
	}
}
