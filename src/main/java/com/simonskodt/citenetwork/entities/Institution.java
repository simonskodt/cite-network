package com.simonskodt.citenetwork.entities;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node
public class Institution {
    @Id
    private Long institutionId;
    private String name;
    private String location;

    public Institution() {}

    public Institution(Long institutionId, String name, String location) {
        this.institutionId = institutionId;
        this.name = name;
        this.location = location;
    }

    public Long getInstitutionId() { return institutionId; }
    public void setInstitutionId(Long institutionId) { this.institutionId = institutionId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
}
