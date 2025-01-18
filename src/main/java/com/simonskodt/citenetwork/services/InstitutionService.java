package com.simonskodt.citenetwork.services;

import org.springframework.stereotype.Service;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.repositories.InstitutionRepository;

import reactor.core.publisher.Flux;

@Service
public class InstitutionService {
    private final InstitutionRepository institutionRepository;

    public InstitutionService(InstitutionRepository institutionRepository) {
        this.institutionRepository = institutionRepository;
    }

    public Flux<Author> findAuthorsByInstitutionName(String institutionName) {
        return institutionRepository.findAuthorsByInstitutionName(institutionName);
    }

    public Flux<Paper> findPapersByInstitutionName(String institutionName) {
        return institutionRepository.findPapersByInstitutionName(institutionName);
    }

    public Flux<Institution> findInstitutionsByAuthorName(String authorName) {
        return institutionRepository.findInstitutionsByAuthorName(authorName);
    }
}