import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, {useContext} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ReferenceTrackerActionsContext, ReferenceTrackerProvider} from '../ReferenceTrackerContext';
import ReferenceTrackerPanel from '../ReferenceTrackerPanel';
import {RENDER_CLASSIFICATION} from '../types';
import type {RenderRecord} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRenderRecord(renderId: number, refs: RenderRecord['refs'] = []): RenderRecord {
    return {renderId, startTime: 0, duration: 1.234, refs};
}

function makeRef(name: string, classification: string, overrides: Partial<RenderRecord['refs'][0]> = {}): RenderRecord['refs'][0] {
    return {
        name,
        classification: classification as RenderRecord['refs'][0]['classification'],
        refChangedPaths: [],
        valueChangedPaths: [],
        unnecessaryRefChanges: [],
        ...overrides,
    };
}

function AddDataButton({componentId, renderId, name, refs}: {componentId: string; renderId: number; name?: string; refs?: RenderRecord['refs']}) {
    const {addRender} = useContext(ReferenceTrackerActionsContext);
    return (
        <button
            data-testid={`add-${componentId}`}
            onClick={() => addRender(componentId, makeRenderRecord(renderId, refs), name)}
        >
            add
        </button>
    );
}

// ---------------------------------------------------------------------------
// Mock clipboard
// ---------------------------------------------------------------------------

let clipboardWriteText: ReturnType<typeof vi.fn>;

beforeEach(() => {
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: {writeText: clipboardWriteText},
        writable: true,
        configurable: true,
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ===========================================================================
// ReferenceTrackerPanel
// ===========================================================================

describe('ReferenceTrackerPanel', () => {
    describe('FAB button', () => {
        it('renders a toggle button with "RT" text when panel is closed', () => {
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );
            const fab = screen.getByLabelText('Toggle reference tracker panel');
            expect(fab).toBeInTheDocument();
            expect(fab.textContent).toContain('RT');
        });

        it('shows close icon when panel is open', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            const fab = screen.getByLabelText('Toggle reference tracker panel');
            expect(fab.textContent).toContain('\u2715');
        });

        it('shows badge with component count when there are tracked renders', async () => {
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} name="Comp1" />
                    <AddDataButton componentId="c-2" renderId={1} name="Comp2" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-2').click();
            });

            // Badge should show "2" (two components)
            const badge = document.querySelector('.rrt-fab-badge');
            expect(badge).toBeTruthy();
            expect(badge?.textContent).toBe('2');
        });

        it('does not show badge when panel is open', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));

            const badge = document.querySelector('.rrt-fab-badge');
            expect(badge).toBeNull();
        });

        it('does not show badge when there are no renders', () => {
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            const badge = document.querySelector('.rrt-fab-badge');
            expect(badge).toBeNull();
        });
    });

    describe('panel toggle', () => {
        it('does not show panel content initially', () => {
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            expect(screen.queryByText('Reference Tracker')).not.toBeInTheDocument();
        });

        it('shows panel content after clicking FAB', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            expect(screen.getByText('Reference Tracker')).toBeInTheDocument();
        });

        it('hides panel content when FAB is clicked again', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            const fab = screen.getByLabelText('Toggle reference tracker panel');
            await user.click(fab);
            expect(screen.getByText('Reference Tracker')).toBeInTheDocument();

            await user.click(fab);
            expect(screen.queryByText('Reference Tracker')).not.toBeInTheDocument();
        });
    });

    describe('panel header', () => {
        it('shows total renders count', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} />
                    <AddDataButton componentId="c-2" renderId={1} />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-2').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            expect(screen.getByText('2 total')).toBeInTheDocument();
        });

        it('has a Clear All button', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            expect(screen.getByLabelText('Clear all render records')).toBeInTheDocument();
        });

        it('clears all data when Clear All is clicked', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} name="Comp" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            expect(screen.getByText('1 total')).toBeInTheDocument();

            await user.click(screen.getByLabelText('Clear all render records'));
            expect(screen.getByText('0 total')).toBeInTheDocument();
        });

        it('has a Copy all button that copies store data to clipboard', async () => {
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} name="Comp" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });

            await act(async () => {
                screen.getByLabelText('Toggle reference tracker panel').click();
            });

            await act(async () => {
                screen.getByLabelText('Copy all render data').click();
            });

            expect(clipboardWriteText).toHaveBeenCalledTimes(1);
            const copiedText = clipboardWriteText.mock.calls[0][0];
            const parsed = JSON.parse(copiedText);
            expect(parsed).toHaveProperty('exportedAt');
            expect(parsed).toHaveProperty('components');
        });
    });

    describe('empty state', () => {
        it('shows "No components tracked yet." when store is empty', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            expect(screen.getByText('No components tracked yet.')).toBeInTheDocument();
        });
    });

    describe('component sections', () => {
        it('renders a section for each tracked component', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} name="Alpha" />
                    <AddDataButton componentId="c-2" renderId={1} name="Beta" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });
            await act(async () => {
                screen.getByTestId('add-c-2').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));

            expect(screen.getByText('Alpha')).toBeInTheDocument();
            expect(screen.getByText('Beta')).toBeInTheDocument();
        });

        it('shows render count and last duration for each component', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} name="Comp" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));

            // Should show "1 renders | last: 1.23ms" (1.234 rounded to 2 decimals)
            expect(screen.getByText(/1 renders/)).toBeInTheDocument();
            expect(screen.getByText(/1\.23ms/)).toBeInTheDocument();
        });

        it('expands component section to show renders when clicked', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton
                        componentId="c-1"
                        renderId={1}
                        name="Comp"
                        refs={[makeRef('prop', RENDER_CLASSIFICATION.NEW_REF_WITH_VALUE, {
                            refChangedPaths: ['prop'],
                            valueChangedPaths: ['prop'],
                        })]}
                    />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));

            // Render details should not be visible yet
            expect(screen.queryByText(/Render #1/)).not.toBeInTheDocument();

            // Click component header to expand
            await user.click(screen.getByLabelText('Toggle renders for Comp'));

            expect(screen.getByText(/Render #1/)).toBeInTheDocument();
        });
    });

    describe('filters', () => {
        it('has filter inputs for component id and ref name', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));

            expect(screen.getByLabelText('Filter by component id')).toBeInTheDocument();
            expect(screen.getByLabelText('Filter by ref name')).toBeInTheDocument();
        });

        it('filters components by id', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="comp-alpha" renderId={1} name="Alpha" />
                    <AddDataButton componentId="comp-beta" renderId={1} name="Beta" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-comp-alpha').click();
            });
            await act(async () => {
                screen.getByTestId('add-comp-beta').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));

            expect(screen.getByText('Alpha')).toBeInTheDocument();
            expect(screen.getByText('Beta')).toBeInTheDocument();

            // Type in the id filter
            await user.type(screen.getByLabelText('Filter by component id'), 'alpha');

            expect(screen.getByText('Alpha')).toBeInTheDocument();
            expect(screen.queryByText('Beta')).not.toBeInTheDocument();
        });

        it('filter is case-insensitive', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="MyComponent" renderId={1} name="Comp" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-MyComponent').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            await user.type(screen.getByLabelText('Filter by component id'), 'mycomponent');

            expect(screen.getByText('Comp')).toBeInTheDocument();
        });

        it('shows empty state when filter matches nothing', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                    <AddDataButton componentId="c-1" renderId={1} name="Comp" />
                </ReferenceTrackerProvider>,
            );

            await act(async () => {
                screen.getByTestId('add-c-1').click();
            });

            await user.click(screen.getByLabelText('Toggle reference tracker panel'));
            await user.type(screen.getByLabelText('Filter by component id'), 'nonexistent');

            expect(screen.getByText('No components tracked yet.')).toBeInTheDocument();
        });
    });

    describe('CSS injection', () => {
        it('injects a <style> element with data-rrt attribute', async () => {
            const user = userEvent.setup();
            render(
                <ReferenceTrackerProvider>
                    <ReferenceTrackerPanel />
                </ReferenceTrackerProvider>,
            );

            const styleEl = document.querySelector('style[data-rrt]');
            expect(styleEl).toBeTruthy();
            expect(styleEl?.textContent).toContain('.rrt-');
        });
    });
});
