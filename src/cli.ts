#!/usr/bin/env node

import { ProcessStdinReader, showHelp, isHelpCommand } from './cli/CliHelpers.js';
import { CliCommands } from './cli/CliCommands.js';
import * as process from 'process';

async function main() {
  const command = process.argv[2];

  if (isHelpCommand(command)) {
    console.log(showHelp());
    process.exit(0);
  }

  const stdinReader = new ProcessStdinReader();
  const cliCommands = new CliCommands(stdinReader);

  const result = await cliCommands.executeCommand(command);
  process.exit(result.exitCode);
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
