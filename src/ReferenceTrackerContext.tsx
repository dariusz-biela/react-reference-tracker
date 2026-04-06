import React, {useCallback, useMemo, useRef, useState} from 'react';
import type {ComponentRecord, RenderRecord, RenderTrackerContextValue, RenderTrackerStore} from './types';

const EMPTY_STORE: RenderTrackerStore = {components: {}};

type ActionsContextValue = Pick<RenderTrackerContextValue, 'addRender'>;
type StoreContextValue = Pick<RenderTrackerContextValue, 'store' | 'clearAll'>;

const ReferenceTrackerActionsContext = React.createContext<ActionsContextValue>({
    addRender: () => undefined,
});

const ReferenceTrackerStoreContext = React.createContext<StoreContextValue>({
    store: EMPTY_STORE,
    clearAll: () => undefined,
});

function ReferenceTrackerProvider({children}: {children: React.ReactNode}) {
    const [store, setStore] = useState<RenderTrackerStore>(EMPTY_STORE);

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

    const actionsValue = useMemo(() => ({addRender}), [addRender]);
    const storeValue = useMemo(() => ({store, clearAll}), [store, clearAll]);

    return (
        <ReferenceTrackerActionsContext.Provider value={actionsValue}>
            <ReferenceTrackerStoreContext.Provider value={storeValue}>{children}</ReferenceTrackerStoreContext.Provider>
        </ReferenceTrackerActionsContext.Provider>
    );
}

export {ReferenceTrackerActionsContext, ReferenceTrackerStoreContext, ReferenceTrackerProvider};
