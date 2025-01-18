package com.simonskodt.citenetwork.entities;

import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
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
public class Author {
    @Id
    private Long authorId;
    private String name;

    @Relationship(type = "AFFILIATED_WITH", direction = Relationship.Direction.OUTGOING)
    private List<Institution> institutions;

	public Author(Long authorId, String name) {
		this.authorId = authorId;
		this.name = name;
	}
}
