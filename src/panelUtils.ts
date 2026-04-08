import {RENDER_CLASSIFICATION} from './types';
import type {RefResult, RenderClassification, RenderRecord} from './types';

type RenderHealth = 'good' | 'mixed' | 'bad' | 'empty' | 'neutral';

type RenderCounts = {goodCount: number; badCount: number; noChangeCount: number};

const TRULY_BAD = new Set<RenderClassification>([
    RENDER_CLASSIFICATION.MUTATION,
    RENDER_CLASSIFICATION.NEW_REF_NO_VALUE,
]);

const HEALTH_COLOR: Record<RenderHealth, string> = {
    good: '#28a745',
    mixed: '#ffc107',
    bad: '#dc3545',
    empty: '#dc3545',
    neutral: '#6c757d',
};

function getCorrectRefs(result: RefResult): string[] {
    const unnecessarySet = new Set(result.unnecessaryRefChanges);
    const valueSet = new Set(result.valueChangedPaths);
    return result.refChangedPaths.filter((p) => !unnecessarySet.has(p) && !valueSet.has(p));
}

function getRefBadgeColor(result: RefResult): string {
    const v = result.valueChangedPaths.length;
    const r = getCorrectRefs(result).length;
    const u = result.unnecessaryRefChanges.length;

    if (
        result.classification === RENDER_CLASSIFICATION.INITIAL ||
        result.classification === RENDER_CLASSIFICATION.NO_CHANGE
    ) {
        return '#6c757d';
    }
    if (
        result.classification === RENDER_CLASSIFICATION.MUTATION ||
        result.classification === RENDER_CLASSIFICATION.NEW_REF_NO_VALUE
    ) {
        return '#dc3545';
    }
    if ((v > 0 || r > 0) && u === 0) {
        return '#28a745';
    }
    if ((v > 0 || r > 0) && u > 0) {
        return '#ffc107';
    }
    return '#dc3545';
}

function buildRefStats(result: RefResult): string {
    const v = result.valueChangedPaths.length;
    const u = result.unnecessaryRefChanges.length;

    switch (result.classification) {
        case RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE: {
            const r = getCorrectRefs(result).length;
            const aV = result.valueChangedPaths.length;
            const aR = result.refChangedPaths.length;
            return [v > 0 ? `v:${v}` : '', r > 0 ? `r:${r}` : '', u > 0 ? `\u2717u:${u}` : '', `aV:${aV}`, `aR:${aR}`]
                .filter(Boolean)
                .join(' ');
        }
        case RENDER_CLASSIFICATION.MUTATION:
            return [`\u2623${v > 0 ? ` v:${v}` : ''}`, `aV:${v}`, `aR:${result.refChangedPaths.length}`].join(' ');
        case RENDER_CLASSIFICATION.NEW_REF_NO_VALUE:
            return [
                `\u2717u:${u}`,
                `aV:${result.valueChangedPaths.length}`,
                `aR:${result.refChangedPaths.length}`,
            ].join(' ');
        case RENDER_CLASSIFICATION.INITIAL:
            return 'init';
        default:
            return '';
    }
}

function getRenderCounts(refs: RefResult[]): RenderCounts {
    return {
        goodCount: refs.filter((r) => r.classification === RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE).length,
        badCount: refs.filter((r) => TRULY_BAD.has(r.classification)).length,
        noChangeCount: refs.filter((r) => r.classification === RENDER_CLASSIFICATION.NO_CHANGE).length,
    };
}

function getRenderHealth({goodCount, badCount, noChangeCount}: RenderCounts): RenderHealth {
    if (goodCount === 0 && badCount === 0 && noChangeCount > 0) {
        return 'empty';
    }
    if (goodCount > 0 && badCount === 0) {
        return 'good';
    }
    if (goodCount > 0 && badCount > 0) {
        return 'mixed';
    }
    if (badCount > 0) {
        return 'bad';
    }
    return 'neutral';
}

function buildRenderStatsText(health: RenderHealth, counts: RenderCounts): string {
    if (health === 'empty') {
        return 'no changes';
    }
    if (health === 'neutral') {
        return 'initial';
    }
    if (counts.goodCount > 0 && counts.badCount > 0) {
        return `\u2713 ${counts.goodCount}  \u2717 ${counts.badCount}`;
    }
    if (counts.goodCount > 0) {
        return `\u2713 ${counts.goodCount}`;
    }
    return `\u2717 ${counts.badCount}`;
}

function buildComponentStats(renders: RenderRecord[]): {good: number; mixed: number; bad: number; empty: number} {
    let good = 0;
    let mixed = 0;
    let bad = 0;
    let empty = 0;
    for (const r of renders) {
        const h = getRenderHealth(getRenderCounts(r.refs));
        if (h === 'good') {
            good += 1;
        } else if (h === 'mixed') {
            mixed += 1;
        } else if (h === 'bad') {
            bad += 1;
        } else if (h === 'empty') {
            empty += 1;
        }
    }
    return {good, mixed, bad, empty};
}

export {
    HEALTH_COLOR,
    TRULY_BAD,
    getCorrectRefs,
    getRefBadgeColor,
    buildRefStats,
    getRenderCounts,
    getRenderHealth,
    buildRenderStatsText,
    buildComponentStats,
};
export type {RenderHealth, RenderCounts};
