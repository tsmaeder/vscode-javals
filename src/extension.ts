import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import JSZip = require('jszip');
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';

import { resolveServerJar, ServerMode } from './serverResolver';

const JAVAC_JVM_FLAGS: string[] = [
	'--add-exports', 'jdk.compiler/com.sun.tools.javac.main=ALL-UNNAMED',
	'--add-exports', 'jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED',
	'--add-exports', 'jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED',
	'--add-exports', 'jdk.compiler/com.sun.tools.javac.comp=ALL-UNNAMED',
	'--add-exports', 'jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED',
	'--add-exports', 'jdk.compiler/com.sun.tools.javac.jvm=ALL-UNNAMED',
	'--add-exports', 'jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED',
	'--add-opens', 'jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED',
	'--add-opens', 'jdk.compiler/com.sun.tools.javac.jvm=ALL-UNNAMED',
];

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel | undefined;
const JAR_URI_SCHEME = 'jar';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	outputChannel = vscode.window.createOutputChannel('JavaLS');
	context.subscriptions.push(outputChannel);
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(
			JAR_URI_SCHEME,
			new JarTextDocumentContentProvider(outputChannel),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('javals.showOutputChannel', () => {
			outputChannel?.show(true);
		}),
		vscode.commands.registerCommand('javals.restartServer', async () => {
			await restartClient(context);
		}),
	);

	await startClient(context);
}

export async function deactivate(): Promise<void> {
	if (client) {
		await client.stop();
		client = undefined;
	}
}

async function startClient(context: vscode.ExtensionContext): Promise<void> {
	const config = vscode.workspace.getConfiguration('javals');
	const mode = config.get<ServerMode>('serverMode', 'auto');
	const devProjectPath = config.get<string>('devProjectPath', '../java-ls');
	const userJvmArgs = config.get<string[]>('jvmArgs', []);
	const debugWaitForDebugger = config.get<boolean>('debug', false);
	const debugPort = resolveDebugPort(config);

	let resolved;
	try {
		resolved = resolveServerJar({
			extensionPath: context.extensionPath,
			mode,
			devProjectPath,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		outputChannel?.appendLine(`[javals] ${message}`);
		void vscode.window.showErrorMessage(`JavaLS: ${message}`);
		return;
	}

	const javaExe = resolveJavaExecutable(config.get<string>('javaHome', ''));
	if (!javaExe) {
		const hint = 'Set "javals.javaHome" or JAVA_HOME to a Java 17+ installation.';
		outputChannel?.appendLine(`[javals] ${hint}`);
		void vscode.window.showErrorMessage(`JavaLS: no Java executable found. ${hint}`);
		return;
	}

	outputChannel?.appendLine(`[javals] mode=${resolved.mode} jar=${resolved.jarPath}`);
	outputChannel?.appendLine(`[javals] java=${javaExe}`);

	const debugJvmArgs = debugWaitForDebugger
		? [`-agentlib:jdwp=transport=dt_socket,quiet=y,server=y,suspend=y,address=*:${debugPort}`]
		: [];
	if (debugWaitForDebugger) {
		outputChannel?.appendLine(`[javals] debugger wait enabled on port ${debugPort}`);
	}

	const args = [...JAVAC_JVM_FLAGS, ...userJvmArgs, ...debugJvmArgs, '-jar', resolved.jarPath];
	const serverOptions: ServerOptions = {
		run: { command: javaExe, args, transport: TransportKind.stdio },
		debug: { command: javaExe, args, transport: TransportKind.stdio },
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'java' }],
		outputChannel,
	};

	client = new LanguageClient('javals', 'JavaLS', serverOptions, clientOptions);

	try {
		await client.start();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		outputChannel?.appendLine(`[javals] failed to start: ${message}`);
		void vscode.window.showErrorMessage(`JavaLS failed to start: ${message}`);
	}
}

async function restartClient(context: vscode.ExtensionContext): Promise<void> {
	if (client) {
		try {
			await client.stop();
		} catch {
			// Best-effort stop before restart.
		}
		client = undefined;
	}
	await startClient(context);
}

function resolveJavaExecutable(configuredJavaHome: string): string | undefined {
	const binary = process.platform === 'win32' ? 'java.exe' : 'java';

	const candidates: string[] = [];
	if (configuredJavaHome) {
		candidates.push(path.join(configuredJavaHome, 'bin', binary));
	}
	if (process.env.JAVA_HOME) {
		candidates.push(path.join(process.env.JAVA_HOME, 'bin', binary));
	}

	for (const candidate of candidates) {
		if (isExecutableFile(candidate)) {
			return candidate;
		}
	}

	return binary;
}

function resolveDebugPort(config: vscode.WorkspaceConfiguration): number {
	const configuredDebugPort = config.get<number>('debugPort', 9000);
	if (
		typeof configuredDebugPort === 'number'
		&& Number.isInteger(configuredDebugPort)
		&& configuredDebugPort >= 1
		&& configuredDebugPort <= 65535
	) {
		return configuredDebugPort;
	}
	return 9000;
}

function isExecutableFile(p: string): boolean {
	try {
		return fs.statSync(p).isFile();
	} catch {
		return false;
	}
}

class JarTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
	public constructor(private readonly channel: vscode.OutputChannel | undefined) {}

	public async provideTextDocumentContent(uri: vscode.Uri): Promise<string | undefined> {
		const parsed = parseJarUri(uri);
		if (!parsed) {
			this.channel?.appendLine(`[javals] unsupported jar uri: ${uri.toString()}`);
			return undefined;
		}

		try {
			const archiveBytes = await fs.promises.readFile(parsed.archiveFsPath);
			const archive = await JSZip.loadAsync(archiveBytes);
			const entry = archive.file(parsed.entryPath);

			if (!entry) {
				this.channel?.appendLine(`[javals] missing jar entry: ${parsed.entryPath}`);
				return undefined;
			}

			return await entry.async('string');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.channel?.appendLine(`[javals] failed to load jar uri ${uri.toString()}: ${message}`);
			return undefined;
		}
	}
}

function parseJarUri(uri: vscode.Uri): { archiveFsPath: string; entryPath: string } | undefined {
	if (uri.scheme !== JAR_URI_SCHEME) {
		return undefined;
	}

	const fileUri = decodeURI(uri.path);
	const separatorIndex = fileUri.indexOf('!/');
	if (separatorIndex < 0) {
		return undefined;
	}

	const archiveUri = vscode.Uri.parse(fileUri.slice(0, separatorIndex));
	if (archiveUri.scheme !== 'file') {
		return undefined;
	}

	const rawEntryPath = fileUri.slice(separatorIndex + 2);
	const entryPath = rawEntryPath.replace(/^\/+/, '');
	if (!entryPath) {
		return undefined;
	}

	return {
		archiveFsPath: archiveUri.fsPath,
		entryPath,
	};
}
