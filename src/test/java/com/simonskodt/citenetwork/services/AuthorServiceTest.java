package com.simonskodt.citenetwork.services;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.repositories.AuthorRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthorServiceTest {

    @Mock
    AuthorRepository authorRepository;

    @InjectMocks
    AuthorService authorService;

    private Author author(Long id, String name) {
        return new Author(id, name);
    }

    @Test
    void findAuthorsByPaperTitle_delegatesToRepository() {
        Author a = author(1L, "Alice");
        when(authorRepository.findAuthorsByPaperTitle("Test Paper")).thenReturn(Flux.just(a));

        StepVerifier.create(authorService.findAuthorsByPaperTitle("Test Paper"))
                .assertNext(result -> assertEquals("Alice", result.getName()))
                .verifyComplete();
    }

    @Test
    void findCoAuthors_delegatesToRepository() {
        Author coAuthor = author(2L, "Bob");
        when(authorRepository.findCoAuthors("Alice")).thenReturn(Flux.just(coAuthor));

        StepVerifier.create(authorService.findCoAuthors("Alice"))
                .assertNext(a -> assertEquals("Bob", a.getName()))
                .verifyComplete();
    }

    @Test
    void createAuthor_savesAndReturnsAuthor() {
        Author a = author(10L, "New Author");
        when(authorRepository.save(a)).thenReturn(Mono.just(a));

        StepVerifier.create(authorService.createAuthor(a))
                .expectNext(a)
                .verifyComplete();

        verify(authorRepository).save(a);
    }

    @Test
    void deleteAuthor_delegatesToRepository() {
        when(authorRepository.deleteById(1L)).thenReturn(Mono.empty());

        StepVerifier.create(authorService.deleteAuthor(1L))
                .verifyComplete();

        verify(authorRepository).deleteById(1L);
    }
}
