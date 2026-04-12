import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {serializeStore} from './clipboardUtils';
import type {ComponentRecord, RenderRecord, RenderTrackerContextValue, RenderTrackerStore} from './types';

const EMPTY_STORE: RenderTrackerStore = {components: {}};

type ActionsContextValue = Pick<RenderTrackerContextValue, 'addRender'>;
type StoreContextValue = Pick<RenderTrackerContextValue, 'store' | 'clearAll'>;
type EnabledContextValue = {enabled: boolean; setEnabled: (v: boolean) => void};

const ReferenceTrackerActionsContext = React.createContext<ActionsContextValue>({
    addRender: () => undefined,
});

const ReferenceTrackerStoreContext = React.createContext<StoreContextValue>({
    store: EMPTY_STORE,
    clearAll: () => undefined,
});

const NOOP_SET_ENABLED = () => {};
const ReferenceTrackerEnabledContext = React.createContext<EnabledContextValue>({
    enabled: true,
    setEnabled: NOOP_SET_ENABLED,
});

function ReferenceTrackerProvider({
    children,
    enabled: enabledProp = true,
}: {
    children: React.ReactNode;
    enabled?: boolean;
}) {
    const [enabled, setEnabled] = useState(enabledProp);
    const [store, setStore] = useState(EMPTY_STORE);

    const addRender = useCallback((componentId: string, record: RenderRecord, componentName?: string) => {
        setStore((prev) => {
            const existing: ComponentRecord = prev.components[componentId] ?? {componentId, componentName, renders: []};
            return {
                components: {
                    ...prev.components,
                    [componentId]: {
                        ...existing,
                        componentName: componentName ?? existing.componentName,
                        renders: [...existing.renders, record],
                    },
                },
            };
        });
    }, []);

    const clearAll = useCallback(() => setStore(EMPTY_STORE), []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as unknown as Record<string, unknown>).__REFERENCE_TRACKER_DATA__ = serializeStore(store);
        }
    }, [store]);

    const actionsValue = useMemo(() => ({addRender}), [addRender]);
    const storeValue = useMemo(() => ({store, clearAll}), [store, clearAll]);
    const enabledValue = useMemo(() => ({enabled, setEnabled}), [enabled]);

    return (
        <ReferenceTrackerEnabledContext.Provider value={enabledValue}>
            <ReferenceTrackerActionsContext.Provider value={actionsValue}>
                <ReferenceTrackerStoreContext.Provider value={storeValue}>
                    {children}
                </ReferenceTrackerStoreContext.Provider>
            </ReferenceTrackerActionsContext.Provider>
        </ReferenceTrackerEnabledContext.Provider>
    );
}

export {
    ReferenceTrackerActionsContext,
    ReferenceTrackerEnabledContext,
    ReferenceTrackerStoreContext,
    ReferenceTrackerProvider,
};
