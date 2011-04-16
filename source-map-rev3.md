# Source Map Revision 3 Proposal

Better bidirectional mapping.

John Lenz, Google

February 11, 2011

## Document Revisions

Date | Author | Comment
--- | --- | ---
April 12, 2011 | John Lenz | Initial Revision
April 15, 2011 | John Lenz | Updates to reflect prototype

## Background

Even with the changes made with the v2 version of the format, the source map file size was limiting it usefulness.  The v3 format is based on suggestions made by podivilov@google.com

Related documents:

[Revision 2 proposal](https://docs.google.com/a/google.com/document/pub?id=1toK5DDgHdslEACv_Q4wh4Tw5r540d3nGpFSzb1jaErU)


## Revision 3 format


### General Goals



*   Reduce the overall size to improve parse time, memory consumption, and download time.
*   Support source level debugging allowing bidirectional mapping
*   Support server side stack trace deobfuscation


### Proposed format



1. `{`
2. `version : 3,`
3. `file: "out.js"`
4. `lineCount: 123,`
5. `sourceRoot : "",`
6. `sources: ["foo.js", "bar.js"],`
7. `names: ["src", "maps", "are", "fun"],`
8. `mappings: "AA,AB;;ABCDE;"`
9. `}`

Line 1: The entire file is a single JSON object

Line 2: File revision (always the first entry in the object)

Line 3: The name of the file that this source map is associated with.

Line 4: “lineCount” field a JSON number, is the number of lines of the generated source represented.

Line 5: An optional source root, useful for relocating source files on a server or removing repeated values in the “sources” entry.

Line 6: A list of sources used by the “mappings” entry.

Line 7: A list of symbol names used by the “mapping” entry.

Line 8: A string with the encoded mapping data.

The “mapping” data is broken down as follows:



*   each line is separated by a ”;”
*   each segment is separated by a “,”
*   each segment is made up of 1,4 or 5 variable length fields.

The fields in each segment are:



*   the starting column of the line in the generated output that the segment represents
*   if present, a index into the sources list
*   if present, the stating line in the source represented. Always present if there is a source field.
*   if present, the starting column of the line in the source represented.  Always present if there is a source field.
*   if present, the index into the names list associated with this index.

To save space, each field value is a[ VLQ](http://en.wikipedia.org/wiki/Variable-length_quantity) and as the difference from the previous occurrence of the field.

The VLQ is a[ Base64](http://en.wikipedia.org/wiki/Base64) value, when the most significant bit (the 6th bit) is used as the continuation bit, and the “digits” are encoded into the string least significant first, and where the least significant bit of the first digit is used as the sign bit.

Note: The values that can be represent by the VLQ Base64 encoded are limited to 32 bit quantities until some use case for larger values is presented.

Note: This encoding reduces the source map size 50% relative to the V2 format in tests performed using Google Calendar.


#### Encoding

For simplicity, the character set encoding is always UTF-8.

**Compression**

The file is allowed to be GZIP compressed.   It is not expected that in-browser consumers of the the source map will support GZIP compression directly but that they will consume an uncompressed map that may be GZIPd for transport.

**Extensions**

Additional fields may be added to the top level source map provided the fields begin with the “x\_” naming convention.  It is expected that the extensions would be classified by the project providing the extension, such as “x\_lavabug\_extradata”.    Field names outside the “x\_” namespace are reserved for future revisions.


### ~~Proposal 2 - Alternate encoding~~

~~As an alternative to Base64 encoding,  a UTF-8 based encoding scheme reduces the source map size 13% (from 3.1M to 2.7M for Google Calendar).  Using the characteristics of UTF-8 we can encode larger values in fewer bytes.~~

~~Base64 encoding values using printable ascii characters for portability, but by defining the character set encoding to be UTF-8 for the source map we can guarantee the encoding cost of characters beyond the ASCII range.~~

~~Roughly, UTF-8 encodes values in the range of 0x0000 to 0x10FFFF as a sequence of 1 to 4 bytes.  The important characteristic that we are looking for is that smaller values are encoded using fewer bytes.  UTF-8, can express valuesUnfortunately, the UTF encoding scheme are only designed to express values up to 0x10FFFF a safe limit for our purposes~~

~~However, for our purposes (encoding values in a JSON string) not every character is available, in particular, we want to avoid escaping values (quote, comma, and semicolon), and invalid UTF-8 code points.  After skipping troublesome values, and rounding down to a power of two, we can express values up to 0x8FFFF (2^19), where one bit is used as a continuation bit to represent larger values~~.

TODO: consider offsets instead of line/column data.

TODO: representation in generated file and other usage notes.

TODO: common roots for names and sources.

**Supporting incremental compiles**

To support incremental compiles, an alternate representation of a map is supported:



1. {
2. version : 3,
3. file: “app.js”,
4. sections: [
5.  { offset: {line:0, column:0}, url: “url\_for\_part1.map” }
6.  { offset: {line:100, column:10}, url: “url\_for\_part2.map” }
7. ],
8. }

It is a JSON object with three  fields: “version”, “file” and “sections”.

“sections” is an array of JSON objects that itself has two fields “offset” and “file”.  “offset” is an object with two fields, line and column, that represent the offset into  the associated file that the map found at the location specified by the “url” field represents.

The sections must be sorted and may not overlap.

**Combined Maps**

A map file may contain the map for more than one generated file, if they do these are “combined” maps.  It is simply a series of maps concatenated together and separated by a new-line character.

TODO: Here I described the existing combined map format here:  would it make more sense to make this a true JSON file with an array of maps?


### Conventions


#### While the source map format is intended to be language agnostic, it is useful to have a few language specific notes.


#### The generated source may include a line at the start of the source, with the following form:


```
//@ sourceMappingURL=<url>
```

TODO: Allow the magic comment at the end of the file?

TODO: Using a HTTP header?
