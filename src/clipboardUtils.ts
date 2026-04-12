import {getCorrectRefs} from './panelUtils';
import type {ComponentRecord, RefResult, RenderRecord, RenderTrackerStore, ValueChangeDetail} from './types';

type SerializedRef = {
    name: string;
    classification: string;
    valuesChanged: string[];
    valuesChangedDetails: ValueChangeDetail[];
    correctRefChanges: string[];
    unnecessaryRefChanges: string[];
};

type SerializedRender = {
    renderId: number;
    duration_ms: string;
    refs: SerializedRef[];
};

type SerializedComponent = {
    componentId: string;
    componentName: string | undefined;
    totalRenders: number;
    renders: SerializedRender[];
};

type SerializedStore = {
    exportedAt: string;
    components: SerializedComponent[];
};

function serializeRef(ref: RefResult, includeDetails = true): SerializedRef {
    const base: SerializedRef = {
        name: ref.name,
        classification: ref.classification,
        valuesChanged: ref.valueChangedPaths,
        valuesChangedDetails: [],
        correctRefChanges: getCorrectRefs(ref),
        unnecessaryRefChanges: ref.unnecessaryRefChanges,
    };
    if (includeDetails) {
        base.valuesChangedDetails = ref.valueChangedDetails;
    }
    return base;
}

function serializeRenderRecord(record: RenderRecord, includeDetails = true): SerializedRender {
    return {
        renderId: record.renderId,
        duration_ms: record.duration.toFixed(3),
        refs: record.refs
            .filter((r) => r.classification !== 'no-change' && r.classification !== 'initial')
            .map((r) => serializeRef(r, includeDetails)),
    };
}

function serializeComponentRecord(component: ComponentRecord, includeDetails = true): SerializedComponent {
    return {
        componentId: component.componentId,
        componentName: component.componentName,
        totalRenders: component.renders.length,
        renders: component.renders.map((r) => serializeRenderRecord(r, includeDetails)),
    };
}

function serializeStore(store: RenderTrackerStore, includeDetails = true): SerializedStore {
    return {
        exportedAt: new Date().toISOString(),
        components: Object.values(store.components).map((c) => serializeComponentRecord(c, includeDetails)),
    };
}

function toClipboardText(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
        // Fallback for older browsers or non-secure contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional fallback for older browsers
        document.execCommand('copy');
        document.body.removeChild(textarea);
    });
}

export {serializeRenderRecord, serializeComponentRecord, serializeStore, toClipboardText, copyToClipboard};
