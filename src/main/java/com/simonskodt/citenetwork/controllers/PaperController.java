package com.simonskodt.citenetwork.controllers;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.services.PaperService;

@RestController
@RequestMapping("/papers")
public class PaperController {
    private final PaperService paperService;

    public PaperController(PaperService paperService) {
        this.paperService = paperService;
    }

    @GetMapping("/title/{title}")
    public Paper findPaperByTitle(@PathVariable String title) {
        return paperService.findPaperByTitle(title);
    }

    @GetMapping("/citedBy/{paperId}")
    public List<Paper> findPapersCitedByPaper(@PathVariable Long paperId) {
        return paperService.findPapersCitedByPaper(paperId);
    }

    @GetMapping("/citing/{paperId}")
    public List<Paper> findPapersCitingPaper(@PathVariable Long paperId) {
        return paperService.findPapersCitingPaper(paperId);
    }

    @GetMapping("/year/{year}")
    public List<Paper> findPapersByPublicationYear(@PathVariable int year) {
        return paperService.findPapersByPublicationYear(year);
    }

    @GetMapping("/institution/{institutionName}")
    public List<Paper> findPapersByInstitutionName(@PathVariable String institutionName) {
        return paperService.findPapersByInstitutionName(institutionName);
    }

    @GetMapping("/author/{authorName}")
    public List<Paper> findPapersByAuthorName(@PathVariable String authorName) {
        return paperService.findPapersByAuthorName(authorName);
    }
}
