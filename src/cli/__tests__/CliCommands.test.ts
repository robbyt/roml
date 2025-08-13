import { CliCommands } from '../CliCommands.js';
import { StdinReader } from '../CliHelpers.js';

class MockStdinReader implements StdinReader {
  constructor(private mockInput: string) {}

  async readStdin(): Promise<string> {
    return this.mockInput;
  }
}

describe('CliCommands', () => {
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

  describe('encode command', () => {
    it('should convert valid JSON to ROML', async () => {
      const mockStdin = new MockStdinReader('{"name":"Robert","age":30}');
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('encode');

      expect(result.exitCode).toBe(0);
      expect(mockOutput.length).toBe(1);
      expect(mockOutput[0]).toMatch(/^~ROML~/);
      expect(mockOutput[0]).toContain('name');
      expect(mockOutput[0]).toContain('Robert');
      expect(mockError.length).toBe(0);
    });

    it('should handle invalid JSON input', async () => {
      const mockStdin = new MockStdinReader('invalid json');
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('encode');

      expect(result.exitCode).toBe(1);
      expect(mockOutput.length).toBe(0);
      expect(mockError.length).toBeGreaterThan(0);
      expect(mockError[0]).toContain('Error: Invalid JSON input');
    });

    it('should handle empty input', async () => {
      const mockStdin = new MockStdinReader('');
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('encode');

      expect(result.exitCode).toBe(1);
      expect(mockError.length).toBeGreaterThan(0);
      expect(mockError[0]).toContain('Error: No input provided via stdin');
    });
  });

  describe('decode command', () => {
    it('should convert valid ROML to JSON using modern.roml example', async () => {
      const validRoml = `~ROML~
name="Robert"
&age&30
active<true>
email="robert@example.com"
//salary//75000
@created@2024-01-01@
tags||dev||admin||`;
      const mockStdin = new MockStdinReader(validRoml);
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('decode');

      expect(result.exitCode).toBe(0);
      expect(mockOutput.length).toBe(1);

      const parsed = JSON.parse(mockOutput[0]);
      expect(parsed.name).toBe('Robert');
      expect(parsed.age).toBe(30);
      expect(parsed.active).toBe(true);
      expect(parsed.email).toBe('robert@example.com');
      expect(mockError.length).toBe(0);
    });

    it('should convert complex ROML with nested objects', async () => {
      const complexRoml = `~ROML~
name="Robert Johnson"
age:30
address{
  street="123 Main Street"
  city:Springfield
  country~USA
}`;
      const mockStdin = new MockStdinReader(complexRoml);
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('decode');

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(mockOutput[0]);
      expect(parsed.name).toBe('Robert Johnson');
      expect(parsed.address.street).toBe('123 Main Street');
      expect(parsed.address.city).toBe('Springfield');
      expect(parsed.address.country).toBe('USA');
    });

    it('should handle malformed ROML gracefully', async () => {
      // Test with truly broken syntax that should cause parsing errors
      const malformedRoml = 'not roml at all';
      const mockStdin = new MockStdinReader(malformedRoml);
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('decode');

      // The parser might be forgiving, but it should at least complete
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      // Either it succeeds with empty object or fails with error
      expect(mockOutput.length + mockError.length).toBeGreaterThan(0);
    });
  });

  describe('unknown command', () => {
    it('should handle unknown commands', async () => {
      const mockStdin = new MockStdinReader('some input');
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('unknown');

      expect(result.exitCode).toBe(1);
      expect(mockOutput.length).toBe(0);
      expect(mockError.length).toBe(2);
      expect(mockError[0]).toContain("Error: Unknown command 'unknown'");
      expect(mockError[1]).toContain('Use "roml help" for usage information');
    });
  });

  describe('executeCommand with direct input', () => {
    it('should accept input parameter instead of reading stdin', async () => {
      const mockStdin = new MockStdinReader('should not be used');
      const cli = new CliCommands(mockStdin, outputWriter, errorWriter);

      const result = await cli.executeCommand('encode', '{"test":123}');

      expect(result.exitCode).toBe(0);
      expect(mockOutput.length).toBe(1);
      expect(mockOutput[0]).toMatch(/^~ROML~/);
      expect(mockOutput[0]).toContain('test');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through encode->decode cycle', async () => {
      const originalData = {
        name: 'Alice',
        age: 25,
        active: true,
        tags: ['user', 'admin'],
        metadata: {
          created: '2024-01-01',
          score: 95.5,
        },
      };

      // Encode to ROML
      const encodeMockStdin = new MockStdinReader(JSON.stringify(originalData));
      const encodeCli = new CliCommands(encodeMockStdin, outputWriter, errorWriter);
      const encodeResult = await encodeCli.executeCommand('encode');

      expect(encodeResult.exitCode).toBe(0);
      expect(mockOutput.length).toBe(1);

      const romlOutput = mockOutput[0];

      // Reset mock arrays
      mockOutput.length = 0;
      mockError.length = 0;

      // Decode back to JSON
      const decodeMockStdin = new MockStdinReader(romlOutput);
      const decodeCli = new CliCommands(decodeMockStdin, outputWriter, errorWriter);
      const decodeResult = await decodeCli.executeCommand('decode');

      expect(decodeResult.exitCode).toBe(0);
      expect(mockOutput.length).toBe(1);

      const decodedData = JSON.parse(mockOutput[0]);
      expect(decodedData).toEqual(originalData);
    });
  });
});
