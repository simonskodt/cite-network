package com.simonskodt.citenetwork.services;

import java.util.List;

import org.springframework.stereotype.Service;

import com.simonskodt.citenetwork.entities.Author;
import com.simonskodt.citenetwork.entities.Institution;
import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.repositories.InstitutionRepository;

@Service
public class InstitutionService {
    private final InstitutionRepository institutionRepository;

    public InstitutionService(InstitutionRepository institutionRepository) {
        this.institutionRepository = institutionRepository;
    }

    public List<Author> findAuthorsByInstitutionName(String institutionName) {
        return institutionRepository.findAuthorsByInstitutionName(institutionName);
    }

    public List<Paper> findPapersByInstitutionName(String institutionName) {
        return institutionRepository.findPapersByInstitutionName(institutionName);
    }

    public List<Institution> findInstitutionsByAuthorName(String authorName) {
        return institutionRepository.findInstitutionsByAuthorName(authorName);
    }
}