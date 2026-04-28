package com.simonskodt.citenetwork.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.services.AuthorService;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/authors")
public class AuthorController {
    private final AuthorService authorService;

    public AuthorController(AuthorService authorService) {
        this.authorService = authorService;
    }

    @GetMapping("/coauthors/{authorName}")
    public Flux<Author> findCoAuthors(@PathVariable String authorName) {
        return authorService.findCoAuthors(authorName);
    }

    @GetMapping("/paper/{title}")
    public Flux<Author> findAuthorsByPaperTitle(@PathVariable String title) {
        return authorService.findAuthorsByPaperTitle(title);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Author> createAuthor(@RequestBody Author author) {
        return authorService.createAuthor(author);
    }

    @DeleteMapping("/{authorId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteAuthor(@PathVariable Long authorId) {
        return authorService.deleteAuthor(authorId);
    }
}
