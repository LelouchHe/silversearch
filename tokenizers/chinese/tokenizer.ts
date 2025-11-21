// @deno-types="./jieba-wasm-2.4.0/jieba_rs_wasm.d.ts"
import initWasm, { cut_for_search } from "./jieba-wasm-2.4.0/jieba_rs_wasm.js";

import { clientStore, space } from "@silverbulletmd/silverbullet/syscalls";
import { LIBRARY_PATH } from "../../worker/util/global.ts";

const wasmPath = `${LIBRARY_PATH}/silversearch-tokenizer-chinese.wasm`;
const cacheKey = "silversearch-tokenizer-chinese";
const cacheVersion = 1;

interface Cache {
    version: number;
    data: Uint8Array;
}

export async function init() {
    let cache: Cache | null = await clientStore.get(cacheKey);
    if (!cache || cache.version !== cacheVersion) {
        console.log(`[Silversearch] Chinese tokenizer not found in cache, loading from ${wasmPath}`);
        cache = {
            version: cacheVersion,
            data: await space.readFile(wasmPath),
        };
        await clientStore.set(cacheKey, cache);
        console.log(`[Silversearch] Chinese tokenizer loaded, size: ${cache.data.length / 1024} KB`);
    }

    try {
        // `initWasm` caches the module internally
        // only reload the page can reset it
        await initWasm({ module_or_path: cache.data });
    } catch (e) {
        console.error("[Silversearch] Failed to load Chinese tokenizer: ", e);
        return false;
    }

    return true;
}

export async function reset() {
    await clientStore.del(cacheKey);
}

export function isTarget(word: string): boolean {
    return /[\u4e00-\u9fff]/u.test(word)
}

export function tokenize(word: string): string[] {
    return cut_for_search(word, true).filter(t => !/^[\p{P}\s]+$/u.test(t));
}
