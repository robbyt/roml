#!/usr/bin/env node

import { RomlFile } from './file/RomlFile';
import * as process from 'process';

function showHelp() {
  console.log(`
ROML CLI - Robert's Opaque Mangling Language

Usage:
  roml encode     Convert JSON from stdin to ROML on stdout
  roml decode     Convert ROML from stdin to JSON on stdout
  roml help       Show this help message

Examples:
  echo '{"name":"Robert","age":30}' | roml encode
  echo 'name="Robert"' | roml decode
  cat data.json | roml encode > output.roml
  cat input.roml | roml decode > output.json
`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
  });
}

async function main() {
  const command = process.argv[2];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  try {
    const input = await readStdin();

    if (!input) {
      console.error('Error: No input provided via stdin');
      process.exit(1);
    }

    switch (command) {
      case 'encode':
        try {
          const jsonData = JSON.parse(input);
          const roml = RomlFile.jsonToRoml(jsonData);
          console.log(roml);
        } catch (error) {
          console.error('Error: Invalid JSON input');
          console.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
        break;

      case 'decode':
        try {
          const jsonData = RomlFile.romlToJson(input);
          console.log(JSON.stringify(jsonData, null, 2));
        } catch (error) {
          console.error('Error: Invalid ROML input');
          console.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
        break;

      default:
        console.error(`Error: Unknown command '${command}'`);
        console.error('Use "roml help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error reading from stdin');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
