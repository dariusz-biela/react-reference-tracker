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

    it('track-refs FIRST (Program:enter), React Compiler SECOND: original labels preserved', () => {
        const output = transformWithBothPlugins(SAMPLE_COMPONENT, true);
        const labels = extractListenLabels(output);

        console.log('=== track-refs FIRST (Program:enter), React Compiler SECOND ===');
        console.log(output);
        console.log('Labels:', labels);

        // All original variable names must be preserved as string labels
        expect(labels).toContain('user');
        expect(labels).toContain('config');
        expect(labels).toContain('count');
        expect(labels).toContain('setCount');
        expect(labels).toContain('theme');

        // No compiled names (t0, t1, $) should appear as labels
        const hasCompiledLabels = labels.some((label) => /^t\d+$/.test(label) || label === '$');
        expect(hasCompiledLabels).toBe(false);
    });

    it('React Compiler FIRST, track-refs SECOND: labels are compiled names', () => {
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
