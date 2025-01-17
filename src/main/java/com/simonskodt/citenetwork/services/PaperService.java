package com.simonskodt.citenetwork.services;

import java.util.List;

import org.springframework.stereotype.Service;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.repositories.PaperRepository;

@Service
public class PaperService {
    private final PaperRepository paperRepository;

    public PaperService(PaperRepository paperRepository) {
        this.paperRepository = paperRepository;
    }

    public List<String> findFirstTenPapers() {
        return paperRepository.findFirstTenPapers();
    }

    public Paper findPaperByTitle(String title) {
        return paperRepository.findPaperByTitle(title);
    }

    public List<Paper> findPapersCitedByPaper(Long paperId) {
        return paperRepository.findPapersCitedByPaper(paperId);
    }

    public List<Paper> findPapersCitingPaper(Long paperId) {
        return paperRepository.findPapersCitingPaper(paperId);
    }

    public List<Paper> findPapersByPublicationYear(int year) {
        return paperRepository.findPapersByPublicationYear(year);
    }

    public List<Paper> findPapersByInstitutionName(String institutionName) {
        return paperRepository.findPapersByInstitutionName(institutionName);
    }

    public List<Paper> findPapersByAuthorName(String authorName) {
        return paperRepository.findPapersByAuthorName(authorName);
    }
}
