# Academic Research Citation Network

A project to put together the courses I attend at Università della Svizzera italiana.

![Courses](/resources/screenshots/courses.png)

## My Overambitious Goal

The goal is to create a web application to be able to play around with academic citations.
This allows for playing around with the following different technologies:

- Maven
- Spring Framework
- Neo4J
- Web applications in Java
- Concurrency in Java

## The Initial ER-Model

Cardinality explained:

| Value (left) | Value (right) | Meaning |
|--------------|---------------|---------|
| \|o          | o\|           | Zero or one |
| \|\|         | \|\|          | Exactly one |
| }o           | o{            | Zero or more (no upper limit) |
| }\|          | \|{           | One or more (no upper limit) |

![ER-Model](/resources/screenshots/er-model.png)

## Commit Message Conventions

I follow this convention for commit messages:

- feat: New feature addition
- fix: Bug correction
- style: Styling updates
- refactor: Code restructuring
- test: Testing-related changes
- docs: Documentation updates
- chore: Routine maintenance
