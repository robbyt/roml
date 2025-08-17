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

    // Process header
    if (this.lines.length > 0 && this.lines[0].trim().startsWith('~ROML~')) {
      this.addToken('HEADER', this.lines[0].trim(), 0, 0);
    }

    // Process content lines
    const contentStart = this.lines[0]?.trim().startsWith('~ROML~') ? 1 : 0;
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
        const key = objectMatch[1];
        this.addToken(
          'OBJECT_START',
          trimmedLine,
          startOffset,
          lineNumber,
          undefined,
          key,
          undefined,
          depth
        );
        i++;
        continue;
      }

      // Check for array start: key[
      const arrayMatch = trimmedLine.match(/^(.+?)\[$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        this.addToken(
          'ARRAY_START',
          trimmedLine,
          startOffset,
          lineNumber,
          undefined,
          key,
          undefined,
          depth
        );
        i++;
        continue;
      }

      // Regular key-value line - use trimStart to preserve trailing spaces
      const contentLine = line.trimStart();
      const parsed = this.parseKeyValueLine(contentLine);
      if (parsed) {
        const [key, value, style] = parsed;
        this.addToken('KEY_VALUE', contentLine, startOffset, lineNumber, style, key, value, depth);
      }

      i++;
    }
  }

  private parseKeyValueLine(line: string): [string, unknown, string] | null {
    // Helper function to extract and unescape quoted keys
    const extractKey = (keyPart: string): string => {
      const quotedKeyMatch = keyPart.match(/^"(.*)"$/);
      if (quotedKeyMatch) {
        // Unescape all special characters in key names (same as unescapeStringValue)
        return unescapeStringValue(quotedKeyMatch[1]);
      }
      return keyPart;
    };

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
      const key = extractKey(keyPart);

      // Parse the value based on the style
      return this.parseValueForStyle(key, valuePart, style);
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

    // Check for single bracket pattern: key<value>
    const bracketMatch = line.match(/^(.+?)<(.+)>$/);
    if (bracketMatch) {
      return {
        style: 'BRACKETS',
        keyPart: bracketMatch[1],
        valuePart: bracketMatch[2],
      };
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
   * Only complex patterns that can't be handled by simple separator analysis
   */
  private parseSpecialCases(
    line: string,
    extractKey: (keyPart: string) => string
  ): [string, unknown, string] | null {
    // Parse double colon style: ::key::value::
    if (line.startsWith('::') && line.endsWith('::')) {
      const content = line.slice(2, -2);
      // Find the :: separator within the content
      const separatorIndex = content.indexOf('::');
      if (separatorIndex !== -1) {
        const keyPart = content.slice(0, separatorIndex);
        const valuePart = content.slice(separatorIndex + 2); // +2 to skip both colons
        const key = extractKey(keyPart);

        // Check if value is quoted
        const quotedValueMatch = valuePart.match(/^"(.+)"$/);
        if (quotedValueMatch) {
          return [key, unescapeStringValue(quotedValueMatch[1]), 'DOUBLE_COLON'];
        }
        return [key, this.parseSpecialValue(valuePart), 'DOUBLE_COLON'];
      }
    }

    // Parse fake comment style: //key//value
    if (line.startsWith('//')) {
      const content = line.slice(2);
      const separatorPos = this.findSeparatorOutsideQuotes(content, '/');
      if (separatorPos !== -1 && content.slice(separatorPos).startsWith('//')) {
        const keyPart = content.slice(0, separatorPos);
        const valuePart = content.slice(separatorPos + 2);
        const key = extractKey(keyPart);

        const quotedValueMatch = valuePart.match(/^"(.*)"$/);
        if (quotedValueMatch) {
          return [key, unescapeStringValue(quotedValueMatch[1]), 'FAKE_COMMENT'];
        }
        return [key, this.parseSpecialValue(valuePart), 'FAKE_COMMENT'];
      }
    }

    // Parse at sandwich style: @key@value@
    if (line.startsWith('@') && line.endsWith('@')) {
      const content = line.slice(1, -1);
      const separatorPos = this.findSeparatorOutsideQuotes(content, '@');
      if (separatorPos !== -1) {
        const keyPart = content.slice(0, separatorPos);
        const valuePart = content.slice(separatorPos + 1);
        const key = extractKey(keyPart);

        const quotedValueMatch = valuePart.match(/^"(.+)"$/);
        if (quotedValueMatch) {
          return [key, unescapeStringValue(quotedValueMatch[1]), 'AT_SANDWICH'];
        }
        return [key, this.parseSpecialValue(valuePart), 'AT_SANDWICH'];
      }
    }

    // Parse underscore style: _key_value_
    if (line.startsWith('_') && line.endsWith('_')) {
      const content = line.slice(1, -1);
      const separatorPos = this.findSeparatorOutsideQuotes(content, '_');
      if (separatorPos !== -1) {
        const keyPart = content.slice(0, separatorPos);
        const valuePart = content.slice(separatorPos + 1);
        const key = extractKey(keyPart);

        const quotedValueMatch = valuePart.match(/^"(.+)"$/);
        if (quotedValueMatch) {
          return [key, unescapeStringValue(quotedValueMatch[1]), 'UNDERSCORE'];
        }
        return [key, this.parseSpecialValue(valuePart), 'UNDERSCORE'];
      }
    }

    // Parse multiple brackets (arrays): key<item1><item2>
    const multiBracketMatch = line.match(/^(.+?)(<.+>)+$/);
    if (multiBracketMatch && line.includes('><')) {
      const key = extractKey(multiBracketMatch[1]);
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
      return [key, items, 'BRACKETS'];
    }

    // Parse single bracket style: key<value>
    const bracketMatch = line.match(/^(.+?)<(.+)>$/);
    if (bracketMatch) {
      const key = extractKey(bracketMatch[1]);
      const value = this.parseSpecialValue(bracketMatch[2]);
      if (value === 'true') return [key, true, 'BRACKETS'];
      if (value === 'false') return [key, false, 'BRACKETS'];
      return [key, value, 'BRACKETS'];
    }

    // Parse pipe arrays: key||item1||item2|| (content between pipes can be empty)
    const pipeArrayMatch = line.match(/^(.+?)\|\|(.*)|\|$/);
    if (pipeArrayMatch) {
      const key = pipeArrayMatch[1];
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
        return [key, items, 'PIPES'];
      } else {
        // Handle empty array case: key||||
        if (value === '') {
          return [key, [], 'PIPES'];
        }

        // Check if single value is quoted
        const quotedMatch = value.match(/^"(.+)"$/);
        const singleValue = quotedMatch
          ? unescapeStringValue(quotedMatch[1])
          : this.parseSpecialValue(value);

        // For wrapper keys, single values should still be arrays
        if (key === '_items' || key === '_value') {
          return [key, [singleValue], 'PIPES'];
        }

        return [key, singleValue, 'PIPES'];
      }
    }

    // Parse JSON-style arrays: key["item1",7,"true",true]
    const jsonArrayMatch = line.match(/^(.+?)\[(.+)\]$/);
    if (jsonArrayMatch && jsonArrayMatch[2].includes(',')) {
      const key = jsonArrayMatch[1];
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

      return [key, items, 'JSON_STYLE'];
    }

    // Parse colon-delimited arrays: key:item1:item2:item3
    const colonArrayMatch = line.match(/^(.+?):(.+)$/);
    if (colonArrayMatch && colonArrayMatch[2].includes(':')) {
      const key = colonArrayMatch[1];
      const items = colonArrayMatch[2].split(':').map((item) => {
        // Check if item is quoted (can be empty)
        const quotedMatch = item.match(/^"(.*)"$/);
        if (quotedMatch) {
          // Preserve quoted values as strings and unescape
          return unescapeStringValue(quotedMatch[1]);
        }
        return this.parseSpecialValue(item);
      });
      return [key, items, 'COLON_DELIM'];
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
    depth?: number
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
    });
  }
}
