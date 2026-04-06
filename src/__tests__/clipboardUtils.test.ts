import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    copyToClipboard,
    serializeComponentRecord,
    serializeRenderRecord,
    serializeStore,
    toClipboardText,
} from '../clipboardUtils';
import {RENDER_CLASSIFICATION} from '../types';
import type {ComponentRecord, RefResult, RenderRecord, RenderTrackerStore} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRefResult(overrides: Partial<RefResult>): RefResult {
    return {
        name: 'testRef',
        classification: RENDER_CLASSIFICATION.NO_CHANGE,
        refChangedPaths: [],
        valueChangedPaths: [],
        unnecessaryRefChanges: [],
        ...overrides,
    };
}

function makeRenderRecord(overrides: Partial<RenderRecord> = {}): RenderRecord {
    return {
        renderId: 1,
        startTime: 100,
        duration: 5.123456,
        refs: [],
        ...overrides,
    };
}

function makeComponentRecord(overrides: Partial<ComponentRecord> = {}): ComponentRecord {
    return {
        componentId: 'comp-1',
        componentName: 'TestComponent',
        renders: [],
        ...overrides,
    };
}

// ===========================================================================
// serializeRenderRecord
// ===========================================================================

describe('serializeRenderRecord', () => {
    it('returns renderId and formatted duration_ms', () => {
        const record = makeRenderRecord({renderId: 3, duration: 12.3456});
        const result = serializeRenderRecord(record);
        expect(result.renderId).toBe(3);
        expect(result.duration_ms).toBe('12.346');
    });

    it('filters out refs with no-change classification', () => {
        const record = makeRenderRecord({
            refs: [
                makeRefResult({name: 'kept', classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
                makeRefResult({name: 'filtered', classification: RENDER_CLASSIFICATION.NO_CHANGE}),
            ],
        });
        const result = serializeRenderRecord(record);
        expect(result.refs).toHaveLength(1);
        expect(result.refs[0].name).toBe('kept');
    });

    it('filters out refs with initial classification', () => {
        const record = makeRenderRecord({
            refs: [
                makeRefResult({name: 'kept', classification: RENDER_CLASSIFICATION.MUTATION}),
                makeRefResult({name: 'initial', classification: RENDER_CLASSIFICATION.INITIAL}),
            ],
        });
        const result = serializeRenderRecord(record);
        expect(result.refs).toHaveLength(1);
        expect(result.refs[0].name).toBe('kept');
    });

    it('keeps MUTATION, NEW_REF_NO_VALUE, and NEW_REF_WITH_VALUE refs', () => {
        const record = makeRenderRecord({
            refs: [
                makeRefResult({name: 'mutation', classification: RENDER_CLASSIFICATION.MUTATION}),
                makeRefResult({name: 'noValue', classification: RENDER_CLASSIFICATION.NEW_REF_NO_VALUE}),
                makeRefResult({name: 'withValue', classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE}),
            ],
        });
        const result = serializeRenderRecord(record);
        expect(result.refs).toHaveLength(3);
    });

    it('returns empty refs array when all refs are no-change or initial', () => {
        const record = makeRenderRecord({
            refs: [
                makeRefResult({classification: RENDER_CLASSIFICATION.NO_CHANGE}),
                makeRefResult({classification: RENDER_CLASSIFICATION.INITIAL}),
            ],
        });
        const result = serializeRenderRecord(record);
        expect(result.refs).toHaveLength(0);
    });

    it('serializes ref with correct structure including correctRefChanges', () => {
        const record = makeRenderRecord({
            refs: [
                makeRefResult({
                    name: 'prop',
                    classification: RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE,
                    refChangedPaths: ['prop', 'prop.a', 'prop.b'],
                    valueChangedPaths: ['prop.a'],
                    unnecessaryRefChanges: ['prop.b'],
                }),
            ],
        });
        const result = serializeRenderRecord(record);
        expect(result.refs[0]).toEqual({
            name: 'prop',
            classification: 'new-ref-with-value',
            valuesChanged: ['prop.a'],
            correctRefChanges: ['prop'],
            unnecessaryRefChanges: ['prop.b'],
        });
    });

    it('formats duration to exactly 3 decimal places', () => {
        const record1 = makeRenderRecord({duration: 1});
        expect(serializeRenderRecord(record1).duration_ms).toBe('1.000');

        const record2 = makeRenderRecord({duration: 0.1});
        expect(serializeRenderRecord(record2).duration_ms).toBe('0.100');

        const record3 = makeRenderRecord({duration: 99.9999});
        expect(serializeRenderRecord(record3).duration_ms).toBe('100.000');
    });
});

// ===========================================================================
// serializeComponentRecord
// ===========================================================================

describe('serializeComponentRecord', () => {
    it('returns componentId, componentName, totalRenders, and serialized renders', () => {
        const component = makeComponentRecord({
            componentId: 'c-42',
            componentName: 'MyComp',
            renders: [makeRenderRecord({renderId: 1}), makeRenderRecord({renderId: 2})],
        });
        const result = serializeComponentRecord(component);
        expect(result.componentId).toBe('c-42');
        expect(result.componentName).toBe('MyComp');
        expect(result.totalRenders).toBe(2);
        expect(result.renders).toHaveLength(2);
    });

    it('preserves undefined componentName', () => {
        const component = makeComponentRecord({componentName: undefined});
        const result = serializeComponentRecord(component);
        expect(result.componentName).toBeUndefined();
    });

    it('returns 0 totalRenders for component with no renders', () => {
        const component = makeComponentRecord({renders: []});
        const result = serializeComponentRecord(component);
        expect(result.totalRenders).toBe(0);
        expect(result.renders).toHaveLength(0);
    });

    it('serializes each render through serializeRenderRecord (filtering applies)', () => {
        const component = makeComponentRecord({
            renders: [
                makeRenderRecord({
                    renderId: 1,
                    refs: [
                        makeRefResult({name: 'visible', classification: RENDER_CLASSIFICATION.MUTATION}),
                        makeRefResult({name: 'hidden', classification: RENDER_CLASSIFICATION.NO_CHANGE}),
                    ],
                }),
            ],
        });
        const result = serializeComponentRecord(component);
        expect(result.renders[0].refs).toHaveLength(1);
        expect(result.renders[0].refs[0].name).toBe('visible');
    });
});

// ===========================================================================
// serializeStore
// ===========================================================================

describe('serializeStore', () => {
    it('returns exportedAt ISO string and serialized components', () => {
        const store: RenderTrackerStore = {
            components: {
                'c-1': makeComponentRecord({componentId: 'c-1', componentName: 'A'}),
                'c-2': makeComponentRecord({componentId: 'c-2', componentName: 'B'}),
            },
        };
        const result = serializeStore(store);
        expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(result.components).toHaveLength(2);
    });

    it('returns empty components array for empty store', () => {
        const store: RenderTrackerStore = {components: {}};
        const result = serializeStore(store);
        expect(result.components).toHaveLength(0);
    });

    it('exportedAt is a valid ISO date', () => {
        const store: RenderTrackerStore = {components: {}};
        const result = serializeStore(store);
        const date = new Date(result.exportedAt);
        expect(date.getTime()).not.toBeNaN();
    });

    it('serializes components with their full render data', () => {
        const store: RenderTrackerStore = {
            components: {
                'c-1': makeComponentRecord({
                    componentId: 'c-1',
                    renders: [
                        makeRenderRecord({
                            renderId: 1,
                            refs: [makeRefResult({name: 'x', classification: RENDER_CLASSIFICATION.MUTATION})],
                        }),
                    ],
                }),
            },
        };
        const result = serializeStore(store);
        expect(result.components[0].renders[0].refs[0].name).toBe('x');
    });
});

// ===========================================================================
// toClipboardText
// ===========================================================================

describe('toClipboardText', () => {
    it('returns pretty-printed JSON with 2-space indentation', () => {
        const obj = {a: 1, b: 'two'};
        const result = toClipboardText(obj);
        expect(result).toBe(JSON.stringify(obj, null, 2));
    });

    it('formats a string value correctly', () => {
        expect(toClipboardText('hello')).toBe('"hello"');
    });

    it('formats a number correctly', () => {
        expect(toClipboardText(42)).toBe('42');
    });

    it('formats null correctly', () => {
        expect(toClipboardText(null)).toBe('null');
    });

    it('formats a nested structure with proper indentation', () => {
        const obj = {a: {b: [1, 2]}};
        const result = toClipboardText(obj);
        expect(result).toContain('\n');
        expect(result).toContain('  ');
    });

    it('handles empty object', () => {
        expect(toClipboardText({})).toBe('{}');
    });

    it('handles empty array', () => {
        expect(toClipboardText([])).toBe('[]');
    });

    it('handles boolean values', () => {
        expect(toClipboardText(true)).toBe('true');
        expect(toClipboardText(false)).toBe('false');
    });
});

// ===========================================================================
// copyToClipboard
// ===========================================================================

describe('copyToClipboard', () => {
    let originalClipboard: Clipboard;

    beforeEach(() => {
        originalClipboard = navigator.clipboard;
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: originalClipboard,
            writable: true,
            configurable: true,
        });
        vi.restoreAllMocks();
    });

    it('calls navigator.clipboard.writeText with the given text', () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: {writeText: writeTextMock},
            writable: true,
            configurable: true,
        });

        copyToClipboard('hello clipboard');
        expect(writeTextMock).toHaveBeenCalledWith('hello clipboard');
    });

    it('falls back to textarea + execCommand when clipboard API rejects', async () => {
        const writeTextMock = vi.fn().mockRejectedValue(new Error('denied'));
        Object.defineProperty(navigator, 'clipboard', {
            value: {writeText: writeTextMock},
            writable: true,
            configurable: true,
        });

        // jsdom does not define execCommand, so we need to add it
        document.execCommand = vi.fn().mockReturnValue(true);
        const execCommandSpy = vi.spyOn(document, 'execCommand');
        const appendChildSpy = vi.spyOn(document.body, 'appendChild');
        const removeChildSpy = vi.spyOn(document.body, 'removeChild');

        copyToClipboard('fallback text');

        // Wait for the Promise rejection handler to execute
        await vi.waitFor(() => {
            expect(execCommandSpy).toHaveBeenCalledWith('copy');
        });

        expect(appendChildSpy).toHaveBeenCalled();
        expect(removeChildSpy).toHaveBeenCalled();

        const textarea = appendChildSpy.mock.calls[0][0] as HTMLTextAreaElement;
        expect(textarea.value).toBe('fallback text');
        expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('handles empty string', () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: {writeText: writeTextMock},
            writable: true,
            configurable: true,
        });

        copyToClipboard('');
        expect(writeTextMock).toHaveBeenCalledWith('');
    });
});
