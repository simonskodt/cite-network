package com.simonskodt.citenetwork.controllers;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.services.AuthorService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.http.MediaType;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@WebFluxTest(AuthorController.class)
class AuthorControllerTest {

    @Autowired
    WebTestClient webTestClient;

    @MockBean
    AuthorService authorService;

    private Author author(Long id, String name) {
        return new Author(id, name);
    }

    @Test
    void GET_coauthors_returnsCoAuthors() {
        when(authorService.findCoAuthors("Alice")).thenReturn(Flux.just(author(2L, "Bob")));

        webTestClient.get().uri("/authors/coauthors/Alice")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Author.class).hasSize(1);
    }

    @Test
    void GET_authorsByPaperTitle_returnsAuthors() {
        when(authorService.findAuthorsByPaperTitle("Graph Theory")).thenReturn(Flux.just(author(1L, "Alice")));

        webTestClient.get().uri("/authors/paper/Graph Theory")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Author.class)
                .value(list -> assertEquals("Alice", list.get(0).getName()));
    }

    @Test
    void POST_author_creates201() {
        Author newAuthor = author(5L, "New Author");
        when(authorService.createAuthor(any())).thenReturn(Mono.just(newAuthor));

        webTestClient.post().uri("/authors")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(newAuthor)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Author.class)
                .value(a -> assertEquals("New Author", a.getName()));
    }

    @Test
    void DELETE_author_returns204() {
        when(authorService.deleteAuthor(1L)).thenReturn(Mono.empty());

        webTestClient.delete().uri("/authors/1")
                .exchange()
                .expectStatus().isNoContent();
    }
}
