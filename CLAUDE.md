# CLAUDE.md

Guidance for Claude Code when working in this repo. The README has user-facing docs; this file captures what an agent needs to navigate and modify the code.

## What this is

Academic citation network explorer — Spring Boot reactive backend over Neo4j, with a single-file vanilla-JS + D3.js frontend served as a static classpath resource.

## Project layout

```
src/main/java/com/simonskodt/citenetwork/
  controllers/     REST endpoints (Flux/Mono returns)
  services/        Business logic
  repositories/    Spring Data Neo4j reactive repositories (@Query Cypher)
  entities/        @Node classes: Paper, Author, Institution
  config/          Spring config
src/main/resources/
  static/index.html   Entire frontend — HTML, CSS, and JS in one file (~2100 lines)
  application.properties
src/test/java/com/simonskodt/citenetwork/
  controllers/     @WebFluxTest with @MockBean services
  services/        @ExtendWith(MockitoExtension.class) with mocked repos
  repositories/    @DataNeo4jTest + neo4j-harness (embedded Neo4j)
mock-server.js     Node mock backend serving the static UI with 20 fake papers
data-gathering/    Scripts for sourcing papers (arXiv, Kaggle, generator)
```

## Common commands

```bash
# Backend (needs running Neo4j 5 — see application.properties)
./mvnw spring-boot:run

# Tests (embedded Neo4j harness — no external DB required)
./mvnw verify
./mvnw test -Dtest=PaperControllerTest    # single class
./mvnw test -Dtest=PaperControllerTest#findFirstTenPapers  # single method

# Package
./mvnw package

# Frontend-only dev (no Java/Neo4j needed)
node mock-server.js   # serves UI + fake API at http://localhost:8080

# Docker stack
docker-compose up
```

Maven wrapper lives at `./mvnw` (Unix) and `mvnw.cmd` (Windows). Java 23 is required (`<java.version>23` in pom.xml).

## Key conventions

- **Reactive everywhere**: controllers and services return `Flux<T>` / `Mono<T>`. Don't introduce blocking calls in this stack.
- **Repository queries**: `PaperRepository`, `AuthorRepository`, `InstitutionRepository` use `@Query` with Cypher. Match existing query style when adding new ones.
- **Entities**: `@Node` classes with `@Relationship` for graph edges. Paper → CITES → Paper, Paper → WRITTEN_BY → Author, Author → AFFILIATED_WITH → Institution.
- **Frontend is one file**: `src/main/resources/static/index.html` contains all markup, styles, and D3 logic. Keep it that way — no build step. Search by feature name (e.g. "Seed filter", "Bulk import") to locate sections.
- **Mock server parity**: when adding/changing a backend endpoint, update `mock-server.js` so the frontend-only dev path still works.
- **Tests use the layer's annotation**: `@WebFluxTest` for controllers (mock service), `MockitoExtension` for services (mock repo), `@DataNeo4jTest` + harness for repositories (real embedded Neo4j). Don't replace harness tests with mocks.

## REST surface

See README "REST API" table. All paper endpoints under `/papers`, authors under `/authors`. OpenAPI UI is available via springdoc when running.

## CI

`.github/workflows/` runs compile → test → package on push and PRs to `main`. Surefire XML is uploaded as an artifact and rendered as a job summary. The embedded Neo4j harness means CI needs no DB service container — keep it that way.

## Gotchas

- `src/main/resources/application.properties` holds Neo4j credentials in plaintext for local dev; never commit real credentials.
- Surefire is configured with `--add-opens java.base/java.lang=ALL-UNNAMED` and bytebuddy experimental flag (see pom.xml). Required for the Neo4j harness on Java 23 — don't remove.
- Paper IDs are `Long` (not UUIDs). Path variables expect numeric IDs.
- The `cite-network-ui` launch config in `.claude/launch.json` runs `mock-server.js` from the Preview panel.
