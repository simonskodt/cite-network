package com.simonskodt.citenetwork.services;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.repositories.PaperRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaperServiceTest {

    @Mock
    PaperRepository paperRepository;

    @InjectMocks
    PaperService paperService;

    private Paper paper(Long id, String title) {
        return new Paper(id, title, 2022, "doi/" + id);
    }

    @Test
    void findFirstTenPapers_delegatesToRepository() {
        when(paperRepository.findFirstTenPapers()).thenReturn(Flux.just(paper(1L, "A"), paper(2L, "B")));

        StepVerifier.create(paperService.findFirstTenPapers())
                .expectNextCount(2)
                .verifyComplete();

        verify(paperRepository).findFirstTenPapers();
    }

    @Test
    void findPapersByTitle_returnsMatchingPapers() {
        Paper p1 = paper(1L, "Neo4j Paper");
        Paper p2 = paper(2L, "Neo4j at Scale");
        when(paperRepository.findPapersByTitle("neo4j")).thenReturn(Flux.just(p1, p2));

        StepVerifier.create(paperService.findPapersByTitle("neo4j"))
                .expectNext(p1, p2)
                .verifyComplete();
    }

    @Test
    void findPapersByTitle_returnsEmptyWhenNotFound() {
        when(paperRepository.findPapersByTitle("missing")).thenReturn(Flux.empty());

        StepVerifier.create(paperService.findPapersByTitle("missing"))
                .verifyComplete();
    }

    @Test
    void findPapersCitedByPaper_delegatesToRepository() {
        when(paperRepository.findPapersCitedByPaper(1L)).thenReturn(Flux.just(paper(2L, "Cited")));

        StepVerifier.create(paperService.findPapersCitedByPaper(1L))
                .assertNext(p -> org.junit.jupiter.api.Assertions.assertEquals("Cited", p.getTitle()))
                .verifyComplete();
    }

    @Test
    void findPapersCitingPaper_delegatesToRepository() {
        when(paperRepository.findPapersCitingPaper(2L)).thenReturn(Flux.just(paper(1L, "Citing")));

        StepVerifier.create(paperService.findPapersCitingPaper(2L))
                .assertNext(p -> org.junit.jupiter.api.Assertions.assertEquals("Citing", p.getTitle()))
                .verifyComplete();
    }

    @Test
    void findPapersByPublicationYear_delegatesToRepository() {
        when(paperRepository.findPapersByPublicationYear(2022)).thenReturn(Flux.just(paper(1L, "Recent")));

        StepVerifier.create(paperService.findPapersByPublicationYear(2022))
                .expectNextCount(1)
                .verifyComplete();
    }

    @Test
    void findPapersByAuthorName_returnsPapers() {
        when(paperRepository.findPapersByAuthorName("Alice")).thenReturn(Flux.just(paper(1L, "Alice's Paper")));

        StepVerifier.create(paperService.findPapersByAuthorName("Alice"))
                .assertNext(p -> org.junit.jupiter.api.Assertions.assertEquals("Alice's Paper", p.getTitle()))
                .verifyComplete();

        verify(paperRepository).findPapersByAuthorName("Alice");
    }

    @Test
    void findPapersByAuthorName_returnsEmptyWhenNoneFound() {
        when(paperRepository.findPapersByAuthorName("Unknown")).thenReturn(Flux.empty());

        StepVerifier.create(paperService.findPapersByAuthorName("Unknown"))
                .verifyComplete();
    }

    @Test
    void findPapersByInstitutionName_delegatesToRepository() {
        when(paperRepository.findPapersByInstitutionName("MIT")).thenReturn(Flux.just(paper(3L, "MIT Paper")));

        StepVerifier.create(paperService.findPapersByInstitutionName("MIT"))
                .expectNextCount(1)
                .verifyComplete();

        verify(paperRepository).findPapersByInstitutionName("MIT");
    }

    @Test
    void createPaper_savesAndReturnsPaper() {
        Paper p = paper(5L, "New Paper");
        when(paperRepository.save(p)).thenReturn(Mono.just(p));

        StepVerifier.create(paperService.createPaper(p))
                .expectNext(p)
                .verifyComplete();

        verify(paperRepository).save(p);
    }

    @Test
    void findPapersByTitleFuzzy_findsTypo() {
        Paper p = paper(1L, "dette er en test");
        when(paperRepository.findAll()).thenReturn(Flux.just(p));

        StepVerifier.create(paperService.findPapersByTitleFuzzy("tset"))
                .expectNext(p)
                .verifyComplete();
    }

    @Test
    void findPapersByTitleFuzzy_returnsEmptyWhenNoMatch() {
        Paper p = paper(1L, "Graph Theory");
        when(paperRepository.findAll()).thenReturn(Flux.just(p));

        StepVerifier.create(paperService.findPapersByTitleFuzzy("xyz"))
                .verifyComplete();
    }

    @Test
    void findPapersByTitleFuzzy_stillFindsExactContains() {
        Paper p = paper(1L, "dette er en test");
        when(paperRepository.findAll()).thenReturn(Flux.just(p));

        StepVerifier.create(paperService.findPapersByTitleFuzzy("test"))
                .expectNext(p)
                .verifyComplete();
    }

    @Test
    void addCitation_delegatesToRepository() {
        when(paperRepository.addCitation(1L, 2L)).thenReturn(Mono.empty());

        StepVerifier.create(paperService.addCitation(1L, 2L))
                .verifyComplete();

        verify(paperRepository).addCitation(1L, 2L);
    }

    @Test
    void deletePaper_delegatesToRepository() {
        when(paperRepository.deleteById(1L)).thenReturn(Mono.empty());

        StepVerifier.create(paperService.deletePaper(1L))
                .verifyComplete();

        verify(paperRepository).deleteById(1L);
    }
}
