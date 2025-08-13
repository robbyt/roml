import { showHelp, isHelpCommand, ProcessStdinReader } from '../CliHelpers.js';

describe('CLI Helpers', () => {
  describe('showHelp', () => {
    it('should return help text with usage and examples', () => {
      const helpText = showHelp();

      expect(helpText).toContain("ROML CLI - Robert's Opaque Mangling Language");
      expect(helpText).toContain('Usage:');
      expect(helpText).toContain('roml encode');
      expect(helpText).toContain('roml decode');
      expect(helpText).toContain('roml help');
      expect(helpText).toContain('Examples:');
      expect(helpText).toContain('echo \'{"name":"Robert","age":30}\' | roml encode');
    });

    it('should return a non-empty string', () => {
      const helpText = showHelp();
      expect(helpText.trim()).not.toBe('');
    });
  });

  describe('isHelpCommand', () => {
    it('should return true for undefined command', () => {
      expect(isHelpCommand(undefined)).toBe(true);
    });

    it('should return true for help command variants', () => {
      expect(isHelpCommand('help')).toBe(true);
      expect(isHelpCommand('--help')).toBe(true);
      expect(isHelpCommand('-h')).toBe(true);
    });

    it('should return false for non-help commands', () => {
      expect(isHelpCommand('encode')).toBe(false);
      expect(isHelpCommand('decode')).toBe(false);
      expect(isHelpCommand('unknown')).toBe(false);
      expect(isHelpCommand('')).toBe(true); // Empty string is falsy, so treated as help
    });
  });

  describe('ProcessStdinReader', () => {
    let reader: ProcessStdinReader;

    beforeEach(() => {
      reader = new ProcessStdinReader();
    });

    it('should be instantiable', () => {
      expect(reader).toBeInstanceOf(ProcessStdinReader);
    });

    it('should have readStdin method', () => {
      expect(typeof reader.readStdin).toBe('function');
    });

    // Note: We don't test actual stdin reading here as it would require
    // complex mocking of process.stdin. Integration tests would cover this.
  });
});
