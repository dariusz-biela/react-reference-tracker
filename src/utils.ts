import {RENDER_CLASSIFICATION} from './types';
import type {RefResult, RefSnapshot, RenderClassification} from './types';

const MAX_LOGGED_PATHS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

interface ArrayMatchResult {
    matched: [number, number][];
    unmatchedPrev: number[];
    unmatchedCurr: number[];
}

function matchArrayByIdentity(prev: unknown[], curr: unknown[]): ArrayMatchResult {
    const matched: [number, number][] = [];
    const unmatchedPrev: number[] = [];
    const usedCurrIndices = new Set<number>();

    const currIndices = new Map<unknown, number[]>();
    for (let i = 0; i < curr.length; i++) {
        const element = curr[i];
        const indices = currIndices.get(element);
        if (indices) {
            indices.push(i);
        } else {
            currIndices.set(element, [i]);
        }
    }

    for (let i = 0; i < prev.length; i++) {
        const indices = currIndices.get(prev[i]);
        let found = false;
        if (indices) {
            for (const idx of indices) {
                if (!usedCurrIndices.has(idx)) {
                    matched.push([i, idx]);
                    usedCurrIndices.add(idx);
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            unmatchedPrev.push(i);
        }
    }

    const unmatchedCurr: number[] = [];
    for (let i = 0; i < curr.length; i++) {
        if (!usedCurrIndices.has(i)) {
            unmatchedCurr.push(i);
        }
    }

    return {matched, unmatchedPrev, unmatchedCurr};
}

function deepClone(value: unknown): unknown {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    try {
        return structuredClone(value);
    } catch {
        return value;
    }
}

function getRefChangedPaths(
    prev: unknown,
    curr: unknown,
    path: string,
    maxDepth: number,
    depth: number,
    changes: string[],
): void {
    if (changes.length >= MAX_LOGGED_PATHS || depth > maxDepth) {
        return;
    }
    if (prev === curr) {
        return;
    }
    changes.push(path);
    if (Array.isArray(prev) && Array.isArray(curr)) {
        const {unmatchedPrev, unmatchedCurr} = matchArrayByIdentity(prev, curr);
        const pairCount = Math.min(unmatchedPrev.length, unmatchedCurr.length);
        for (let i = 0; i < pairCount; i++) {
            if (changes.length >= MAX_LOGGED_PATHS) return;
            getRefChangedPaths(
                prev[unmatchedPrev[i]],
                curr[unmatchedCurr[i]],
                `${path}.${unmatchedCurr[i]}`,
                maxDepth,
                depth + 1,
                changes,
            );
        }
        for (let i = pairCount; i < unmatchedCurr.length; i++) {
            if (changes.length >= MAX_LOGGED_PATHS) return;
            getRefChangedPaths(
                undefined,
                curr[unmatchedCurr[i]],
                `${path}.${unmatchedCurr[i]}`,
                maxDepth,
                depth + 1,
                changes,
            );
        }
        if (prev.length !== curr.length && changes.length < MAX_LOGGED_PATHS) {
            changes.push(`${path}.length`);
        }
    } else if (isRecord(prev) && isRecord(curr)) {
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
        for (const key of allKeys) {
            if (changes.length >= MAX_LOGGED_PATHS) {
                return;
            }
            getRefChangedPaths(prev[key], curr[key], `${path}.${key}`, maxDepth, depth + 1, changes);
        }
    }
}

function getValueChangedPaths(
    prev: unknown,
    curr: unknown,
    path: string,
    maxDepth: number,
    depth: number,
    changes: string[],
    prevRaw: unknown,
): void {
    if (changes.length >= MAX_LOGGED_PATHS || depth > maxDepth) {
        return;
    }
    if (Array.isArray(prev) && Array.isArray(curr) && Array.isArray(prevRaw)) {
        const {matched, unmatchedPrev, unmatchedCurr} = matchArrayByIdentity(prevRaw, curr);
        for (const [prevIdx, currIdx] of matched) {
            if (changes.length >= MAX_LOGGED_PATHS) return;
            getValueChangedPaths(
                prev[prevIdx],
                curr[currIdx],
                `${path}.${currIdx}`,
                maxDepth,
                depth + 1,
                changes,
                prevRaw[prevIdx],
            );
        }
        const pairCount = Math.min(unmatchedPrev.length, unmatchedCurr.length);
        for (let i = 0; i < pairCount; i++) {
            if (changes.length >= MAX_LOGGED_PATHS) return;
            getValueChangedPaths(
                prev[unmatchedPrev[i]],
                curr[unmatchedCurr[i]],
                `${path}.${unmatchedCurr[i]}`,
                maxDepth,
                depth + 1,
                changes,
                prevRaw[unmatchedPrev[i]],
            );
        }
        for (let i = pairCount; i < unmatchedCurr.length; i++) {
            if (changes.length >= MAX_LOGGED_PATHS) return;
            getValueChangedPaths(
                undefined,
                curr[unmatchedCurr[i]],
                `${path}.${unmatchedCurr[i]}`,
                maxDepth,
                depth + 1,
                changes,
                undefined,
            );
        }
        if (prev.length !== curr.length && changes.length < MAX_LOGGED_PATHS) {
            changes.push(`${path}.length`);
        }
        return;
    }
    if (isRecord(prev) && isRecord(curr)) {
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
        for (const key of allKeys) {
            if (changes.length >= MAX_LOGGED_PATHS) {
                return;
            }
            getValueChangedPaths(
                prev[key],
                curr[key],
                `${path}.${key}`,
                maxDepth,
                depth + 1,
                changes,
                isRecord(prevRaw) ? prevRaw[key] : undefined,
            );
        }
        return;
    }
    if (prev !== curr) {
        changes.push(path);
    }
}

function isDescendantOrSelf(ancestor: string, descendant: string): boolean {
    return descendant === ancestor || descendant.startsWith(`${ancestor}.`);
}

function getUnnecessaryRefChanges(refChanges: string[], valueChanges: string[]): string[] {
    return refChanges.filter((refPath) => !valueChanges.some((valPath) => isDescendantOrSelf(refPath, valPath)));
}

function classifyRender(
    refSame: boolean,
    valueChangedPaths: string[],
    unnecessaryRefChanges: string[],
): RenderClassification {
    if (refSame && valueChangedPaths.length === 0) {
        return RENDER_CLASSIFICATION.NO_CHANGE;
    }
    if (refSame && valueChangedPaths.length > 0) {
        return RENDER_CLASSIFICATION.MUTATION;
    }
    if (!refSame && valueChangedPaths.length === 0) {
        return RENDER_CLASSIFICATION.NEW_REF_NO_VALUE;
    }
    return RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE;
}

function analyzeRef(
    snapshot: RefSnapshot | undefined,
    currentValue: unknown,
    name: string,
    maxDepth: number,
): RefResult {
    if (snapshot === undefined) {
        return {
            name,
            classification: RENDER_CLASSIFICATION.INITIAL,
            refChangedPaths: [],
            valueChangedPaths: [],
            unnecessaryRefChanges: [],
        };
    }

    const refSame = snapshot.raw === currentValue;

    const refChangedPaths: string[] = [];
    if (!refSame) {
        getRefChangedPaths(snapshot.raw, currentValue, name, maxDepth, 0, refChangedPaths);
    }

    const valueChangedPaths: string[] = [];
    getValueChangedPaths(snapshot.clone, currentValue, name, maxDepth, 0, valueChangedPaths, snapshot.raw);

    const unnecessaryRefChanges = getUnnecessaryRefChanges(refChangedPaths, valueChangedPaths);
    const classification = classifyRender(refSame, valueChangedPaths, unnecessaryRefChanges);

    return {name, classification, refChangedPaths, valueChangedPaths, unnecessaryRefChanges};
}

export {deepClone, analyzeRef};
