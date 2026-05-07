import { RomlFile } from '../file/RomlFile';

describe('Duplicate-key rejection', () => {
  // Regression: at the same object scope, duplicate keys were silently
  // last-wins. ROML's determinism story is stronger if it refuses the
  // ambiguous input outright.

  it('throws on duplicate keys at root', () => {
    expect(() => RomlFile.romlToJson('~ROML~\nfoo:1\nfoo:2')).toThrow(/duplicate/i);
  });

  it('reports the duplicated key name in the error', () => {
    expect(() => RomlFile.romlToJson('~ROML~\nbar=hi\nbar=bye')).toThrow(/bar/);
  });

  it('throws on duplicate keys in a nested object', () => {
    const doc = ['~ROML~', 'outer{', '  inner=1', '  inner=2', '}'].join('\n');
    expect(() => RomlFile.romlToJson(doc)).toThrow(/duplicate/i);
  });

  it('throws on duplicate keys inside an [N]{...} array item', () => {
    const doc = [
      '~ROML~',
      'items[',
      '  [0]{',
      '    name="a"',
      '    name="b"',
      '  }',
      ']',
    ].join('\n');
    expect(() => RomlFile.romlToJson(doc)).toThrow(/duplicate/i);
  });

  it('does not flag the same key name appearing in different scopes', () => {
    const doc = [
      '~ROML~',
      'name="root"',
      'inner{',
      '  name="nested"',
      '}',
    ].join('\n');
    expect(RomlFile.romlToJson(doc)).toEqual({ name: 'root', inner: { name: 'nested' } });
  });

  it('does not flag the same key name appearing in different array items', () => {
    const doc = [
      '~ROML~',
      'items[',
      '  [0]{',
      '    name="a"',
      '  }',
      '  [1]{',
      '    name="b"',
      '  }',
      ']',
    ].join('\n');
    expect(RomlFile.romlToJson(doc)).toEqual({ items: [{ name: 'a' }, { name: 'b' }] });
  });
});
