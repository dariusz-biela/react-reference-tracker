import {describe, expect, it} from 'vitest';
import {
    buildComponentStats,
    buildRefStats,
    buildRenderStatsText,
    getCorrectRefs,
    getRefBadgeColor,
    getRenderCounts,
    getRenderHealth,
    HEALTH_COLOR,
    TRULY_BAD,
} from '../panelUtils';
import {RENDER_CLASSIFICATION} from '../types';
import type {RefResult, RenderRecord} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<RefResult>): RefResult {
    return {
        name: 'test',
        classification: RENDER_CLASSIFICATION.NO_CHANGE,
        refChangedPaths: [],
        valueChangedPaths: [],
        unnecessaryRefChanges: [],
        ...overrides,
    };
}

function makeRenderRecord(refs: RefResult[], renderId = 1): RenderRecord {
    return {renderId, startTime: 0, duration: 1, refs};
}

// ===========================================================================
// Constants
// ===========================================================================

describe('HEALTH_COLOR', () => {
    it('has colors for all five health states', () => {
        expect(HEALTH_COLOR).toHaveProperty('good');
        expect(HEALTH_COLOR).toHaveProperty('mixed');
        expect(HEALTH_COLOR).toHaveProperty('bad');
        expect(HEALTH_COLOR).toHaveProperty('empty');
        expect(HEALTH_COLOR).toHaveProperty('neutral');
    });

    it('each color is a valid hex string', () => {
        for (const color of Object.values(HEALTH_COLOR)) {
            expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
});

describe('TRULY_BAD', () => {
    it('includes MUTATION and NEW_REF_NO_VALUE', () => {
        expect(TRULY_BAD.has(RENDER_CLASSIFICATION.MUTATION)).toBe(true);
        expect(TRULY_BAD.has(RENDER_CLASSIFICATION.NEW_REF_NO_VALUE)).toBe(true);
    });

    it('does not include INITIAL, NO_CHANGE, or NEW_REF_WITH_VALUE', () => {
        expect(TRULY_BAD.has(RENDER_CLASSIFICATION.INITIAL)).toBe(false);
        expect(TRULY_BAD.has(RENDER_CLASSIFICATION.NO_CHANGE)).toBe(false);
        expect(TRULY_BAD.has(RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE)).toBe(false);
    });

    it('has exactly 2 entries', () => {
        expect(TRULY_BAD.size).toBe(2);
    });
});

// ===========================================================================
// getCorrectRefs
// ===========================================================================

describe('getCorrectRefs', () => {
    it('excludes unnecessaryRefChanges from refChangedPaths', () => {
        const result = makeResult({
            refChangedPaths: ['root', 'root.a', 'root.b'],
            valueChangedPaths: [],
            unnecessaryRefChanges: ['root.b'],
        });
        expect(getCorrectRefs(result)).toEqual(['root', 'root.a']);
    });

    it('excludes valueChangedPaths from refChangedPaths', () => {
        const result = makeResult({
            refChangedPaths: ['root', 'root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: [],
        });
        expect(getCorrectRefs(result)).toEqual(['root']);
    });

    it('excludes both unnecessary and value paths', () => {
        const result = makeResult({
            refChangedPaths: ['root', 'root.a', 'root.b'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: ['root.b'],
        });
        expect(getCorrectRefs(result)).toEqual(['root']);
    });

    it('returns empty array when all ref changes are unnecessary', () => {
        const result = makeResult({
            refChangedPaths: ['root', 'root.a'],
            valueChangedPaths: [],
            unnecessaryRefChanges: ['root', 'root.a'],
        });
        expect(getCorrectRefs(result)).toEqual([]);
    });

    it('returns empty array when refChangedPaths is empty', () => {
        const result = makeResult({refChangedPaths: [], valueChangedPaths: [], unnecessaryRefChanges: []});
        expect(getCorrectRefs(result)).toEqual([]);
    });

    it('returns all refChangedPaths when there are no unnecessary or value paths', () => {
        const result = makeResult({
            refChangedPaths: ['root', 'root.a', 'root.b'],
            valueChangedPaths: [],
            unnecessaryRefChanges: [],
        });
        expect(getCorrectRefs(result)).toEqual(['root', 'root.a', 'root.b']);
    });

    it('handles duplicate paths in unnecessary and value sets', () => {
        const result = makeResult({
            refChangedPaths: ['root', 'root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: ['root.a'],
        });
        // root.a is in both unnecessary and value — should still be excluded
        expect(getCorrectRefs(result)).toEqual(['root']);
    });
});

// ===========================================================================
// getRefBadgeColor
// ===========================================================================

describe('getRefBadgeColor', () => {
    it('returns gray (#6c757d) for INITIAL classification', () => {
        const result = makeResult({classification: RENDER_CLASSIFICATION.INITIAL});
        expect(getRefBadgeColor(result)).toBe('#6c757d');
    });

    it('returns gray (#6c757d) for NO_CHANGE classification', () => {
        const result = makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE});
        expect(getRefBadgeColor(result)).toBe('#6c757d');
    });

    it('returns red (#dc3545) for MUTATION classification', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.MUTATION,
            valueChangedPaths: ['root.a'],
        });
        expect(getRefBadgeColor(result)).toBe('#dc3545');
    });

    it('returns red (#dc3545) for NEW_REF_NO_VALUE classification', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE,
            refChangedPaths: ['root'],
            unnecessaryRefChanges: ['root'],
        });
        expect(getRefBadgeColor(result)).toBe('#dc3545');
    });

    it('returns green (#28a745) when only value changes exist (no unnecessary)', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: [],
        });
        expect(getRefBadgeColor(result)).toBe('#28a745');
    });

    it('returns green (#28a745) when only correct ancestor refs exist (no unnecessary)', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root', 'root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: [],
        });
        expect(getRefBadgeColor(result)).toBe('#28a745');
    });

    it('returns yellow (#ffc107) when correct and unnecessary changes coexist', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root', 'root.a', 'root.b'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: ['root.b'],
        });
        expect(getRefBadgeColor(result)).toBe('#ffc107');
    });

    it('returns red (#dc3545) when all ref changes are unnecessary for NEW_REF_WITH_VALUE', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root.b'],
            valueChangedPaths: [],
            unnecessaryRefChanges: ['root.b'],
        });
        expect(getRefBadgeColor(result)).toBe('#dc3545');
    });

    it('returns red for MUTATION even if value paths are empty (mutation without tracked value diff)', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.MUTATION,
            valueChangedPaths: [],
        });
        expect(getRefBadgeColor(result)).toBe('#dc3545');
    });

    it('returns gray for INITIAL regardless of paths content', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.INITIAL,
            refChangedPaths: ['root'],
            valueChangedPaths: ['root'],
        });
        expect(getRefBadgeColor(result)).toBe('#6c757d');
    });
});

// ===========================================================================
// buildRefStats
// ===========================================================================

describe('buildRefStats', () => {
    it('returns "init" for INITIAL classification', () => {
        expect(buildRefStats(makeResult({classification: RENDER_CLASSIFICATION.INITIAL}))).toBe('init');
    });

    it('returns empty string for NO_CHANGE classification', () => {
        expect(buildRefStats(makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}))).toBe('');
    });

    it('shows v, r, u, aV, aR for NEW_REF_WITH_VALUE with all categories present', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root', 'root.a', 'root.b'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: ['root.b'],
        });
        expect(buildRefStats(result)).toBe('v:1 r:1 \u2717u:1 aV:1 aR:3');
    });

    it('shows v, r, aV, aR when no unnecessary changes', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root', 'root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: [],
        });
        expect(buildRefStats(result)).toBe('v:1 r:1 aV:1 aR:2');
    });

    it('shows v, aV, aR when no ancestor ref changes and no unnecessary', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: [],
        });
        expect(buildRefStats(result)).toBe('v:1 aV:1 aR:1');
    });

    it('shows only u, aV, aR when all changes are unnecessary', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root', 'root.a'],
            valueChangedPaths: [],
            unnecessaryRefChanges: ['root', 'root.a'],
        });
        expect(buildRefStats(result)).toBe('\u2717u:2 aV:0 aR:2');
    });

    it('does NOT count valueChangedPaths in r (correct refs)', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: [],
        });
        const stats = buildRefStats(result);
        expect(stats).not.toContain('r:');
        expect(stats).toContain('v:1');
    });

    it('does NOT double-count unnecessaryRefChanges in r', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
            refChangedPaths: ['root', 'root.a'],
            valueChangedPaths: ['root.a'],
            unnecessaryRefChanges: ['root'],
        });
        const stats = buildRefStats(result);
        expect(stats).not.toContain('r:');
    });

    it('shows mutation marker with value count and totals for MUTATION', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.MUTATION,
            valueChangedPaths: ['root.a'],
            refChangedPaths: [],
        });
        expect(buildRefStats(result)).toBe('\u2623 v:1 aV:1 aR:0');
    });

    it('shows mutation marker without value count when no valueChangedPaths', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.MUTATION,
            valueChangedPaths: [],
            refChangedPaths: [],
        });
        expect(buildRefStats(result)).toBe('\u2623 aV:0 aR:0');
    });

    it('shows unnecessary count and totals for NEW_REF_NO_VALUE', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE,
            refChangedPaths: ['root'],
            valueChangedPaths: [],
            unnecessaryRefChanges: ['root'],
        });
        expect(buildRefStats(result)).toBe('\u2717u:1 aV:0 aR:1');
    });

    it('handles multiple value changes for MUTATION', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.MUTATION,
            valueChangedPaths: ['root.a', 'root.b', 'root.c'],
            refChangedPaths: [],
        });
        expect(buildRefStats(result)).toBe('\u2623 v:3 aV:3 aR:0');
    });

    it('handles multiple unnecessary ref changes for NEW_REF_NO_VALUE', () => {
        const result = makeResult({
            classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE,
            refChangedPaths: ['root', 'root.a', 'root.b'],
            valueChangedPaths: [],
            unnecessaryRefChanges: ['root', 'root.a', 'root.b'],
        });
        expect(buildRefStats(result)).toBe('\u2717u:3 aV:0 aR:3');
    });
});

// ===========================================================================
// getRenderCounts
// ===========================================================================

describe('getRenderCounts', () => {
    it('counts good (NEW_REF_WITH_VALUE), bad (MUTATION + NEW_REF_NO_VALUE), and no-change correctly', () => {
        const refs: RefResult[] = [
            makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            makeResult({classification: RENDER_CLASSIFICATION.MUTATION}),
            makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE}),
            makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}),
            makeResult({classification: RENDER_CLASSIFICATION.INITIAL}),
        ];
        const counts = getRenderCounts(refs);
        expect(counts.goodCount).toBe(2);
        expect(counts.badCount).toBe(2);
        expect(counts.noChangeCount).toBe(1);
    });

    it('returns all zeros for an empty refs array', () => {
        const counts = getRenderCounts([]);
        expect(counts.goodCount).toBe(0);
        expect(counts.badCount).toBe(0);
        expect(counts.noChangeCount).toBe(0);
    });

    it('does not count INITIAL in any bucket', () => {
        const refs = [
            makeResult({classification: RENDER_CLASSIFICATION.INITIAL}),
            makeResult({classification: RENDER_CLASSIFICATION.INITIAL}),
        ];
        const counts = getRenderCounts(refs);
        expect(counts.goodCount).toBe(0);
        expect(counts.badCount).toBe(0);
        expect(counts.noChangeCount).toBe(0);
    });

    it('counts only NEW_REF_WITH_VALUE as good', () => {
        const refs = [
            makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
        ];
        const counts = getRenderCounts(refs);
        expect(counts.goodCount).toBe(3);
        expect(counts.badCount).toBe(0);
    });

    it('counts both MUTATION and NEW_REF_NO_VALUE as bad', () => {
        const refs = [
            makeResult({classification: RENDER_CLASSIFICATION.MUTATION}),
            makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE}),
        ];
        const counts = getRenderCounts(refs);
        expect(counts.badCount).toBe(2);
    });
});

// ===========================================================================
// getRenderHealth
// ===========================================================================

describe('getRenderHealth', () => {
    it('returns "good" when only good refs exist', () => {
        expect(getRenderHealth({goodCount: 3, badCount: 0, noChangeCount: 0})).toBe('good');
    });

    it('returns "bad" when only bad refs exist', () => {
        expect(getRenderHealth({goodCount: 0, badCount: 2, noChangeCount: 0})).toBe('bad');
    });

    it('returns "mixed" when both good and bad refs exist', () => {
        expect(getRenderHealth({goodCount: 1, badCount: 1, noChangeCount: 0})).toBe('mixed');
    });

    it('returns "empty" when all refs are no-change (no good, no bad)', () => {
        expect(getRenderHealth({goodCount: 0, badCount: 0, noChangeCount: 5})).toBe('empty');
    });

    it('returns "neutral" when all counts are zero (all initial)', () => {
        expect(getRenderHealth({goodCount: 0, badCount: 0, noChangeCount: 0})).toBe('neutral');
    });

    it('no-change does not influence bad status', () => {
        expect(getRenderHealth({goodCount: 0, badCount: 0, noChangeCount: 10})).toBe('empty');
    });

    it('returns "good" even when noChangeCount > 0 alongside good', () => {
        expect(getRenderHealth({goodCount: 2, badCount: 0, noChangeCount: 5})).toBe('good');
    });

    it('returns "mixed" even when noChangeCount > 0 alongside both', () => {
        expect(getRenderHealth({goodCount: 1, badCount: 1, noChangeCount: 10})).toBe('mixed');
    });

    it('returns "bad" when only bad and noChange exist', () => {
        expect(getRenderHealth({goodCount: 0, badCount: 3, noChangeCount: 2})).toBe('bad');
    });
});

// ===========================================================================
// buildRenderStatsText
// ===========================================================================

describe('buildRenderStatsText', () => {
    it('returns "no changes" for empty health', () => {
        expect(buildRenderStatsText('empty', {goodCount: 0, badCount: 0, noChangeCount: 5})).toBe('no changes');
    });

    it('returns "initial" for neutral health', () => {
        expect(buildRenderStatsText('neutral', {goodCount: 0, badCount: 0, noChangeCount: 0})).toBe('initial');
    });

    it('shows both counts for mixed health', () => {
        expect(buildRenderStatsText('mixed', {goodCount: 2, badCount: 3, noChangeCount: 0})).toBe('\u2713 2  \u2717 3');
    });

    it('shows only good count for good health', () => {
        expect(buildRenderStatsText('good', {goodCount: 4, badCount: 0, noChangeCount: 0})).toBe('\u2713 4');
    });

    it('shows only bad count for bad health', () => {
        expect(buildRenderStatsText('bad', {goodCount: 0, badCount: 3, noChangeCount: 0})).toBe('\u2717 3');
    });

    it('shows correct format with large counts', () => {
        expect(buildRenderStatsText('mixed', {goodCount: 100, badCount: 50, noChangeCount: 0})).toBe('\u2713 100  \u2717 50');
    });

    it('shows single good count correctly', () => {
        expect(buildRenderStatsText('good', {goodCount: 1, badCount: 0, noChangeCount: 0})).toBe('\u2713 1');
    });

    it('shows single bad count correctly', () => {
        expect(buildRenderStatsText('bad', {goodCount: 0, badCount: 1, noChangeCount: 0})).toBe('\u2717 1');
    });
});

// ===========================================================================
// buildComponentStats
// ===========================================================================

describe('buildComponentStats', () => {
    it('returns all zeros for empty renders array', () => {
        expect(buildComponentStats([])).toEqual({good: 0, mixed: 0, bad: 0, empty: 0});
    });

    it('counts a render with only good refs as good', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            ]),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 1, mixed: 0, bad: 0, empty: 0});
    });

    it('counts a render with only bad refs as bad', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.MUTATION}),
            ]),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 0, mixed: 0, bad: 1, empty: 0});
    });

    it('counts a render with both good and bad refs as mixed', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
                makeResult({classification: RENDER_CLASSIFICATION.MUTATION}),
            ]),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 0, mixed: 1, bad: 0, empty: 0});
    });

    it('counts a render with only no-change refs as empty', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}),
                makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}),
            ]),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 0, mixed: 0, bad: 0, empty: 1});
    });

    it('counts a render with only initial refs as neutral (not counted in any category)', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.INITIAL}),
            ]),
        ];
        // neutral renders are not counted in good/mixed/bad/empty
        expect(buildComponentStats(renders)).toEqual({good: 0, mixed: 0, bad: 0, empty: 0});
    });

    it('correctly categorizes a mix of different render types', () => {
        const renders = [
            // good render
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            ], 1),
            // bad render
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE}),
            ], 2),
            // mixed render
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
                makeResult({classification: RENDER_CLASSIFICATION.MUTATION}),
            ], 3),
            // empty render
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}),
            ], 4),
            // another good render
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            ], 5),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 2, mixed: 1, bad: 1, empty: 1});
    });

    it('counts NEW_REF_NO_VALUE as a bad render', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE}),
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE}),
            ]),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 0, mixed: 0, bad: 1, empty: 0});
    });

    it('a render with bad and no-change refs (but no good) is counted as bad', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.MUTATION}),
                makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}),
            ]),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 0, mixed: 0, bad: 1, empty: 0});
    });

    it('a render with good and no-change refs (but no bad) is counted as good', () => {
        const renders = [
            makeRenderRecord([
                makeResult({classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
                makeResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}),
            ]),
        ];
        expect(buildComponentStats(renders)).toEqual({good: 1, mixed: 0, bad: 0, empty: 0});
    });
});
