package com.simonskodt.citenetwork.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/first10")
    public Flux<String> findFirstTenPapers() {
        return paperService.findFirstTenPapers();
    }

    @GetMapping("/title/{title}")
    public Mono<Paper> findPaperByTitle(@PathVariable String title) {
        return paperService.findPaperByTitle(title);
    }

    @GetMapping("/citedBy/{paperId}")
    public Flux<Paper> findPapersCitedByPaper(@PathVariable Long paperId) {
        return paperService.findPapersCitedByPaper(paperId);
    }

    @GetMapping("/citing/{paperId}")
    public Flux<Paper> findPapersCitingPaper(@PathVariable Long paperId) {
        return paperService.findPapersCitingPaper(paperId);
    }

    @GetMapping("/year/{year}")
    public Flux<Paper> findPapersByPublicationYear(@PathVariable int year) {
        Flux<Paper> papers = paperService.findPapersByPublicationYear(year);
        System.out.println(papers);
        return papers;
    }

    @GetMapping("/institution/{institutionName}")
    public Flux<Paper> findPapersByInstitutionName(@PathVariable String institutionName) {
        return paperService.findPapersByInstitutionName(institutionName);
    }

    @GetMapping("/author/{authorName}")
    public Flux<Paper> findPapersByAuthorName(@PathVariable String authorName) {
        return paperService.findPapersByAuthorName(authorName);
    }
}
