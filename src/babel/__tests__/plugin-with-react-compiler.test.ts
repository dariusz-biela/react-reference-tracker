import {transformSync} from '@babel/core';
import babelPluginTrackRefs from '../plugin';

const REACT_COMPILER_CONFIG = {
    target: '19',
    environment: {
        enableTreatRefLikeIdentifiersAsRefs: true,
    },
};

function transformWithBothPlugins(code: string, trackRefsFirst: boolean): string {
    const plugins = trackRefsFirst
        ? [babelPluginTrackRefs, ['babel-plugin-react-compiler', REACT_COMPILER_CONFIG]]
        : [['babel-plugin-react-compiler', REACT_COMPILER_CONFIG], babelPluginTrackRefs];

    const result = transformSync(code, {
        plugins,
        presets: ['@babel/preset-react', '@babel/preset-typescript'],
        parserOpts: {plugins: ['jsx', 'typescript']},
        filename: 'test.tsx',
    });
    return result?.code ?? '';
}

function transformTrackRefsOnly(code: string): string {
    const result = transformSync(code, {
        plugins: [babelPluginTrackRefs],
        parserOpts: {plugins: ['jsx', 'typescript']},
        filename: 'test.tsx',
    });
    return result?.code ?? '';
}

function transformReactCompilerOnly(code: string): string {
    const result = transformSync(code, {
        plugins: [['babel-plugin-react-compiler', REACT_COMPILER_CONFIG]],
        presets: ['@babel/preset-react', '@babel/preset-typescript'],
        parserOpts: {plugins: ['jsx', 'typescript']},
        filename: 'test.tsx',
    });
    return result?.code ?? '';
}

function extractListenLabels(output: string): string[] {
    const calls = output.match(/listenForChanges\([^,]+,\s*"([^"]+)"\)/g) ?? [];
    return calls.map((call) => {
        const match = call.match(/listenForChanges\([^,]+,\s*"([^"]+)"\)/);
        return match?.[1] ?? '';
    });
}

const SAMPLE_COMPONENT = `
// @track-refs
function MyComponent({user, config}) {
    const [count, setCount] = useState(0);
    const theme = useContext(ThemeContext);
    return <div>{user.name} {count}</div>;
}
`;

describe('track-refs plugin interaction with React Compiler', () => {
    it('track-refs alone preserves original variable names as labels', () => {
        const output = transformTrackRefsOnly(SAMPLE_COMPONENT);

        expect(output).toContain('listenForChanges(user, "user")');
        expect(output).toContain('listenForChanges(config, "config")');
        expect(output).toContain('listenForChanges(count, "count")');
        expect(output).toContain('listenForChanges(setCount, "setCount")');
        expect(output).toContain('listenForChanges(theme, "theme")');
    });

    it('React Compiler alone renames variables to t0, t1, etc.', () => {
        const output = transformReactCompilerOnly(SAMPLE_COMPONENT);

        expect(output).toMatch(/\bt\d+\b/);
        expect(output).not.toMatch(/const \[count,/);
    });

    it('track-refs FIRST, React Compiler SECOND: compiler corrupts labels', () => {
        const output = transformWithBothPlugins(SAMPLE_COMPONENT, true);
        const labels = extractListenLabels(output);

        console.log('=== track-refs FIRST, React Compiler SECOND ===');
        console.log(output);
        console.log('Labels:', labels);

        // React Compiler restructures the entire function body including our injected code.
        // Some original names survive (destructured vars), but props param & temporaries get renamed.
        const hasCompiledLabels = labels.some((label) => /^t\d+$/.test(label) || label === '$');
        expect(hasCompiledLabels).toBe(true);

        // Original names that survived destructuring
        expect(labels).toContain('user');
        expect(labels).toContain('count');

        // Original names that were lost
        expect(labels).not.toContain('config');
        expect(labels).not.toContain('setCount');
        expect(labels).not.toContain('theme');
    });

    it('React Compiler FIRST, track-refs SECOND: all labels are compiled names', () => {
        const output = transformWithBothPlugins(SAMPLE_COMPONENT, false);
        const labels = extractListenLabels(output);

        console.log('=== React Compiler FIRST, track-refs SECOND ===');
        console.log(output);
        console.log('Labels:', labels);

        // When track-refs runs after React Compiler, it picks up compiled variable names
        const hasCompiledLabels = labels.some((label) => /^t\d+$/.test(label) || label === '$');
        expect(hasCompiledLabels).toBe(true);
    });
});
