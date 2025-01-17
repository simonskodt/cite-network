CREATE CONSTRAINT FOR (p:Paper) REQUIRE p.paperId IS UNIQUE;
CREATE CONSTRAINT FOR (a:Author) REQUIRE a.authorId IS UNIQUE;
CREATE CONSTRAINT FOR (i:Institution) REQUIRE i.institutionId IS UNIQUE;

// Load PAPER.CSV
LOAD CSV WITH HEADERS FROM 'file:///paper.csv' AS row
CREATE (p:Paper {
    paperId: toInteger(row.paperId), 
    title: row.title, 
    publicationYear: toInteger(row.publicationYear), 
    doi: row.DOI
});

// Load AUTHOR.CSV
LOAD CSV WITH HEADERS FROM 'file:///author.csv' AS row
CREATE (a:Author {
    authorId: toInteger(row.authorId), 
    name: row.name
});

// Load INSTITUTION.CSV
LOAD CSV WITH HEADERS FROM 'file:///institution.csv' AS row
CREATE (i:Institution {
    institutionId: toInteger(row.institutionId), 
    name: row.name
});

// Load WRITTEN_BY.CSV and create relationships
LOAD CSV WITH HEADERS FROM 'file:///WRITTEN_BY.csv' AS row
MATCH (p:Paper {paperId: toInteger(row.paperId)}), 
      (a:Author {authorId: toInteger(row.authorId)})
CREATE (p)-[:WRITTEN_BY]->(a);

// Load AFFILIATED_WITH.CSV and create relationships
LOAD CSV WITH HEADERS FROM 'file:///AFFILIATED_WITH.csv' AS row
MATCH (a:Author {authorId: toInteger(row.authorId)}), 
      (i:Institution {institutionId: toInteger(row.institutionId)})
CREATE (a)-[:AFFILIATED_WITH]->(i);

// Load CITES.CSV and create relationships
LOAD CSV WITH HEADERS FROM 'file:///CITES.csv' AS row
MATCH (fromPaper:Paper {paperId: toInteger(row.fromPaperId)}), 
      (toPaper:Paper {paperId: toInteger(row.toPaperId)})
CREATE (fromPaper)-[:CITES]->(toPaper);