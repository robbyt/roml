#!/usr/bin/env node

import {
  ProcessStdinReader,
  showHelp,
  isHelpCommand,
  isVersionFlag,
} from './cli/CliHelpers.js';
import { CliCommands } from './cli/CliCommands.js';
import * as fs from 'fs';
import * as process from 'process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

function readPackageVersion(): string {
  // dist/cli.js sits next to dist/cli/, dist/file/, etc. The package
  // root (which holds package.json) is one directory up from dist/.
  try {
    const here = fileURLToPath(import.meta.url);
    const pkgPath = join(dirname(here), '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (isVersionFlag(args[0])) {
    console.log(readPackageVersion());
    process.exit(0);
  }

  const command = args[0];
  const fileArg = args[1];

  if (isHelpCommand(command)) {
    console.log(showHelp(readPackageVersion()));
    process.exit(0);
  }

  // Only treat the second positional arg as a file path for commands
  // that actually accept input. For unknown commands, skip the file
  // read so the user sees the proper "Unknown command" diagnostic
  // instead of a misleading "Cannot read file" error.
  const COMMANDS_TAKING_INPUT = new Set(['encode', 'decode', 'validate']);

  let input: string | undefined;
  if (fileArg && COMMANDS_TAKING_INPUT.has(command)) {
    try {
      input = fs.readFileSync(fileArg, 'utf-8').trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: Cannot read file '${fileArg}': ${message}`);
      process.exit(1);
    }
    if (!input) {
      console.error(`Error: File '${fileArg}' is empty`);
      process.exit(1);
    }
  }

  const stdinReader = new ProcessStdinReader();
  const cliCommands = new CliCommands(stdinReader);

  const result = await cliCommands.executeCommand(command, input);
  process.exit(result.exitCode);
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
