import { RomlFile } from '../file/RomlFile.js';
import { StdinReader } from './CliHelpers.js';

export interface CliResult {
  output: string;
  exitCode: number;
}

export interface CliError {
  message: string;
  exitCode: number;
}

export class CliCommands {
  constructor(
    private stdinReader: StdinReader,
    private outputWriter: (text: string) => void = console.log,
    private errorWriter: (text: string) => void = console.error
  ) {}

  async executeCommand(command: string, input?: string): Promise<CliResult> {
    try {
      const inputData = input !== undefined ? input : await this.stdinReader.readStdin();

      if (!inputData) {
        const errorMsg = 'Error: No input provided via stdin';
        this.errorWriter(errorMsg);
        return { output: '', exitCode: 1 };
      }

      switch (command) {
        case 'encode':
          return await this.handleEncode(inputData);
        case 'decode':
          return await this.handleDecode(inputData);
        default: {
          const errorMsg = `Error: Unknown command '${command}'`;
          this.errorWriter(errorMsg);
          this.errorWriter('Use "roml help" for usage information');
          return { output: '', exitCode: 1 };
        }
      }
    } catch (error) {
      const errorMsg = 'Error reading from stdin';
      this.errorWriter(errorMsg);
      this.errorWriter(error instanceof Error ? error.message : String(error));
      return { output: '', exitCode: 1 };
    }
  }

  private async handleEncode(input: string): Promise<CliResult> {
    try {
      const jsonData = JSON.parse(input);
      const roml = RomlFile.jsonToRoml(jsonData);
      this.outputWriter(roml);
      return { output: roml, exitCode: 0 };
    } catch (error) {
      const errorMsg = 'Error: Invalid JSON input';
      this.errorWriter(errorMsg);
      this.errorWriter(error instanceof Error ? error.message : String(error));
      return { output: '', exitCode: 1 };
    }
  }

  private async handleDecode(input: string): Promise<CliResult> {
    try {
      const jsonData = RomlFile.romlToJson(input);
      const output = JSON.stringify(jsonData, null, 2);
      this.outputWriter(output);
      return { output, exitCode: 0 };
    } catch (error) {
      const errorMsg = 'Error: Invalid ROML input';
      this.errorWriter(errorMsg);
      this.errorWriter(error instanceof Error ? error.message : String(error));
      return { output: '', exitCode: 1 };
    }
  }
}
