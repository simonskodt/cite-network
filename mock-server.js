#!/usr/bin/env node
// Lightweight mock server — serves static files + fakes the Spring Boot API
const http = require("http");
const fs   = require("fs");
const path = require("path");

const STATIC = path.join(__dirname, "src/main/resources/static");
const PORT   = 8080;

// ── Sample data ───────────────────────────────────────────────────────────────
const authors = [
  { authorId: 1,  name: "Alice Turing"   },
  { authorId: 2,  name: "Bob Church"     },
  { authorId: 3,  name: "Carol Shannon"  },
  { authorId: 4,  name: "David Dijkstra" },
  { authorId: 5,  name: "Eve Knuth"      },
  { authorId: 6,  name: "Frank Hoare"    },
  { authorId: 7,  name: "Grace Lamport"  },
  { authorId: 8,  name: "Henry Backus"   },
  { authorId: 9,  name: "Iris McCarthy"  },
  { authorId: 10, name: "James Wirth"    },
];

const institutions = [
  { institutionId: 1, name: "USI",        location: "Lugano"    },
  { institutionId: 2, name: "ETH Zurich", location: "Zurich"    },
  { institutionId: 3, name: "MIT",        location: "Cambridge" },
  { institutionId: 4, name: "Stanford",   location: "Stanford"  },
];

const a = authors; // shorthand
let papers = [
  { paperId:  1, title: "Graph Databases in Practice",      publicationYear: 2021, doi: "10.1000/graph-db",            authors: [a[0], a[1]] },
  { paperId:  2, title: "Neo4j at Scale",                   publicationYear: 2020, doi: "10.1000/neo4j-scale",         authors: [a[1]] },
  { paperId:  3, title: "Reactive Streams in Java",         publicationYear: 2022, doi: "10.1000/reactive-java",       authors: [a[2]] },
  { paperId:  4, title: "Citation Network Analysis",        publicationYear: 2019, doi: "10.1000/citation-net",        authors: [a[0], a[3]] },
  { paperId:  5, title: "Information Retrieval Fundamentals", publicationYear: 2018, doi: "10.1000/ir-fundamentals",   authors: [a[4]] },
  { paperId:  6, title: "Deep Learning for NLP",            publicationYear: 2023, doi: "10.1000/dl-nlp",              authors: [a[2], a[4]] },
  { paperId:  7, title: "Distributed Systems Theory",       publicationYear: 2017, doi: "10.1000/dist-sys",            authors: [a[3]] },
  { paperId:  8, title: "Semantic Web Technologies",        publicationYear: 2020, doi: "10.1000/semantic-web",        authors: [a[0]] },
  { paperId:  9, title: "Algorithm Design Patterns",        publicationYear: 2016, doi: "10.1000/alg-patterns",        authors: [a[4], a[3]] },
  { paperId: 10, title: "Spring Boot Microservices",        publicationYear: 2022, doi: "10.1000/spring-microservices",authors: [a[1], a[2]] },
  { paperId: 11, title: "Knowledge Graph Construction",     publicationYear: 2021, doi: "10.1000/kg-construction",     authors: [a[5], a[6]] },
  { paperId: 12, title: "Transformer Architecture Advances",publicationYear: 2023, doi: "10.1000/transformer-adv",     authors: [a[8]] },
  { paperId: 13, title: "Formal Verification Methods",      publicationYear: 2019, doi: "10.1000/formal-verify",       authors: [a[7], a[5]] },
  { paperId: 14, title: "Concurrent Programming Models",    publicationYear: 2018, doi: "10.1000/concurrent-prog",     authors: [a[6], a[7]] },
  { paperId: 15, title: "Natural Language Processing Survey",publicationYear: 2022, doi: "10.1000/nlp-survey",         authors: [a[8], a[9]] },
  { paperId: 16, title: "Graph Neural Networks",            publicationYear: 2023, doi: "10.1000/gnn",                 authors: [a[2], a[5]] },
  { paperId: 17, title: "Database Indexing Strategies",     publicationYear: 2020, doi: "10.1000/db-indexing",         authors: [a[1], a[3]] },
  { paperId: 18, title: "Machine Learning Pipelines",       publicationYear: 2021, doi: "10.1000/ml-pipelines",        authors: [a[8], a[4]] },
  { paperId: 19, title: "Type Theory Applications",         publicationYear: 2015, doi: "10.1000/type-theory",         authors: [a[9], a[7]] },
  { paperId: 20, title: "Blockchain Consensus Protocols",   publicationYear: 2022, doi: "10.1000/blockchain-consensus",authors: [a[6], a[0]] },
];

// citation edges: [citing paperId, cited paperId]
const citations = [
  [1, 2], [1, 4],
  [2, 5],
  [3, 2], [3, 7],
  [4, 5], [4, 9],
  [6, 3], [6, 5],
  [8, 4],
  [10, 3], [10, 7],
  [11, 1], [11, 4],
  [12, 6], [12, 11],
  [13, 14],
  [14, 7], [14, 19],
  [15, 6], [15, 12],
  [16, 6], [16, 11],
  [17, 2], [17, 9],
  [18, 5], [18, 12],
  [20, 13], [20, 14],
];

// Snapshot of the original seeded papers (never includes user-created ones)
const SEEDS = papers.slice();

// ── Fuzzy helpers ─────────────────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => j === 0 ? i : 0));
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
  return dp[m][n];
}

function fuzzyTitleMatch(title, query) {
  const t = title.toLowerCase(), q = query.toLowerCase();
  if (t.includes(q)) return true;
  const qWords = q.split(/\s+/).filter(w => w.length >= 3);
  const tWords = t.split(/\s+/);
  return qWords.some(qw =>
    tWords.some(tw => {
      const thresh = Math.ceil(qw.length / 3);
      return levenshtein(qw, tw) <= thresh;
    })
  );
}

// ── Route helpers ─────────────────────────────────────────────────────────────
function routeGet(url) {
  const base   = url.split("?")[0];
  const params = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");

  if (base === "/papers") {
    const limit = Math.min(parseInt(params.get("limit") || SEEDS.length), SEEDS.length);
    return SEEDS.slice(0, limit).map(p => ({ ...p, _source: "seed" }));
  }

  const fuzzyM = url.match(/^\/papers\/fuzzy-title\/(.+)$/);
  if (fuzzyM) {
    const q = decodeURIComponent(fuzzyM[1]);
    return papers.filter(p => fuzzyTitleMatch(p.title, q));
  }

  const titleM = url.match(/^\/papers\/title\/(.+)$/);
  if (titleM) {
    const q = decodeURIComponent(titleM[1]).toLowerCase();
    return papers.filter(p => p.title.toLowerCase().includes(q));
  }

  const citedByM = url.match(/^\/papers\/(\d+)\/cited-by$/);
  if (citedByM) {
    const id = parseInt(citedByM[1]);
    const ids = citations.filter(([src]) => src === id).map(([, tgt]) => tgt);
    return papers.filter(p => ids.includes(p.paperId));
  }

  const citingM = url.match(/^\/papers\/(\d+)\/citing$/);
  if (citingM) {
    const id = parseInt(citingM[1]);
    const ids = citations.filter(([, tgt]) => tgt === id).map(([src]) => src);
    return papers.filter(p => ids.includes(p.paperId));
  }

  const yearM = url.match(/^\/papers\/year\/(\d+)$/);
  if (yearM)
    return papers.filter(p => p.publicationYear === parseInt(yearM[1]));

  const authorM = url.match(/^\/papers\/author\/(.+)$/);
  if (authorM) {
    const name = decodeURIComponent(authorM[1]).toLowerCase();
    return papers.filter(p => p.authors?.some(au => au.name.toLowerCase().includes(name)));
  }

  const instM = url.match(/^\/papers\/institution\/(.+)$/);
  if (instM) {
    // mock: return papers whose author index is even (no real affiliation data)
    return papers.filter((_, i) => i % 2 === 0);
  }

  const coauthM = url.match(/^\/authors\/coauthors\/(.+)$/);
  if (coauthM) {
    const name   = decodeURIComponent(coauthM[1]).toLowerCase();
    const author = authors.find(au => au.name.toLowerCase().includes(name));
    if (!author) return [];
    const coIds = new Set(
      papers
        .filter(p => p.authors?.some(au => au.authorId === author.authorId))
        .flatMap(p => p.authors.map(au => au.authorId))
    );
    coIds.delete(author.authorId);
    return authors.filter(au => coIds.has(au.authorId));
  }

  return undefined; // no match
}

// ── HTTP server ───────────────────────────────────────────────────────────────
function respond(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(json);
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // POST /papers/:citingId/cites/:citedId — add a citation edge
  const citesM = url.match(/^\/papers\/(\d+)\/cites\/(\d+)$/);
  if (req.method === "POST" && citesM) {
    const citingId = parseInt(citesM[1]);
    const citedId  = parseInt(citesM[2]);
    if (!citations.some(([a, b]) => a === citingId && b === citedId))
      citations.push([citingId, citedId]);
    respond(res, 201, { citingId, citedId });
    return;
  }

  // POST /papers — create a new paper
  if (req.method === "POST" && url === "/papers") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (!data.title || !data.title.trim()) {
          return respond(res, 400, { error: "title is required" });
        }
        const newId = papers.reduce((m, p) => Math.max(m, p.paperId), 0) + 1;
        const newPaper = {
          paperId: newId,
          title: data.title.trim(),
          publicationYear: data.publicationYear ? parseInt(data.publicationYear) : null,
          doi: data.doi || null,
          authors: (data.authors || []).map((au, i) => ({
            authorId: 1000 + newId * 10 + i,
            name: typeof au === "string" ? au : au.name,
          })).filter(au => au.name?.trim()),
          _source: "user",
        };
        papers.push(newPaper);
        respond(res, 201, newPaper);
      } catch (_) {
        respond(res, 400, { error: "Invalid JSON body" });
      }
    });
    return;
  }

  // GET API routes
  if (req.method === "GET") {
    const result = routeGet(req.url); // pass full URL so query params are available
    if (result !== undefined) {
      respond(res, result === null ? 404 : 200, result);
      return;
    }
  }

  // Static file fallback
  const filePath = path.join(STATIC, url === "/" ? "index.html" : url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const mime = {
      ".html": "text/html",
      ".js":   "text/javascript",
      ".css":  "text/css",
    }[path.extname(filePath)] || "text/plain";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Mock server running at http://localhost:${PORT}`));
