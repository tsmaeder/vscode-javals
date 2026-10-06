# vscode-javals

This is a VS Code extension to launch the JavaLS language server. JavaLS is an experimental Java language server
that is is really fast and scales really well.

## Prerequisites

- Node.js 18+ and npm
- Java 17+ (`JAVA_HOME` or `java` on `PATH`)
- Sibling [java-ls](../java-ls) Maven project (for local/dev server builds)

Expected layout:

```
<parent>/
  vscode-javals/    ← this extension
  java-ls/
    java-ls/
      target/java-ls.jar
      target/mavenimporter.jar
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

   Produces `../java-ls/java-ls/target/java-ls.jar` and
   `../java-ls/java-ls/target/mavenimporter.jar` (copied beside the LS jar).

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
# Ensure the server jars exist first (step 2 above)
npm run package
```

`vscode:prepublish` runs `npm run sync-server`, which copies both jars:

- `../java-ls/java-ls/target/java-ls.jar` → `./server/java-ls.jar`
- `../java-ls/java-ls/target/mavenimporter.jar` → `./server/mavenimporter.jar`

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
| `javals.backend.sourceIndexer` | `turbine` | `javac` / `ecj` / `turbine` — compiler used when indexing sources |
| `javals.backend.classIndexer` | `turbine` | `asm` / `turbine` — class-file reader for jars / JRT |
| `javals.backend.compiler` | `ecj` | `javac` / `ecj` — compiler used for analysis |
| `javals.importers` | `{ "maven": "mavenimporter.jar" }` | Map of arbitrary build-system id → importer script. Every entry runs at init. Relative paths resolve against the java-ls install directory. See [Import process](#import-process). |
| `javals.maven.generatedSourceRules` | `[]` | Extra Maven generated-source rules, or disable built-ins with `enabled: false` (restart required). See [Import process](#import-process). |

## Import process

java-ls does not read `pom.xml` (or other build files) directly. It indexes from an
[`mbt.json`](https://github.com/scalameta/metals/blob/main-v2/docs/build-tools/mbt.json.md)
workspace description (sources, jars, and classpath layout). On startup:

1. If a root-level `mbt.json` exists in a workspace folder, that file is used as-is (no import).
2. Otherwise the server runs each importer listed in `javals.importers` (default seeds
   Maven; add any other id to run additional scripts).
3. Each importer writes a fragment under `.javals/` (e.g. Maven: `.javals/mbt.json.maven`).
4. Fragments are merged into `.javals/mbt.json`, which the server then loads for indexing.
5. If no `mbt.json` is found anywhere (root, `.javals/`, or `.metals/` fallback), indexing stays
   disabled.

### Importer scripts (`javals.importers`)

`javals.importers` is a free-form map of build-system id → script string. Keys are not
restricted: any id you add is run at workspace init and writes `.javals/mbt.json.<id>`.
The default map seeds only `maven` → `mavenimporter.jar` (bundled beside `java-ls.jar`).
Values are resolved as follows:

| Value | Behavior |
| --- | --- |
| Ends with `.jar` | Run with the LS JVM: `java -jar <path> <workspace> --output <.javals/mbt.json.<id>>`. Absolute paths are used as-is; **relative paths resolve against the java-ls install directory** (folder containing `java-ls.jar`, e.g. the extension's `server/`). |
| Anything else | Treated as a shell command line (`cmd.exe /C` on Windows, `/bin/sh -c` elsewhere). The importer process working directory is the java-ls install directory, so relative script paths resolve there too. The server appends `<workspace> --output <fragment>` (and optionally `--generated-source-rules` for Maven). |

Examples:

```json
{
  "javals.importers": {
    "maven": "mavenimporter.jar",
    "gradle": "/opt/tools/gradle-mbt-import.sh"
  }
}
```

The Maven importer scans the workspace for `pom.xml` files, resolves each reactor with an
embedded Maven instance, and maps projects to Metals-shaped namespaces (main and test as separate
targets, external jars as `dependencyModules`, workspace modules as `dependsOn`). It skips a full
re-import when the fragment is newer than every scanned pom unless forced.

### Generated source rules

Maven does not run `generate-sources` during import. Instead the importer applies a registry of
rules that map known plugins to configuration paths and default directories, then adds those roots
to each namespace’s `sources` list (even if the directory does not exist yet).

Built-in rules cover modello, `maven-compiler-plugin` annotation-processor output, and
`build-helper-maven-plugin` `add-source` / `add-test-source`. Extend or disable them with
`javals.maven.generatedSourceRules` (restart required). The extension passes the array to the
server; non-empty values are written to `.javals/generated-source-rules.json` for the importer.

Each entry is a JSON object:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `pluginKey` | string | yes | Maven plugin coordinates (`groupId:artifactId`) |
| `scope` | `"main"` \| `"test"` | for additions | Which namespace receives the root |
| `configPath` | string | for additions | Slash-separated path under the plugin’s `<configuration>` (e.g. `outputDirectory`, `sources/source`) |
| `goals` | string[] | no | When set, only executions whose goals intersect apply; empty/omitted → plugin-level config (plus executions that set the path) |
| `list` | boolean | no | If `true`, each matching child element is a path (default `false`) |
| `defaultPath` | string | no | Used when config is absent; supports `${project.build.directory}` / `${project.basedir}` |
| `required` | boolean | no | If `true`, skip when neither config nor default yields a path (default `false`) |
| `enabled` | boolean | no | `"enabled": false` disables matching built-ins instead of adding a rule (default `true`) |

Disable matching: `pluginKey` is required; optional `scope`, `goals`, and/or `configPath` narrow
which built-in(s) are removed. Additions need `pluginKey`, `scope`, and `configPath`.

Example:

```json
"javals.maven.generatedSourceRules": [
  {
    "pluginKey": "org.antlr:antlr4-maven-plugin",
    "scope": "main",
    "configPath": "outputDirectory",
    "defaultPath": "${project.build.directory}/generated-sources/antlr4"
  },
  {
    "pluginKey": "org.codehaus.modello:modello-maven-plugin",
    "enabled": false
  }
]
```

## Commands

- **JavaLS: Restart Language Server** (`javals.restartServer`)
- **JavaLS: Show Output Channel** (`javals.showOutputChannel`)
