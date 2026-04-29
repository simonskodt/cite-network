package com.simonskodt.citenetwork.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.services.PaperService;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/papers")
public class PaperController {
    private final PaperService paperService;

    public PaperController(PaperService paperService) {
        this.paperService = paperService;
    }

    @GetMapping
    public Flux<Paper> findFirstTenPapers() {
        return paperService.findFirstTenPapers();
    }

    @GetMapping("/title/{title}")
    public Flux<Paper> findPapersByTitle(@PathVariable String title) {
        return paperService.findPapersByTitle(title);
    }

    @GetMapping("/{paperId}/cited-by")
    public Flux<Paper> findPapersCitedByPaper(@PathVariable Long paperId) {
        return paperService.findPapersCitedByPaper(paperId);
    }

    @GetMapping("/{paperId}/citing")
    public Flux<Paper> findPapersCitingPaper(@PathVariable Long paperId) {
        return paperService.findPapersCitingPaper(paperId);
    }

    @GetMapping("/year/{year}")
    public Flux<Paper> findPapersByPublicationYear(@PathVariable int year) {
        return paperService.findPapersByPublicationYear(year);
    }

    @GetMapping("/institution/{institutionName}")
    public Flux<Paper> findPapersByInstitutionName(@PathVariable String institutionName) {
        return paperService.findPapersByInstitutionName(institutionName);
    }

    @GetMapping("/author/{authorName}")
    public Flux<Paper> findPapersByAuthorName(@PathVariable String authorName) {
        return paperService.findPapersByAuthorName(authorName);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Paper> createPaper(@RequestBody Paper paper) {
        return paperService.createPaper(paper);
    }

    @PostMapping("/{citingId}/cites/{citedId}")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Void> addCitation(@PathVariable Long citingId, @PathVariable Long citedId) {
        return paperService.addCitation(citingId, citedId);
    }

    @GetMapping("/fuzzy-title/{query}")
    public Flux<Paper> findPapersByTitleFuzzy(@PathVariable String query) {
        return paperService.findPapersByTitleFuzzy(query);
    }

    @DeleteMapping("/{paperId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deletePaper(@PathVariable Long paperId) {
        return paperService.deletePaper(paperId);
    }
}
