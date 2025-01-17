package com.simonskodt.citenetwork.services;

import java.util.List;

import org.springframework.stereotype.Service;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.repositories.AuthorRepository;

@Service
public class AuthorService {
    private final AuthorRepository authorRepository;

    public AuthorService(AuthorRepository authorRepository) {
        this.authorRepository = authorRepository;
    }

    public List<Author> findAuthorsByPaperTitle(String title) {
        return authorRepository.findAuthorsByPaperTitle(title);
    }

    public List<Author> findCoAuthors(String authorName) {
        return authorRepository.findCoAuthors(authorName);
    }
}
