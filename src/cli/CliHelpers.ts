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

export function showHelp(version?: string): string {
  const banner = version
    ? `ROML CLI v${version} - Robert's Opaque Mangling Language`
    : `ROML CLI - Robert's Opaque Mangling Language`;
  return `${banner}

Usage:
  roml encode [FILE]    Convert JSON to ROML (reads FILE or stdin)
  roml decode [FILE]    Convert ROML to JSON (reads FILE or stdin)
  roml validate [FILE]  Validate a ROML document (reads FILE or stdin)
  roml --version, -v    Print the package version and exit
  roml help             Show this help message

Examples:
  echo '{"name":"Robert","age":30}' | roml encode
  roml encode data.json > output.roml
  roml decode input.roml
  roml validate input.roml
`;
}

export function isHelpCommand(command?: string): boolean {
  if (!command) return true;
  return command === 'help' || command === '--help' || command === '-h';
}

export function isVersionFlag(command?: string): boolean {
  return command === '--version' || command === '-v';
}
