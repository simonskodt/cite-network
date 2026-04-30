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

    public Flux<Paper> findPapersByTitleFuzzy(String query) {
        if (query == null) {
            return Flux.empty();
        }
        String q = query.toLowerCase().trim();
        if (q.isEmpty()) {
            return Flux.empty();
        }
        return paperRepository.findAll()
                .filter(p -> isFuzzyTitleMatch(p.getTitle(), q));
    }

    private boolean isFuzzyTitleMatch(String title, String query) {
        if (title == null) return false;
        String lower = title.toLowerCase();
        if (lower.contains(query)) return true;
        String[] queryWords = query.split("\\s+");
        String[] titleWords = lower.split("\\s+");
        for (String qw : queryWords) {
            if (qw.length() < 3) continue;
            for (String tw : titleWords) {
                if (levenshtein(qw, tw) <= editThreshold(qw)) return true;
            }
        }
        return false;
    }

    private int editThreshold(String word) {
        return (int) Math.ceil(word.length() / 3.0);
    }

    private int levenshtein(String a, String b) {
        int m = a.length(), n = b.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;
        for (int i = 1; i <= m; i++)
            for (int j = 1; j <= n; j++)
                dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                        ? dp[i - 1][j - 1]
                        : 1 + Math.min(dp[i - 1][j - 1], Math.min(dp[i - 1][j], dp[i][j - 1]));
        return dp[m][n];
    }
}
