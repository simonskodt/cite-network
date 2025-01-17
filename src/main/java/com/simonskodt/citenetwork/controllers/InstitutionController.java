package com.simonskodt.citenetwork.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.services.InstitutionService;

import java.util.List;

@RestController
@RequestMapping("/institutions")
public class InstitutionController {
    private final InstitutionService institutionService;

    public InstitutionController(InstitutionService institutionService) {
        this.institutionService = institutionService;
    }

    @GetMapping("/authors/{institutionName}")
    public List<Author> findAuthorsByInstitutionName(@PathVariable String institutionName) {
        return institutionService.findAuthorsByInstitutionName(institutionName);
    }

    @GetMapping("/papers/{institutionName}")
    public List<Paper> findPapersByInstitutionName(@PathVariable String institutionName) {
        return institutionService.findPapersByInstitutionName(institutionName);
    }

    @GetMapping("/author/{authorName}")
    public List<Institution> findInstitutionsByAuthorName(@PathVariable String authorName) {
        return institutionService.findInstitutionsByAuthorName(authorName);
    }
}
