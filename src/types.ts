const RENDER_CLASSIFICATION = {
    INITIAL: 'initial',
    NO_CHANGE: 'no-change',
    MUTATION: 'mutation',
    NEW_REF_NO_VALUE: 'new-ref-no-value',
    NEW_REF_WITH_VALUE: 'new-ref-with-value',
} as const;

type RenderClassification = (typeof RENDER_CLASSIFICATION)[keyof typeof RENDER_CLASSIFICATION];

type RefSnapshot = {
    raw: unknown;
    clone: unknown;
};

type RefResult = {
    name: string;
    classification: RenderClassification;
    refChangedPaths: string[];
    valueChangedPaths: string[];
    unnecessaryRefChanges: string[];
};

type RenderRecord = {
    renderId: number;
    startTime: number;
    duration: number;
    refs: RefResult[];
};

type ComponentRecord = {
    componentId: string;
    componentName?: string;
    renders: RenderRecord[];
};

type RenderTrackerStore = {
    components: Record<string, ComponentRecord>;
};

type RenderTrackerContextValue = {
    store: RenderTrackerStore;
    addRender: (componentId: string, record: RenderRecord, componentName?: string) => void;
    clearAll: () => void;
};

type RenderCache = {
    renderCount: number;
    renderStartTime: number;
    snapshots: Map<string, RefSnapshot>;
    currentResults: RefResult[];
    pendingRecord: RenderRecord | null;
};

export {RENDER_CLASSIFICATION};
export type {RenderClassification, RefSnapshot, RefResult, RenderRecord, ComponentRecord, RenderTrackerStore, RenderTrackerContextValue, RenderCache};
