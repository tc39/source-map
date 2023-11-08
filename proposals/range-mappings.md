# Range Mappings

* Author: Tobias Koppers
* Date: November, 2023

## Motiviation

Currently mappings map locations in the source code to other locations in the source code.
This works well when trying to access a location that is defined in the SourceMap, but one looses percision when accessing locations that are not directly defined in the SourceMap.
In these cases tools usually fallback to next lower column that is actually mapped in the SourceMap.
So we are either loosing information or we need many mappings in the SourceMap to cover all possible locations.

These information problem is especially problematic when applying a SourceMap to another SourceMap.
Here we can only use locations that are specified in both SourceMaps. We have to be lucky that locations match up.

## Proposal

Add a boolean flag for each mapping to convert it into a "range mapping".
For a range mapping, tools should assume that every char that follows the mapping (until the next mapping), is mapped to the specified original location plus the offset in the generated code.
This means all chars in the generated code that is covered by the range mapping, are mapped char by char to the same range in the original code.
(Usually this only makes sense when generated and original are identical for that range)

### Example

Generated Code:

``` js
console.log("hello world");
```

Original Code:

``` js
  // Copyright 2023
  console.log("hello world");
```

With a normal mapping:

```
Source Map:
Generate Line 1 Column 0 -> Original Line 2 Column 2
```

``` js
console.log("hello world");
^       ^   ^
|       |   + maps to Original Line 2 Column 2
|       + maps to Original Line 2 Column 2
+ maps to Original Line 2 Column 2
```

With a range mapping:

```
Source Map:
Generate Line 1 Column 0 -> Original Line 2 Column 2 (range mapping)
```

``` js
console.log("hello world");
^       ^   ^
|       |   + maps to Original Line 2 Column 14
|       + maps to Original Line 2 Column 10
+ maps to Original Line 2 Column 2
```

### Encoding

To avoid a breaking change to the `mappings` field, a new field named `rangeMappings` is added.
It contains encoded data per line in the generated code.
Each line is separated by `;`.
The data contains a bit per mapping in that line.
When the bit is set, the mapping is a range mapping, otherwise it is a normal mapping.
For every 6 bits a base64 encoded char is emitted.
Zero bits can be padded or omitted, to create full base64 chars or make the encoding shorter.
When there is no bit defined for a mapping, it is assumed to be a normal mapping.

```
"rangeMappings": "AAB;;g"
```

decodes as:

```
Line 1: 0b000000 0b000000 0b000001 => the 13th mapping is a range mapping
Line 3: 0b100000 => the 6th mapping is a range mapping
```

> Note: The per line encoding is chosen to make it easier to generate SourceMap line by line.
> It also looks similar to the `mappings` field, so should allow good compression.
