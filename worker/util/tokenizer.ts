import { splitCamelCase, splitHyphens } from "./utils.ts";
import { QueryCombination } from "minisearch";
import { extractMdLinks } from "md-link-extractor";
import { BRACKETS_AND_SPACE, SPACE_OR_PUNCTUATION } from "./global.ts";

export function tokenizeForIndexing(text: string, options: { tokenizeUrls: boolean }): string[] {
    try {
        const words = tokenizeWords(text);

        let urls: string[] = [];
        if (options.tokenizeUrls) {
            // Would love to use silverbullet here, but we can't introduce async here
            urls = extractMdLinks(text).map(link => link.href);
        }

        const tokens = tokenizeTokens(text)
            .flatMap(token => [
                token,
                ...splitHyphens(token),
                ...splitCamelCase(token),
            ]);

        // Just throw all methods of tokenization at the problem and hope some
        // stuff sticks. Unsure if this is really the best approach here, but
        // it's the one omnisearch chooses
        const all = [
            ...tokens,
            ...words,
            ...urls,
        ];

        // Omnisearch removed this too
        // My guess would be that keeping doubled tokens improves search results
        // all = [...new Set(all)];

        return all;
    } catch (e) {
        console.error("[Silversearch] Error tokenizing text, skipping document", e);
        return [];
    }
}

export function tokenizeForSearch(text: string): QueryCombination {
    // Extract urls and remove them from the query
    const urls: string[] = extractMdLinks(text).map(link => link.href);
    text = urls.reduce((acc, url) => acc.replace(url, ""), text);

    const tokens = [...tokenizeTokens(text), ...urls];

    return {
        combineWith: 'OR',
        queries: [
            { combineWith: 'AND', queries: tokens },
            { combineWith: 'AND', queries: tokenizeWords(text) },
            { combineWith: 'AND', queries: tokens.flatMap(splitHyphens) },
            { combineWith: 'AND', queries: tokens.flatMap(splitCamelCase) },
        ],
    };
}


function tokenizeWords(text: string): string[] {
    const tokens = text.split(BRACKETS_AND_SPACE).filter(Boolean);
    return tokenizeLanguage(tokens);
}

function tokenizeTokens(text: string): string[] {
    return text.split(SPACE_OR_PUNCTUATION).filter(Boolean);
    //return tokenizeLanguage(tokens);
}

function tokenizeLanguage(tokens: string[]): string[] {
    return tokens;
}
