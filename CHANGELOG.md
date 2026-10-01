# Change Log

All notable changes to the "vscode-javals" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.0]
- Added support for importing maven projects

## [0.1.1]
- Added suppport for searching references in JDK and jar attached sources
- Improved "references" performance for "String" to 18 seconds in Trino source
- Cancellable progress for references, yielding results up to cancellation
- Progress for indexing
- Improved indexing performance for Trino Workspace to ~22 seconds
- Switched to a common format for the AST and unified algorightms for implementing LSP features base on that
- Bugfixes

## [0.1.0]

- Initial release