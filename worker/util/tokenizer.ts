import { splitCamelCase, splitHyphens } from "./utils.ts";
import { QueryCombination } from "minisearch";
import { extractMdLinks } from "md-link-extractor";
import { BRACKETS_AND_SPACE, SPACE_OR_PUNCTUATION } from "./global.ts";
import { cut_for_search } from "../../tokenizers/jieba-wasm-2.4.0/src/jieba_rs_wasm.ts";

export function tokenizeForIndexing(text: string, options: { tokenizeUrls: boolean, enableChinese: boolean }): string[] {
    try {
        const words = tokenizeWords(text, options.enableChinese);
        let urls: string[] = [];
        if (options.tokenizeUrls) {
            try {
                // Would love to use silverbullet here, but we can't introduce async here
                // deno-lint-ignore no-explicit-any
                urls = extractMdLinks(text).map((link: any) => link.href);
            } catch (e) {
                console.log("[Silversearch] Error extracting urls", e);
            }
        }

        let tokens = tokenizeTokens(text, options.enableChinese);
        tokens = [...tokens.flatMap(token => [
            token,
            ...splitHyphens(token),
            ...splitCamelCase(token),
        ]), ...words];

        // Add urls
        if (urls.length) {
            tokens = [...tokens, ...urls];
        }

        // Remove duplicates
        tokens = [...new Set(tokens)];

        return tokens;
    } catch (e) {
        console.error("[Silversearch] Error tokenizing text, skipping document", e);
        return [];
    }
}

export function tokenizeForSearch(text: string, options: { enableChinese: boolean }): QueryCombination {
    // Extract urls and remove them from the query
    // deno-lint-ignore no-explicit-any
    const urls: string[] = extractMdLinks(text).map((link: any) => link.href);
    text = urls.reduce((acc, url) => acc.replace(url, ''), text);

    const tokens = [...tokenizeTokens(text, options.enableChinese), ...urls].filter(Boolean);

    return {
        combineWith: 'OR',
        queries: [
            { combineWith: 'AND', queries: tokens },
            {
                combineWith: 'AND',
                queries: tokenizeWords(text, options.enableChinese).filter(Boolean),
            },
            { combineWith: 'AND', queries: tokens.flatMap(splitHyphens) },
            { combineWith: 'AND', queries: tokens.flatMap(splitCamelCase) },
        ],
    };
}

function tokenizeWords(text: string, enableChinese: boolean): string[] {
    return tokenize(text.split(BRACKETS_AND_SPACE), enableChinese);
}

function tokenizeTokens(text: string, enableChinese: boolean): string[] {
    return tokenize(text.split(SPACE_OR_PUNCTUATION), enableChinese);
}

function tokenize(words: string[], enableChinese: boolean): string[] {
    return words.flatMap(word => languageTokenize(word, enableChinese));
}

function languageTokenize(word: string, enableChinese: boolean): string[] {
    // Chinese
    if (enableChinese && /[\u4e00-\u9fff]/u.test(word)) {
        return cut_for_search(word, true).filter(t => !/^[\p{P}\s]+$/u.test(t));
    }

    // default: word as token
    return [word];
}
