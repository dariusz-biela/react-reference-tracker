import type {PluginObj, PluginPass, NodePath} from '@babel/core';
import type * as BabelTypes from '@babel/types';

const ANNOTATION = '@track-refs';
const SOURCE_MODULE = 'react-reference-tracker';
const HOOK_NAME = 'useReferenceTracker';
const TRACKER_METHODS = ['startRender', 'listenForChanges', 'endRender'] as const;

interface PluginState extends PluginPass {
    needsImport?: boolean;
}

function hasTrackRefsAnnotation(node: BabelTypes.Node): boolean {
    const comments = node.leadingComments;
    if (!comments) {
        return false;
    }
    return comments.some((c) => c.value.includes(ANNOTATION));
}

function extractIdentifierNames(node: BabelTypes.Node): string[] {
    switch (node.type) {
        case 'Identifier':
            return [node.name];
        case 'ObjectPattern': {
            const names: string[] = [];
            for (const prop of node.properties) {
                if (prop.type === 'ObjectProperty') {
                    names.push(...extractIdentifierNames(prop.value));
                } else {
                    names.push(...extractIdentifierNames(prop.argument));
                }
            }
            return names;
        }
        case 'ArrayPattern': {
            const names: string[] = [];
            for (const el of node.elements) {
                if (el) {
                    names.push(...extractIdentifierNames(el));
                }
            }
            return names;
        }
        case 'AssignmentPattern':
            return extractIdentifierNames(node.left);
        case 'RestElement':
            return extractIdentifierNames(node.argument);
        default:
            return [];
    }
}

function collectParamBindings(params: BabelTypes.Function['params']): string[] {
    const names: string[] = [];
    for (const param of params) {
        names.push(...extractIdentifierNames(param));
    }
    return names;
}

function collectBodyBindings(body: BabelTypes.BlockStatement): string[] {
    const names: string[] = [];
    for (const stmt of body.body) {
        if (stmt.type !== 'VariableDeclaration') {
            continue;
        }
        for (const decl of stmt.declarations) {
            names.push(...extractIdentifierNames(decl.id));
        }
    }
    return names;
}

function isTrackerDestructuring(name: string): boolean {
    return (TRACKER_METHODS as readonly string[]).includes(name);
}

export default function babelPluginTrackRefs({types: t}: {types: typeof BabelTypes}): PluginObj {
    return {
        name: 'babel-plugin-track-refs',
        visitor: {
            Program: {
                enter(programPath, state) {
                    programPath.traverse({
                        FunctionDeclaration(path: NodePath<BabelTypes.FunctionDeclaration>) {
                            if (!hasTrackRefsAnnotation(path.node)) {
                                return;
                            }
                            const componentName = path.node.id?.name ?? 'Anonymous';
                            instrumentFunction(t, path, componentName, state);
                        },
                        VariableDeclaration(path: NodePath<BabelTypes.VariableDeclaration>) {
                            if (!hasTrackRefsAnnotation(path.node)) {
                                return;
                            }
                            for (const decl of path.node.declarations) {
                                if (
                                    decl.init &&
                                    (decl.init.type === 'ArrowFunctionExpression' ||
                                        decl.init.type === 'FunctionExpression') &&
                                    decl.id.type === 'Identifier'
                                ) {
                                    const componentName = decl.id.name;
                                    const funcPath = path.get(
                                        `declarations.${path.node.declarations.indexOf(decl)}.init`,
                                    ) as NodePath<BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression>;
                                    instrumentFunction(t, funcPath, componentName, state);
                                }
                            }
                        },
                    });
                },
                exit(programPath, state) {
                    if (!state.needsImport) {
                        return;
                    }

                    const alreadyImported = programPath.node.body.some(
                        (node) =>
                            node.type === 'ImportDeclaration' &&
                            node.source.value === SOURCE_MODULE &&
                            node.specifiers.some(
                                (s) =>
                                    s.type === 'ImportSpecifier' &&
                                    s.imported.type === 'Identifier' &&
                                    s.imported.name === HOOK_NAME,
                            ),
                    );

                    if (alreadyImported) {
                        return;
                    }

                    const importDecl = t.importDeclaration(
                        [t.importSpecifier(t.identifier(HOOK_NAME), t.identifier(HOOK_NAME))],
                        t.stringLiteral(SOURCE_MODULE),
                    );

                    programPath.unshiftContainer('body', importDecl);
                },
            },
        },
    };
}

function instrumentFunction(
    t: typeof BabelTypes,
    path: NodePath<BabelTypes.FunctionDeclaration | BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression>,
    componentName: string,
    state: PluginState,
) {
    const node = path.node;

    let body: BabelTypes.BlockStatement;
    if (node.body.type !== 'BlockStatement') {
        const returnStmt = t.returnStatement(node.body);
        body = t.blockStatement([returnStmt]);
        node.body = body;
    } else {
        body = node.body;
    }

    const paramNames = collectParamBindings(node.params);
    const bodyNames = collectBodyBindings(body);
    const allNames = [...paramNames, ...bodyNames].filter((name) => !isTrackerDestructuring(name));

    const trackerDecl = t.variableDeclaration('const', [
        t.variableDeclarator(
            t.objectPattern(
                TRACKER_METHODS.map((m) => t.objectProperty(t.identifier(m), t.identifier(m), false, true)),
            ),
            t.callExpression(t.identifier(HOOK_NAME), [t.stringLiteral(componentName)]),
        ),
    ]);

    const trackingStatements: BabelTypes.Statement[] = [
        t.expressionStatement(t.callExpression(t.identifier('startRender'), [])),
        ...allNames.map((name) =>
            t.expressionStatement(
                t.callExpression(t.identifier('listenForChanges'), [t.identifier(name), t.stringLiteral(name)]),
            ),
        ),
        t.expressionStatement(t.callExpression(t.identifier('endRender'), [])),
    ];

    let returnIndex = body.body.findIndex((stmt) => stmt.type === 'ReturnStatement');
    if (returnIndex === -1) {
        returnIndex = body.body.length;
    }

    body.body.splice(0, 0, trackerDecl);
    // returnIndex shifted by 1 after inserting trackerDecl
    body.body.splice(returnIndex + 1, 0, ...trackingStatements);

    state.needsImport = true;
}
