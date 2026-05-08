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
 * Unescape string from ROML format - convert escape sequences back to actual characters
 */
function unescapeStringValue(value: string): string {
  return value
    .replace(/\\n/g, '\n') // Unescape newlines
    .replace(/\\r/g, '\r') // Unescape carriage returns
    .replace(/\\t/g, '\t') // Unescape tabs
    .replace(/\\"/g, '"') // Unescape quotes
    .replace(/\\\\/g, '\\'); // Unescape backslashes (must be last)
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
      // Find the :: separator within the content
      const separatorIndex = content.indexOf('::');
      if (separatorIndex !== -1) {
        const keyPart = content.slice(0, separatorIndex);
        const valuePart = content.slice(separatorIndex + 2); // +2 to skip both colons
        const k = extractKey(keyPart);

        // Check if value is quoted
        const quotedValueMatch = valuePart.match(/^"(.+)"$/);
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

        const quotedValueMatch = valuePart.match(/^"(.+)"$/);
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

    // Parse underscore style: _key_value_
    if (line.startsWith('_') && line.endsWith('_')) {
      const content = line.slice(1, -1);
      const separatorPos = this.findSeparatorOutsideQuotes(content, '_');
      if (separatorPos !== -1) {
        const keyPart = content.slice(0, separatorPos);
        const valuePart = content.slice(separatorPos + 1);
        const k = extractKey(keyPart);

        const quotedValueMatch = valuePart.match(/^"(.+)"$/);
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

    // Parse multiple brackets (arrays): key<item1><item2>
    const multiBracketMatch = line.match(/^(.+?)(<.+>)+$/);
    if (multiBracketMatch && line.includes('><')) {
      const k = extractKey(multiBracketMatch[1]);
      const items = [...line.matchAll(/<([^>]*)>/g)]
        .map((match) => match[1])
        .filter((itemValue) => itemValue !== '') // Filter out empty brackets
        .map((itemValue) => {
          // Check if item is quoted
          const quotedMatch = itemValue.match(/^"(.+)"$/);
          if (quotedMatch) {
            // Preserve quoted values as strings and unescape
            return unescapeStringValue(quotedMatch[1]);
          }
          return this.parseSpecialValue(itemValue);
        });
      return [k.key, items, 'BRACKETS', k.wasQuoted, k.hasPrimePrefix];
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
      if (value.includes('||')) {
        const items = value
          .split('||')
          .filter((item) => item.trim())
          .map((item) => {
            // Check if item is quoted
            const quotedMatch = item.match(/^"(.+)"$/);
            if (quotedMatch) {
              // Preserve quoted values as strings and unescape
              return unescapeStringValue(quotedMatch[1]);
            }
            return this.parseSpecialValue(item);
          });
        return [k.key, items, 'PIPES', k.wasQuoted, k.hasPrimePrefix];
      } else {
        // Handle empty array case: key||||
        if (value === '') {
          return [k.key, [], 'PIPES', k.wasQuoted, k.hasPrimePrefix];
        }

        // Check if single value is quoted
        const quotedMatch = value.match(/^"(.+)"$/);
        const singleValue = quotedMatch
          ? unescapeStringValue(quotedMatch[1])
          : this.parseSpecialValue(value);

        // For wrapper keys, single values should still be arrays
        if (k.key === SYNTHETIC_ITEMS_KEY || k.key === SYNTHETIC_VALUE_KEY) {
          return [k.key, [singleValue], 'PIPES', k.wasQuoted, k.hasPrimePrefix];
        }

        return [k.key, singleValue, 'PIPES', k.wasQuoted, k.hasPrimePrefix];
      }
    }

    // Parse JSON-style arrays: key["item1",7,"true",true]
    const jsonArrayMatch = line.match(/^(.+?)\[(.+)\]$/);
    if (jsonArrayMatch && jsonArrayMatch[2].includes(',')) {
      const k = extractKey(jsonArrayMatch[1]);
      const arrayContent = jsonArrayMatch[2];

      // Parse JSON-style array items
      const items: unknown[] = [];
      let current = '';
      let inQuotes = false;
      let depth = 0;

      for (let i = 0; i < arrayContent.length; i++) {
        const char = arrayContent[i];

        if (char === '"' && (i === 0 || arrayContent[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
          current += char;
        } else if (!inQuotes && char === '[') {
          depth++;
          current += char;
        } else if (!inQuotes && char === ']') {
          depth--;
          current += char;
        } else if (!inQuotes && char === ',' && depth === 0) {
          // End of item
          const trimmed = current.trim();
          if (trimmed) {
            items.push(this.parseJsonValue(trimmed));
          }
          current = '';
        } else {
          current += char;
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
    const firstColonPos = this.findSeparatorOutsideQuotes(line, ':');
    const colonRemainder = firstColonPos !== -1 ? line.slice(firstColonPos + 1) : '';
    if (firstColonPos !== -1 && colonRemainder.includes(':')) {
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

    // Handle quoted strings - preserve as strings
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1); // Remove quotes and return string
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
