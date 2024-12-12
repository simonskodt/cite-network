package com.simonskodt.citenetwork.service;

import org.springframework.stereotype.Service;

import com.simonskodt.citenetwork.entities.Paper;
import com.simonskodt.citenetwork.repositories.PaperRepository;

@Service
public class PaperService {
    private final PaperRepository paperRepository;

    public PaperService(PaperRepository paperRepository) {
        this.paperRepository = paperRepository;
    }

    public Paper findPaper(String title) {
        return paperRepository.findPaperByTitle(title);
    }
}
