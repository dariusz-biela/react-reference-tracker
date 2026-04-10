import {transformSync} from '@babel/core';
import babelPluginTrackRefs from '../plugin';

function transform(code: string): string {
    const result = transformSync(code, {
        plugins: [babelPluginTrackRefs],
        parserOpts: {plugins: ['jsx', 'typescript']},
        filename: 'test.tsx',
    });
    return result?.code ?? '';
}

describe('babelPluginTrackRefs', () => {
    it('instruments a function declaration with @track-refs', () => {
        const input = `
// @track-refs
function MyComponent({user, config}) {
    const [count, setCount] = useState(0);
    return <div>{user.name}</div>;
}`;
        const output = transform(input);

        expect(output).toContain('import { useReferenceTracker } from "react-reference-tracker"');
        expect(output).toContain('useReferenceTracker("MyComponent")');
        expect(output).toContain('startRender()');
        expect(output).toContain('listenForChanges(user, "user")');
        expect(output).toContain('listenForChanges(config, "config")');
        expect(output).toContain('listenForChanges(count, "count")');
        expect(output).toContain('listenForChanges(setCount, "setCount")');
        expect(output).toContain('endRender()');
    });

    it('instruments an arrow function with @track-refs', () => {
        const input = `
// @track-refs
const MyComponent = ({name}) => {
    const theme = useContext(ThemeContext);
    return <span>{name}</span>;
};`;
        const output = transform(input);

        expect(output).toContain('useReferenceTracker("MyComponent")');
        expect(output).toContain('listenForChanges(name, "name")');
        expect(output).toContain('listenForChanges(theme, "theme")');
    });

    it('instruments an arrow function with implicit return', () => {
        const input = `
// @track-refs
const MyComponent = ({label}) => <span>{label}</span>;`;
        const output = transform(input);

        expect(output).toContain('useReferenceTracker("MyComponent")');
        expect(output).toContain('listenForChanges(label, "label")');
        expect(output).toContain('startRender()');
        expect(output).toContain('endRender()');
        expect(output).toContain('return');
    });

    it('does not transform a component without annotation', () => {
        const input = `
function PlainComponent({user}) {
    return <div>{user.name}</div>;
}`;
        const output = transform(input);

        expect(output).not.toContain('useReferenceTracker');
        expect(output).not.toContain('startRender');
    });

    it('tracks destructured props individually', () => {
        const input = `
// @track-refs
function MyComponent({a, b, c}) {
    return <div />;
}`;
        const output = transform(input);

        expect(output).toContain('listenForChanges(a, "a")');
        expect(output).toContain('listenForChanges(b, "b")');
        expect(output).toContain('listenForChanges(c, "c")');
    });

    it('tracks useState and useContext results', () => {
        const input = `
// @track-refs
function MyComponent() {
    const [val, setVal] = useState(0);
    const ctx = useContext(SomeCtx);
    return <div />;
}`;
        const output = transform(input);

        expect(output).toContain('listenForChanges(val, "val")');
        expect(output).toContain('listenForChanges(setVal, "setVal")');
        expect(output).toContain('listenForChanges(ctx, "ctx")');
    });

    it('adds import only once with multiple annotated components', () => {
        const input = `
// @track-refs
function A({x}) {
    return <div />;
}

// @track-refs
function B({y}) {
    return <span />;
}`;
        const output = transform(input);

        const importCount = (output.match(/import.*useReferenceTracker/g) ?? []).length;
        expect(importCount).toBe(1);
    });

    it('does not duplicate an existing useReferenceTracker import', () => {
        const input = `
import { useReferenceTracker } from 'react-reference-tracker';

// @track-refs
function MyComponent({x}) {
    return <div />;
}`;
        const output = transform(input);

        const importCount = (output.match(/import.*useReferenceTracker/g) ?? []).length;
        expect(importCount).toBe(1);
    });

    it('places tracking calls before the return statement', () => {
        const input = `
// @track-refs
function MyComponent({x}) {
    const y = useMemo(() => x * 2, [x]);
    return <div>{y}</div>;
}`;
        const output = transform(input);

        const endRenderPos = output.indexOf('endRender()');
        const returnPos = output.indexOf('return');
        expect(endRenderPos).toBeLessThan(returnPos);
    });

    it('handles function expression assigned to const', () => {
        const input = `
// @track-refs
const MyComponent = function({data}) {
    return <div>{data}</div>;
};`;
        const output = transform(input);

        expect(output).toContain('useReferenceTracker("MyComponent")');
        expect(output).toContain('listenForChanges(data, "data")');
    });
});
