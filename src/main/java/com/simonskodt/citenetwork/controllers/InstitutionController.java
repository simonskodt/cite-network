package com.simonskodt.citenetwork.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.services.InstitutionService;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/institutions")
public class InstitutionController {
    private final InstitutionService institutionService;

    public InstitutionController(InstitutionService institutionService) {
        this.institutionService = institutionService;
    }

    @GetMapping("/authors/{institutionName}")
    public Flux<Author> findAuthorsByInstitutionName(@PathVariable String institutionName) {
        return institutionService.findAuthorsByInstitutionName(institutionName);
    }

    @GetMapping("/papers/{institutionName}")
    public Flux<Paper> findPapersByInstitutionName(@PathVariable String institutionName) {
        return institutionService.findPapersByInstitutionName(institutionName);
    }

    @GetMapping("/author/{authorName}")
    public Flux<Institution> findInstitutionsByAuthorName(@PathVariable String authorName) {
        return institutionService.findInstitutionsByAuthorName(authorName);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Institution> createInstitution(@RequestBody Institution institution) {
        return institutionService.createInstitution(institution);
    }

    @DeleteMapping("/{institutionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteInstitution(@PathVariable Long institutionId) {
        return institutionService.deleteInstitution(institutionId);
    }
}
