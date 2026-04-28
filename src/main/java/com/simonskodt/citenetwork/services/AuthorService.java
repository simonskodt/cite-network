package com.simonskodt.citenetwork.services;

import org.springframework.stereotype.Service;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.repositories.AuthorRepository;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class AuthorService {
    private final AuthorRepository authorRepository;

    public AuthorService(AuthorRepository authorRepository) {
        this.authorRepository = authorRepository;
    }

    public Flux<Author> findAuthorsByPaperTitle(String title) {
        return authorRepository.findAuthorsByPaperTitle(title);
    }

    public Flux<Author> findCoAuthors(String authorName) {
        return authorRepository.findCoAuthors(authorName);
    }

    public Mono<Author> createAuthor(Author author) {
        return authorRepository.save(author);
    }

    public Mono<Void> deleteAuthor(Long authorId) {
        return authorRepository.deleteById(authorId);
    }
}
