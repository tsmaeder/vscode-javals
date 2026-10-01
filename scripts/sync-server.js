/**
 * Copyright 2026 by Anysphere Inc.
 * Licensed under the MIT License.
 *
 * Author: Thomas Mäder, Castle Ridge Software
 *
 * SPDX-License-Identifier: MIT
 * 
 * Copies the shaded JavaLS and mavenimporter jars from the sibling Maven project
 * into the extension's server/ directory so that `vsce package` (and local runs
 * in bundled mode) can ship/launch them. The importer must sit next to
 * java-ls.jar so ImporterJarLocator can find it.
 *
 * Invoked via `npm run sync-server`, and also as part of `vscode:prepublish`.
 *
 */
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..');
const devProjectRelative = process.env.JAVALS_DEV_PROJECT || '../java-ls';
const sourceTargetDir = path.resolve(
	extensionRoot,
	devProjectRelative,
	'java-ls',
	'target',
);
const targetDir = path.join(extensionRoot, 'server');

const jars = ['java-ls.jar', 'mavenimporter.jar'];

const missing = jars.filter((name) => !fs.existsSync(path.join(sourceTargetDir, name)));
if (missing.length > 0) {
	for (const name of missing) {
		console.error(`[sync-server] source jar not found: ${path.join(sourceTargetDir, name)}`);
	}
	console.error(
		`[sync-server] build them with 'mvn -pl java-ls -am package' in ${path.resolve(
			extensionRoot,
			devProjectRelative,
		)}`,
	);
	process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
for (const name of jars) {
	const sourceJar = path.join(sourceTargetDir, name);
	const targetJar = path.join(targetDir, name);
	fs.copyFileSync(sourceJar, targetJar);
	console.log(`[sync-server] copied ${sourceJar} -> ${targetJar}`);
}
