package com.simonskodt.citenetwork.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.services.AuthorService;

import java.util.List;

@RestController
@RequestMapping("/authors")
public class AuthorController {
    private final AuthorService authorService;

    public AuthorController(AuthorService authorService) {
        this.authorService = authorService;
    }

    @GetMapping("/coauthors/{authorName}")
    public List<Author> findCoAuthors(@PathVariable String authorName) {
        return authorService.findCoAuthors(authorName);
    }

    @GetMapping("/paper/{title}")
    public List<Author> findAuthorsByPaperTitle(@PathVariable String title) {
        return authorService.findAuthorsByPaperTitle(title);
    }
}
