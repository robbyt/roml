import { CliCommands } from '../CliCommands.js';
import { StdinReader } from '../CliHelpers.js';

class MockStdinReader implements StdinReader {
  constructor(private mockInput: string) {}
  async readStdin(): Promise<string> {
    return this.mockInput;
  }
}

describe('CliCommands.validate', () => {
  let mockOutput: string[];
  let mockError: string[];
  let outputWriter: (text: string) => void;
  let errorWriter: (text: string) => void;

  beforeEach(() => {
    mockOutput = [];
    mockError = [];
    outputWriter = (text: string) => mockOutput.push(text);
    errorWriter = (text: string) => mockError.push(text);
  });

  it('exits 0 with confirmation on a valid ROML document', async () => {
    const valid = '~ROML~\nname="Robert"\nage:30';
    const cli = new CliCommands(new MockStdinReader(valid), outputWriter, errorWriter);

    const result = await cli.executeCommand('validate');

    expect(result.exitCode).toBe(0);
    expect(mockOutput.join('\n')).toMatch(/valid/i);
    expect(mockError.length).toBe(0);
  });

  it('exits 1 and reports the error when the header is missing', async () => {
    const cli = new CliCommands(new MockStdinReader('not roml'), outputWriter, errorWriter);

    const result = await cli.executeCommand('validate');

    expect(result.exitCode).toBe(1);
    expect(mockError.join('\n')).toMatch(/~ROML~/);
  });

  it('exits 1 and reports the error on duplicate keys', async () => {
    const dup = '~ROML~\nfoo:1\nfoo:2';
    const cli = new CliCommands(new MockStdinReader(dup), outputWriter, errorWriter);

    const result = await cli.executeCommand('validate');

    expect(result.exitCode).toBe(1);
    expect(mockError.join('\n')).toMatch(/duplicate/i);
  });

  it('handles empty input as no-input error', async () => {
    const cli = new CliCommands(new MockStdinReader(''), outputWriter, errorWriter);

    const result = await cli.executeCommand('validate');

    expect(result.exitCode).toBe(1);
    expect(mockError.join('\n')).toMatch(/No input/);
  });
});
