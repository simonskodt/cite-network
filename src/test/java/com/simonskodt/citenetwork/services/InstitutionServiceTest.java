package com.simonskodt.citenetwork.services;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.repositories.InstitutionRepository;
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
class InstitutionServiceTest {

    @Mock
    InstitutionRepository institutionRepository;

    @InjectMocks
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
    void findAuthorsByInstitutionName_delegatesToRepository() {
        Author a = author(1L, "Alice");
        when(institutionRepository.findAuthorsByInstitutionName("USI")).thenReturn(Flux.just(a));

        StepVerifier.create(institutionService.findAuthorsByInstitutionName("USI"))
                .assertNext(result -> assertEquals("Alice", result.getName()))
                .verifyComplete();

        verify(institutionRepository).findAuthorsByInstitutionName("USI");
    }

    @Test
    void findAuthorsByInstitutionName_returnsEmptyWhenNoneFound() {
        when(institutionRepository.findAuthorsByInstitutionName("Unknown")).thenReturn(Flux.empty());

        StepVerifier.create(institutionService.findAuthorsByInstitutionName("Unknown"))
                .verifyComplete();
    }

    @Test
    void findPapersByInstitutionName_delegatesToRepository() {
        Paper p = paper(1L, "USI Paper");
        when(institutionRepository.findPapersByInstitutionName("USI")).thenReturn(Flux.just(p));

        StepVerifier.create(institutionService.findPapersByInstitutionName("USI"))
                .assertNext(result -> assertEquals("USI Paper", result.getTitle()))
                .verifyComplete();

        verify(institutionRepository).findPapersByInstitutionName("USI");
    }

    @Test
    void findPapersByInstitutionName_returnsEmptyWhenNoneFound() {
        when(institutionRepository.findPapersByInstitutionName("Unknown")).thenReturn(Flux.empty());

        StepVerifier.create(institutionService.findPapersByInstitutionName("Unknown"))
                .verifyComplete();
    }

    @Test
    void findInstitutionsByAuthorName_delegatesToRepository() {
        Institution inst = institution(1L, "USI", "Lugano");
        when(institutionRepository.findInstitutionsByAuthorName("Alice")).thenReturn(Flux.just(inst));

        StepVerifier.create(institutionService.findInstitutionsByAuthorName("Alice"))
                .assertNext(result -> assertEquals("USI", result.getName()))
                .verifyComplete();

        verify(institutionRepository).findInstitutionsByAuthorName("Alice");
    }

    @Test
    void findInstitutionsByAuthorName_returnsEmptyWhenNoneFound() {
        when(institutionRepository.findInstitutionsByAuthorName("Unknown")).thenReturn(Flux.empty());

        StepVerifier.create(institutionService.findInstitutionsByAuthorName("Unknown"))
                .verifyComplete();
    }

    @Test
    void createInstitution_savesAndReturnsInstitution() {
        Institution inst = institution(1L, "ETH Zurich", "Zurich");
        when(institutionRepository.save(inst)).thenReturn(Mono.just(inst));

        StepVerifier.create(institutionService.createInstitution(inst))
                .expectNext(inst)
                .verifyComplete();

        verify(institutionRepository).save(inst);
    }

    @Test
    void deleteInstitution_delegatesToRepository() {
        when(institutionRepository.deleteById(1L)).thenReturn(Mono.empty());

        StepVerifier.create(institutionService.deleteInstitution(1L))
                .verifyComplete();

        verify(institutionRepository).deleteById(1L);
    }
}
