import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	outputChannel = vscode.window.createOutputChannel('JavaLS');
	context.subscriptions.push(outputChannel);

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

	const args = [...JAVAC_JVM_FLAGS, ...userJvmArgs, '-jar', resolved.jarPath];
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

function isExecutableFile(p: string): boolean {
	try {
		return fs.statSync(p).isFile();
	} catch {
		return false;
	}
}
