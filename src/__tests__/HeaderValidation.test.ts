import { RomlFile } from '../file/RomlFile';

describe('Required ~ROML~ header', () => {
  // Regression: FORMAT.md says every document must begin with `~ROML~`, but
  // the lexer accepted any input. `romlToJson('not roml')` returned `{}`
  // silently, indistinguishable from a valid empty document. Now it throws.

  it('throws when input has no ~ROML~ header', () => {
    expect(() => RomlFile.romlToJson('not roml')).toThrow(/~ROML~/);
  });

  it('throws when input is a single key-value line with no header', () => {
    expect(() => RomlFile.romlToJson('foo:7')).toThrow(/~ROML~/);
  });

  it('throws on the empty string (no header at all)', () => {
    expect(() => RomlFile.romlToJson('')).toThrow(/~ROML~/);
  });

  it('throws on a whitespace-only document', () => {
    expect(() => RomlFile.romlToJson('   \n\n')).toThrow(/~ROML~/);
  });

  it('still parses a valid empty ROML document', () => {
    expect(RomlFile.romlToJson('~ROML~')).toEqual({});
  });

  it('still parses a valid header with content', () => {
    expect(RomlFile.romlToJson('~ROML~\nfoo:7')).toEqual({ foo: 7 });
  });

  it('reports a clear error message naming the header', () => {
    let caught: Error | undefined;
    try {
      RomlFile.romlToJson('garbage line one');
    } catch (e) {
      caught = e as Error;
    }
    expect(caught?.message).toMatch(/~ROML~/);
  });
});
