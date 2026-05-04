import * as fs from 'fs';
import * as path from 'path';

export type ServerMode = 'auto' | 'bundled' | 'dev';

export type ResolvedServerMode = 'bundled' | 'dev';

export interface ResolvedServer {
	jarPath: string;
	mode: ResolvedServerMode;
}

export interface ResolveOptions {
	extensionPath: string;
	mode: ServerMode;
	devProjectPath: string;
}

const BUNDLED_JAR_RELATIVE = path.join('server', 'java-ls.jar');
const DEV_JAR_RELATIVE = path.join('java-ls', 'target', 'java-ls.jar');

function bundledJarPath(extensionPath: string): string {
	return path.join(extensionPath, BUNDLED_JAR_RELATIVE);
}

function devJarPath(extensionPath: string, devProjectPath: string): string {
	const base = path.isAbsolute(devProjectPath)
		? devProjectPath
		: path.resolve(extensionPath, devProjectPath);
	return path.join(base, DEV_JAR_RELATIVE);
}

function exists(p: string): boolean {
	try {
		return fs.statSync(p).isFile();
	} catch {
		return false;
	}
}

export function resolveServerJar(options: ResolveOptions): ResolvedServer {
	const { extensionPath, mode, devProjectPath } = options;
	const bundled = bundledJarPath(extensionPath);
	const dev = devJarPath(extensionPath, devProjectPath);

	if (mode === 'bundled') {
		if (!exists(bundled)) {
			throw new Error(
				`JavaLS bundled jar not found at ${bundled}. ` +
					`Build the sibling project and run 'npm run sync-server' before packaging the extension.`,
			);
		}
		return { jarPath: bundled, mode: 'bundled' };
	}

	if (mode === 'dev') {
		if (!exists(dev)) {
			throw new Error(
				`JavaLS dev jar not found at ${dev}. ` +
					`Run 'mvn -pl java-ls -am package' in '${path.dirname(path.dirname(dev))}' to produce it.`,
			);
		}
		return { jarPath: dev, mode: 'dev' };
	}

	if (exists(dev)) {
		return { jarPath: dev, mode: 'dev' };
	}
	if (exists(bundled)) {
		return { jarPath: bundled, mode: 'bundled' };
	}
	throw new Error(
		`JavaLS server jar not found. Looked for dev jar at ${dev} and bundled jar at ${bundled}. ` +
			`Either build the sibling project ('mvn -pl java-ls -am package') or run 'npm run sync-server' to install a bundled jar.`,
	);
}
