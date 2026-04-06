import {act, render, screen} from '@testing-library/react';
import React, {useContext, useState} from 'react';
import {describe, expect, it} from 'vitest';
import {ReferenceTrackerProvider, ReferenceTrackerStoreContext} from '../ReferenceTrackerContext';
import useReferenceTracker from '../useReferenceTracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StoreInspector() {
    const {store} = useContext(ReferenceTrackerStoreContext);
    return <pre data-testid="store">{JSON.stringify(store)}</pre>;
}

function getStore(): Record<string, unknown> {
    return JSON.parse(screen.getByTestId('store').textContent ?? '{}');
}

// ===========================================================================
// useReferenceTracker
// ===========================================================================

describe('useReferenceTracker', () => {
    describe('basic tracking cycle (startRender → listenForChanges → endRender)', () => {
        it('records a render with tracked refs after the component commits', async () => {
            function Tracked({value}: {value: number}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('Tracked');
                startRender();
                listenForChanges(value, 'value');
                endRender();
                return <div data-testid="tracked">{value}</div>;
            }

            function Wrapper() {
                const [val, setVal] = useState(1);
                return (
                    <ReferenceTrackerProvider>
                        <Tracked value={val} />
                        <StoreInspector />
                        <button data-testid="change" onClick={() => setVal(2)}>change</button>
                    </ReferenceTrackerProvider>
                );
            }

            render(<Wrapper />);

            // After initial render + useEffect flush, store should have one component
            await act(async () => {});

            const store1 = getStore();
            const componentIds = Object.keys(store1.components as Record<string, unknown>);
            expect(componentIds).toHaveLength(1);

            const comp = (store1.components as Record<string, {renders: unknown[]}>)[componentIds[0]];
            expect(comp.renders).toHaveLength(1);
        });

        it('accumulates renders on re-render', async () => {
            function Tracked({value}: {value: number}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('Tracked');
                startRender();
                listenForChanges(value, 'value');
                endRender();
                return <div>{value}</div>;
            }

            function Wrapper() {
                const [val, setVal] = useState(1);
                return (
                    <ReferenceTrackerProvider>
                        <Tracked value={val} />
                        <StoreInspector />
                        <button data-testid="inc" onClick={() => setVal((v) => v + 1)}>inc</button>
                    </ReferenceTrackerProvider>
                );
            }

            render(<Wrapper />);
            await act(async () => {});

            await act(async () => {
                screen.getByTestId('inc').click();
            });
            await act(async () => {});

            const store = getStore();
            const componentIds = Object.keys(store.components as Record<string, unknown>);
            const comp = (store.components as Record<string, {renders: unknown[]}>)[componentIds[0]];
            expect(comp.renders.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('multiple refs tracked in a single render', () => {
        it('records all tracked refs in one render record', async () => {
            function Tracked({a, b, c}: {a: number; b: string; c: boolean}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('Multi');
                startRender();
                listenForChanges(a, 'a');
                listenForChanges(b, 'b');
                listenForChanges(c, 'c');
                endRender();
                return <div>{String(a)}</div>;
            }

            render(
                <ReferenceTrackerProvider>
                    <Tracked a={1} b="hello" c={true} />
                    <StoreInspector />
                </ReferenceTrackerProvider>,
            );
            await act(async () => {});

            const store = getStore();
            const componentIds = Object.keys(store.components as Record<string, unknown>);
            const comp = (store.components as Record<string, {renders: {refs: {name: string}[]}[]}>)[componentIds[0]];
            const refs = comp.renders[0].refs;
            expect(refs).toHaveLength(3);
            expect(refs.map((r) => r.name)).toEqual(['a', 'b', 'c']);
        });
    });

    describe('classification of tracked values', () => {
        it('classifies initial render as "initial"', async () => {
            function Tracked({value}: {value: unknown}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('T');
                startRender();
                listenForChanges(value, 'val');
                endRender();
                return null;
            }

            render(
                <ReferenceTrackerProvider>
                    <Tracked value={{x: 1}} />
                    <StoreInspector />
                </ReferenceTrackerProvider>,
            );
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {renders: {refs: {classification: string}[]}[]}>)[0];
            expect(comp.renders[0].refs[0].classification).toBe('initial');
        });

        it('classifies unchanged reference as "no-change"', async () => {
            const stableRef = {x: 1};

            function Tracked({value}: {value: unknown}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('T');
                startRender();
                listenForChanges(value, 'val');
                endRender();
                return null;
            }

            function Wrapper() {
                const [, setTick] = useState(0);
                return (
                    <ReferenceTrackerProvider>
                        <Tracked value={stableRef} />
                        <StoreInspector />
                        <button data-testid="rerender" onClick={() => setTick((t) => t + 1)}>re</button>
                    </ReferenceTrackerProvider>
                );
            }

            render(<Wrapper />);
            await act(async () => {});

            await act(async () => {
                screen.getByTestId('rerender').click();
            });
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {renders: {refs: {classification: string}[]}[]}>)[0];
            const lastRender = comp.renders[comp.renders.length - 1];
            expect(lastRender.refs[0].classification).toBe('no-change');
        });

        it('classifies new reference with changed value as "new-ref-with-value"', async () => {
            function Tracked({value}: {value: unknown}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('T');
                startRender();
                listenForChanges(value, 'val');
                endRender();
                return null;
            }

            function Wrapper() {
                const [val, setVal] = useState(1);
                return (
                    <ReferenceTrackerProvider>
                        <Tracked value={val} />
                        <StoreInspector />
                        <button data-testid="change" onClick={() => setVal(2)}>change</button>
                    </ReferenceTrackerProvider>
                );
            }

            render(<Wrapper />);
            await act(async () => {});

            await act(async () => {
                screen.getByTestId('change').click();
            });
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {renders: {refs: {classification: string}[]}[]}>)[0];
            const lastRender = comp.renders[comp.renders.length - 1];
            expect(lastRender.refs[0].classification).toBe('new-ref-with-value');
        });

        it('classifies new reference without value change as "new-ref-no-value"', async () => {
            function Tracked({value}: {value: unknown}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('T');
                startRender();
                listenForChanges(value, 'val');
                endRender();
                return null;
            }

            function Wrapper() {
                const [, setTick] = useState(0);
                return (
                    <ReferenceTrackerProvider>
                        {/* Creates a new {x:1} object each render — new ref, same value */}
                        <Tracked value={{x: 1}} />
                        <StoreInspector />
                        <button data-testid="rerender" onClick={() => setTick((t) => t + 1)}>re</button>
                    </ReferenceTrackerProvider>
                );
            }

            render(<Wrapper />);
            await act(async () => {});

            await act(async () => {
                screen.getByTestId('rerender').click();
            });
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {renders: {refs: {classification: string}[]}[]}>)[0];
            const lastRender = comp.renders[comp.renders.length - 1];
            expect(lastRender.refs[0].classification).toBe('new-ref-no-value');
        });
    });

    describe('component name', () => {
        it('stores the component name passed to the hook', async () => {
            function Tracked() {
                const {startRender, endRender} = useReferenceTracker('MySpecialName');
                startRender();
                endRender();
                return null;
            }

            render(
                <ReferenceTrackerProvider>
                    <Tracked />
                    <StoreInspector />
                </ReferenceTrackerProvider>,
            );
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {componentName: string}>)[0];
            expect(comp.componentName).toBe('MySpecialName');
        });

        it('works without a component name', async () => {
            function Tracked() {
                const {startRender, endRender} = useReferenceTracker();
                startRender();
                endRender();
                return null;
            }

            render(
                <ReferenceTrackerProvider>
                    <Tracked />
                    <StoreInspector />
                </ReferenceTrackerProvider>,
            );
            await act(async () => {});

            const store = getStore();
            const ids = Object.keys(store.components as Record<string, unknown>);
            expect(ids).toHaveLength(1);
        });
    });

    describe('render record metadata', () => {
        it('records a positive duration', async () => {
            function Tracked() {
                const {startRender, endRender} = useReferenceTracker('T');
                startRender();
                endRender();
                return null;
            }

            render(
                <ReferenceTrackerProvider>
                    <Tracked />
                    <StoreInspector />
                </ReferenceTrackerProvider>,
            );
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {renders: {duration: number}[]}>)[0];
            expect(comp.renders[0].duration).toBeGreaterThanOrEqual(0);
        });

        it('increments renderId across renders', async () => {
            function Tracked({value}: {value: number}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('T');
                startRender();
                listenForChanges(value, 'v');
                endRender();
                return null;
            }

            function Wrapper() {
                const [val, setVal] = useState(1);
                return (
                    <ReferenceTrackerProvider>
                        <Tracked value={val} />
                        <StoreInspector />
                        <button data-testid="inc" onClick={() => setVal((v) => v + 1)}>inc</button>
                    </ReferenceTrackerProvider>
                );
            }

            render(<Wrapper />);
            await act(async () => {});

            await act(async () => {
                screen.getByTestId('inc').click();
            });
            await act(async () => {});

            await act(async () => {
                screen.getByTestId('inc').click();
            });
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {renders: {renderId: number}[]}>)[0];
            const renderIds = comp.renders.map((r) => r.renderId);
            // Each renderId should be strictly greater than the previous
            for (let i = 1; i < renderIds.length; i++) {
                expect(renderIds[i]).toBeGreaterThan(renderIds[i - 1]);
            }
        });
    });

    describe('maxDepth parameter', () => {
        it('limits the depth of path tracking', async () => {
            function Tracked({value}: {value: unknown}) {
                const {startRender, listenForChanges, endRender} = useReferenceTracker('T', 1);
                startRender();
                listenForChanges(value, 'val');
                endRender();
                return null;
            }

            function Wrapper() {
                const [deep, setDeep] = useState(false);
                const value = deep ? {a: {b: {c: 999}}} : {a: {b: {c: 1}}};
                return (
                    <ReferenceTrackerProvider>
                        <Tracked value={value} />
                        <StoreInspector />
                        <button data-testid="change" onClick={() => setDeep(true)}>deep</button>
                    </ReferenceTrackerProvider>
                );
            }

            render(<Wrapper />);
            await act(async () => {});

            await act(async () => {
                screen.getByTestId('change').click();
            });
            await act(async () => {});

            const store = getStore();
            const comp = Object.values(store.components as Record<string, {renders: {refs: {refChangedPaths: string[]}[]}[]}>)[0];
            const lastRender = comp.renders[comp.renders.length - 1];
            const paths = lastRender.refs[0].refChangedPaths;
            // With maxDepth=1, should not see paths deeper than depth 1 from root
            const deepPaths = paths.filter((p: string) => p.split('.').length > 3);
            expect(deepPaths).toHaveLength(0);
        });
    });
});
