import {act, render, screen} from '@testing-library/react';
import React, {useContext} from 'react';
import {describe, expect, it} from 'vitest';
import {
    ReferenceTrackerActionsContext,
    ReferenceTrackerProvider,
    ReferenceTrackerStoreContext,
} from '../ReferenceTrackerContext';
import type {RenderRecord} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRenderRecord(renderId: number): RenderRecord {
    return {renderId, startTime: 0, duration: 1, refs: []};
}

function StoreReader() {
    const {store} = useContext(ReferenceTrackerStoreContext);
    const ids = Object.keys(store.components);
    return <div data-testid="store-ids">{ids.join(',')}</div>;
}

function RenderCounter({componentId}: {componentId: string}) {
    const {store} = useContext(ReferenceTrackerStoreContext);
    const count = store.components[componentId]?.renders.length ?? 0;
    return <div data-testid={`count-${componentId}`}>{count}</div>;
}

function AddRenderButton({componentId, renderId, name}: {componentId: string; renderId: number; name?: string}) {
    const {addRender} = useContext(ReferenceTrackerActionsContext);
    return (
        <button
            data-testid={`add-${componentId}-${renderId}`}
            onClick={() => addRender(componentId, makeRenderRecord(renderId), name)}
        >
            add
        </button>
    );
}

function ClearButton() {
    const {clearAll} = useContext(ReferenceTrackerStoreContext);
    return (
        <button data-testid="clear" onClick={clearAll}>
            clear
        </button>
    );
}

// ===========================================================================
// ReferenceTrackerProvider
// ===========================================================================

describe('ReferenceTrackerProvider', () => {
    describe('initial state', () => {
        it('provides an empty store by default', () => {
            render(
                <ReferenceTrackerProvider>
                    <StoreReader />
                </ReferenceTrackerProvider>,
            );
            expect(screen.getByTestId('store-ids').textContent).toBe('');
        });
    });

    describe('addRender', () => {
        it('adds a render record to a new component', async () => {
            render(
                <ReferenceTrackerProvider>
                    <StoreReader />
                    <RenderCounter componentId="c-1" />
                    <AddRenderButton componentId="c-1" renderId={1} name="Comp" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });

            expect(screen.getByTestId('store-ids').textContent).toBe('c-1');
            expect(screen.getByTestId('count-c-1').textContent).toBe('1');
        });

        it('appends multiple renders to the same component', async () => {
            render(
                <ReferenceTrackerProvider>
                    <RenderCounter componentId="c-1" />
                    <AddRenderButton componentId="c-1" renderId={1} />
                    <AddRenderButton componentId="c-1" renderId={2} />
                    <AddRenderButton componentId="c-1" renderId={3} />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-1-2').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-1-3').click();
            });

            expect(screen.getByTestId('count-c-1').textContent).toBe('3');
        });

        it('adds renders to different components independently', async () => {
            render(
                <ReferenceTrackerProvider>
                    <StoreReader />
                    <RenderCounter componentId="c-1" />
                    <RenderCounter componentId="c-2" />
                    <AddRenderButton componentId="c-1" renderId={1} />
                    <AddRenderButton componentId="c-2" renderId={1} />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-2-1').click();
            });

            expect(screen.getByTestId('store-ids').textContent).toBe('c-1,c-2');
            expect(screen.getByTestId('count-c-1').textContent).toBe('1');
            expect(screen.getByTestId('count-c-2').textContent).toBe('1');
        });

        it('preserves componentName from the first addRender call', async () => {
            function NameReader({componentId}: {componentId: string}) {
                const {store} = useContext(ReferenceTrackerStoreContext);
                const name = store.components[componentId]?.componentName ?? 'none';
                return <div data-testid="comp-name">{name}</div>;
            }

            render(
                <ReferenceTrackerProvider>
                    <NameReader componentId="c-1" />
                    <AddRenderButton componentId="c-1" renderId={1} name="FirstName" />
                    <AddRenderButton componentId="c-1" renderId={2} />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-1-2').click();
            });

            // Name from first call should persist even when second call has no name
            expect(screen.getByTestId('comp-name').textContent).toBe('FirstName');
        });

        it('updates componentName if a later call provides one', async () => {
            function NameReader({componentId}: {componentId: string}) {
                const {store} = useContext(ReferenceTrackerStoreContext);
                const name = store.components[componentId]?.componentName ?? 'none';
                return <div data-testid="comp-name">{name}</div>;
            }

            render(
                <ReferenceTrackerProvider>
                    <NameReader componentId="c-1" />
                    <AddRenderButton componentId="c-1" renderId={1} />
                    <AddRenderButton componentId="c-1" renderId={2} name="LaterName" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-1-2').click();
            });

            expect(screen.getByTestId('comp-name').textContent).toBe('LaterName');
        });
    });

    describe('clearAll', () => {
        it('resets the store to empty', async () => {
            render(
                <ReferenceTrackerProvider>
                    <StoreReader />
                    <AddRenderButton componentId="c-1" renderId={1} />
                    <ClearButton />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });
            expect(screen.getByTestId('store-ids').textContent).toBe('c-1');

            await act(async () => {
                screen.getByTestId('clear').click();
            });
            expect(screen.getByTestId('store-ids').textContent).toBe('');
        });

        it('allows adding new renders after clearing', async () => {
            render(
                <ReferenceTrackerProvider>
                    <RenderCounter componentId="c-1" />
                    <AddRenderButton componentId="c-1" renderId={1} />
                    <AddRenderButton componentId="c-1" renderId={2} />
                    <ClearButton />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });
            await act(async () => {
                screen.getByTestId('clear').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-1-2').click();
            });

            expect(screen.getByTestId('count-c-1').textContent).toBe('1');
        });
    });

    describe('context split (actions vs store)', () => {
        it('actions context does not trigger re-renders when store changes', async () => {
            let actionsRenderCount = 0;

            function ActionsConsumer() {
                useContext(ReferenceTrackerActionsContext);
                actionsRenderCount++;
                return <div data-testid="actions-renders">{actionsRenderCount}</div>;
            }

            render(
                <ReferenceTrackerProvider>
                    <ActionsConsumer />
                    <AddRenderButton componentId="c-1" renderId={1} />
                    <AddRenderButton componentId="c-1" renderId={2} />
                </ReferenceTrackerProvider>,
            );

            const initialCount = actionsRenderCount;

            await act(async () => {
                screen.getByTestId('add-c-1-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-1-2').click();
            });

            // Actions context value is stable (useMemo with stable addRender)
            // so ActionsConsumer should not re-render when store data changes
            expect(actionsRenderCount).toBe(initialCount);
        });
    });

    describe('default context values (outside provider)', () => {
        it('addRender is a no-op outside the provider', () => {
            function OutsideConsumer() {
                const {addRender} = useContext(ReferenceTrackerActionsContext);
                addRender('c-1', makeRenderRecord(1));
                return <div data-testid="outside">ok</div>;
            }

            // Should not throw
            render(<OutsideConsumer />);
            expect(screen.getByTestId('outside').textContent).toBe('ok');
        });

        it('store is empty outside the provider', () => {
            function OutsideReader() {
                const {store} = useContext(ReferenceTrackerStoreContext);
                return <div data-testid="outside-ids">{Object.keys(store.components).length}</div>;
            }

            render(<OutsideReader />);
            expect(screen.getByTestId('outside-ids').textContent).toBe('0');
        });

        it('clearAll is a no-op outside the provider', () => {
            function OutsideClear() {
                const {clearAll} = useContext(ReferenceTrackerStoreContext);
                clearAll();
                return <div data-testid="outside-clear">ok</div>;
            }

            render(<OutsideClear />);
            expect(screen.getByTestId('outside-clear').textContent).toBe('ok');
        });
    });
});
