import type * as t from '@babel/types';
import type { Plugin } from 'vite';
import type { AstroConfig } from '../@types/astro';

import * as babelTraverse from '@babel/traverse';
import * as babel from '@babel/core';

// Check for `Astro.glob()`. Be very forgiving of whitespace. False positives are okay.
const ASTRO_GLOB_REGEX = /Astro2?\s*\.\s*glob\s*\(/;
interface AstroPluginOptions {
	config: AstroConfig;
}

// esbuild transforms the component-scoped Astro into Astro2, so need to check both.
const validAstroGlobalNames = new Set(['Astro', 'Astro2']);

export default function astro({ config }: AstroPluginOptions): Plugin {
	return {
		name: 'astro:postprocess',
		async transform(code, id) {
			// Currently only supported in ".astro" & ".md" files
			if (!id.endsWith('.astro') && !id.endsWith('.md')) {
				return null;
			}

			// Optimization: Detect usage with a quick string match.
			// Only perform the transform if this function is found
			if (!ASTRO_GLOB_REGEX.test(code)) {
				return null;
			}

			// Handle the second-pass JS AST Traversal
			const result = await babel.transformAsync(code, {
				sourceType: 'module',
				sourceMaps: true,
				plugins: [
					() => {
						return {
							visitor: {
								StringLiteral(path: babelTraverse.NodePath<t.StringLiteral>) {
									if (
										path.parent.type !== 'CallExpression' ||
										path.parent.callee.type !== 'MemberExpression' ||
										!validAstroGlobalNames.has((path.parent.callee.object as any).name) ||
										(path.parent.callee.property as any).name !== 'glob'
									) {
										return;
									}
									const { value } = path.node;
									if (/[a-z]\:\/\//.test(value)) {
										return;
									}
									path.replaceWith({
										type: 'CallExpression',
										callee: {
											type: 'MemberExpression',
											object: { type: 'MetaProperty', meta: { type: 'Identifier', name: 'import' }, property: { type: 'Identifier', name: 'meta' } },
											property: { type: 'Identifier', name: 'globEager' },
											computed: false,
										},
										arguments: [path.node],
									} as any);
								},
							},
						};
					},
				],
			});

			// Undocumented baby behavior, but possible according to Babel types.
			if (!result || !result.code) {
				return null;
			}

			return { code: result.code, map: result.map };
		},
	};
}
