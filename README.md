# vscode-javals

VS Code extension that launches the `ch.castleridge:java-ls` language server
over stdio.

## How the server jar is located

The extension can run the server from one of two sources, selected by the
`javals.serverMode` setting:

| Mode      | Jar path                                          | When to use                          |
| --------- | ------------------------------------------------- | ------------------------------------ |
| `bundled` | `<extension>/server/java-ls.jar`                  | Normal end-user install from VSIX    |
| `dev`     | `<devProjectPath>/java-ls/target/java-ls.jar`     | Hacking on the server locally        |
| `auto`    | Dev jar if present, otherwise the bundled jar     | Default                              |

`javals.devProjectPath` defaults to `../java-ls` (relative to the extension's
install directory / repo parent), which matches the layout in this monorepo:

```
<parent>/
  vscode-javals/       <- this extension
  java-ls/
    java-ls/
      target/java-ls.jar
```

Additional settings:

- `javals.javaHome` — absolute path to a Java 17+ install. Falls back to
  `JAVA_HOME`, then `java` on `PATH`.
- `javals.jvmArgs` — extra JVM arguments appended after the required
  `--add-exports` / `--add-opens` flags.
- `javals.trace.server` — standard LSP trace level.

The extension always prepends the `--add-exports` / `--add-opens` flags the
server needs to reach `jdk.compiler/com.sun.tools.javac.*` internals. JAR
manifests cannot carry these flags when launched with `java -jar`, so they
must be on the command line in both bundled and dev modes.

## Dev setup

1. Build the server: in `../java-ls`, run

   ```
   mvn -pl java-ls -am package
   ```

   This produces `../java-ls/java-ls/target/java-ls.jar`.

2. In this repo, press `F5` to launch the Extension Development Host. With
   the default `javals.serverMode: auto`, the extension will pick up the
   freshly built dev jar automatically.

3. After iterating on the server, rebuild it and run
   `JavaLS: Restart Language Server` from the command palette.

## Packaging

`npm run package` builds the extension bundle. `vscode:prepublish` first runs
`npm run sync-server`, which copies
`../java-ls/java-ls/target/java-ls.jar` into `./server/java-ls.jar` so that
the VSIX ships a working bundled server. The source jar must exist before
packaging — run `mvn -pl java-ls -am package` first.

Point the sync at a different sibling project with
`JAVALS_DEV_PROJECT=../some/other/path npm run sync-server`.

## Commands

- `JavaLS: Restart Language Server` (`javals.restartServer`)
- `JavaLS: Show Output Channel` (`javals.showOutputChannel`)
