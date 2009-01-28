# Source Mapping

### Background

Many tools exist today which produce compressed or modified JavaScript as their output (examples: GWT, YUI minifier, Caja). Debugging the produced JavaScript is at best irritating and at worse nearly impossible, as these tools rename variables, move code and sometimes, radically alter the structure (but not the produced semantics) of the input JavaScript. Some tools (like GWT) even produce JavaScript from a different input language entirely, further frustrating the ability for developers to follow the sources of bugs in their programs. This document proposes a new technology entitled "source mapping" which will allow these tools to produce a logical code map which debuggers (such as LavaBug) can consume to provide better and more specific information to their users.

### Overview

The source mapping techonology consists of the production of source maps, files which follow a standardized format (defined below) and contain a mapping from the generated JavaScript source files to the original input file(s). These files can be produced by any tool, and consumed by any debugger, to map from some set of input language(s) to JavaScript. The file format is designed to be a) extensible, b) easy to produce and most importantly, c) fast to consume from within JavaScript. Point c is critical for the toolside (such as LavaBug) to be successful in using this technology.

### Terminology and constructs

Section - a set of data in the source map. All sections must begin with a declaration comment and must contain the number of lines that the section fills in the metadata object. These two items form the section header. Following the section header are a number of lines of text, whose format depends on the section.

 Example:

```
n:   /\*\* some section. \*\*/ { 'count': 2 }

n+1: any data can go here,

n+2: including JS comments! /\*\* yay! \*\*/
```

Section body - The body of a section consists of N number of lines of text, where N is the count found in the metadata object. For required sections, the format of this text is well defined. For custom sections (i.e. any others), the design is left to the implementing generator and debugger.

Declaration comment - A comment declaring the beginning of a new section. Must start at character 0 on a line, and is always of the form:

```
/\*\* The section name/description goes here. \*\*/
```

Declaration comments are always single line, and are always followed by the metadata object, on the same line.

Metadata object - The metadata associated with a section is always found on the same line, right after the declaration comment. It consists of an object literal with a number of keys, of the form:

```
{ 'key1': 'data', 'key2': 3 }
```

Metadata objects are always single lined (which means all string must have newlines escaped to \\n), and always follow immediately after the declaration comment (i.e. no spaces between the comment and the object).

Keys (case sensitive):

*   count - Integer - The number of lines that the section takes (not including the header). Required.
*   All other keys MUST be namespaced

Section header - The combination of the declaration comment and metadata object. Must be evaluated as JSON when the comment is removed (i.e. sending the string to an eval would result in the metadata object being returned).

### Namespacing policy

Unless otherwise noted, all custom keys, and sections, must be namespaced. Typically, this will be done by prefixing a namespace such as "com.google.thegenerator" to the key or section name.

 Example: `{ 'com.google.mygenerator.myflag': false }`

 Example: `/** com.google.mygenerator.customsection. **/`

### Full Example

(Text in _italics_ is solely for reference and not part of the actual file)

_(1)_ /\*\* Begin source map. \*\*/ { 'version': 1 }

_(2)_ /\*\* Begin file list. \*\*/ { 'count': 2 }

\['input1.js', { 'ranges': \[10, 20, 30, 40\] }\]

\['input2.js', { 'lang': 'java' } \]

_(3)_/\*\* Begin character map. \*\*/ { 'count': 1 }

\[0,,-1,,,2,,,3\]

_(4)_/\*\* Begin mapping definitions. \*\*/ { 'count': 4 }

\[0, 1, 10\]

\[0, 2, 15\]

\[0, 4, 67\]

\[0, 6, 1\]

\[1, 1, 0, { 'originalName': 'foobar' }\]

_(5)_/\*\* Begin exception mappings. \*\*/ { 'count': 2, 'delimeter': '\\b' }

\[2, "This is a message: %1", { 'com.google.whatever.metadata': 7 }\]

\[3, "This is another message: %1"\]

_(6)_/\*\* com\_google\_mygenerator\_customsection. \*\*/{'count': 1}

My data can go here and I can put whatever I want!

### Detailed Explanation

#### Section 1: Header

Each source map begins with the source map header. This is a special declarative comment which has the text "Begin source map.". If the source map is a composite source map, then text will instead read: "Begin composite source map.".

Following the declarative comment, the metadata object contains a version key/value pair. Debuggers are expected to support at least a single major version. Minor version increases are allowed to add metadata (or extra sections), but are not allowed to remove or break existing implementations. Breaking changes must result in a major version increase.

Keys (case sensitive):

*   version - Number - The version of the source map spec to which this file was generated. Required.
*   All other keys MUST be namespaced

A composite source map can be used when independent script files, each with their own source map, are combined into a single script that is served to the client. In the combined script, other script code may be included before, after, or in between the individual script files. For example, we could wrap the script in an anonymous function by adding an extra line at the top and at the bottom. However, the individual script files must be included whole, not split up into pieces. Furthermore, a composite source map requires that the individual script files each start on their own line. Hence, we can break the combined combined script up into a sequence of contiguous regions of lines, where each region is either an individual script file (in its entirety) or additional script with no source mapping.

In a composite source map, the metadata object includes extra information:

Keys (case sensitive):

*   map\_sizes - Array of numbers - The size in characters of the source maps of each of the individual source files. Required.
*   map\_start\_lines - Array of numbers - The (zero-based) index of the line of the composite script file at which each individual script file starts. Required.
*   map\_end\_lines - Array of numbers - The (zero-based) index of the line of the composite script file just after each individual script file ends (i.e., the range is exclusive on this end). Required.

Each of these arrays contains one entry for each individual script included in the combined script. Hence, all three arrays must have the same length. Following the header line, a composite source map includes the source maps of each individual script. A composite source map parser can use the map\_sizes array to determine which characters of the file, after the initial line, are part of which script. The sum of all these sizes plus the length of the initial line must equal the total size of the file. Each individual source map that follows must be a valid non-composite source map, as defined by this specification. In particular, each includes its own header and all the other required sections.

#### Section 2: File listings

Header: /\*\* Begin file list. \*\*/ { 'count': 2 }

The second section of the source map is a listing of all the input files that were used to create the file(s) that the source map describes. Each entry represents a single input file and must be of the form:

\[ uriString, { optional metadata object }\]

*   uriString - String - The String URI pointing to the input file. Must be a resource that can be opened by a normal browser (such as a URL). If no such resource exists, then a pseudo-url can be used in its place and the metadata flag 'internalUri' must be set.
*   metadata object - The optional metadata object for this file.
    *   lang - String - The language of the input file. Standard options include: 'js', 'java'. If omitted, 'js' is assumed. - Optional
    *   internalUri - boolean - If the URI string is not a global URL, then this flag must be set to true so debuggers know to invoke a custom handler of some sort (or none at all)
    *   ranges - Array -  An array of pairs of ranges at elements N and N+1, indicating the ranges of the generated code that this file covers - Optional.
    *   All other keys MUST be namespaced

#### Section 3: Character Mappings

Header: /\*\* Begin character map. \*\*/ { 'count': 1 }

The third section of the source map is a map of a character on a given line to a mapping entry. This section is used to map from the generated code back to the original input code in an O(1) fashion. Each line of the character mappings is an array containing N entries, where N is the size of the corresponding generated line of code. For each generated line L of JavaScript, a corresponding line L + offset (where offset is the line where the character mappings begin) must exist in the source map file.

For example, line Q in the file foo.js, might look like this:

alert('hello world!')

and have a corresponding character mapping line in the source map like so:

\[0,,,,-1,1,,,,,,,,,,,,,-1\]

Looking up the character 'e', for example, in the 'alert' would mean looking at entry #2 (0-based offset) in the array, which would indicate to us the corresponding map to use.

There are three possible entry types:

*   E >= 0 - Use the map with ID E
*   E == -1 - No mapping exists for this character (i.e. compiler added code or something similar)
*   E == undefined - Use the last non-undefined entry. Should we just drop this part and always specify the mapping index? -Joseph Schorr 9/29/09 6:25 PM

#### Section 4: Mapping Definitions

Header: /\*\* Begin mapping definitions. \*\*/ { 'count': 4 }

The fourth section of the source map contains an ordered list of the mapping definitions referred to in section three by the character maps. Each mapping definition is an array consisting of the following information:

\[ file index, line number, column number,  { optional metadata object }\]

Entries:

*   file index - Integer - The index into the file listing of which file this mapping refers to.
*   line number - Integer - The line number in that file
*   column number - Integer - The column position on that line
*   Metadata object - Optional information for this mapping:
    *   originalName - String - if specified, the original name of the token, whether a variable name, member access or basic identifier.
    *   All other keys MUST be namespaced

#### Section 5: Exception Mappings

Header: /\*\* Begin exception mappings. \*\*/ { count: 2, delimeter: '\\b' }

*   delimeter - String - The delimeter to use in messages - Required

An optional (in that it can be empty with a 'count' of 0) section, which allows generators to replace strings in throw statements with shortened delimeted commands. For example, a generator might want to replace:

if (someError) {

 throw "I could not complete the " + someName + " operation because: " +

 someReason;

}

with

if (someError) {

 throw "1\\b" + someName + "\\b" + someReason;

}

This would tell the debugger to look for exception mapping #1, and replace the values %1 and %2 with the string values found.

Each exception mapping entry looks lik:

\[file index, "I could not complete the %1 operation because: %2", { optional metadata }\]

where the file index is the index into the file map above.

#### Section 6 - Onward: Custom sections

Header: /\*\* com.google.mygenerator.customsection. \*\*/{'count': 1}

All additional sections are custom and implementaiton is left to the generators and debuggers.

### Finding and using source maps

Debuggers are encouraged to allow developers to load source maps manually via their UI and/or command line. In addition to manual loading of source maps, debuggers \*must\* support the ability to find source maps (if the option is turned on) by reading in the generated JavaScript files. This can be done by looking in the generated JavaScript on the first line for a comment like so:

/\*\* @sourcemap{URL-to-the-source-map} \*\*/code begins here.

If a debugger finds such a comment, they should follow the URL, evaluate the source map found at that location (if it is valid, of course), and display the results as if the developer had opened the source map manually.

Generators are encouraged to add such declarations only in debug mode, or when visited from a subset of IP addresses.
