# vscode-javals

This is a VS Code extension to launch the JavaLS language server.

## Prerequisites

- Node.js 18+ and npm
- Java 17+ (`JAVA_HOME` or `java` on `PATH`)
- Sibling [java-ls](../java-ls) Maven project (for local/dev server builds)

Expected layout:

```xml
<parent>/
  vscode-javals/    ← this extension
  java-ls/
    java-ls/
      target/java-ls.jar
```

## Build

1. Install extension dependencies:

   ```bash
   npm ci
   ```

2. Build the language server (from `../java-ls`):

   ```bash
   mvn -pl java-ls -am package
   ```

   Produces `../java-ls/java-ls/target/java-ls.jar`.

3. Compile the extension:

   ```bash
   npm run compile
   ```

   For iterative work, use `npm run watch` instead (TypeScript check + esbuild).

## Run

1. Open this folder in VS Code / Cursor.
2. Press **F5** (or **Run and Debug → Run Extension**).
3. In the Extension Development Host, open a Java file — the server starts automatically.

With default `javals.serverMode: auto`, the extension uses the sibling Maven jar when present, otherwise the bundled `server/java-ls.jar`.

After changing the server, rebuild it with Maven and run **JavaLS: Restart Language Server** from the command palette.

## Package (VSIX)

```bash
# Ensure the server jar exists first (step 2 above)
npm run package
```

`vscode:prepublish` runs `npm run sync-server`, which copies
`../java-ls/java-ls/target/java-ls.jar` → `./server/java-ls.jar`.

Override the source project with:

```bash
JAVALS_DEV_PROJECT=../some/other/path npm run sync-server
```

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `javals.serverMode` | `auto` | `auto` / `bundled` / `dev` — which jar to launch |
| `javals.devProjectPath` | `../java-ls` | Sibling Maven project (relative to extension parent) |
| `javals.javaHome` | _(empty)_ | Java 17+ home; else `JAVA_HOME` / `PATH` |
| `javals.jvmArgs` | `[]` | Extra JVM args after required `--add-exports` / `--add-opens` |
| `javals.trace.server` | `off` | LSP trace level |
| `javals.references.inJars` | `false` | Also search dependency sources jars when finding references |
| `javals.references.inJdk` | `false` | Also search JDK sources when finding references |
| `javals.backend.sourceIndexer` | `javac` | `javac` / `ecj` — compiler used when indexing sources |
| `javals.backend.classIndexer` | `asm` | `asm` / `turbine` — class-file reader for jars / JRT |
| `javals.backend.compiler` | `javac` | `javac` / `ecj` — compiler used for analysis |

## Commands

- **JavaLS: Restart Language Server** (`javals.restartServer`)
- **JavaLS: Show Output Channel** (`javals.showOutputChannel`)
