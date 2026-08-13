/**
 * Copyright 2026 by Anysphere Inc.
 * Licensed under the MIT License.
 *
 * Author: Thomas Mäder, Castle Ridge Software
 *
 * SPDX-License-Identifier: MIT
 */
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
});
