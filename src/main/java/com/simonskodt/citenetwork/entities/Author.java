package com.simonskodt.citenetwork.entities;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.With;

@Getter
@Setter
@With
@AllArgsConstructor
@Node
public class Author {
    @Id
    private Long authorId;
    private String name;
}
