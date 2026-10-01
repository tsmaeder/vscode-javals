# server/

This directory ships the shaded JARs used in `bundled` mode:

- `java-ls.jar` — language server
- `mavenimporter.jar` — Maven → mbt.json importer (must sit next to `java-ls.jar`)

The jars are NOT checked in. They are produced by the sibling
`ch.castleridge:java-ls` Maven project and copied here via `npm run sync-server`
(invoked automatically by `vscode:prepublish`). See the repository root
`README.md` for details.
