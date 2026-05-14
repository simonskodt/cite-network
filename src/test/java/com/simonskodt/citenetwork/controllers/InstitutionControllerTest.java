package com.simonskodt.citenetwork.controllers;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.services.InstitutionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@WebFluxTest(InstitutionController.class)
class InstitutionControllerTest {

    @Autowired
    WebTestClient webTestClient;

    @MockBean
    InstitutionService institutionService;

    private Author author(Long id, String name) {
        return new Author(id, name);
    }

    private Paper paper(Long id, String title) {
        return new Paper(id, title, 2022, "doi/" + id);
    }

    private Institution institution(Long id, String name, String location) {
        return new Institution(id, name, location);
    }

    @Test
    void GET_authorsByInstitution_returnsAuthors() {
        when(institutionService.findAuthorsByInstitutionName("USI"))
                .thenReturn(Flux.just(author(1L, "Alice"), author(2L, "Bob")));

        webTestClient.get().uri("/institutions/authors/USI")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Author.class).hasSize(2);
    }

    @Test
    void GET_authorsByInstitution_returnsEmptyWhenNoneFound() {
        when(institutionService.findAuthorsByInstitutionName("Unknown"))
                .thenReturn(Flux.empty());

        webTestClient.get().uri("/institutions/authors/Unknown")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Author.class).hasSize(0);
    }

    @Test
    void GET_papersByInstitution_returnsPapers() {
        when(institutionService.findPapersByInstitutionName("MIT"))
                .thenReturn(Flux.just(paper(1L, "MIT Research")));

        webTestClient.get().uri("/institutions/papers/MIT")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class)
                .value(list -> assertEquals("MIT Research", list.get(0).getTitle()));
    }

    @Test
    void GET_papersByInstitution_returnsEmptyWhenNoneFound() {
        when(institutionService.findPapersByInstitutionName("Unknown"))
                .thenReturn(Flux.empty());

        webTestClient.get().uri("/institutions/papers/Unknown")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(0);
    }

    @Test
    void GET_institutionsByAuthor_returnsInstitutions() {
        when(institutionService.findInstitutionsByAuthorName("Alice"))
                .thenReturn(Flux.just(institution(1L, "USI", "Lugano")));

        webTestClient.get().uri("/institutions/author/Alice")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Institution.class)
                .value(list -> assertEquals("USI", list.get(0).getName()));
    }

    @Test
    void GET_institutionsByAuthor_returnsEmptyWhenNoneFound() {
        when(institutionService.findInstitutionsByAuthorName("Unknown"))
                .thenReturn(Flux.empty());

        webTestClient.get().uri("/institutions/author/Unknown")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Institution.class).hasSize(0);
    }

    @Test
    void POST_institution_creates201() {
        Institution inst = institution(1L, "ETH Zurich", "Zurich");
        when(institutionService.createInstitution(any())).thenReturn(Mono.just(inst));

        webTestClient.post().uri("/institutions")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(inst)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Institution.class)
                .value(i -> assertEquals("ETH Zurich", i.getName()));
    }

    @Test
    void DELETE_institution_returns204() {
        when(institutionService.deleteInstitution(1L)).thenReturn(Mono.empty());

        webTestClient.delete().uri("/institutions/1")
                .exchange()
                .expectStatus().isNoContent();
    }
}
