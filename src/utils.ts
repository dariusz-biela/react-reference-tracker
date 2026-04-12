import {RENDER_CLASSIFICATION} from './types';
import type {RefResult, RefSnapshot, RenderClassification, ValueChangeDetail} from './types';

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

function isPlainObjectOrArray(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    if (Array.isArray(value)) {
        return true;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function deepClone(value: unknown): unknown {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    if (!isPlainObjectOrArray(value)) {
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
    seen?: Set<unknown>,
): void {
    if (changes.length >= MAX_LOGGED_PATHS || depth > maxDepth) {
        return;
    }
    if (prev === curr) {
        return;
    }
    changes.push(path);

    const visited = seen ?? new Set<unknown>();
    if (isRecord(prev)) {
        if (visited.has(prev)) return;
        visited.add(prev);
    }
    if (isRecord(curr)) {
        if (visited.has(curr)) return;
        visited.add(curr);
    }

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
                visited,
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
                visited,
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
            getRefChangedPaths(prev[key], curr[key], `${path}.${key}`, maxDepth, depth + 1, changes, visited);
        }
    }
}

const MAX_SERIALIZED_LENGTH = 120;

function serializeValue(val: unknown): string {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'function') return 'Function';
    if (typeof val === 'string') return val.length > 60 ? `"${val.slice(0, 57)}..."` : `"${val}"`;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    const json = JSON.stringify(val);
    return json.length > MAX_SERIALIZED_LENGTH ? `${json.slice(0, MAX_SERIALIZED_LENGTH - 3)}...` : json;
}

function getValueChangedPaths(
    prev: unknown,
    curr: unknown,
    path: string,
    maxDepth: number,
    depth: number,
    changes: string[],
    prevRaw: unknown,
    details: ValueChangeDetail[],
    seen?: Set<unknown>,
): void {
    if (changes.length >= MAX_LOGGED_PATHS || depth > maxDepth) {
        return;
    }

    const visited = seen ?? new Set<unknown>();
    if (isRecord(curr)) {
        if (visited.has(curr)) return;
        visited.add(curr);
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
                details,
                visited,
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
                details,
                visited,
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
                details,
                visited,
            );
        }
        if (prev.length !== curr.length && changes.length < MAX_LOGGED_PATHS) {
            changes.push(`${path}.length`);
            details.push({path: `${path}.length`, prev: serializeValue(prev.length), curr: serializeValue(curr.length)});
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
                details,
                visited,
            );
        }
        return;
    }
    if (prev !== curr) {
        changes.push(path);
        details.push({path, prev: serializeValue(prev), curr: serializeValue(curr)});
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
    _unnecessaryRefChanges: string[],
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
            valueChangedDetails: [],
            unnecessaryRefChanges: [],
        };
    }

    const refSame = snapshot.raw === currentValue;

    const refChangedPaths: string[] = [];
    if (!refSame) {
        getRefChangedPaths(snapshot.raw, currentValue, name, maxDepth, 0, refChangedPaths);
    }

    const valueChangedPaths: string[] = [];
    const valueChangedDetails: ValueChangeDetail[] = [];
    getValueChangedPaths(snapshot.clone, currentValue, name, maxDepth, 0, valueChangedPaths, snapshot.raw, valueChangedDetails);

    const unnecessaryRefChanges = getUnnecessaryRefChanges(refChangedPaths, valueChangedPaths);
    const classification = classifyRender(refSame, valueChangedPaths, unnecessaryRefChanges);

    return {name, classification, refChangedPaths, valueChangedPaths, valueChangedDetails, unnecessaryRefChanges};
}

export {deepClone, analyzeRef};
