import {describe, expect, it} from 'vitest';
import {RENDER_CLASSIFICATION} from '../types';
import type {RefSnapshot} from '../types';
import {analyzeRef, deepClone} from '../utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(raw: unknown, clone: unknown): RefSnapshot {
    return {raw, clone};
}

// ===========================================================================
// deepClone
// ===========================================================================

describe('deepClone', () => {
    describe('primitives are returned as-is', () => {
        it('clones a number', () => {
            expect(deepClone(42)).toBe(42);
        });

        it('clones a string', () => {
            expect(deepClone('hello')).toBe('hello');
        });

        it('clones a boolean', () => {
            expect(deepClone(true)).toBe(true);
        });

        it('clones null', () => {
            expect(deepClone(null)).toBe(null);
        });

        it('clones undefined', () => {
            expect(deepClone(undefined)).toBe(undefined);
        });

        it('clones zero', () => {
            expect(deepClone(0)).toBe(0);
        });

        it('clones NaN', () => {
            expect(deepClone(NaN)).toBeNaN();
        });

        it('clones empty string', () => {
            expect(deepClone('')).toBe('');
        });
    });

    describe('objects are deep-cloned (new identity, same values)', () => {
        it('clones a flat object', () => {
            const obj = {a: 1, b: 'two'};
            const cloned = deepClone(obj);
            expect(cloned).toEqual(obj);
            expect(cloned).not.toBe(obj);
        });

        it('clones a nested object', () => {
            const obj = {a: {b: {c: 3}}};
            const cloned = deepClone(obj) as typeof obj;
            expect(cloned).toEqual(obj);
            expect(cloned.a).not.toBe(obj.a);
            expect(cloned.a.b).not.toBe(obj.a.b);
        });

        it('clones an empty object', () => {
            const obj = {};
            const cloned = deepClone(obj);
            expect(cloned).toEqual(obj);
            expect(cloned).not.toBe(obj);
        });
    });

    describe('arrays are deep-cloned', () => {
        it('clones a flat array', () => {
            const arr = [1, 2, 3];
            const cloned = deepClone(arr);
            expect(cloned).toEqual(arr);
            expect(cloned).not.toBe(arr);
        });

        it('clones nested arrays', () => {
            const arr = [[1, 2], [3]];
            const cloned = deepClone(arr) as typeof arr;
            expect(cloned).toEqual(arr);
            expect(cloned[0]).not.toBe(arr[0]);
        });

        it('clones an empty array', () => {
            const arr: unknown[] = [];
            const cloned = deepClone(arr);
            expect(cloned).toEqual(arr);
            expect(cloned).not.toBe(arr);
        });
    });

    describe('special object types', () => {
        it('clones a Date object', () => {
            const date = new Date('2024-01-01');
            const cloned = deepClone(date) as Date;
            expect(cloned).toEqual(date);
            expect(cloned).not.toBe(date);
        });

        it('clones a RegExp', () => {
            const regex = /test/gi;
            const cloned = deepClone(regex) as RegExp;
            expect(cloned).toEqual(regex);
            expect(cloned).not.toBe(regex);
        });

        it('clones a Map', () => {
            const map = new Map([
                ['a', 1],
                ['b', 2],
            ]);
            const cloned = deepClone(map) as Map<string, number>;
            expect(cloned).toEqual(map);
            expect(cloned).not.toBe(map);
        });

        it('clones a Set', () => {
            const set = new Set([1, 2, 3]);
            const cloned = deepClone(set) as Set<number>;
            expect(cloned).toEqual(set);
            expect(cloned).not.toBe(set);
        });
    });

    describe('non-cloneable values fall back to returning the original reference', () => {
        it('returns the same reference for an object containing a function', () => {
            const obj = {fn: () => 42};
            const cloned = deepClone(obj);
            // structuredClone cannot handle functions — falls back to same ref
            expect(cloned).toBe(obj);
        });

        it('returns the same reference for an object containing a Symbol property value', () => {
            const obj = {val: Symbol('test')};
            const cloned = deepClone(obj);
            expect(cloned).toBe(obj);
        });
    });

    describe('mutation isolation', () => {
        it('mutating the clone does not affect the original', () => {
            const obj = {a: 1, nested: {b: 2}};
            const cloned = deepClone(obj) as typeof obj;
            cloned.a = 999;
            cloned.nested.b = 888;
            expect(obj.a).toBe(1);
            expect(obj.nested.b).toBe(2);
        });
    });
});

// ===========================================================================
// analyzeRef — core invariants (ported from original project)
// ===========================================================================

describe('analyzeRef', () => {
    describe('initial render (no previous snapshot)', () => {
        it('returns INITIAL classification with empty paths', () => {
            const result = analyzeRef(undefined, {a: 1}, 'prop', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.INITIAL);
            expect(result.refChangedPaths).toHaveLength(0);
            expect(result.valueChangedPaths).toHaveLength(0);
            expect(result.unnecessaryRefChanges).toHaveLength(0);
        });

        it('preserves the given name', () => {
            const result = analyzeRef(undefined, 42, 'myProp', Infinity);
            expect(result.name).toBe('myProp');
        });

        it('works with null as the initial value', () => {
            const result = analyzeRef(undefined, null, 'nullProp', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.INITIAL);
        });

        it('works with undefined as the initial value', () => {
            const result = analyzeRef(undefined, undefined, 'undefProp', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.INITIAL);
        });
    });

    describe('same ref, no value mutation → NO_CHANGE', () => {
        it('returns NO_CHANGE when ref identity and deep values are the same', () => {
            const obj = {a: 1};
            const snapshot = makeSnapshot(obj, {a: 1});
            const result = analyzeRef(snapshot, obj, 'prop', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NO_CHANGE);
            expect(result.refChangedPaths).toHaveLength(0);
            expect(result.valueChangedPaths).toHaveLength(0);
            expect(result.unnecessaryRefChanges).toHaveLength(0);
        });

        it('NO_CHANGE for identical primitive', () => {
            const snapshot = makeSnapshot(1, 1);
            const result = analyzeRef(snapshot, 1, 'count', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NO_CHANGE);
        });

        it('NO_CHANGE for the same null reference', () => {
            const snapshot = makeSnapshot(null, null);
            const result = analyzeRef(snapshot, null, 'prop', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NO_CHANGE);
        });

        it('NO_CHANGE for the same string reference', () => {
            const str = 'hello';
            const snapshot = makeSnapshot(str, 'hello');
            const result = analyzeRef(snapshot, str, 'label', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NO_CHANGE);
        });
    });

    describe('same ref, value mutated in place → MUTATION', () => {
        it('detects mutation when ref is the same but deep value differs', () => {
            const obj = {a: 1};
            const snapshot = makeSnapshot(obj, {a: 0});
            const result = analyzeRef(snapshot, obj, 'prop', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.MUTATION);
            expect(result.refChangedPaths).toHaveLength(0);
            expect(result.valueChangedPaths.length).toBeGreaterThan(0);
        });

        it('detects mutation when a nested property was mutated', () => {
            const obj = {a: {b: 2}};
            const snapshot = makeSnapshot(obj, {a: {b: 1}});
            const result = analyzeRef(snapshot, obj, 'data', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.MUTATION);
            expect(result.valueChangedPaths).toContain('data.a.b');
        });

        it('detects mutation when a property was added to the same object', () => {
            const obj: Record<string, number> = {a: 1};
            const snapshot = makeSnapshot(obj, {});
            const result = analyzeRef(snapshot, obj, 'data', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.MUTATION);
            expect(result.valueChangedPaths).toContain('data.a');
        });

        it('detects mutation when a property was removed (clone had it, current does not)', () => {
            const obj: Record<string, number> = {};
            const snapshot = makeSnapshot(obj, {a: 1});
            const result = analyzeRef(snapshot, obj, 'data', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.MUTATION);
            expect(result.valueChangedPaths).toContain('data.a');
        });
    });

    describe('new ref, no value change → NEW_REF_NO_VALUE', () => {
        it('detects unnecessary new ref when values are identical', () => {
            const prev = {a: 1};
            const curr = {a: 1};
            const snapshot = makeSnapshot(prev, {a: 1});
            const result = analyzeRef(snapshot, curr, 'prop', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_NO_VALUE);
            expect(result.valueChangedPaths).toHaveLength(0);
            expect(result.refChangedPaths.length).toBeGreaterThan(0);
            expect(result.unnecessaryRefChanges).toEqual(result.refChangedPaths);
        });

        it('detects unnecessary new ref for deeply nested identical structure', () => {
            const prev = {a: {b: {c: 1}}};
            const curr = {a: {b: {c: 1}}};
            const snapshot = makeSnapshot(prev, {a: {b: {c: 1}}});
            const result = analyzeRef(snapshot, curr, 'deep', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_NO_VALUE);
            expect(result.unnecessaryRefChanges.length).toBeGreaterThan(0);
        });

        it('detects new ref with empty arrays (same values, new identity)', () => {
            const prev: unknown[] = [];
            const curr: unknown[] = [];
            const snapshot = makeSnapshot(prev, []);
            const result = analyzeRef(snapshot, curr, 'list', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_NO_VALUE);
        });
    });

    describe('new ref, value changed → NEW_REF_WITH_VALUE', () => {
        it('detects legitimate ref change when values differ', () => {
            const prev = {a: 1};
            const curr = {a: 2};
            const snapshot = makeSnapshot(prev, {a: 1});
            const result = analyzeRef(snapshot, curr, 'prop', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
            expect(result.valueChangedPaths.length).toBeGreaterThan(0);
            expect(result.refChangedPaths.length).toBeGreaterThan(0);
        });

        it('detects value change in a nested leaf', () => {
            const prev = {a: {b: {c: 1}}, x: 42};
            const curr = {a: {b: {c: 2}}, x: 42};
            const snapshot = makeSnapshot(prev, {a: {b: {c: 1}}, x: 42});
            const result = analyzeRef(snapshot, curr, 'root', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
            expect(result.valueChangedPaths).toContain('root.a.b.c');
            expect(result.valueChangedPaths).not.toContain('root.x');
        });

        it('handles a changed primitive (number)', () => {
            const snapshot = makeSnapshot(1, 1);
            const result = analyzeRef(snapshot, 2, 'count', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
            expect(result.valueChangedPaths).toContain('count');
        });

        it('handles type change from number to string', () => {
            const snapshot = makeSnapshot(42, 42);
            const result = analyzeRef(snapshot, '42', 'val', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
            expect(result.valueChangedPaths).toContain('val');
        });

        it('handles type change from null to object', () => {
            const snapshot = makeSnapshot(null, null);
            const result = analyzeRef(snapshot, {a: 1}, 'val', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
        });

        it('handles type change from object to null', () => {
            const obj = {a: 1};
            const snapshot = makeSnapshot(obj, {a: 1});
            const result = analyzeRef(snapshot, null, 'val', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
        });
    });

    describe('invariant: unnecessaryRefChanges is always a subset of refChangedPaths', () => {
        it('holds for new ref with partial value change', () => {
            const prev = {a: 1, b: {c: 2}};
            const curr = {a: 99, b: {c: 2}};
            const snapshot = makeSnapshot(prev, {a: 1, b: {c: 2}});
            const result = analyzeRef(snapshot, curr, 'prop', Infinity);
            const refSet = new Set(result.refChangedPaths);
            for (const u of result.unnecessaryRefChanges) {
                expect(refSet.has(u)).toBe(true);
            }
        });

        it('holds for completely unnecessary new ref', () => {
            const prev = {a: 1, b: {c: 2}};
            const curr = {a: 1, b: {c: 2}};
            const snapshot = makeSnapshot(prev, {a: 1, b: {c: 2}});
            const result = analyzeRef(snapshot, curr, 'prop', Infinity);
            const refSet = new Set(result.refChangedPaths);
            for (const u of result.unnecessaryRefChanges) {
                expect(refSet.has(u)).toBe(true);
            }
        });

        it('unnecessary refs have no descendant value change', () => {
            const prev = {a: 1, b: {c: 2}};
            const curr = {a: 99, b: {c: 2}};
            const snapshot = makeSnapshot(prev, {a: 1, b: {c: 2}});
            const result = analyzeRef(snapshot, curr, 'prop', Infinity);
            for (const u of result.unnecessaryRefChanges) {
                const hasDescendantValueChange = result.valueChangedPaths.some(
                    (vp) => vp === u || vp.startsWith(`${u}.`),
                );
                expect(hasDescendantValueChange).toBe(false);
            }
        });
    });

    describe('refChangedPaths includes the leaf value path', () => {
        it('leaf path appears in both refChangedPaths and valueChangedPaths', () => {
            const prev = {a: 1};
            const curr = {a: 2};
            const snapshot = makeSnapshot(prev, {a: 1});
            const result = analyzeRef(snapshot, curr, 'prop', Infinity);
            expect(result.valueChangedPaths).toContain('prop.a');
            expect(result.refChangedPaths).toContain('prop.a');
        });
    });

    describe('maxDepth limiting', () => {
        it('stops diffing beyond the specified maxDepth', () => {
            const prev = {a: {b: {c: {d: 1}}}};
            const curr = {a: {b: {c: {d: 2}}}};
            const snapshot = makeSnapshot(prev, {a: {b: {c: {d: 1}}}});

            const resultDepth1 = analyzeRef(snapshot, curr, 'r', 1);
            // At depth 1 we see r and r.a, but not deeper leaf paths like r.a.b.c.d
            expect(resultDepth1.refChangedPaths).toContain('r');
            expect(resultDepth1.refChangedPaths).toContain('r.a');
            expect(resultDepth1.refChangedPaths).not.toContain('r.a.b');
            expect(resultDepth1.refChangedPaths).not.toContain('r.a.b.c');
            expect(resultDepth1.refChangedPaths).not.toContain('r.a.b.c.d');
        });

        it('maxDepth=0 only reports the root path for refChangedPaths', () => {
            const prev = {a: 1};
            const curr = {a: 2};
            const snapshot = makeSnapshot(prev, {a: 1});
            const result = analyzeRef(snapshot, curr, 'root', 0);
            expect(result.refChangedPaths).toEqual(['root']);
            // Value diff at depth 0 sees both are records, tries to recurse into keys,
            // but depth+1 > maxDepth so no leaf values are recorded
            expect(result.valueChangedPaths).toEqual([]);
        });

        it('maxDepth=0 reports the root path for primitives (leaf at root)', () => {
            const snapshot = makeSnapshot(1, 1);
            const result = analyzeRef(snapshot, 2, 'root', 0);
            expect(result.refChangedPaths).toEqual(['root']);
            expect(result.valueChangedPaths).toEqual(['root']);
        });

        it('Infinity maxDepth traverses arbitrarily deep', () => {
            const prev = {a: {b: {c: {d: {e: {f: 1}}}}}};
            const curr = {a: {b: {c: {d: {e: {f: 2}}}}}};
            const snapshot = makeSnapshot(prev, {a: {b: {c: {d: {e: {f: 1}}}}}});
            const result = analyzeRef(snapshot, curr, 'r', Infinity);
            expect(result.valueChangedPaths).toContain('r.a.b.c.d.e.f');
        });
    });

    describe('array handling', () => {
        it('detects changed array elements', () => {
            const prev = [1, 2, 3];
            const curr = [1, 99, 3];
            const snapshot = makeSnapshot(prev, [1, 2, 3]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
            expect(result.valueChangedPaths).toContain('arr.1');
            expect(result.valueChangedPaths).not.toContain('arr.0');
            expect(result.valueChangedPaths).not.toContain('arr.2');
        });

        it('detects added array element', () => {
            const prev = [1, 2];
            const curr = [1, 2, 3];
            const snapshot = makeSnapshot(prev, [1, 2]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toContain('arr.2');
            expect(result.valueChangedPaths).toContain('arr.length');
        });

        it('detects removed array element (length change)', () => {
            const prev = [1, 2, 3];
            const curr = [1, 2];
            const snapshot = makeSnapshot(prev, [1, 2, 3]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toContain('arr.length');
        });

        it('same array identity returns NO_CHANGE', () => {
            const arr = [1, 2, 3];
            const snapshot = makeSnapshot(arr, [1, 2, 3]);
            const result = analyzeRef(snapshot, arr, 'arr', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NO_CHANGE);
        });
    });

    describe('array identity matching', () => {
        it('insert at beginning — only reports the new element', () => {
            const A = {id: 1};
            const B = {id: 2};
            const C = {id: 3};
            const X = {id: 99};
            const prev = [A, B, C];
            const curr = [X, A, B, C];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}, {id: 3}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.refChangedPaths).toContain('arr.0');
            expect(result.refChangedPaths).toContain('arr.length');
            expect(result.refChangedPaths).not.toContain('arr.1');
            expect(result.refChangedPaths).not.toContain('arr.2');
            expect(result.refChangedPaths).not.toContain('arr.3');
        });

        it('insert at middle — only reports the new element', () => {
            const A = {id: 1};
            const B = {id: 2};
            const C = {id: 3};
            const X = {id: 99};
            const prev = [A, B, C];
            const curr = [A, X, B, C];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}, {id: 3}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.refChangedPaths).toContain('arr.1');
            expect(result.refChangedPaths).toContain('arr.length');
            expect(result.refChangedPaths).not.toContain('arr.2');
            expect(result.refChangedPaths).not.toContain('arr.3');
        });

        it('insert at end — only reports the new element', () => {
            const A = {id: 1};
            const B = {id: 2};
            const X = {id: 99};
            const prev = [A, B];
            const curr = [A, B, X];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.refChangedPaths).toContain('arr.2');
            expect(result.refChangedPaths).toContain('arr.length');
            expect(result.refChangedPaths).not.toContain('arr.0');
            expect(result.refChangedPaths).not.toContain('arr.1');
        });

        it('remove from beginning — only reports length change', () => {
            const A = {id: 1};
            const B = {id: 2};
            const C = {id: 3};
            const prev = [A, B, C];
            const curr = [B, C];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}, {id: 3}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.refChangedPaths).toContain('arr.length');
            expect(result.valueChangedPaths).toEqual(['arr.length']);
        });

        it('remove from middle — only reports length change', () => {
            const A = {id: 1};
            const B = {id: 2};
            const C = {id: 3};
            const prev = [A, B, C];
            const curr = [A, C];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}, {id: 3}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toEqual(['arr.length']);
        });

        it('remove from end — only reports length change', () => {
            const A = {id: 1};
            const B = {id: 2};
            const C = {id: 3};
            const prev = [A, B, C];
            const curr = [A, B];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}, {id: 3}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toEqual(['arr.length']);
        });

        it('replace element (same length) — reports the replaced position', () => {
            const A = {id: 1};
            const B = {id: 2};
            const C = {id: 3};
            const X = {id: 99};
            const prev = [A, B, C];
            const curr = [A, X, C];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}, {id: 3}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.refChangedPaths).toContain('arr.1');
            expect(result.refChangedPaths).not.toContain('arr.length');
            expect(result.valueChangedPaths).toContain('arr.1.id');
        });

        it('reorder elements — no value changes detected', () => {
            const A = {id: 1};
            const B = {id: 2};
            const C = {id: 3};
            const prev = [A, B, C];
            const curr = [C, A, B];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}, {id: 3}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_NO_VALUE);
            expect(result.valueChangedPaths).toHaveLength(0);
        });

        it('primitive array insert — reports new element and length', () => {
            const prev = [10, 20, 30];
            const curr = [10, 99, 20, 30];
            const snapshot = makeSnapshot(prev, [10, 20, 30]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toContain('arr.1');
            expect(result.valueChangedPaths).toContain('arr.length');
            expect(result.valueChangedPaths).not.toContain('arr.2');
            expect(result.valueChangedPaths).not.toContain('arr.3');
        });

        it('same elements new array — NEW_REF_NO_VALUE', () => {
            const A = {id: 1};
            const B = {id: 2};
            const prev = [A, B];
            const curr = [A, B];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_NO_VALUE);
        });

        it('nested arrays in objects — identity matching applies recursively', () => {
            const child = {val: 1};
            const prev = {items: [child]};
            const curr = {items: [child]};
            const snapshot = makeSnapshot(prev, {items: [{val: 1}]});
            const result = analyzeRef(snapshot, curr, 'data', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_NO_VALUE);
            expect(result.valueChangedPaths).toHaveLength(0);
        });

        it('duplicate references — matches each occurrence once', () => {
            const A = {id: 1};
            const prev = [A, A, A];
            const curr = [A, A];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 1}, {id: 1}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toEqual(['arr.length']);
        });

        it('all elements replaced — reports all positions', () => {
            const A = {id: 1};
            const B = {id: 2};
            const X = {id: 10};
            const Y = {id: 20};
            const prev = [A, B];
            const curr = [X, Y];
            const snapshot = makeSnapshot(prev, [{id: 1}, {id: 2}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toContain('arr.0.id');
            expect(result.valueChangedPaths).toContain('arr.1.id');
        });

        it('empty to non-empty — reports additions and length', () => {
            const prev: unknown[] = [];
            const curr = [{id: 1}];
            const snapshot = makeSnapshot(prev, []);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toContain('arr.0');
            expect(result.valueChangedPaths).toContain('arr.length');
        });

        it('non-empty to empty — reports length change', () => {
            const A = {id: 1};
            const prev = [A];
            const curr: unknown[] = [];
            const snapshot = makeSnapshot(prev, [{id: 1}]);
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toEqual(['arr.length']);
        });

        it('mutation detection with shifted elements', () => {
            const A = {id: 1, val: 'a'};
            const B = {id: 2, val: 'b'};
            const C = {id: 3, val: 'c'};
            const prev = [A, B, C];
            const snapshot = makeSnapshot(prev, [
                {id: 1, val: 'a'},
                {id: 2, val: 'b'},
                {id: 3, val: 'c'},
            ]);
            A.val = 'mutated';
            const curr = [B, A, C];
            const result = analyzeRef(snapshot, curr, 'arr', Infinity);
            expect(result.valueChangedPaths).toContain('arr.1.val');
            expect(result.valueChangedPaths).not.toContain('arr.0.val');
            expect(result.valueChangedPaths).not.toContain('arr.2.val');
        });
    });

    describe('mixed object and array nesting', () => {
        it('tracks changes inside nested arrays within objects', () => {
            const prev = {items: [{id: 1, name: 'a'}]};
            const curr = {items: [{id: 1, name: 'b'}]};
            const snapshot = makeSnapshot(prev, {items: [{id: 1, name: 'a'}]});
            const result = analyzeRef(snapshot, curr, 'data', Infinity);
            expect(result.valueChangedPaths).toContain('data.items.0.name');
        });
    });

    describe('edge cases with keys added and removed', () => {
        it('detects a new key added to an object', () => {
            const prev = {a: 1};
            const curr = {a: 1, b: 2};
            const snapshot = makeSnapshot(prev, {a: 1});
            const result = analyzeRef(snapshot, curr, 'obj', Infinity);
            expect(result.valueChangedPaths).toContain('obj.b');
        });

        it('detects a key removed from an object', () => {
            const prev = {a: 1, b: 2};
            const curr = {a: 1};
            const snapshot = makeSnapshot(prev, {a: 1, b: 2});
            const result = analyzeRef(snapshot, curr, 'obj', Infinity);
            expect(result.valueChangedPaths).toContain('obj.b');
        });

        it('detects both added and removed keys simultaneously', () => {
            const prev = {a: 1, b: 2};
            const curr = {a: 1, c: 3};
            const snapshot = makeSnapshot(prev, {a: 1, b: 2});
            const result = analyzeRef(snapshot, curr, 'obj', Infinity);
            expect(result.valueChangedPaths).toContain('obj.b');
            expect(result.valueChangedPaths).toContain('obj.c');
            expect(result.valueChangedPaths).not.toContain('obj.a');
        });
    });

    describe('large number of paths (MAX_LOGGED_PATHS cap)', () => {
        it('caps refChangedPaths at 100 entries for very wide objects', () => {
            const prev: Record<string, number> = {};
            const curr: Record<string, number> = {};
            for (let i = 0; i < 200; i++) {
                prev[`key${i}`] = i;
                curr[`key${i}`] = i;
            }
            const snapshot = makeSnapshot(prev, prev);
            const result = analyzeRef(snapshot, curr, 'wide', Infinity);
            // All refs are different (different object identity), paths should be capped
            expect(result.refChangedPaths.length).toBeLessThanOrEqual(100);
        });

        it('caps valueChangedPaths at 100 entries for wide mutations', () => {
            const obj: Record<string, number> = {};
            const clone: Record<string, number> = {};
            for (let i = 0; i < 200; i++) {
                obj[`key${i}`] = i;
                clone[`key${i}`] = i + 1000;
            }
            const snapshot = makeSnapshot(obj, clone);
            const result = analyzeRef(snapshot, obj, 'wide', Infinity);
            expect(result.valueChangedPaths.length).toBeLessThanOrEqual(100);
        });
    });

    describe('undefined vs missing properties', () => {
        it('treats explicit undefined same as missing for value comparison', () => {
            const prev = {a: undefined};
            const curr = {};
            const snapshot = makeSnapshot(prev, {a: undefined});
            const result = analyzeRef(snapshot, curr, 'obj', Infinity);
            // Both prev.a and curr.a resolve to undefined — no value change for 'a'
            // but the ref changed (different object identity)
            expect(result.refChangedPaths).toContain('obj');
        });
    });

    describe('boolean and falsy values', () => {
        it('differentiates false from 0', () => {
            const snapshot = makeSnapshot(false, false);
            const result = analyzeRef(snapshot, 0, 'val', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
        });

        it('differentiates null from undefined', () => {
            const snapshot = makeSnapshot(null, null);
            const result = analyzeRef(snapshot, undefined, 'val', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
        });

        it('differentiates empty string from false', () => {
            const snapshot = makeSnapshot('', '');
            const result = analyzeRef(snapshot, false, 'val', Infinity);
            expect(result.classification).toBe(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE);
        });
    });
});
