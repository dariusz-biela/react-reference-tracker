import {useContext, useEffect, useId, useRef} from 'react';
import {ReferenceTrackerActionsContext, ReferenceTrackerEnabledContext} from './ReferenceTrackerContext';
import type {RenderCache} from './types';
import {analyzeRef, deepClone} from './utils';

const DEFAULT_MAX_DEPTH = Infinity;

const NOOP_TRACKER = {
    startRender: () => {},
    listenForChanges: (_value: unknown, _refName: string) => {},
    endRender: () => {},
} as const;

function makeEmptyCache(): RenderCache {
    return {
        renderCount: 0,
        renderStartTime: 0,
        snapshots: new Map(),
        pendingSnapshots: new Map(),
        currentResults: [],
        pendingRecord: null,
    };
}

function useReferenceTracker(name?: string, maxDepth = DEFAULT_MAX_DEPTH) {
    const id = useId();
    const cache = useRef(makeEmptyCache());
    const {addRender} = useContext(ReferenceTrackerActionsContext);
    const {enabled} = useContext(ReferenceTrackerEnabledContext);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const pending = cache.current.pendingRecord;
        if (pending === null) {
            return;
        }
        cache.current.pendingRecord = null;
        for (const [key, value] of cache.current.pendingSnapshots) {
            cache.current.snapshots.set(key, value);
        }
        cache.current.pendingSnapshots = new Map();
        addRender(id, pending, name);
    });

    if (!enabled) {
        return NOOP_TRACKER;
    }

    function startRender() {
        cache.current.currentResults = [];
        cache.current.pendingSnapshots = new Map();
        cache.current.renderStartTime = performance.now();
        cache.current.renderCount += 1;
    }

    function listenForChanges(value: unknown, refName: string) {
        try {
            const snapshot = cache.current.snapshots.get(refName);
            const result = analyzeRef(snapshot, value, refName, maxDepth);
            cache.current.currentResults.push(result);
            cache.current.pendingSnapshots.set(refName, {raw: value, clone: deepClone(value)});
        } catch {
            cache.current.pendingSnapshots.set(refName, {raw: value, clone: value});
        }
    }

    function endRender() {
        const duration = performance.now() - cache.current.renderStartTime;
        cache.current.pendingRecord = {
            renderId: cache.current.renderCount,
            startTime: cache.current.renderStartTime,
            duration,
            refs: [...cache.current.currentResults],
        };
    }

    return {startRender, endRender, listenForChanges};
}

export default useReferenceTracker;
