package com.simonskodt.citenetwork.services;

import org.springframework.stereotype.Service;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.repositories.PaperRepository;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class PaperService {
    private final PaperRepository paperRepository;

    public PaperService(PaperRepository paperRepository) {
        this.paperRepository = paperRepository;
    }

    public Flux<Paper> findFirstTenPapers() {
        return paperRepository.findFirstTenPapers();
    }

    public Flux<Paper> findPapersByTitle(String title) {
        return paperRepository.findPapersByTitle(title);
    }

    public Flux<Paper> findPapersCitedByPaper(Long paperId) {
        return paperRepository.findPapersCitedByPaper(paperId);
    }

    public Flux<Paper> findPapersCitingPaper(Long paperId) {
        return paperRepository.findPapersCitingPaper(paperId);
    }

    public Flux<Paper> findPapersByPublicationYear(int year) {
        return paperRepository.findPapersByPublicationYear(year);
    }

    public Flux<Paper> findPapersByInstitutionName(String institutionName) {
        return paperRepository.findPapersByInstitutionName(institutionName);
    }

    public Flux<Paper> findPapersByAuthorName(String authorName) {
        return paperRepository.findPapersByAuthorName(authorName);
    }

    public Mono<Paper> createPaper(Paper paper) {
        return paperRepository.save(paper);
    }

    public Mono<Void> addCitation(Long citingId, Long citedId) {
        return paperRepository.addCitation(citingId, citedId);
    }

    public Mono<Void> deletePaper(Long paperId) {
        return paperRepository.deleteById(paperId);
    }
}
