import * as process from 'process';

export interface StdinReader {
  readStdin(): Promise<string>;
}

export class ProcessStdinReader implements StdinReader {
  async readStdin(): Promise<string> {
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
}

export function showHelp(): string {
  return `
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
`;
}

export function isHelpCommand(command?: string): boolean {
  if (!command) return true;
  return command === 'help' || command === '--help' || command === '-h';
}
