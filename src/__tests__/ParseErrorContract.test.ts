import { RomlFile } from '../file/RomlFile';

describe('Parse error contract on RomlFile', () => {
  // Regression: RomlFile.parse() catches lexer/parser errors and returns
  // them via the `errors` field. Historically the error path also returned
  // a misleading `data: {}` which is indistinguishable from a valid empty
  // ROML document. These tests lock in the post-fix contract:
  //
  //   - parse()    returns errors[] with the original message preserved.
  //   - parse()    returns data === null on error (not `{}`).
  //   - toJSON()   throws with the underlying cause embedded.
  //   - validate() returns the same errors[].

  describe('lexer-level errors (missing ~ROML~ header)', () => {
    const broken = 'not a roml document';

    it('parse() returns non-empty errors', () => {
      const file = new RomlFile(broken);
      const result = file.parse();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('parse() preserves the lexer error message verbatim', () => {
      const file = new RomlFile(broken);
      const result = file.parse();
      expect(result.errors[0]).toMatch(/Missing ~ROML~ header/);
    });

    it('parse() returns data === null on error (not the misleading {})', () => {
      const file = new RomlFile(broken);
      const result = file.parse();
      expect(result.data).toBeNull();
    });

    it('toJSON() throws with the underlying cause embedded', () => {
      const file = new RomlFile(broken);
      expect(() => file.toJSON()).toThrow(/Missing ~ROML~ header/);
    });

    it('validate() returns the same errors[]', () => {
      const file = new RomlFile(broken);
      const v = file.validate();
      expect(v.valid).toBe(false);
      expect(v.errors[0]).toMatch(/Missing ~ROML~ header/);
    });
  });

  describe('parser-level errors (duplicate keys at the same scope)', () => {
    const broken = '~ROML~\nfoo:1\nfoo:2';

    it('parse() returns non-empty errors', () => {
      const file = new RomlFile(broken);
      const result = file.parse();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('parse() preserves the parser error message verbatim', () => {
      const file = new RomlFile(broken);
      const result = file.parse();
      expect(result.errors.find((e) => /Duplicate key/.test(e))).toBeDefined();
    });

    it('toJSON() throws with the underlying cause embedded', () => {
      const file = new RomlFile(broken);
      expect(() => file.toJSON()).toThrow(/Duplicate key/);
    });
  });

  describe('successful parse', () => {
    it('parse() returns errors=[] and data is the parsed object', () => {
      const file = new RomlFile('~ROML~\nfoo:7');
      const result = file.parse();
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ foo: 7 });
    });

    it('validate() reports valid=true with no errors', () => {
      const file = new RomlFile('~ROML~\nfoo:7');
      const v = file.validate();
      expect(v.valid).toBe(true);
      expect(v.errors).toEqual([]);
    });
  });
});
