package com.simonskodt.citenetwork.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.service.PaperService;

@RestController
public class PaperController {
    private final PaperService paperService;

    public PaperController(PaperService paperService) {
        this.paperService = paperService;
    }

    @GetMapping("/paper/{title}")
    public Paper getPaper(@PathVariable String title) {
        return paperService.findPaper(title);
    }
}
