# ROML Format Guide

This document describes ROML (Robert's Opaque Mangling Language) encoding and decoding rules. ROML lacks a formal specification by design. This guide documents the rules for translation between ROML and JSON formats.

## Document Structure

ROML documents begin with `~ROML~` on line 1. Subsequent content follows alternating line behavior rules.

## Line Counting Rules

Lines are counted sequentially from 1. Each line counts, including:
- The `~ROML~` header (line 1)
- Key-value pairs
- Object opening braces (`key{`)
- Object closing braces (`}`)
- Array opening brackets (`key[`)
- Array closing brackets (`]`)
- Array item markers (`[0]{`, `[1]{`, etc.)
- Empty lines

Indentation does not affect line counting. A line at any indentation level counts as one line.

## Alternating Line Behavior

ROML uses different syntax styles for odd-numbered lines (1, 3, 5, ...) versus even-numbered lines (2, 4, 6, ...).

### Odd-Line Syntax Styles (Lines 1, 3, 5, ...)

1. **QUOTED**: `key="value"` - Double quotes around the value
2. **AMPERSAND**: `&key&value` - Ampersands surround both key and value
3. **BRACKETS**: `key<value>` - Angle brackets around the value
4. **PIPES**: `||key||value||` - Double pipes surround and separate key and value
5. **DOUBLE_COLON**: `::key::value::` - Double colons surround and separate key and value
6. **FAKE_COMMENT**: `//key//value` - Double slashes
7. **AT_SANDWICH**: `@key@value@` - At signs surround and separate key and value
8. **UNDERSCORE**: `_key_value_` - Underscores surround and separate key and value

### Even-Line Syntax Styles (Lines 2, 4, 6, ...)

1. **EQUALS**: `key=value` - Equals sign separator
2. **COLON**: `key:value` - Colon separator
3. **TILDE**: `key~value` - Tilde separator
4. **HASH**: `key#value` - Hash/pound sign separator
5. **PERCENT**: `key%value` - Percent sign separator
6. **DOLLAR**: `key$value` - Dollar sign separator
7. **CARET**: `key^value` - Caret separator
8. **PLUS**: `key+value` - Plus sign separator

## Syntax Selection Rules

The syntax style for each line is determined by the following priority order:

### Priority 1: Semantic Categories (Odd Lines Only)

On odd-numbered lines, if the key (case-insensitive) exactly matches one of these keywords, use the specified style:

**PERSONAL** → QUOTED style (`key="value"`)
- Keywords: `name`, `first_name`, `last_name`, `email`, `phone`, `address`, `username`

**STATUS** → BRACKETS style (`key<value>`)
- Keywords: `active`, `enabled`, `valid`, `working`, `online`, `disabled`, `inactive`

**COLLECTIONS** → PIPES style (`||key||value||`)
- Keywords: `tags`, `items`, `list`, `array`, `elements`, `values`, `data`

**TECHNICAL** → AMPERSAND style (`&key&value`)
- Keywords: `id`, `uuid`, `hash`, `checksum`, `token`, `key`, `secret`

**FINANCIAL** → FAKE_COMMENT style (`//key//value`)
- Keywords: `salary`, `price`, `cost`, `amount`, `total`, `balance`, `fee`

**TEMPORAL** → AT_SANDWICH style (`@key@value@`)
- Keywords: `date`, `time`, `created`, `updated`, `timestamp`, `expires`

### Priority 2: Value Type Rules

If no semantic category matches, apply these rules based on value type:

**Boolean Values:**
- Odd lines: Use BRACKETS style with `<true>` or `<false>`
- Even lines: Use EQUALS style with `=yes` (for true) or `=no` (for false)

**Number Values:**
- Odd lines: Use AMPERSAND style (`&key&123`)
- Even lines: Use COLON style (`key:123`)

**String Values:**
- Check if key starts with a vowel (a, e, i, o, u, case-insensitive)
- Check if value length > 10 characters

For odd lines:
- Vowel-starting key: QUOTED style (`key="value"`)
- Value length > 10: DOUBLE_COLON style (`::key::value::`)
- Otherwise: FAKE_COMMENT style (`//key//value`)

For even lines:
- Vowel-starting key: TILDE style (`key~value`)
- Value length > 10: HASH style (`key#value`)
- Otherwise: EQUALS style (`key=value`)

### Priority 3: Special Values

For null, undefined, or empty values:
- Odd lines: FAKE_COMMENT style (`//key//special`)
- Even lines: DOLLAR style (`key$special`)

### Priority 4: Fallback Algorithm

If no other rules apply, use a deterministic hash-based selection:
1. Calculate hash of the key
2. Add nesting depth and value length
3. Use modulo to select from available styles for that line type

## Special Value Encoding

- **null**: Encoded as `__NULL__`
- **empty string**: Encoded as `__EMPTY__`
- **undefined**: Encoded as `__UNDEFINED__`
- **whitespace**: Preserved exactly as-is
- **booleans on odd lines**: `<true>` or `<false>`
- **booleans on even lines**: `yes` or `no`

## Array Encoding Rules

### Primitive Arrays (strings, numbers, booleans, nulls)

Primitive arrays are encoded on a single line using one of four styles, selected via hash of the key:

1. **PIPES**: `key||item1||item2||item3||`
2. **BRACKETS**: `key<item1><item2><item3>`
3. **JSON_STYLE**: `key["item1","item2","item3"]`
4. **COLON_DELIM**: `key:item1:item2:item3`

Special values in primitive arrays:
- null → `__NULL__`
- empty string → `__EMPTY__`
- undefined → `__UNDEFINED__`

### Object Arrays

Arrays containing objects use this format:
```roml
key[
  [0]{
    field1="value1"
    field2:123
  }
  [1]{
    field1="value2"
    field2:456
  }
]
```

Each array item:
- Starts with `[index]{` on its own line
- Contains the object's key-value pairs (following alternating line rules)
- Ends with `}` on its own line

## Object Encoding Rules

Objects are encoded with:
- Opening: `key{` on its own line
- Contents: Indented by 2 spaces, following alternating line rules
- Closing: `}` on its own line at the same indentation as opening

Nested objects follow the same rules, with additional indentation.

## Decoding Rules

To decode ROML back to JSON:

1. **Identify syntax style** by pattern matching:
   - Look for delimiters and separators
   - Extract key and value based on identified pattern

2. **Decode special values**:
   - `__NULL__` → null
   - `__EMPTY__` → ""
   - `__UNDEFINED__` → undefined (or omit)
   - `yes` → true (even lines)
   - `no` → false (even lines)
   - `<true>` → true (odd lines)
   - `<false>` → false (odd lines)

3. **Parse arrays**:
   - Primitive arrays: Split by delimiter, decode special values
   - Object arrays: Parse each `[index]{...}` block recursively

4. **Parse objects**:
   - Identify `key{` opening and `}` closing
   - Recursively parse contents

5. **Handle data types**:
   - Numbers: Parse numeric strings
   - Strings: Preserve as-is (after removing style-specific delimiters)
   - Booleans: Convert from yes/no or <true>/<false>

## Complete Example

Given this JSON:
```json
{
  "name": "Robert",
  "age": 30,
  "active": true,
  "email": "robert@example.com",
  "salary": 75000,
  "created": "2024-01-01",
  "tags": ["dev", "admin"],
  "settings": {
    "theme": "dark",
    "notifications": true
  }
}
```

The ROML encoding would be:
```roml
~ROML~
name="Robert"              // Line 2 (even): semantic match overridden by even line
age:30                     // Line 3 (odd): number on odd line → ampersand
active<true>               // Line 4 (even): boolean on even line → equals with yes/no
email~robert@example.com   // Line 5 (odd): semantic personal → quoted
//salary//75000            // Line 6 (even): would normally use even style
@created@2024-01-01@       // Line 7 (odd): semantic temporal → at-sandwich
tags||dev||admin||         // Line 8 (even): array (style by hash)
settings{                  // Line 9 (odd): object opener
  theme="dark"             // Line 10 (even): nested, vowel-free → equals
  notifications=yes        // Line 11 (odd): boolean on odd → brackets
}                          // Line 12 (even): object closer
```

Note: Output depends on line counting and implementation details.

## Important Notes

1. **No formal specification exists** - This is intentional. ROML is defined by its implementation, not by a specification.

2. **Deterministic** - The same input always produces the same output.

3. **Case-insensitive keyword matching** - Semantic categories match keywords regardless of case.

4. **Exact keyword matching only** - "firstName" won't match the "name" keyword; only exact matches work.

5. **Line position matters** - The same key-value pair will use different syntax depending on which line it appears on.

6. **Indentation is visual only** - Indentation doesn't affect parsing or line counting.

The authoritative definition of ROML is its implementation, not this documentation.