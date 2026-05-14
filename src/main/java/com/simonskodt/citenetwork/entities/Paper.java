package com.simonskodt.citenetwork.entities;

import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node
public class Paper {
    @Id
    private Long paperId;
    private String title;
    private Integer publicationYear;
    private String doi;

    @Relationship(type = "CITES", direction = Relationship.Direction.OUTGOING)
    private List<Paper> cites;

    @Relationship(type = "WRITTEN_BY", direction = Relationship.Direction.OUTGOING)
    private List<Author> authors;

    public Paper() {}

    public Paper(Long paperId, String title, Integer publicationYear, String doi) {
        this.paperId = paperId;
        this.title = title;
        this.publicationYear = publicationYear;
        this.doi = doi;
    }

    public Paper(Long paperId, String title, Integer publicationYear, String doi, List<Paper> cites, List<Author> authors) {
        this.paperId = paperId;
        this.title = title;
        this.publicationYear = publicationYear;
        this.doi = doi;
        this.cites = cites;
        this.authors = authors;
    }

    public Long getPaperId() { return paperId; }
    public void setPaperId(Long paperId) { this.paperId = paperId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Integer getPublicationYear() { return publicationYear; }
    public void setPublicationYear(Integer publicationYear) { this.publicationYear = publicationYear; }

    public String getDoi() { return doi; }
    public void setDoi(String doi) { this.doi = doi; }

    public List<Paper> getCites() { return cites; }
    public void setCites(List<Paper> cites) { this.cites = cites; }

    public List<Author> getAuthors() { return authors; }
    public void setAuthors(List<Author> authors) { this.authors = authors; }
}
