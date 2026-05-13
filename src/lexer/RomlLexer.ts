import { SYNTHETIC_ITEMS_KEY, SYNTHETIC_VALUE_KEY } from '../types.js';

/**
 * Result of `extractKey`: the literal JSON key name plus structural
 * metadata about how it was written in the source. The parser uses
 * `hasPrimePrefix` to drive `primesDetected`; `wasQuoted` is currently
 * informational only.
 */
interface ExtractedKey {
  key: string;
  wasQuoted: boolean;
  hasPrimePrefix: boolean;
}

/**
 * Map of escape-letter to the bytes it decodes to. Used by
 * `unescapeStringValue` to resolve each `\X` pair atomically.
 */
const ESCAPE_MAP: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  '"': '"',
  '\\': '\\',
};

/**
 * Unescape a string from ROML's escape form.
 *
 * Walks the input with a single regex pass (`/\\(.)/g`) so each
 * `\X` pair is resolved atomically — earlier versions used a
 * chained `.replace()` pipeline whose ordering couldn't compose
 * for the literal 2-char sequences `\n` / `\r` / `\t`: the
 * `\\n` → newline step would consume the `\n` portion of a
 * doubled-`\` + `n` source (`\\n`, 3 bytes from the encoder's
 * doubling pass) before the `\\\\` → `\` step could reverse the
 * doubling. Result: user input `\` + `n` (2 bytes) mangled to
 * `\` + newline on round-trip (limitation #16).
 *
 * Unknown escapes (`\X` where X is not in the map) are left
 * verbatim — matches the encoder's behaviour of only escaping
 * the chars it knows.
 */
function unescapeStringValue(value: string): string {
  return value.replace(/\\(.)/g, (match, char: string) =>
    Object.prototype.hasOwnProperty.call(ESCAPE_MAP, char) ? ESCAPE_MAP[char] : match
  );
}

export interface RomlToken {
  type:
    | 'HEADER'
    | 'KEY_VALUE'
    | 'OBJECT_START'
    | 'OBJECT_END'
    | 'ARRAY_START'
    | 'ARRAY_END'
    | 'ARRAY_ITEM'
    | 'NEWLINE'
    | 'INDENT'
    | 'EOF';
  value: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  style?:
    | 'QUOTED'
    | 'AMPERSAND'
    | 'BRACKETS'
    | 'PIPES'
    | 'DOUBLE_COLON'
    | 'FAKE_COMMENT'
    | 'AT_SANDWICH'
    | 'UNDERSCORE'
    | 'COLON_DELIM'
    | 'EQUALS'
    | 'COLON'
    | 'TILDE'
    | 'HASH'
    | 'PERCENT'
    | 'DOLLAR'
    | 'CARET'
    | 'PLUS';
  key?: string;
  parsedValue?: unknown;
  depth?: number;
  /**
   * True when the key in the source was wrapped in double quotes
   * (e.g. `"!warn"=1`). The lexer strips the quotes from `key` itself;
   * this flag is informational metadata for downstream tooling that
   * wants to recover the source's quoting choice. The parser does not
   * use it for prime-prefix disambiguation — `keyHasPrimePrefix` is
   * already exclusive of the surrounding quotes.
   */
  keyWasQuoted?: boolean;
  /**
   * True when the source line carried a prime-marker `!` immediately
   * before the (possibly-quoted) key, e.g. `!count:7` or `!"!warn":7`.
   * The lexer strips the `!` so `key` is always the post-prefix name;
   * the parser uses this flag to mark `primesDetected` and validate.
   */
  keyHasPrimePrefix?: boolean;
}

export class RomlLexer {
  private input: string;
  private lines: string[];
  private tokens: RomlToken[] = [];

  constructor(input: string) {
    this.input = input;
    this.lines = input.split('\n');
  }

  public tokenize(): RomlToken[] {
    this.tokens = [];

    // The ~ROML~ header is mandatory. Find the first non-blank line and
    // require it to begin with `~ROML~`; otherwise the input is not a
    // ROML document. Blank lines before the header are tolerated.
    let headerLineIndex = -1;
    let headerTrimmed = '';
    for (let i = 0; i < this.lines.length; i++) {
      const trimmed = this.lines[i].trim();
      if (trimmed !== '') {
        headerLineIndex = i;
        headerTrimmed = trimmed;
        break;
      }
    }
    if (headerLineIndex === -1 || !headerTrimmed.startsWith('~ROML~')) {
      throw new Error('Missing ~ROML~ header: input is not a ROML document');
    }

    this.addToken(
      'HEADER',
      headerTrimmed,
      this.getLineStartOffset(headerLineIndex),
      headerLineIndex
    );

    // Process content lines after the header.
    const contentStart = headerLineIndex + 1;
    this.processLines(this.lines.slice(contentStart), contentStart);

    this.addToken('EOF', '', this.input.length, this.lines.length);
    return this.tokens;
  }

  private processLines(lines: string[], startLineNum: number): void {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        i++;
        continue;
      }

      const depth = this.calculateDepth(line);
      const lineNumber = startLineNum + i;
      const startOffset = this.getLineStartOffset(lineNumber);

      // Handle comment lines (including META tags)
      if (trimmedLine.startsWith('#')) {
        // Preserve META tags as tokens for parser validation
        if (trimmedLine.includes('~META~')) {
          this.addToken('HEADER', trimmedLine, startOffset, lineNumber);
        }
        // Skip other comment lines from tokenization
        i++;
        continue;
      }

      // Check for object end
      if (trimmedLine === '}') {
        this.addToken(
          'OBJECT_END',
          trimmedLine,
          startOffset,
          lineNumber,
          undefined,
          undefined,
          undefined,
          depth
        );
        i++;
        continue;
      }

      // Check for array end
      if (trimmedLine === ']') {
        this.addToken(
          'ARRAY_END',
          trimmedLine,
          startOffset,
          lineNumber,
          undefined,
          undefined,
          undefined,
          depth
        );
        i++;
        continue;
      }

      // Check for array item: [index]{ (must come before generic object pattern)
      const arrayItemMatch = trimmedLine.match(/^\[(\d+)\]\{$/);
      if (arrayItemMatch) {
        const index = arrayItemMatch[1];
        this.addToken(
          'ARRAY_ITEM',
          trimmedLine,
          startOffset,
          lineNumber,
          undefined,
          `[${index}]`,
          undefined,
          depth
        );
        i++;
        continue;
      }

      // Check for object start: key{
      const objectMatch = trimmedLine.match(/^(.+?)\{$/);
      if (objectMatch) {
        const extracted = this.extractKey(objectMatch[1]);
        this.addToken(
          'OBJECT_START',
          trimmedLine,
          startOffset,
          lineNumber,
          undefined,
          extracted.key,
          undefined,
          depth,
          extracted.wasQuoted,
          extracted.hasPrimePrefix
        );
        i++;
        continue;
      }

      // Check for array start: key[
      const arrayMatch = trimmedLine.match(/^(.+?)\[$/);
      if (arrayMatch) {
        const extracted = this.extractKey(arrayMatch[1]);
        this.addToken(
          'ARRAY_START',
          trimmedLine,
          startOffset,
          lineNumber,
          undefined,
          extracted.key,
          undefined,
          depth,
          extracted.wasQuoted,
          extracted.hasPrimePrefix
        );
        i++;
        continue;
      }

      // Regular key-value line - use trimStart to preserve trailing spaces
      const contentLine = line.trimStart();
      const parsed = this.parseKeyValueLine(contentLine);
      if (parsed) {
        const [key, value, style, keyWasQuoted, keyHasPrimePrefix] = parsed;
        this.addToken(
          'KEY_VALUE',
          contentLine,
          startOffset,
          lineNumber,
          style,
          key,
          value,
          depth,
          keyWasQuoted,
          keyHasPrimePrefix
        );
      }

      i++;
    }
  }

  /**
   * Strip an optional leading `!` (prime marker) and surrounding double
   * quotes from a raw key, returning the literal JSON key plus the
   * structural metadata. Used by `parseKeyValueLine` for KEY_VALUE
   * tokens and by `processLines` for OBJECT_START / ARRAY_START tokens
   * so all token types surface clean keys with consistent flags.
   */
  private extractKey(keyPart: string): ExtractedKey {
    let inner = keyPart;
    let hasPrimePrefix = false;
    if (inner.startsWith('!')) {
      hasPrimePrefix = true;
      inner = inner.substring(1);
    }
    const quotedKeyMatch = inner.match(/^"(.*)"$/);
    if (quotedKeyMatch) {
      return {
        key: unescapeStringValue(quotedKeyMatch[1]),
        wasQuoted: true,
        hasPrimePrefix,
      };
    }
    return { key: inner, wasQuoted: false, hasPrimePrefix };
  }

  private parseKeyValueLine(
    line: string
  ): [string, unknown, string, boolean, boolean] | null {
    const extractKey = (keyPart: string): ExtractedKey => this.extractKey(keyPart);

    // Check special cases FIRST before simple separator analysis
    // This prevents complex patterns from being incorrectly split by analyzeLineStructure
    const specialResult = this.parseSpecialCases(line, extractKey);
    if (specialResult) {
      return specialResult;
    }

    // Analyze line structure to identify style and key/value positions
    const analysis = this.analyzeLineStructure(line);
    if (analysis) {
      const { style, keyPart, valuePart } = analysis;
      const extracted = extractKey(keyPart);

      // Parse the value based on the style
      const valueResult = this.parseValueForStyle(extracted.key, valuePart, style);
      return [
        valueResult[0],
        valueResult[1],
        valueResult[2],
        extracted.wasQuoted,
        extracted.hasPrimePrefix,
      ];
    }

    return null;
  }

  /**
   * Analyze line structure to identify style and extract key/value parts
   * This is the single point where quote-awareness is handled
   */
  private analyzeLineStructure(
    line: string
  ): { style: string; keyPart: string; valuePart: string } | null {
    // First check for quoted pattern (special case)
    const quotedMatch = line.match(/^(.+?)="(.*)"$/);
    if (quotedMatch) {
      return {
        style: 'QUOTED',
        keyPart: quotedMatch[1],
        valuePart: quotedMatch[2],
      };
    }

    // Check for AMPERSAND style FIRST: &key&value (handles quoted keys properly)
    if (line.startsWith('&')) {
      const content = line.slice(1); // Remove leading &
      const ampersandPos = this.findSeparatorOutsideQuotes(content, '&');
      if (ampersandPos !== -1) {
        return {
          style: 'AMPERSAND',
          keyPart: content.slice(0, ampersandPos),
          valuePart: content.slice(ampersandPos + 1),
        };
      }
    }

    // Define separator patterns in order of precedence
    const separators = [
      { char: '=', style: 'EQUALS' },
      { char: ':', style: 'COLON' },
      { char: '~', style: 'TILDE' },
      { char: '#', style: 'HASH' },
      { char: '%', style: 'PERCENT' },
      { char: '$', style: 'DOLLAR' },
      { char: '^', style: 'CARET' },
      { char: '+', style: 'PLUS' },
    ];

    // Find the earliest separator outside quoted sections
    let earliestPos = -1;
    let earliestStyle = '';

    for (const { char, style } of separators) {
      if (char === '=' && quotedMatch) continue; // Already handled above

      const separatorPos = this.findSeparatorOutsideQuotes(line, char);
      if (separatorPos !== -1) {
        // Special handling for colon to avoid colon arrays
        if (char === ':' && this.isColonArray(line, separatorPos)) {
          continue;
        }

        // Keep track of the earliest valid separator
        if (earliestPos === -1 || separatorPos < earliestPos) {
          earliestPos = separatorPos;
          earliestStyle = style;
        }
      }
    }

    // Return the earliest valid separator found
    if (earliestPos !== -1) {
      return {
        style: earliestStyle,
        keyPart: line.slice(0, earliestPos),
        valuePart: line.slice(earliestPos + 1),
      };
    }

    // Fallback to single bracket pattern: key<value>. Run after the
    // separator scan so an EQUALS / COLON / etc. line wins when both
    // shapes are present (e.g. `key=<value>` is EQUALS with value
    // `<value>`, not BRACKETS with key `key=` and value `value`).
    // Find the `<` outside any quoted region so a quoted-key like
    // `"<"` doesn't get split at the wrong char. Require non-empty
    // value content so `key<>` isn't claimed (that shape is the
    // single-element array marker handled elsewhere).
    if (line.endsWith('>')) {
      const inner = line.slice(0, -1);
      const bracketPos = this.findSeparatorOutsideQuotes(inner, '<');
      if (bracketPos !== -1 && bracketPos < inner.length - 1) {
        return {
          style: 'BRACKETS',
          keyPart: inner.slice(0, bracketPos),
          valuePart: inner.slice(bracketPos + 1),
        };
      }
    }

    return null;
  }

  /**
   * Find position of separator character outside quoted sections
   */
  private findSeparatorOutsideQuotes(line: string, separator: string): number {
    let inQuotes = false;
    let escapeNext = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === separator) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Split `value` on `separator` (single- or multi-char) outside of
   * `"…"` regions, with the same quote/escape tracking as
   * `findSeparatorOutsideQuotes`. Used by the PIPES branch so a
   * quoted item like `"a||b"` is preserved as one element rather
   * than being split at the inner `||`.
   *
   * Quote-awareness gives us the only viable resolution for fuzz
   * limitation #12: `|` in a PIPES item can't be re-mapped (the
   * encoder doesn't escape it cheaply because every byte in PIPES
   * has structural meaning), so the encoder routes any `|`-bearing
   * value through QUOTED-inside-PIPES, and the split needs to look
   * past those quotes.
   */
  private splitOutsideQuotes(value: string, separator: string): string[] {
    const result: string[] = [];
    let inQuotes = false;
    let escapeNext = false;
    let buffer = '';
    let i = 0;
    while (i < value.length) {
      const char = value[i];

      if (escapeNext) {
        buffer += char;
        escapeNext = false;
        i++;
        continue;
      }
      // `\` is an escape introducer ONLY inside a quoted item. The
      // encoder doubles `\` to `\\` when wrapping a value in
      // `"..."` (`escapeStringValue`), so inside quotes the next
      // byte after `\` is part of an escape sequence (`\\`, `\"`,
      // `\n`, ...) and must not toggle quote state or trigger a
      // separator split. Outside quotes the encoder emits bytes
      // verbatim — a bare `\` is just a byte, so we treat it as
      // such (limitation #11 surfaced this: a PIPES line like
      // `key||\||false||` was mis-split as one item `\||false`
      // because the bare `\` consumed the next `|`).
      if (inQuotes && char === '\\') {
        buffer += char;
        escapeNext = true;
        i++;
        continue;
      }
      if (char === '"') {
        buffer += char;
        inQuotes = !inQuotes;
        i++;
        continue;
      }
      if (!inQuotes && value.startsWith(separator, i)) {
        result.push(buffer);
        buffer = '';
        i += separator.length;
        continue;
      }
      buffer += char;
      i++;
    }
    result.push(buffer);
    return result;
  }

  /**
   * Check if this colon is part of a colon-delimited array
   */
  private isColonArray(line: string, firstColonPos: number): boolean {
    const afterFirstColon = line.slice(firstColonPos + 1);
    return afterFirstColon.includes(':');
  }

  /**
   * Parse value according to the identified style
   */
  private parseValueForStyle(
    key: string,
    valuePart: string,
    style: string
  ): [string, unknown, string] {
    // QUOTED style: always preserve as string (quotes already stripped by analyzeLineStructure)
    if (style === 'QUOTED') {
      return [key, unescapeStringValue(valuePart), style];
    }

    // Handle quoted values in other styles
    const quotedValueMatch = valuePart.match(/^"(.*)"$/);
    if (quotedValueMatch) {
      return [key, unescapeStringValue(quotedValueMatch[1]), style];
    }

    // Handle special values for EQUALS style
    if (style === 'EQUALS') {
      if (valuePart === 'yes') return [key, true, style];
      if (valuePart === 'no') return [key, false, style];
      if (valuePart === '') return [key, '', style];
    }

    // Handle numeric conversion for specific styles
    if (style === 'COLON' || style === 'AMPERSAND') {
      const numValue = parseFloat(valuePart);
      if (!isNaN(numValue) && isFinite(numValue) && String(numValue) === valuePart) {
        return [key, numValue, style];
      }
    }

    // Default to parsing as special value
    return [key, this.parseSpecialValue(valuePart), style];
  }

  /**
   * Handle special cases that need custom parsing logic
   * Only complex patterns that can't be handled by simple separator analysis.
   *
   * Each branch destructures the result of `extractKey` locally and threads
   * the structural metadata (`wasQuoted`, `hasPrimePrefix`) into its return
   * tuple. Earlier iterations relied on closure side effects in the caller,
   * which would silently break if a branch ever called extractKey twice.
   */
  private parseSpecialCases(
    line: string,
    extractKey: (keyPart: string) => ExtractedKey
  ): [string, unknown, string, boolean, boolean] | null {
    // Parse double colon style: ::key::value::
    if (line.startsWith('::') && line.endsWith('::')) {
      const content = line.slice(2, -2);
      // Find the structural `::` separator OUTSIDE any quoted
      // region — `content.indexOf('::')` would split a quoted key
      // like `"a::b"` at the inner `::` (limitation #6 family
      // surfaced by Copilot review on PR #28).
      let separatorIndex = -1;
      {
        let inQuotes = false;
        let escapeNext = false;
        for (let i = 0; i < content.length - 1; i++) {
          const ch = content[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (ch === '\\') {
            escapeNext = true;
            continue;
          }
          if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
          }
          if (!inQuotes && ch === ':' && content[i + 1] === ':') {
            separatorIndex = i;
            break;
          }
        }
      }
      if (separatorIndex !== -1) {
        const keyPart = content.slice(0, separatorIndex);
        const valuePart = content.slice(separatorIndex + 2); // +2 to skip both colons
        const k = extractKey(keyPart);

        // Check if value is quoted. `(.*)` not `(.+)` so the empty
        // quoted form `""` is recognised as an empty string rather
        // than parsed as the literal 2-char value `""`.
        const quotedValueMatch = valuePart.match(/^"(.*)"$/);
        if (quotedValueMatch) {
          return [
            k.key,
            unescapeStringValue(quotedValueMatch[1]),
            'DOUBLE_COLON',
            k.wasQuoted,
            k.hasPrimePrefix,
          ];
        }
        return [
          k.key,
          this.parseSpecialValue(valuePart),
          'DOUBLE_COLON',
          k.wasQuoted,
          k.hasPrimePrefix,
        ];
      }
    }

    // Parse fake comment style: //key//value
    if (line.startsWith('//')) {
      const content = line.slice(2);
      const separatorPos = this.findSeparatorOutsideQuotes(content, '/');
      if (separatorPos !== -1 && content.slice(separatorPos).startsWith('//')) {
        const keyPart = content.slice(0, separatorPos);
        const valuePart = content.slice(separatorPos + 2);
        const k = extractKey(keyPart);

        const quotedValueMatch = valuePart.match(/^"(.*)"$/);
        if (quotedValueMatch) {
          return [
            k.key,
            unescapeStringValue(quotedValueMatch[1]),
            'FAKE_COMMENT',
            k.wasQuoted,
            k.hasPrimePrefix,
          ];
        }
        return [
          k.key,
          this.parseSpecialValue(valuePart),
          'FAKE_COMMENT',
          k.wasQuoted,
          k.hasPrimePrefix,
        ];
      }
    }

    // Parse at sandwich style: @key@value@
    if (line.startsWith('@') && line.endsWith('@')) {
      const content = line.slice(1, -1);
      const separatorPos = this.findSeparatorOutsideQuotes(content, '@');
      if (separatorPos !== -1) {
        const keyPart = content.slice(0, separatorPos);
        const valuePart = content.slice(separatorPos + 1);
        const k = extractKey(keyPart);

        // `(.*)` so the empty quoted form `""` is recognised.
        const quotedValueMatch = valuePart.match(/^"(.*)"$/);
        if (quotedValueMatch) {
          return [
            k.key,
            unescapeStringValue(quotedValueMatch[1]),
            'AT_SANDWICH',
            k.wasQuoted,
            k.hasPrimePrefix,
          ];
        }
        return [
          k.key,
          this.parseSpecialValue(valuePart),
          'AT_SANDWICH',
          k.wasQuoted,
          k.hasPrimePrefix,
        ];
      }
    }

    // Parse underscore style: _key_value_. The shape is structurally
    // ambiguous with any other KEY_VALUE syntax whose key and value
    // both happen to start/end with `_` (e.g. DOLLAR for the
    // synthetic-wrapper key `__roml_value__` with a special-value
    // payload renders as `__roml_value__$__NULL__`, which starts and
    // ends with `_`). Only claim the line as UNDERSCORE when no
    // other KEY_VALUE separator outside quotes appears anywhere in
    // the content — same precedence-by-rejection pattern as the
    // colon-array fix in #27, but checked across the full content
    // rather than only before the first `_`, because (1) the first
    // `_` in a synthetic-wrap line is at position 0 so "earlier"
    // would be vacuous, and (2) any genuine UNDERSCORE-style line
    // emitted by the encoder has only `_` as its structural
    // separator.
    if (line.startsWith('_') && line.endsWith('_')) {
      const content = line.slice(1, -1);
      const separatorPos = this.findSeparatorOutsideQuotes(content, '_');
      if (separatorPos !== -1) {
        // If any other KEY_VALUE separator appears outside quotes
        // anywhere in the content, prefer that interpretation: the
        // line is structurally another style whose key/value happen
        // to be `_`-bounded. Without this, e.g. the encoder's
        // DOLLAR output `__roml_value__$__NULL__` for a top-level
        // null gets stolen by the UNDERSCORE parser because the
        // line starts and ends with `_`.
        const otherSeparators = ['=', ':', '~', '#', '%', '$', '^', '+'];
        let hasOtherSeparator = false;
        for (const sep of otherSeparators) {
          if (this.findSeparatorOutsideQuotes(content, sep) !== -1) {
            hasOtherSeparator = true;
            break;
          }
        }
        if (!hasOtherSeparator) {
          const keyPart = content.slice(0, separatorPos);
          const valuePart = content.slice(separatorPos + 1);
          const k = extractKey(keyPart);

          // `(.*)` so the empty quoted form `""` is recognised.
          const quotedValueMatch = valuePart.match(/^"(.*)"$/);
          if (quotedValueMatch) {
            return [
              k.key,
              unescapeStringValue(quotedValueMatch[1]),
              'UNDERSCORE',
              k.wasQuoted,
              k.hasPrimePrefix,
            ];
          }
          return [
            k.key,
            this.parseSpecialValue(valuePart),
            'UNDERSCORE',
            k.wasQuoted,
            k.hasPrimePrefix,
          ];
        }
      }
    }

    // Parse multiple brackets (arrays): key<item1><item2>...
    //
    // The previous extraction used `matchAll(/<([^>]*)>/g)`, which
    // was structurally unable to represent `>` inside an item.
    // Walk the content char-by-char instead, tracking item-state
    // and quote-state so `<"a>b">` is one item rather than two
    // (limitation #9). The `\` inside a quoted item is an escape
    // introducer (mirrors `splitOutsideQuotes`).
    //
    // Use `findSeparatorOutsideQuotes` for the key/items boundary
    // — a quoted key containing `<` (e.g. `"<-"<false><null>`) has
    // its first `<` inside the quoted region, which is part of
    // the key, not a structural item-start marker.
    const multiBracketMatch = line.match(/^(.+?)(<.+>)+$/);
    if (multiBracketMatch && line.includes('><')) {
      const firstBracket = this.findSeparatorOutsideQuotes(line, '<');
      if (firstBracket <= 0) {
        // Either no `<` outside quotes, or the line starts with one
        // (no key bytes) — neither is the multi-bracket shape we
        // handle here. Fall through to other parsers.
        return null;
      }
      const k = extractKey(line.slice(0, firstBracket));
      const content = line.slice(firstBracket); // starts with `<`, ends with `>`

      const items: string[] = [];
      let buffer = '';
      let inItem = false;
      let inQuotes = false;
      let escapeNext = false;
      for (let i = 0; i < content.length; i++) {
        const c = content[i];
        if (!inItem) {
          if (c === '<') inItem = true;
          continue;
        }
        if (escapeNext) {
          buffer += c;
          escapeNext = false;
          continue;
        }
        if (inQuotes && c === '\\') {
          buffer += c;
          escapeNext = true;
          continue;
        }
        if (c === '"') {
          buffer += c;
          inQuotes = !inQuotes;
          continue;
        }
        if (!inQuotes && c === '>') {
          items.push(buffer);
          buffer = '';
          inItem = false;
          continue;
        }
        buffer += c;
      }

      const processed = items
        .filter((itemValue) => itemValue !== '') // empty brackets are arity markers
        .map((itemValue) => {
          // Check if item is quoted. `(.*)` so the empty quoted
          // form `""` is recognised as an empty string.
          const quotedMatch = itemValue.match(/^"(.*)"$/);
          if (quotedMatch) {
            return unescapeStringValue(quotedMatch[1]);
          }
          return this.parseSpecialValue(itemValue);
        });
      return [k.key, processed, 'BRACKETS', k.wasQuoted, k.hasPrimePrefix];
    }

    // Single-bracket parsing has moved to `analyzeLineStructure`'s
    // fallback so it runs after the regular separator scan — if a
    // line has both an EQUALS/COLON/etc. separator and a `<...>`
    // shape, the regular separator wins.


    // Parse pipe arrays: key||item1||item2|| (content between pipes can be empty)
    const pipeArrayMatch = line.match(/^(.+?)\|\|(.*)\|\|$/);
    if (pipeArrayMatch) {
      const k = extractKey(pipeArrayMatch[1]);
      const value = pipeArrayMatch[2];

      // Quote-aware split (limitation #12): a `|`-bearing value is
      // emitted by the encoder as `"…"` so the bytes survive the
      // round-trip; splitting plain on `||` would mis-count items
      // when an item contains `||` inside its quoted form.
      const splitItems = this.splitOutsideQuotes(value, '||');

      // Multi-item array shape — `value` carries a `||` outside
      // quotes, so the split returned more than one element.
      if (splitItems.length > 1) {
        const items = splitItems
          .filter((item) => item.trim())
          .map((item) => {
            // Check if item is quoted. `(.*)` so `""` parses as ''.
            const quotedMatch = item.match(/^"(.*)"$/);
            if (quotedMatch) {
              // Preserve quoted values as strings and unescape
              return unescapeStringValue(quotedMatch[1]);
            }
            return this.parseSpecialValue(item);
          });
        return [k.key, items, 'PIPES', k.wasQuoted, k.hasPrimePrefix];
      }

      // Single-item or empty shape (`splitItems` has exactly one
      // element, equal to `value`).

      // Empty array case: `key||||` — `value` is the empty string.
      if (value === '') {
        return [k.key, [], 'PIPES', k.wasQuoted, k.hasPrimePrefix];
      }

      // Check if single value is quoted. `(.*)` so `""` parses
      // as the empty string rather than the literal 2-char `""`.
      const quotedMatch = value.match(/^"(.*)"$/);
      const singleValue = quotedMatch
        ? unescapeStringValue(quotedMatch[1])
        : this.parseSpecialValue(value);

      // For wrapper keys, single values should still be arrays
      if (k.key === SYNTHETIC_ITEMS_KEY || k.key === SYNTHETIC_VALUE_KEY) {
        return [k.key, [singleValue], 'PIPES', k.wasQuoted, k.hasPrimePrefix];
      }

      return [k.key, singleValue, 'PIPES', k.wasQuoted, k.hasPrimePrefix];
    }

    // Parse JSON-style arrays: key["item1",7,"true",true]
    const jsonArrayMatch = line.match(/^(.+?)\[(.+)\]$/);
    if (jsonArrayMatch && jsonArrayMatch[2].includes(',') && line.endsWith(']')) {
      // Find the key/items boundary at the first `[` OUTSIDE the
      // quoted-key region. A bare lazy `.+?` finds the first `[`
      // anywhere, which mis-splits a quoted key containing `[`
      // (e.g. `"7[J"[null,""]` — the regex captures `"7` as the
      // key and `J"[null,""` as the array). Same pattern as the
      // BRACKETS key-boundary fix in this PR.
      const openIdx = this.findSeparatorOutsideQuotes(line, '[');
      if (openIdx <= 0) return null;
      const k = extractKey(line.slice(0, openIdx));
      const arrayContent = line.slice(openIdx + 1, -1);
      if (!arrayContent.includes(',')) return null;

      // Parse JSON-style array items. Track a running count of
      // consecutive `\` bytes immediately before the cursor so we
      // can decide in O(1) whether the next `"` is escaped (the
      // naïve "previous byte isn't `\`" check fails on `\\"` —
      // an escaped backslash followed by a closing quote — the
      // previous byte is `\` but it's itself part of an escape
      // pair). `bsRun` is incremented on `\` and reset to 0 on
      // every other byte; a `"` is unescaped iff `bsRun` is even.
      const items: unknown[] = [];
      let current = '';
      let inQuotes = false;
      let depth = 0;
      let bsRun = 0;

      for (let i = 0; i < arrayContent.length; i++) {
        const char = arrayContent[i];

        if (char === '"') {
          if (bsRun % 2 === 0) {
            inQuotes = !inQuotes;
          }
          current += char;
          bsRun = 0;
        } else if (char === '\\') {
          current += char;
          bsRun++;
        } else if (!inQuotes && char === '[') {
          depth++;
          current += char;
          bsRun = 0;
        } else if (!inQuotes && char === ']') {
          depth--;
          current += char;
          bsRun = 0;
        } else if (!inQuotes && char === ',' && depth === 0) {
          // End of item
          const trimmed = current.trim();
          if (trimmed) {
            items.push(this.parseJsonValue(trimmed));
          }
          current = '';
          bsRun = 0;
        } else {
          current += char;
          bsRun = 0;
        }
      }

      // Add the last item
      const trimmed = current.trim();
      if (trimmed) {
        items.push(this.parseJsonValue(trimmed));
      }

      return [k.key, items, 'JSON_STYLE', k.wasQuoted, k.hasPrimePrefix];
    }

    // Parse colon-delimited arrays: key:item1:item2:item3. Find the
    // first `:` outside any quoted region so a key like `"::"`
    // (legitimate quoted-key containing colons) isn't misread as a
    // colon-array. The "this is an array, not a scalar" disambiguator
    // is unchanged: the value-part must contain at least one more `:`.
    //
    // Additionally, only fire when no earlier KEY_VALUE separator
    // (`=`, `~`, `#`, `%`, `$`, `^`, `+`) appears outside quotes
    // before the first `:`. Otherwise an EQUALS-style string value
    // like `y=a:b:c` would be misread as a 2-item colon-array.
    const firstColonPos = this.findSeparatorOutsideQuotes(line, ':');
    const colonRemainder = firstColonPos !== -1 ? line.slice(firstColonPos + 1) : '';
    if (firstColonPos !== -1 && colonRemainder.includes(':')) {
      const earlierSeparators = ['=', '~', '#', '%', '$', '^', '+'];
      let hasEarlierSeparator = false;
      for (const sep of earlierSeparators) {
        const sepPos = this.findSeparatorOutsideQuotes(line, sep);
        if (sepPos !== -1 && sepPos < firstColonPos) {
          hasEarlierSeparator = true;
          break;
        }
      }
      if (!hasEarlierSeparator) {
        const k = extractKey(line.slice(0, firstColonPos));
        const items = colonRemainder.split(':').map((item) => {
          // Check if item is quoted (can be empty)
          const quotedMatch = item.match(/^"(.*)"$/);
          if (quotedMatch) {
            // Preserve quoted values as strings and unescape
            return unescapeStringValue(quotedMatch[1]);
          }
          return this.parseSpecialValue(item);
        });
        return [k.key, items, 'COLON_DELIM', k.wasQuoted, k.hasPrimePrefix];
      }
    }

    return null;
  }
  private parseSpecialValue(value: string): unknown {
    if (value === '__NULL__') return null;
    if (value === '__EMPTY__') return '';
    if (value === '__UNDEFINED__') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && isFinite(numValue) && String(numValue) === value) {
      return numValue;
    }

    return value;
  }

  private parseJsonValue(value: string): unknown {
    const trimmed = value.trim();

    // Handle quoted strings — JSON_STYLE items are emitted via
    // `JSON.stringify` in the encoder (see RomlConverter ~line 516),
    // which escapes `\` as `\\`, `"` as `\"`, and control chars as
    // `\n` / `\r` / `\t` / `\b` / `\f` / `\uXXXX`. `JSON.parse` is
    // the symmetric inverse. Earlier versions used a bare
    // `slice(1, -1)`, which left every JSON escape sequence intact
    // in the returned string (limitation #11). Fall back to the
    // literal slice if JSON.parse throws on pathological
    // hand-written input that isn't valid JSON.
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.slice(1, -1);
      }
    }

    // Handle special JSON values
    if (trimmed === 'null') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'undefined') return undefined;

    // Handle numbers
    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue) && isFinite(numValue) && String(numValue) === trimmed) {
      return numValue;
    }

    // Handle special ROML values
    if (trimmed === '__NULL__') return null;
    if (trimmed === '__EMPTY__') return '';
    if (trimmed === '__UNDEFINED__') return undefined;

    // Default to string for unrecognized values
    return trimmed;
  }

  private calculateDepth(line: string): number {
    let depth = 0;
    for (const char of line) {
      if (char === ' ') depth += 1;
      else if (char === '\t') depth += 2;
      else break;
    }
    return Math.floor(depth / 2); // Convert to logical depth
  }

  private getLineStartOffset(lineNumber: number): number {
    let offset = 0;
    for (let i = 0; i < lineNumber && i < this.lines.length; i++) {
      offset += this.lines[i].length + 1; // +1 for newline
    }
    return offset;
  }

  private addToken(
    type: RomlToken['type'],
    value: string,
    startOffset: number,
    lineNumber: number,
    style?: string,
    key?: string,
    parsedValue?: unknown,
    depth?: number,
    keyWasQuoted?: boolean,
    keyHasPrimePrefix?: boolean
  ): void {
    this.tokens.push({
      type,
      value,
      startOffset,
      endOffset: startOffset + value.length,
      lineNumber,
      style: style as any,
      key,
      parsedValue,
      depth,
      keyWasQuoted,
      keyHasPrimePrefix,
    });
  }
}
