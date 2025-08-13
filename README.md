# ROML: Robert's Opaque Mangling Language

ROML is a deliberately obfuscated markup language that transforms readable JSON into syntactically complex but deterministic output. It uses several seemingly arbitrary syntax styles within a single document, selected through content-driven rules that prioritize inscrutability and complexity over clarity.

The resulting format is intentionally difficult to read and write, but the underlying transformations are completely deterministic and reversible.

## What is ROML?

Following the style of many other serialization or document formats, ROML is both an implementation and a specification. Since no formal specification was written before implementation, ROML is chaotic and incomplete. The format uses content-driven syntax selection to create obfuscated but deterministic output.

Each ROML document begins with the `~ROML~` header, followed by data encoded using many different syntax styles. Different delimiters are required based on key characteristics, such as hard-coded semantic categories, line position, and the presence of certain characters in keys or values.

ROML alternates behavior for even or odd lines in the document. Odd-numbered lines use one set of eight syntax styles, while even-numbered lines use a different set of eight styles. Boolean values are `<true>` on odd lines and `=yes` on even lines.

Array representations vary by content type. Primitive arrays use pipe-delimited formats (`||item1||item2||`) or bracket enclosures (`<item1><item2>`), while object arrays use numbered containers (`[0]{...}`, `[1]{...}`). Object nesting uses standard brace notation.

Special values are encoded explicitly: null values become `__NULL__`, empty strings become `__EMPTY__`, and whitespace is preserved exactly.

ROML's syntax selection works deterministically based on key names, value types, line positions, semantic categorization, and nesting depth. Identical JSON input produces identical ROML output.

**No formal specification exists for ROML.** The lack of a complete specification is inspired by other serialization formats, the format is defined only through this implementation and the limited examples.

One of ROML's core principles is the deliberate absence of a formal specification!

For those needing detailed guidance on the format's encoding and decoding rules, see the [ROML Format Guide](./FORMAT.md). This guide provides a more comprehensive verbal description of the format's behavior. However, remember that the authoritative definition remains in this implementation itself, which may change over time. Semantic versioning may not be strictly followed, and the format may evolve unpredictably. Type-safety of ROML documents is not guaranteed, and the format may not be suitable for encoding complex data structures or large datasets.

## Features

- **Alternating line behavior**: Different syntax styles for odd vs even lines, creating visual rhythm
- **Content-driven syntax selection**: Sixteen syntax styles based on key characteristics and semantic categories
- **Deterministic obfuscation**: Same input always produces identical ROML output
- **Perfect round-trip conversion**: No data loss during JSON ↔ ROML transformations
- **Stateless operation**: No external dependencies or seed values required
- **Human-writable**: Complex but learnable rules for manual ROML creation
- **TypeScript implementation**: Type safety with const assertions and type guards

## Installation

```bash
npm install roml
```

## Usage

### CLI Usage

```bash
# Convert JSON to ROML
echo '{"name":"Robert","age":30}' | roml encode

# Convert ROML to JSON  
echo 'name="Robert"' | roml decode

# File conversion
cat data.json | roml encode > output.roml
cat input.roml | roml decode > output.json
```

### TypeScript API

```typescript
import { RomlFile } from 'roml';

// Convert JSON to ROML
const jsonData = { name: "Robert", age: 30, active: true };
const romlContent = RomlFile.jsonToRoml(jsonData);

// Convert ROML back to JSON
const parsedData = RomlFile.romlToJson(romlContent);

// File operations
const romlFile = RomlFile.fromJSON(jsonData);
romlFile.saveToFile('output.roml');

const loadedFile = RomlFile.fromFile('output.roml');
const roundTripResult = loadedFile.testRoundTrip();
```

## Syntax Examples

ROML uses different syntax styles based on content analysis and line position:

```roml
~ROML~
name="Robert"             // Line 1 (odd): Personal info uses quoted style
age:30                    // Line 2 (even): Numbers use colon style
active<true>              // Line 3 (odd): Booleans use bracket style
email~robert@example.com  // Line 4 (even): Vowel-starting keys use tilde style
//salary//50000           // Line 5 (odd): Financial info uses fake comment style
balance$1000              // Line 6 (even): Numbers use dollar style
@created@2024-01-15@      // Line 7 (odd): Temporal info uses at-sandwich style
tags<user><admin>         // Line 8 (even): Arrays use brackets
settings{                 // Objects span multiple lines
  theme="dark"            // Nested content follows same alternating rules
  notifications=no        // Even lines use yes/no for booleans
}
```

### Alternating Line Behavior

ROML uses different syntax styles for odd and even lines:

**Odd Lines (1, 3, 5...):**
- `name="value"` - Quoted style for personal info
- `&key&value` - Ampersand style for technical/numeric data
- `key<value>` - Bracket style for booleans
- `//key//value` - Fake comment style for financial data
- `@key@value@` - At-sandwich style for temporal data

**Even Lines (2, 4, 6...):**
- `key=value` or `key=yes/no` - Equals style for general data and booleans
- `key:value` - Colon style for numeric data
- `key~value` - Tilde style for vowel-starting keys
- `key#value` - Hash style for long strings
- `key$value` - Dollar style for special values

The same JSON structure always produces identical ROML output. The alternating pattern creates visual rhythm while maintaining deterministic conversion.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run demo
npm run demo
```

## License

Apache 2.0
