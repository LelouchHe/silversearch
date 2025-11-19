import { editor } from "@silverbulletmd/silverbullet/syscalls";
import { excerptAfter, excerptBefore } from "./global.ts";
import { Query } from "./query.ts";
import { getPlugConfig } from "./settings.ts";
import { removeDiacritics } from "./utils.ts";
import { ResultExcerpt, SearchMatch } from "../../shared/global.ts";

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stringsToRegex(strings: string[]): RegExp {
    if (!strings.length) return /^$/g;

    // sort strings by decreasing length, so that longer strings are matched first
    strings.sort((a, b) => b.length - a.length);

    const joined = `(${strings
        .map(s => `\\b${escapeRegExp(s)}\\b|${escapeRegExp(s)}`)
        .join('|')})`;

    return new RegExp(`${joined}`, 'gui');
}

async function processTextForDisplay(text: string): Promise<string> {
    const settings = await getPlugConfig();
    
    text = escapeHTML(text);
    
    if (settings.renderLineReturnInExcerpts) {
        text = text.replaceAll('\n', '<br>');
    }
    
    return text;
}

async function normalizeLineBreaks(text: string): Promise<string> {
    const settings = await getPlugConfig();
    
    if (settings.renderLineReturnInExcerpts) {
        const lineReturn = new RegExp(/(?:\r\n|\r|\n)/g);
        // Remove multiple line returns
        text = text
            .split(lineReturn)
            .filter(l => l)
            .join('\n');
    }
    
    return text;
}

export async function getMatches(
    text: string,
    words: string[],
    query?: Query
): Promise<SearchMatch[]> {
    const settings = await getPlugConfig();

    words = words.map(escapeHTML);
    const reg = stringsToRegex(words);
    const originalText = text;

    if (settings.ignoreDiacritics) {
        text = removeDiacritics(text, settings.ignoreArabicDiacritics);
    }

    const startTime = new Date().getTime();
    let match: RegExpExecArray | null = null;
    const matches: SearchMatch[] = [];
    let count = 0;
    while ((match = reg.exec(text)) !== null) {
        // Avoid infinite loops, stop looking after 100 matches or if we're taking too much time
        if (++count >= 100 || new Date().getTime() - startTime > 50) break;

        const matchStartIndex = match.index;
        const matchEndIndex = matchStartIndex + match[0].length;
        let originalMatch = originalText
            .substring(matchStartIndex, matchEndIndex)
            .trim();

        if (originalMatch && match.index >= 0) {
            // Process match the same way as excerpt content for consistent highlighting
            originalMatch = await normalizeLineBreaks(originalMatch);
            originalMatch = originalMatch.trim();
            originalMatch = await processTextForDisplay(originalMatch);
            matches.push({ match: originalMatch, offset: match.index });
        }
    }

    // If the query is more than 1 token and can be found "as is" in the text, put this match first
    if (query && (query.query.text.length > 1 || query.getExactTerms().length > 0)) {
        const best = text.indexOf(query.getBestStringForExcerpt());
        if (best > -1 && matches.find(m => m.offset === best)) {
            let bestMatch = query.getBestStringForExcerpt();
            bestMatch = await normalizeLineBreaks(bestMatch);
            bestMatch = bestMatch.trim();
            bestMatch = await processTextForDisplay(bestMatch);
            matches.unshift({
                offset: best,
                match: bestMatch,
            });
        }
    }

    return matches;
}

export async function makeExcerpt(content: string, offset: number): Promise<ResultExcerpt> {
    const settings = await getPlugConfig();

    try {
        const pos = offset ?? -1;
        const from = Math.max(0, pos - excerptBefore);
        const to = Math.min(content.length, pos + excerptAfter);
        
        if (pos > -1) {
            content = content.slice(from, to);
        } else {
            content = content.slice(0, excerptAfter);
        }
        
        // Calculate relative position BEFORE any transformations
        const relativePos = pos - from;
        
        if (settings.renderLineReturnInExcerpts) {
            // Slice at line breaks BEFORE normalizing them
            // This uses the original line break positions
            const last = content.slice(0, relativePos).lastIndexOf('\n');

            if (last > 0) {
                content = content.slice(last + 1); // Skip the newline itself
            }
        }
        
        // Trim after slicing
        content = content.trim();
        content = (from > 0 ? '…' : '') + content + (to < content.length - 1 ? '…' : '');
        
        // Now normalize line breaks (collapse multiple to single)
        content = await normalizeLineBreaks(content);

        // Final processing for display
        content = await processTextForDisplay(content);

        return { excerpt: content, offset: offset };
    } catch (e) {
        await editor.flashNotification("Silversearch - Error while creating excerpt, see developer console", "error");
        console.error("[Silversearch] Error while creating excerpt", e);
        return { excerpt: "", offset: 0 };
    }
}

export function escapeHTML(html: string): string {
    return html
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}