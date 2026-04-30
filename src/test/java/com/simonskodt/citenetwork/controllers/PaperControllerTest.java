package com.simonskodt.citenetwork.controllers;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.services.PaperService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.http.MediaType;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import static org.mockito.Mockito.*;

@WebFluxTest(PaperController.class)
class PaperControllerTest {

    @Autowired
    WebTestClient webTestClient;

    @MockBean
    PaperService paperService;

    private Paper paper(Long id, String title) {
        return new Paper(id, title, 2022, "doi/" + id);
    }

    @Test
    void GET_papers_returnsFirstTen() {
        when(paperService.findFirstTenPapers()).thenReturn(Flux.just(paper(1L, "A"), paper(2L, "B")));

        webTestClient.get().uri("/papers")
                .accept(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(2);
    }

    @Test
    void GET_papersByTitle_returnsMatchingPapers() {
        when(paperService.findPapersByTitle("graph")).thenReturn(
                Flux.just(paper(1L, "Graph Theory"), paper(2L, "Graph Databases")));

        webTestClient.get().uri("/papers/title/graph")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(2);
    }

    @Test
    void GET_papersByTitle_returnsEmptyListWhenNotFound() {
        when(paperService.findPapersByTitle("missing")).thenReturn(Flux.empty());

        webTestClient.get().uri("/papers/title/missing")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(0);
    }

    @Test
    void GET_papersCitedBy_returnsCitedPapers() {
        when(paperService.findPapersCitedByPaper(1L)).thenReturn(Flux.just(paper(2L, "Cited")));

        webTestClient.get().uri("/papers/1/cited-by")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(1);
    }

    @Test
    void GET_papersCiting_returnsCitingPapers() {
        when(paperService.findPapersCitingPaper(2L)).thenReturn(Flux.just(paper(1L, "Citing")));

        webTestClient.get().uri("/papers/2/citing")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(1);
    }

    @Test
    void GET_papersByYear_returnsPapers() {
        when(paperService.findPapersByPublicationYear(2022)).thenReturn(Flux.just(paper(1L, "2022 Paper")));

        webTestClient.get().uri("/papers/year/2022")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(1);
    }

    @Test
    void GET_papersByAuthor_returnsPapers() {
        when(paperService.findPapersByAuthorName("Alice")).thenReturn(Flux.just(paper(1L, "Alice's Paper")));

        webTestClient.get().uri("/papers/author/Alice")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class)
                .value(list -> org.junit.jupiter.api.Assertions.assertEquals("Alice's Paper", list.get(0).getTitle()));
    }

    @Test
    void GET_papersByAuthor_returnsEmptyListWhenNoneFound() {
        when(paperService.findPapersByAuthorName("Unknown")).thenReturn(Flux.empty());

        webTestClient.get().uri("/papers/author/Unknown")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(0);
    }

    @Test
    void GET_papersByInstitution_returnsPapers() {
        when(paperService.findPapersByInstitutionName("MIT")).thenReturn(Flux.just(paper(3L, "MIT Paper")));

        webTestClient.get().uri("/papers/institution/MIT")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(1);
    }

    @Test
    void GET_papers_returnsFirstTenPapers() {
        when(paperService.findFirstTenPapers()).thenReturn(
                Flux.just(paper(1L, "A"), paper(2L, "B"), paper(3L, "C")));

        webTestClient.get().uri("/papers")
                .accept(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(3);
    }

    @Test
    void GET_fuzzyTitle_returnsFuzzyMatches() {
        when(paperService.findPapersByTitleFuzzy("tset"))
                .thenReturn(Flux.just(paper(1L, "dette er en test")));

        webTestClient.get().uri("/papers/fuzzy-title/tset")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(1);
    }

    @Test
    void GET_fuzzyTitle_returnsEmptyWhenNoMatch() {
        when(paperService.findPapersByTitleFuzzy("xyz")).thenReturn(Flux.empty());

        webTestClient.get().uri("/papers/fuzzy-title/xyz")
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Paper.class).hasSize(0);
    }

    @Test
    void POST_papers_createsPaper() {
        Paper newPaper = paper(10L, "New Paper");
        when(paperService.createPaper(any())).thenReturn(Mono.just(newPaper));

        webTestClient.post().uri("/papers")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(newPaper)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Paper.class)
                .value(p -> org.junit.jupiter.api.Assertions.assertEquals("New Paper", p.getTitle()));
    }

    @Test
    void POST_citation_creates201() {
        when(paperService.addCitation(1L, 2L)).thenReturn(Mono.empty());

        webTestClient.post().uri("/papers/1/cites/2")
                .exchange()
                .expectStatus().isCreated();
    }

    @Test
    void DELETE_paper_returns204() {
        when(paperService.deletePaper(1L)).thenReturn(Mono.empty());

        webTestClient.delete().uri("/papers/1")
                .exchange()
                .expectStatus().isNoContent();
    }
}
