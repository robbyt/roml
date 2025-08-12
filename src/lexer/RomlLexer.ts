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
      const value = this.parseSpecialValue(quotedMatch[2]);
      return [quotedMatch[1], value, 'QUOTED'];
    }

    // Parse even-line equals style: key=value or key=yes/no
    const equalsMatch = line.match(/^(.+?)=(.+)$/);
    if (equalsMatch && !quotedMatch) {
      const value = equalsMatch[2];
      if (value === 'yes') return [equalsMatch[1], true, 'EQUALS'];
      if (value === 'no') return [equalsMatch[1], false, 'EQUALS'];
      return [equalsMatch[1], this.parseSpecialValue(value), 'EQUALS'];
    }

    // Parse even-line colon style: key:value
    const colonMatch = line.match(/^(.+?):(.+)$/);
    if (colonMatch && !colonMatch[2].includes(':')) {
      const value = this.parseSpecialValue(colonMatch[2]);
      const numValue = parseFloat(String(value));
      return [colonMatch[1], isNaN(numValue) ? value : numValue, 'COLON'];
    }

    // Parse even-line tilde style: key~value
    const tildeMatch = line.match(/^(.+?)~(.+)$/);
    if (tildeMatch) {
      const value = this.parseSpecialValue(tildeMatch[2]);
      return [tildeMatch[1], value, 'TILDE'];
    }

    // Parse even-line hash style: key#value
    const hashMatch = line.match(/^(.+?)#(.+)$/);
    if (hashMatch) {
      const value = this.parseSpecialValue(hashMatch[2]);
      return [hashMatch[1], value, 'HASH'];
    }

    // Parse even-line percent style: key%value
    const percentMatch = line.match(/^(.+?)%(.+)$/);
    if (percentMatch) {
      const value = this.parseSpecialValue(percentMatch[2]);
      return [percentMatch[1], value, 'PERCENT'];
    }

    // Parse even-line dollar style: key$value
    const dollarMatch = line.match(/^(.+?)\$(.+)$/);
    if (dollarMatch) {
      const value = this.parseSpecialValue(dollarMatch[2]);
      return [dollarMatch[1], value, 'DOLLAR'];
    }

    // Parse even-line caret style: key^value
    const caretMatch = line.match(/^(.+?)\^(.+)$/);
    if (caretMatch) {
      const value = this.parseSpecialValue(caretMatch[2]);
      return [caretMatch[1], value, 'CARET'];
    }

    // Parse even-line plus style: key+value
    const plusMatch = line.match(/^(.+?)\+(.+)$/);
    if (plusMatch) {
      const value = this.parseSpecialValue(plusMatch[2]);
      return [plusMatch[1], value, 'PLUS'];
    }

    // Parse ampersand style: &key&value
    const ampersandMatch = line.match(/^&(.+?)&(.+)$/);
    if (ampersandMatch) {
      const value = this.parseSpecialValue(ampersandMatch[2]);
      const numValue = parseFloat(String(value));
      return [ampersandMatch[1], isNaN(numValue) ? value : numValue, 'AMPERSAND'];
    }

    // Parse multiple brackets (arrays): key<item1><item2>
    const multiBracketMatch = line.match(/^(.+?)(<.+>)+$/);
    if (multiBracketMatch && line.includes('><')) {
      const key = multiBracketMatch[1];
      const items = [...line.matchAll(/<([^>]+)>/g)].map((match) =>
        this.parseSpecialValue(match[1])
      );
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
          .map((item) => this.parseSpecialValue(item));
        return [key, items, 'PIPES'];
      } else {
        return [key, this.parseSpecialValue(value), 'PIPES'];
      }
    }

    // Parse colon-delimited arrays: key:item1:item2:item3
    const colonArrayMatch = line.match(/^(.+?):(.+)$/);
    if (colonArrayMatch && colonArrayMatch[2].includes(':')) {
      const key = colonArrayMatch[1];
      const items = colonArrayMatch[2].split(':').map((item) => this.parseSpecialValue(item));
      return [key, items, 'COLON_DELIM'];
    }

    // Parse double colon style: ::key::value::
    const doubleColonMatch = line.match(/^::(.+?)::(.+)::$/);
    if (doubleColonMatch) {
      return [doubleColonMatch[1], this.parseSpecialValue(doubleColonMatch[2]), 'DOUBLE_COLON'];
    }

    // Parse fake comment style: //key//value
    const commentMatch = line.match(/^\/\/(.+?)\/\/(.*)$/);
    if (commentMatch) {
      const value = commentMatch[2];
      const parsedValue = this.parseSpecialValue(value);
      return [commentMatch[1], parsedValue, 'FAKE_COMMENT'];
    }

    // Parse at sandwich style: @key@value@
    const atMatch = line.match(/^@(.+?)@(.+)@$/);
    if (atMatch) {
      return [atMatch[1], this.parseSpecialValue(atMatch[2]), 'AT_SANDWICH'];
    }

    // Parse underscore style: _key_value_
    const underscoreMatch = line.match(/^_(.+?)_(.+)_$/);
    if (underscoreMatch) {
      return [underscoreMatch[1], this.parseSpecialValue(underscoreMatch[2]), 'UNDERSCORE'];
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
