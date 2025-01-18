package com.simonskodt.citenetwork.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.services.InstitutionService;

import reactor.core.publisher.Flux;

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
}
