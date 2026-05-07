import { RomlFile } from '../file/RomlFile';

describe('Lexer regressions', () => {
  describe('pipe-array regex precedence', () => {
    // Regression: RomlLexer's pipe-array pattern was
    //   /^(.+?)\|\|(.*)|\|$/
    // which due to alternation precedence meant
    //   (^(.+?)\|\|(.*)) | (\|$)
    // so a line ending in a single `|` matched the trailing alternative,
    // capture groups [1]/[2] became undefined, and the very next line
    // accessed `.includes('||')` on undefined and crashed with a TypeError.
    it('does not surface a TypeError for a line ending in a single pipe', () => {
      expect(() => RomlFile.romlToJson('~ROML~\nfoo|')).not.toThrow(
        /Cannot read properties of undefined/
      );
    });

    it('treats an unparseable trailing-pipe line as no-op (silent drop)', () => {
      // After the fix, the line matches no syntax style and is dropped,
      // matching existing behavior for any unrecognized line.
      expect(RomlFile.romlToJson('~ROML~\nfoo|')).toEqual({});
    });

    it('still parses a well-formed pipe array', () => {
      // Sanity: the fix must not regress the legitimate pipe-array case.
      expect(RomlFile.romlToJson('~ROML~\nitems||a||b||c||')).toEqual({
        items: ['a', 'b', 'c'],
      });
    });
  });
});
