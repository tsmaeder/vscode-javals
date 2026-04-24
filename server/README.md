# server/

This directory ships the `java-ls.jar` shaded JAR used in `bundled` mode.

The jar is NOT checked in. It is produced by the sibling `ch.castleridge:java-ls`
Maven project and copied here via `npm run sync-server` (invoked automatically
by `vscode:prepublish`). See the repository root `README.md` for details.
