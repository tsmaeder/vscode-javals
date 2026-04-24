/**
 * Copies the shaded JavaLS jar from the sibling Maven project into the extension's
 * server/ directory so that `vsce package` (and local runs in bundled mode) can
 * ship/launch it.
 *
 * Invoked via `npm run sync-server`, and also as part of `vscode:prepublish`.
 */
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..');
const devProjectRelative = process.env.JAVALS_DEV_PROJECT || '../java-ls';
const sourceJar = path.resolve(
	extensionRoot,
	devProjectRelative,
	'java-ls',
	'target',
	'java-ls.jar',
);
const targetDir = path.join(extensionRoot, 'server');
const targetJar = path.join(targetDir, 'java-ls.jar');

if (!fs.existsSync(sourceJar)) {
	console.error(`[sync-server] source jar not found: ${sourceJar}`);
	console.error(
		`[sync-server] build it with 'mvn -pl java-ls -am package' in ${path.resolve(
			extensionRoot,
			devProjectRelative,
		)}`,
	);
	process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourceJar, targetJar);
console.log(`[sync-server] copied ${sourceJar} -> ${targetJar}`);
