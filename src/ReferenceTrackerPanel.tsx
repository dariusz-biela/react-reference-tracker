import React, {useContext, useState} from 'react';
import {
    copyToClipboard,
    serializeComponentRecord,
    serializeRenderRecord,
    serializeStore,
    toClipboardText,
} from './clipboardUtils';
import {
    buildComponentStats,
    buildRefStats,
    buildRenderStatsText,
    getCorrectRefs,
    getRefBadgeColor,
    getRenderCounts,
    getRenderHealth,
    HEALTH_COLOR,
} from './panelUtils';
import {ReferenceTrackerStoreContext} from './ReferenceTrackerContext';
import {RENDER_CLASSIFICATION} from './types';
import type {RefResult, RenderRecord} from './types';

const CSS_PREFIX = 'rrt';

const PANEL_STYLES = `
.${CSS_PREFIX}-root {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
    font-size: 12px;
    line-height: 1.4;
}
.${CSS_PREFIX}-fab {
    width: 48px;
    height: 48px;
    border-radius: 24px;
    background: #1a1a2e;
    border: 2px solid #4a9eff;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    position: relative;
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
}
.${CSS_PREFIX}-fab--active {
    background: #4a9eff;
}
.${CSS_PREFIX}-fab-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #dc3545;
    border-radius: 8px;
    min-width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
}
.${CSS_PREFIX}-panel {
    width: 480px;
    max-height: 600px;
    background: #0d0d1a;
    border-radius: 8px;
    border: 1px solid #2a2a4a;
    margin-bottom: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: #fff;
}
.${CSS_PREFIX}-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid #2a2a4a;
}
.${CSS_PREFIX}-title {
    font-size: 14px;
    font-weight: 700;
}
.${CSS_PREFIX}-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.${CSS_PREFIX}-total-badge {
    color: #888;
    font-size: 11px;
}
.${CSS_PREFIX}-clear-btn {
    background: #dc3545;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
}
.${CSS_PREFIX}-copy-btn {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 3px;
    padding: 2px 5px;
    font-size: 9px;
    font-weight: 700;
    font-family: monospace;
    cursor: pointer;
}
.${CSS_PREFIX}-filters {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom: 1px solid #2a2a4a;
}
.${CSS_PREFIX}-filter-input {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
}
.${CSS_PREFIX}-filter-input::placeholder {
    color: #666;
}
.${CSS_PREFIX}-list {
    flex: 1;
    overflow-y: auto;
}
.${CSS_PREFIX}-empty {
    color: #555;
    font-size: 12px;
    text-align: center;
    padding: 20px;
}
.${CSS_PREFIX}-comp-section {
    border-bottom: 1px solid #1a1a2e;
}
.${CSS_PREFIX}-comp-header {
    display: flex;
    align-items: center;
    padding: 10px;
    gap: 8px;
    background: #111128;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
    color: inherit;
    font: inherit;
}
.${CSS_PREFIX}-comp-id-row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}
.${CSS_PREFIX}-comp-name {
    color: #fff;
    font-size: 12px;
    font-weight: 700;
}
.${CSS_PREFIX}-comp-id {
    color: #4a9eff;
    font-size: 11px;
    font-family: monospace;
}
.${CSS_PREFIX}-comp-stats-row {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}
.${CSS_PREFIX}-comp-stats-badges {
    display: flex;
    gap: 6px;
}
.${CSS_PREFIX}-stat-badge {
    font-size: 11px;
    font-weight: 700;
    font-family: monospace;
}
.${CSS_PREFIX}-comp-meta {
    color: #888;
    font-size: 11px;
}
.${CSS_PREFIX}-renders-container {
    padding-left: 8px;
}
.${CSS_PREFIX}-render-row {
    border-top: 1px solid #1a1a2e;
    border-left: 2px solid;
}
.${CSS_PREFIX}-render-header {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    gap: 8px;
    background: #0d0d1a;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
    color: inherit;
    font: inherit;
}
.${CSS_PREFIX}-render-title {
    color: #ccc;
    font-size: 11px;
    font-family: monospace;
    flex: 1;
}
.${CSS_PREFIX}-render-stats {
    font-size: 11px;
    font-weight: 700;
    font-family: monospace;
}
.${CSS_PREFIX}-row-right {
    display: flex;
    align-items: center;
    margin-left: auto;
    gap: 6px;
}
.${CSS_PREFIX}-ref-row {
    padding-left: 12px;
    border-top: 1px solid #111128;
}
.${CSS_PREFIX}-ref-header {
    display: flex;
    align-items: center;
    padding: 5px 8px;
    gap: 8px;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
    background: transparent;
    color: inherit;
    font: inherit;
}
.${CSS_PREFIX}-ref-name {
    color: #aaa;
    font-size: 11px;
    font-family: monospace;
    flex: 1;
}
.${CSS_PREFIX}-ref-badge {
    font-size: 10px;
    font-weight: 600;
    font-family: monospace;
}
.${CSS_PREFIX}-expand-arrow {
    color: #555;
    font-size: 9px;
}
.${CSS_PREFIX}-paths-container {
    padding: 0 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.${CSS_PREFIX}-paths-label {
    font-size: 10px;
    font-weight: 600;
    margin-top: 4px;
}
.${CSS_PREFIX}-path-item {
    font-size: 10px;
    font-family: monospace;
    padding-left: 8px;
}
`;

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected || typeof document === 'undefined') {
        return;
    }
    stylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-rrt', '');
    style.textContent = PANEL_STYLES;
    document.head.appendChild(style);
}

function CopyBtn({onCopy, label}: {onCopy: () => void; label: string}) {
    const [copied, setCopied] = useState(false);

    function handleClick() {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    }

    return (
        <button
            aria-label={label}
            className={`${CSS_PREFIX}-copy-btn`}
            onClick={handleClick}
            style={{color: copied ? '#28a745' : '#4a9eff'}}
            type="button"
        >
            {copied ? 'OK' : 'CP'}
        </button>
    );
}

function RefResultRow({result}: {result: RefResult}) {
    const [expanded, setExpanded] = useState(false);
    const color = getRefBadgeColor(result);
    const stats = buildRefStats(result);
    const correctRefs = getCorrectRefs(result);
    const hasPaths =
        result.valueChangedPaths.length > 0 || correctRefs.length > 0 || result.unnecessaryRefChanges.length > 0;

    return (
        <div className={`${CSS_PREFIX}-ref-row`}>
            <button
                aria-label={`Toggle details for ${result.name}`}
                className={`${CSS_PREFIX}-ref-header`}
                onClick={() => hasPaths && setExpanded((v) => !v)}
                type="button"
            >
                <span className={`${CSS_PREFIX}-ref-name`}>{result.name}</span>
                <span className={`${CSS_PREFIX}-ref-badge`} style={{color}}>
                    {stats}
                </span>
                {hasPaths && <span className={`${CSS_PREFIX}-expand-arrow`}>{expanded ? '\u25B2' : '\u25BC'}</span>}
            </button>
            {expanded && hasPaths && (
                <div className={`${CSS_PREFIX}-paths-container`}>
                    {result.valueChangedPaths.length > 0 && (
                        <div>
                            <div className={`${CSS_PREFIX}-paths-label`} style={{color: '#28a745'}}>
                                Values changed ({result.valueChangedPaths.length}):
                            </div>
                            {result.valueChangedPaths.map((p) => (
                                <div key={p} className={`${CSS_PREFIX}-path-item`} style={{color: '#28a745'}}>
                                    {p}
                                </div>
                            ))}
                        </div>
                    )}
                    {correctRefs.length > 0 && (
                        <div>
                            <div className={`${CSS_PREFIX}-paths-label`} style={{color: '#4a9eff'}}>
                                Refs changed correctly ({correctRefs.length}):
                            </div>
                            {correctRefs.map((p) => (
                                <div key={p} className={`${CSS_PREFIX}-path-item`} style={{color: '#4a9eff'}}>
                                    {p}
                                </div>
                            ))}
                        </div>
                    )}
                    {result.unnecessaryRefChanges.length > 0 && (
                        <div>
                            <div className={`${CSS_PREFIX}-paths-label`} style={{color: '#dc3545'}}>
                                Refs changed unnecessarily ({result.unnecessaryRefChanges.length}):
                            </div>
                            {result.unnecessaryRefChanges.map((p) => (
                                <div key={p} className={`${CSS_PREFIX}-path-item`} style={{color: '#dc3545'}}>
                                    {p}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function RenderRecordRow({record, nameFilter}: {record: RenderRecord; nameFilter: string}) {
    const [expanded, setExpanded] = useState(false);

    const counts = getRenderCounts(record.refs);
    const health = getRenderHealth(counts);
    const healthColor = HEALTH_COLOR[health];

    const visibleRefs = record.refs.filter((r) => {
        if (r.classification === RENDER_CLASSIFICATION.NO_CHANGE) {
            return false;
        }
        return !nameFilter || r.name.toLowerCase().includes(nameFilter.toLowerCase());
    });

    if (nameFilter && visibleRefs.length === 0) {
        return null;
    }

    const statsText = buildRenderStatsText(health, counts);

    function handleCopy() {
        copyToClipboard(toClipboardText(serializeRenderRecord(record)));
    }

    return (
        <div className={`${CSS_PREFIX}-render-row`} style={{borderLeftColor: healthColor}}>
            <button
                aria-label={`Toggle render #${record.renderId} details`}
                className={`${CSS_PREFIX}-render-header`}
                onClick={() => setExpanded((v) => !v)}
                type="button"
            >
                <span className={`${CSS_PREFIX}-render-title`}>
                    Render #{record.renderId} — {record.duration.toFixed(2)}ms
                </span>
                <span className={`${CSS_PREFIX}-row-right`}>
                    <span className={`${CSS_PREFIX}-render-stats`} style={{color: healthColor}}>
                        {statsText}
                    </span>
                    <CopyBtn label={`Copy render #${record.renderId} data`} onCopy={handleCopy} />
                </span>
                <span className={`${CSS_PREFIX}-expand-arrow`}>{expanded ? '\u25B2' : '\u25BC'}</span>
            </button>
            {expanded && visibleRefs.map((ref) => <RefResultRow key={ref.name} result={ref} />)}
        </div>
    );
}

function ComponentSection({componentId, nameFilter}: {componentId: string; nameFilter: string}) {
    const {store} = useContext(ReferenceTrackerStoreContext);
    const [expanded, setExpanded] = useState(false);
    const record = store.components[componentId];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Record index can be undefined at runtime
    if (!record) {
        return null;
    }

    const lastRender = record.renders.at(-1);
    const lastDuration = lastRender ? `${lastRender.duration.toFixed(2)}ms` : '\u2014';
    const stats = buildComponentStats(record.renders);
    const hasProblems = stats.bad > 0 || stats.empty > 0 || stats.mixed > 0;

    function handleCopy() {
        copyToClipboard(toClipboardText(serializeComponentRecord(record)));
    }

    return (
        <div className={`${CSS_PREFIX}-comp-section`}>
            <button
                aria-label={`Toggle renders for ${record.componentName ?? componentId}`}
                className={`${CSS_PREFIX}-comp-header`}
                onClick={() => setExpanded((v) => !v)}
                type="button"
            >
                <span className={`${CSS_PREFIX}-comp-id-row`}>
                    {!!record.componentName && (
                        <span className={`${CSS_PREFIX}-comp-name`}>{record.componentName}</span>
                    )}
                    <span className={`${CSS_PREFIX}-comp-id`}>{componentId}</span>
                </span>
                <span className={`${CSS_PREFIX}-row-right`}>
                    <span className={`${CSS_PREFIX}-comp-stats-row`}>
                        <span className={`${CSS_PREFIX}-comp-meta`}>
                            {record.renders.length} renders | last: {lastDuration}
                        </span>
                        {hasProblems && (
                            <span className={`${CSS_PREFIX}-comp-stats-badges`}>
                                {stats.good > 0 && (
                                    <span className={`${CSS_PREFIX}-stat-badge`} style={{color: HEALTH_COLOR.good}}>
                                        {'\u2713'}
                                        {stats.good}
                                    </span>
                                )}
                                {stats.mixed > 0 && (
                                    <span className={`${CSS_PREFIX}-stat-badge`} style={{color: HEALTH_COLOR.mixed}}>
                                        ~{stats.mixed}
                                    </span>
                                )}
                                {stats.bad > 0 && (
                                    <span className={`${CSS_PREFIX}-stat-badge`} style={{color: HEALTH_COLOR.bad}}>
                                        {'\u2717'}
                                        {stats.bad}
                                    </span>
                                )}
                                {stats.empty > 0 && (
                                    <span className={`${CSS_PREFIX}-stat-badge`} style={{color: HEALTH_COLOR.empty}}>
                                        {'\u2298'}
                                        {stats.empty}
                                    </span>
                                )}
                            </span>
                        )}
                    </span>
                    <CopyBtn label={`Copy component ${componentId} data`} onCopy={handleCopy} />
                </span>
                <span className={`${CSS_PREFIX}-expand-arrow`}>{expanded ? '\u25B2' : '\u25BC'}</span>
            </button>
            {expanded && (
                <div className={`${CSS_PREFIX}-renders-container`}>
                    {[...record.renders].reverse().map((r) => (
                        <RenderRecordRow key={r.renderId} record={r} nameFilter={nameFilter} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ReferenceTrackerPanel() {
    injectStyles();

    const {store, clearAll} = useContext(ReferenceTrackerStoreContext);
    const [open, setOpen] = useState(false);
    const [idFilter, setIdFilter] = useState('');
    const [nameFilter, setNameFilter] = useState('');

    const allIds = Object.keys(store.components);
    const filteredIds = idFilter ? allIds.filter((id) => id.toLowerCase().includes(idFilter.toLowerCase())) : allIds;
    const totalRenders = allIds.reduce((sum, id) => sum + store.components[id].renders.length, 0);

    function handleCopyAll() {
        copyToClipboard(toClipboardText(serializeStore(store)));
    }

    return (
        <div className={`${CSS_PREFIX}-root`}>
            {open && (
                <div className={`${CSS_PREFIX}-panel`}>
                    <div className={`${CSS_PREFIX}-header`}>
                        <span className={`${CSS_PREFIX}-title`}>Reference Tracker</span>
                        <span className={`${CSS_PREFIX}-header-actions`}>
                            <span className={`${CSS_PREFIX}-total-badge`}>{totalRenders} total</span>
                            <CopyBtn label="Copy all render data" onCopy={handleCopyAll} />
                            <button
                                aria-label="Clear all render records"
                                className={`${CSS_PREFIX}-clear-btn`}
                                onClick={clearAll}
                                type="button"
                            >
                                Clear All
                            </button>
                        </span>
                    </div>
                    <div className={`${CSS_PREFIX}-filters`}>
                        <input
                            aria-label="Filter by component id"
                            className={`${CSS_PREFIX}-filter-input`}
                            placeholder="Filter by component id\u2026"
                            value={idFilter}
                            onChange={(e) => setIdFilter(e.target.value)}
                        />
                        <input
                            aria-label="Filter by ref name"
                            className={`${CSS_PREFIX}-filter-input`}
                            placeholder="Filter by ref name\u2026"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                        />
                    </div>
                    <div className={`${CSS_PREFIX}-list`}>
                        {filteredIds.length === 0 && (
                            <div className={`${CSS_PREFIX}-empty`}>No components tracked yet.</div>
                        )}
                        {filteredIds.map((id) => (
                            <ComponentSection key={id} componentId={id} nameFilter={nameFilter} />
                        ))}
                    </div>
                </div>
            )}
            <button
                aria-label="Toggle reference tracker panel"
                className={`${CSS_PREFIX}-fab ${open ? `${CSS_PREFIX}-fab--active` : ''}`}
                onClick={() => setOpen((v) => !v)}
                type="button"
            >
                {open ? '\u2715' : 'RT'}
                {!open && totalRenders > 0 && <span className={`${CSS_PREFIX}-fab-badge`}>{allIds.length}</span>}
            </button>
        </div>
    );
}

export default ReferenceTrackerPanel;
