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

      // Handle comment lines (including META tags)
      if (trimmedLine.startsWith('#')) {
        // Store comment lines in header token if they contain META
        if (
          trimmedLine.includes('~META~') &&
          this.tokens.length > 0 &&
          this.tokens[0].type === 'HEADER'
        ) {
          this.tokens[0].value = this.tokens[0].value + '\n' + trimmedLine;
        }
        // Skip all comment lines from tokenization
        i++;
        continue;
      }

      const depth = this.calculateDepth(line);
      const lineNumber = startLineNum + i;
      const startOffset = this.getLineStartOffset(lineNumber);

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
    // Parse quoted style: name="value"
    const quotedMatch = line.match(/^(.+?)="(.+)"$/);
    if (quotedMatch) {
      // Preserve quoted values as strings - don't convert types
      const value = quotedMatch[2];
      return [quotedMatch[1], value, 'QUOTED'];
    }

    // Parse even-line equals style: key=value or key=yes/no or key="value"
    const equalsMatch = line.match(/^(.+?)=(.+)$/);
    if (equalsMatch && !quotedMatch) {
      const value = equalsMatch[2];
      // Check if value is quoted
      const quotedValueMatch = value.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [equalsMatch[1], quotedValueMatch[1], 'EQUALS'];
      }
      if (value === 'yes') return [equalsMatch[1], true, 'EQUALS'];
      if (value === 'no') return [equalsMatch[1], false, 'EQUALS'];
      return [equalsMatch[1], this.parseSpecialValue(value), 'EQUALS'];
    }

    // Parse even-line colon style: key:value or key:"value"
    const colonMatch = line.match(/^(.+?):(.+)$/);
    if (colonMatch && !colonMatch[2].includes(':')) {
      const rawValue = colonMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [colonMatch[1], quotedValueMatch[1], 'COLON'];
      }
      const value = this.parseSpecialValue(rawValue);
      const numValue = parseFloat(String(value));
      return [colonMatch[1], isNaN(numValue) ? value : numValue, 'COLON'];
    }

    // Parse even-line tilde style: key~value or key~"value"
    const tildeMatch = line.match(/^(.+?)~(.+)$/);
    if (tildeMatch) {
      const rawValue = tildeMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [tildeMatch[1], quotedValueMatch[1], 'TILDE'];
      }
      const value = this.parseSpecialValue(rawValue);
      return [tildeMatch[1], value, 'TILDE'];
    }

    // Parse even-line hash style: key#value or key#"value"
    const hashMatch = line.match(/^(.+?)#(.+)$/);
    if (hashMatch) {
      const rawValue = hashMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [hashMatch[1], quotedValueMatch[1], 'HASH'];
      }
      const value = this.parseSpecialValue(rawValue);
      return [hashMatch[1], value, 'HASH'];
    }

    // Parse even-line percent style: key%value or key%"value"
    const percentMatch = line.match(/^(.+?)%(.+)$/);
    if (percentMatch) {
      const rawValue = percentMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [percentMatch[1], quotedValueMatch[1], 'PERCENT'];
      }
      const value = this.parseSpecialValue(rawValue);
      return [percentMatch[1], value, 'PERCENT'];
    }

    // Parse even-line dollar style: key$value or key$"value"
    const dollarMatch = line.match(/^(.+?)\$(.+)$/);
    if (dollarMatch) {
      const rawValue = dollarMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [dollarMatch[1], quotedValueMatch[1], 'DOLLAR'];
      }
      const value = this.parseSpecialValue(rawValue);
      return [dollarMatch[1], value, 'DOLLAR'];
    }

    // Parse even-line caret style: key^value or key^"value"
    const caretMatch = line.match(/^(.+?)\^(.+)$/);
    if (caretMatch) {
      const rawValue = caretMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [caretMatch[1], quotedValueMatch[1], 'CARET'];
      }
      const value = this.parseSpecialValue(rawValue);
      return [caretMatch[1], value, 'CARET'];
    }

    // Parse even-line plus style: key+value or key+"value"
    const plusMatch = line.match(/^(.+?)\+(.+)$/);
    if (plusMatch) {
      const rawValue = plusMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [plusMatch[1], quotedValueMatch[1], 'PLUS'];
      }
      const value = this.parseSpecialValue(rawValue);
      return [plusMatch[1], value, 'PLUS'];
    }

    // Parse ampersand style: &key&value or &key&"value"
    const ampersandMatch = line.match(/^&(.+?)&(.+)$/);
    if (ampersandMatch) {
      const rawValue = ampersandMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [ampersandMatch[1], quotedValueMatch[1], 'AMPERSAND'];
      }
      const value = this.parseSpecialValue(rawValue);
      const numValue = parseFloat(String(value));
      return [ampersandMatch[1], isNaN(numValue) ? value : numValue, 'AMPERSAND'];
    }

    // Parse multiple brackets (arrays): key<item1><item2>
    const multiBracketMatch = line.match(/^(.+?)(<.+>)+$/);
    if (multiBracketMatch && line.includes('><')) {
      const key = multiBracketMatch[1];
      const items = [...line.matchAll(/<([^>]+)>/g)].map((match) => {
        const itemValue = match[1];
        // Check if item is quoted
        const quotedMatch = itemValue.match(/^"(.+)"$/);
        if (quotedMatch) {
          // Preserve quoted values as strings
          return quotedMatch[1];
        }
        return this.parseSpecialValue(itemValue);
      });
      return [key, items, 'BRACKETS'];
    }

    // Parse single bracket style: key<value>
    const bracketMatch = line.match(/^(.+?)<(.+)>$/);
    if (bracketMatch) {
      const value = this.parseSpecialValue(bracketMatch[2]);
      if (value === 'true') return [bracketMatch[1], true, 'BRACKETS'];
      if (value === 'false') return [bracketMatch[1], false, 'BRACKETS'];
      return [bracketMatch[1], value, 'BRACKETS'];
    }

    // Parse pipe arrays: key||item1||item2||
    const pipeArrayMatch = line.match(/^(.+?)\|\|(.+)\|\|$/);
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
              // Preserve quoted values as strings
              return quotedMatch[1];
            }
            return this.parseSpecialValue(item);
          });
        return [key, items, 'PIPES'];
      } else {
        // Check if single value is quoted
        const quotedMatch = value.match(/^"(.+)"$/);
        if (quotedMatch) {
          return [key, quotedMatch[1], 'PIPES'];
        }
        return [key, this.parseSpecialValue(value), 'PIPES'];
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
        // Check if item is quoted
        const quotedMatch = item.match(/^"(.+)"$/);
        if (quotedMatch) {
          // Preserve quoted values as strings
          return quotedMatch[1];
        }
        return this.parseSpecialValue(item);
      });
      return [key, items, 'COLON_DELIM'];
    }

    // Parse double colon style: ::key::value:: or ::key::"value"::
    const doubleColonMatch = line.match(/^::(.+?)::(.+)::$/);
    if (doubleColonMatch) {
      const rawValue = doubleColonMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [doubleColonMatch[1], quotedValueMatch[1], 'DOUBLE_COLON'];
      }
      return [doubleColonMatch[1], this.parseSpecialValue(rawValue), 'DOUBLE_COLON'];
    }

    // Parse fake comment style: //key//value or //key//"value"
    const commentMatch = line.match(/^\/\/(.+?)\/\/(.*)$/);
    if (commentMatch) {
      const rawValue = commentMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [commentMatch[1], quotedValueMatch[1], 'FAKE_COMMENT'];
      }
      const parsedValue = this.parseSpecialValue(rawValue);
      return [commentMatch[1], parsedValue, 'FAKE_COMMENT'];
    }

    // Parse at sandwich style: @key@value@ or @key@"value"@
    const atMatch = line.match(/^@(.+?)@(.+)@$/);
    if (atMatch) {
      const rawValue = atMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [atMatch[1], quotedValueMatch[1], 'AT_SANDWICH'];
      }
      return [atMatch[1], this.parseSpecialValue(rawValue), 'AT_SANDWICH'];
    }

    // Parse underscore style: _key_value_ or _key_"value"_
    const underscoreMatch = line.match(/^_(.+?)_(.+)_$/);
    if (underscoreMatch) {
      const rawValue = underscoreMatch[2];
      // Check if value is quoted
      const quotedValueMatch = rawValue.match(/^"(.+)"$/);
      if (quotedValueMatch) {
        // Preserve quoted values as strings
        return [underscoreMatch[1], quotedValueMatch[1], 'UNDERSCORE'];
      }
      return [underscoreMatch[1], this.parseSpecialValue(rawValue), 'UNDERSCORE'];
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
