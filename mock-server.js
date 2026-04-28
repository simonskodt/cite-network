#!/usr/bin/env node
// Lightweight mock server — serves static files + fakes the Spring Boot API
const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC = path.join(__dirname, "src/main/resources/static");
const PORT = 8080;

// ── Sample data ────────────────────────────────────────────────────────────
const authors = [
  { authorId: 1, name: "Alice Turing" },
  { authorId: 2, name: "Bob Church" },
  { authorId: 3, name: "Carol Shannon" },
  { authorId: 4, name: "David Dijkstra" },
  { authorId: 5, name: "Eve Knuth" },
];

const institutions = [
  { institutionId: 1, name: "USI", location: "Lugano" },
  { institutionId: 2, name: "ETH Zurich", location: "Zurich" },
  { institutionId: 3, name: "MIT", location: "Cambridge" },
];

const papers = [
  { paperId: 1, title: "Graph Databases in Practice", publicationYear: 2021, doi: "10.1000/graph-db", authors: [authors[0], authors[1]] },
  { paperId: 2, title: "Neo4j at Scale", publicationYear: 2020, doi: "10.1000/neo4j-scale", authors: [authors[1]] },
  { paperId: 3, title: "Reactive Streams in Java", publicationYear: 2022, doi: "10.1000/reactive-java", authors: [authors[2]] },
  { paperId: 4, title: "Citation Network Analysis", publicationYear: 2019, doi: "10.1000/citation-net", authors: [authors[0], authors[3]] },
  { paperId: 5, title: "Information Retrieval Fundamentals", publicationYear: 2018, doi: "10.1000/ir-fundamentals", authors: [authors[4]] },
  { paperId: 6, title: "Deep Learning for NLP", publicationYear: 2023, doi: "10.1000/dl-nlp", authors: [authors[2], authors[4]] },
  { paperId: 7, title: "Distributed Systems Theory", publicationYear: 2017, doi: "10.1000/dist-sys", authors: [authors[3]] },
  { paperId: 8, title: "Semantic Web Technologies", publicationYear: 2020, doi: "10.1000/semantic-web", authors: [authors[0]] },
  { paperId: 9, title: "Algorithm Design Patterns", publicationYear: 2016, doi: "10.1000/alg-patterns", authors: [authors[4], authors[3]] },
  { paperId: 10, title: "Spring Boot Microservices", publicationYear: 2022, doi: "10.1000/spring-microservices", authors: [authors[1], authors[2]] },
];

// citation edges: paper[i] cites paper[j]
const citations = [
  [1, 2], [1, 4], [2, 5], [3, 2], [3, 7],
  [4, 5], [4, 9], [6, 5], [6, 3], [8, 4],
  [10, 3], [10, 7],
];

// ── Route matching ──────────────────────────────────────────────────────────
function route(method, url) {
  if (method === "GET" && url === "/papers")
    return papers.slice(0, 10);

  const titleM = url.match(/^\/papers\/title\/(.+)$/);
  if (method === "GET" && titleM) {
    const t = decodeURIComponent(titleM[1]).toLowerCase();
    return papers.find(p => p.title.toLowerCase().includes(t)) || null;
  }

  const citedByM = url.match(/^\/papers\/(\d+)\/cited-by$/);
  if (method === "GET" && citedByM) {
    const id = parseInt(citedByM[1]);
    const ids = citations.filter(([a]) => a === id).map(([, b]) => b);
    return papers.filter(p => ids.includes(p.paperId));
  }

  const citingM = url.match(/^\/papers\/(\d+)\/citing$/);
  if (method === "GET" && citingM) {
    const id = parseInt(citingM[1]);
    const ids = citations.filter(([, b]) => b === id).map(([a]) => a);
    return papers.filter(p => ids.includes(p.paperId));
  }

  const yearM = url.match(/^\/papers\/year\/(\d+)$/);
  if (method === "GET" && yearM)
    return papers.filter(p => p.publicationYear === parseInt(yearM[1]));

  const authorM = url.match(/^\/papers\/author\/(.+)$/);
  if (method === "GET" && authorM) {
    const name = decodeURIComponent(authorM[1]).toLowerCase();
    return papers.filter(p => p.authors?.some(a => a.name.toLowerCase().includes(name)));
  }

  const instM = url.match(/^\/papers\/institution\/(.+)$/);
  if (method === "GET" && instM) {
    return papers.filter((_, i) => i % 2 === 0); // mock: return alternate papers
  }

  const coauthM = url.match(/^\/authors\/coauthors\/(.+)$/);
  if (method === "GET" && coauthM) {
    const name = decodeURIComponent(coauthM[1]).toLowerCase();
    const author = authors.find(a => a.name.toLowerCase().includes(name));
    if (!author) return [];
    const coauthorPapers = papers.filter(p => p.authors?.some(a => a.authorId === author.authorId));
    const coauthorIds = new Set(coauthorPapers.flatMap(p => p.authors.map(a => a.authorId)));
    coauthorIds.delete(author.authorId);
    return authors.filter(a => coauthorIds.has(a.authorId));
  }

  return undefined; // not matched
}

// ── Server ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // Try API routes first
  const apiResult = route(req.method, url);
  if (apiResult !== undefined) {
    const body = JSON.stringify(apiResult);
    const status = apiResult === null ? 404 : 200;
    res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    return res.end(body);
  }

  // Serve static file
  const filePath = path.join(STATIC, url === "/" ? "index.html" : url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); return res.end("Not found");
    }
    const ext = path.extname(filePath);
    const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] || "text/plain";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Mock server running at http://localhost:${PORT}`));
