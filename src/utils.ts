import {RENDER_CLASSIFICATION} from './types';
import type {RefResult, RefSnapshot, RenderClassification} from './types';

const MAX_LOGGED_PATHS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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

function getRefChangedPaths(prev: unknown, curr: unknown, path: string, maxDepth: number, depth: number, changes: string[]): void {
    if (changes.length >= MAX_LOGGED_PATHS || depth > maxDepth) {
        return;
    }
    if (prev === curr) {
        return;
    }
    changes.push(path);
    if (isRecord(prev) && isRecord(curr)) {
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
        for (const key of allKeys) {
            if (changes.length >= MAX_LOGGED_PATHS) {
                return;
            }
            getRefChangedPaths(prev[key], curr[key], `${path}.${key}`, maxDepth, depth + 1, changes);
        }
    }
}

function getValueChangedPaths(prev: unknown, curr: unknown, path: string, maxDepth: number, depth: number, changes: string[]): void {
    if (changes.length >= MAX_LOGGED_PATHS || depth > maxDepth) {
        return;
    }
    if (isRecord(prev) && isRecord(curr)) {
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
        for (const key of allKeys) {
            if (changes.length >= MAX_LOGGED_PATHS) {
                return;
            }
            getValueChangedPaths(prev[key], curr[key], `${path}.${key}`, maxDepth, depth + 1, changes);
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

function classifyRender(refSame: boolean, valueChangedPaths: string[], unnecessaryRefChanges: string[]): RenderClassification {
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

function analyzeRef(snapshot: RefSnapshot | undefined, currentValue: unknown, name: string, maxDepth: number): RefResult {
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
    getValueChangedPaths(snapshot.clone, currentValue, name, maxDepth, 0, valueChangedPaths);

    const unnecessaryRefChanges = getUnnecessaryRefChanges(refChangedPaths, valueChangedPaths);
    const classification = classifyRender(refSame, valueChangedPaths, unnecessaryRefChanges);

    return {name, classification, refChangedPaths, valueChangedPaths, unnecessaryRefChanges};
}

export {deepClone, analyzeRef};
