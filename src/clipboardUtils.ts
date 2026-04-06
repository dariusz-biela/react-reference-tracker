import {getCorrectRefs} from './panelUtils';
import type {ComponentRecord, RefResult, RenderRecord, RenderTrackerStore} from './types';

type SerializedRef = {
    name: string;
    classification: string;
    valuesChanged: string[];
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

function serializeRef(ref: RefResult): SerializedRef {
    return {
        name: ref.name,
        classification: ref.classification,
        valuesChanged: ref.valueChangedPaths,
        correctRefChanges: getCorrectRefs(ref),
        unnecessaryRefChanges: ref.unnecessaryRefChanges,
    };
}

function serializeRenderRecord(record: RenderRecord): SerializedRender {
    return {
        renderId: record.renderId,
        duration_ms: record.duration.toFixed(3),
        refs: record.refs.filter((r) => r.classification !== 'no-change' && r.classification !== 'initial').map(serializeRef),
    };
}

function serializeComponentRecord(component: ComponentRecord): SerializedComponent {
    return {
        componentId: component.componentId,
        componentName: component.componentName,
        totalRenders: component.renders.length,
        renders: component.renders.map(serializeRenderRecord),
    };
}

function serializeStore(store: RenderTrackerStore): SerializedStore {
    return {
        exportedAt: new Date().toISOString(),
        components: Object.values(store.components).map(serializeComponentRecord),
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
        document.execCommand('copy');
        document.body.removeChild(textarea);
    });
}

export {serializeRenderRecord, serializeComponentRecord, serializeStore, toClipboardText, copyToClipboard};
