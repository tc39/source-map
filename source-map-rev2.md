# Source Map Revision 2 Proposal

Applying lessons learned to the first revision

John Lenz, Google

August 10, 2010

This document is superseded by [Revision 3](./source-map-rev3.md).

## Document Revisions

Date | Author | Comment
--- | --- | --- |
August 10, 2010 | John Lenz | Initial Revision
August 12, 2010 | John Lenz | minor corrections

## Background

The original source map format grew out of the Closure Inspector project. It was designed for one thing: make it easy for Closure Inspector to reference the original source locations and names. This led to a couple of interesting design choices that make the original source map overly large and difficult to extend. Here we propose a new format for source mapping designed to minimize the overall size while still facilitating easy look up and adding the ability to have third party extensions.

### Overview of the Revision 1 format

```
 1.  /** Begin line maps. **/{ "file":"out.js", "count": 2 }
 2.  [0,0,0,0,0,0,1,1,1,1,2]
 3.  [2,2,2,2,2,2,3,4,4,4,4,4]
 4.  /** Begin file information. **/
 5.  ["a.js", "b.js"]
 6.  ["b.js", "c.js", "d.js"]
 7.  /** Begin mapping definitions. **/
 8.  ["a.js", 1, 34]
 9.  ["a.js", 5, 2]
10.  ["b.js", 1, 3, "event"]
11.  ["c.js", 1, 4]
12.  ["d.js", 3, 78, "foo"]
```

Note: the file as a whole is not valid JSON the arrays are not part of object or an array.

Line 1: a magic comment followed by object with a "count" field.

Line 2: begins a block of text where each line represents a line in the generated output. Each character in the generated source has an entry id which is used to map back to the original source.

Line 4: a magic comment

Line 5: begins a block of text where each line represents a line in the generated output listing the original source files associated with the generated line.

Line 7: a magic comment

Line 8: begins a block where each line represent a mapping entry with starting line and column information and an optional original symbol name.

## Proposed Revision 2 format

### General Goals

*   Create a format that is parseable as a whole as standard JSON.
*   Reduce the redundancy in the format
    *   Use indexes for file name
    *   remove the "file information section"
    *   allow for a file prefix
    *   allow for gzip output
*   Allow the format to carry "ride along" data to faciliate additional use cases.

### Proposal 1 - Redundancy Reduction

```
 1. {
 2.   version: 2,
 3.   file: "out.js"
 4.   lineMaps: [
 5.     [1,,,,2,,,,2],
 6.     [2,,3,,,,,,3]
 7.   ],
 8.   sourceRoot : "",
 9.   sources: ["foo.js", "bar.js"],
10.   names: ["src", "maps", "are", "fun"],
11.   mappings: [
12.     [1, 1, 2, 4],
13.     ["gack.js" 2, 1, 2, "yack"],
14.   ],
15. }
```

Line 1: The entire file is a single JSON object

Line 2: File revision (always the first entry in the object)

Line 3: The name of the file that this source map is assocaiated with.

Line 4: "lineMaps" field a JSON array, where each entry represents a line in the generated text.

Line 5: A line entry, where each entry represents a character in the line, an empty field represents repeated value. The first entry and last entries are never a "repeating value".

Line 8: An optional source root, useful for relocating source files on a server or removing repeated values in the "sources" entry.

Line 9: A list of sources used by the "mappings" entry. ~~This list may be incomplete.~~

Line 10: A list of symbol names used by the "mapping" entry. This list may be incomplete.

Line 11: The mappings field.

Line 12: Each entry represent a block of text in the original source, and consists four fields:

*   The source file name
*   The line in the source file the text begins
*   The column in the line that the text begins
*   An optional name (from the original source) that this entry represents. This can either be an string or index into the "names" field.
*   ~~An optional object containing **namespaced** keys for compiler-specific metadata.~~

~~The mappings entry for the source file and symbol name are optionally indexes into the sources and names entries.~~

#### Encoding

The character set encoding is UTF-8.

#### Compression

The file is allowed to be GZIP compressed. It is not expected that in-browser consumers of the the source map will support GZIP compression directly but that they will consume an uncompressed map that may be GZIPd for transport.

#### Extensions

Additional fields may be added to the top level source map provided the fields begin with the "x\_" naming convention. It is expected that the extensions would be classified by the project providing the extension, such as "x\_inspector\_extradata". Field names outside the "x\_" namespace are reserved for future revisions.

#### Long Line Handling

For generated text that consist of a single very long line. It would be possible to split the line into known fix size pieces by replacing a lineMaps entry with an JSON object:

```
 1. linesMaps: [{
 2.   segment: 512,
 3.   [1,...],  // first 512 characters of the line
 4.   [2,...],  // second 512 characters of the line
 5.   // etc
 6. }],
```

#### Additional Notes

With this format the source map file size is approximately 1/4 of the size of the Revision 1 format in typical use.

### Proposal 2 - Alternate encoding

This proposal start with basic concepts as Proposal 1 but changes the lineMappings entry. The basic idea is to use a string rather than an array and to use Base64 encoding for the mapping ids and run length.

To find an value for a character, the line is decoded from the beginning of the string until a segment is found that matches character of interest (it is expected that in the normal use case, the line will be decoded once, and stored for later reference).

#### Segment description

Each segment entry in the string would have one Base64 digit encoding the length of the encoded map id and the run-length of the segment. Since the base-64 character encodes 6-bits, it is divided up:

2 bits for map id encoding size (1-4 base64 digits)

4 bits for run-length (1-16 repetitions)

The next 1-4 characters represent the map id. As mapping ids are expected to be sequential and generally clustered, the mapping ids in a given lineMappings entry are relative to the previous mapping (as a signed number) .  The first mapping id of the lineMapping is offset relative to zero.

This would change the current source maps from something like this

```
[1,1,1,2,3]
```

into:

```
"CAAAAA"
```

Given a sample like the following, which has already be optimized for repetitions as in Proposal 1, it is easy to see the space saving that would result from this scheme, as most of the ids are large and are just a few indexes away from each other:

```
[79901,79883,79902,79883,79880,79904,,79903,79905,,,,79903,79906,,,,,,,,79907,,79908,79911,79910,,,79909,79912,79909,79913,79909,79914,79909,79915,79909,79917,,79916,79918,79916,79919,,79916,79920,,,,,,,79916,79921,79916,79908]
```

##### Large ids or many repetitions

As described, the encoding imposes a limit on the size of the source as mapping ids larger than 2^24 (~8M mappings) that can be mapped source map file and limits run lengths to 16. This limit is lifted by using characters outside the base64 encoding as special markers (ascii alpha-numerics are used, as well as ‘+’ and ‘/’). A "!" is used to indicate "big" values and both the id size and the repetition get full base-64 characters (6 bits), so it would look like "!EA012aZ". For ids, the use of relative ids for the rest of the line, means that most likely, this would only be used rarely. In practice this is only used for long repetitions. Repetition of the "!" is used, so that "!!!!" means 4 digits values for id and repetition value. For repetitions this is a very acceptable trade off.

#### Example lineMapping entries

```
'ehIREhAhAhAfAiAeAjIhAhAfMiMhEhAhAeEjAiAfAiAeAbAoAYApAXEqAhAVAtAfAjAfAiAeAeAlAbAR',
'ehIrIhAhAhAfAiAeAjAdAkIhAhAfMiMhAhIeEjAdIkAhEfAiAi4fEdAn4fAfAjAdAbAqAfAiAeAkAfAiAeAdAQ',
'ehJHIhAhAhAfAiAeAjIhAi4fAfUjEj4fAfAjAdQcAoMhMhAhIeEjAdIkAhEfAiAeUjEhYhEhAVAX',
'ehJhIhAhAhAfAiAeAjAdAkMhMhAhAfEiAiAfAiAeAdEmAhAYApAXAqAWErAhAUAtMhEhAjQfAfAkAfAiAeAdEnAfAjEfAiAeAjAdAlAfAiAeAjAdARUzEhBfe',
'ehKKIhAhAhAfAiAeAjMhMhEhEhAeEjAiAfAiAeAcEnAhAXAqAWArAVEsAhATAwQfAfAkAfAjAfAiAeAeAlAbAdYpEhAH',
'ehKpIhAhAhAfAiAeAjAdAkAcAlAiAfEjAfAiAeAjAdElAfEjAfAiAeAkAfAiAeAdQmAhAfAiAeAjAdAkAcElAhAaApQfAfAkAfAiAeAdAK',
```

#### Affect on source map size

The size of the source map is reduced another 20-30% over the Proposal 1.
