# react-reference-tracker

A React dev tool that tracks prop and state **reference changes** across renders, helping you detect unnecessary re-renders, object mutations, and unstable references.

## Features

- Detects whether a value changed by **reference**, by **deep value**, or both
- Classifies each tracked reference: `initial`, `no-change`, `mutation`, `new-ref-no-value`, `new-ref-with-value`
- Shows exactly which nested paths changed
- Highlights **unnecessary reference changes** (new object/array identity with no actual value change)
- Built-in floating panel UI with filtering and clipboard export
- Zero dependencies beyond React 18+

## Installation

```bash
npm install react-reference-tracker
```

## Quick Start

### 1. Wrap your app with the provider

```tsx
import {ReferenceTrackerProvider, ReferenceTrackerPanel} from 'react-reference-tracker';

function App() {
    return (
        <ReferenceTrackerProvider>
            <YourApp />
            {__DEV__ && <ReferenceTrackerPanel />}
        </ReferenceTrackerProvider>
    );
}
```

### 2. Track references in any component

```tsx
import {useReferenceTracker} from 'react-reference-tracker';

function MyComponent({user, config, items}) {
    const {startRender, listenForChanges, endRender} = useReferenceTracker('MyComponent');

    startRender();
    listenForChanges(user, 'user');
    listenForChanges(config, 'config');
    listenForChanges(items, 'items');
    endRender();

    return <div>...</div>;
}
```

### 3. Open the floating panel

Click the **RT** button in the bottom-right corner to inspect tracked renders.

## API

### `<ReferenceTrackerProvider>`

Context provider that stores all render records. Wrap your app (or a subtree) with it.

### `<ReferenceTrackerPanel />`

Floating debug panel. Renders a FAB button that toggles an overlay showing all tracked components, their renders, and per-reference diagnostics.

### `useReferenceTracker(name?, maxDepth?)`

Hook that returns three functions to call **during render**:

| Function | Description |
|---|---|
| `startRender()` | Call at the top of your render to begin a tracking cycle |
| `listenForChanges(value, name)` | Track a value (prop, state, context, etc.) by name |
| `endRender()` | Call at the end of render to finalize the record |

- `name` — optional display name for the component in the panel
- `maxDepth` — max depth for deep-diffing nested objects (default: `Infinity`)

## Classification Legend

| Classification | Meaning |
|---|---|
| `initial` | First render — no previous value to compare |
| `no-change` | Same reference, same deep value |
| `mutation` | Same reference but deep value changed (object was mutated!) |
| `new-ref-no-value` | New reference but no deep value change (unnecessary re-creation) |
| `new-ref-with-value` | New reference with actual value change (expected behavior) |

## License

MIT
