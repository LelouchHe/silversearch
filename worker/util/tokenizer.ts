import { splitCamelCase, splitHyphens } from "./utils.ts";
import { QueryCombination } from "minisearch";
import { extractMdLinks } from "md-link-extractor";
import { BRACKETS_AND_SPACE, SPACE_OR_PUNCTUATION } from "./global.ts";
import { Segment, useDefault } from 'segmentit';

const segmentit = useDefault(new Segment());

export function tokenizeForIndexing(text: string, options: { tokenizeUrls: boolean, enableChineseTokenization: boolean }): string[] {
    try {
        const words = tokenizeWords(text);
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

        let tokens = tokenizeTokens(text, { skipChs: !options.enableChineseTokenization });
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

export function tokenizeForSearch(text: string, options: { enableChineseTokenization: boolean }): QueryCombination {
    // Extract urls and remove them from the query
    // deno-lint-ignore no-explicit-any
    const urls: string[] = extractMdLinks(text).map((link: any) => link.href);
    text = urls.reduce((acc, url) => acc.replace(url, ''), text);

    const tokens = [...tokenizeTokens(text, { skipChs: !options.enableChineseTokenization }), ...urls].filter(Boolean);

    return {
        combineWith: 'OR',
        queries: [
            { combineWith: 'AND', queries: tokens },
            {
                combineWith: 'AND',
                queries: tokenizeWords(text).filter(Boolean),
            },
            { combineWith: 'AND', queries: tokens.flatMap(splitHyphens) },
            { combineWith: 'AND', queries: tokens.flatMap(splitCamelCase) },
        ],
    };
}

function tokenizeWords(text: string, { skipChs = false } = {}): string[] {
    const tokens = text.split(BRACKETS_AND_SPACE);
    if (skipChs) return tokens;
    return tokenizeChsWord(tokens);
}

function tokenizeTokens(text: string, { skipChs = false } = {}): string[] {
    const tokens = text.split(SPACE_OR_PUNCTUATION);
    if (skipChs) return tokens;
    return tokenizeChsWord(tokens);
}

function tokenizeChsWord(tokens: string[]): string[] {
    const result: string[] = [];
    for (const token of tokens) {
        if (/[\u4e00-\u9fa5]/.test(token)) {
            const segments = segmentit.doSegment(token, { simple: true, stripPunctuation : true });
            result.push(...segments);
            console.log("SEGMENTS: ", segments);
        } else {
            result.push(token);
        }
    }
    return result;
}
