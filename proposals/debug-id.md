# Source Map Debug ID Proposal

This document presents a proposal to add globally unique build or debug IDs to
source maps and transpiled JavaScript files, making build artifacts
self-identifying.

## Background

Source maps play a crucial role in debugging minified JavaScript files by
providing a mapping between the minified code and the original source code.
However, the current source map specification lacks important properties such as
self-describing and self-identifying capabilities for both the JavaScript
artifact (the transpiled JavaScript file) as well as the source map.  This
results in a subpar user experience and numerous practical problems.  To address
these issues, we propose an extension to the source map format: the addition of
globally unique Debug IDs.

## Objective and Benefits

The primary objective of this proposal is to enhance the source map format by
introducing globally unique Debug IDs, enabling better identification and
organization of minified JavaScript files and their corresponding source maps.
This improvement will streamline the debugging process and reduce the likelihood
of errors arising from misidentification or misassociation of files.

Debug IDs (also sometimes called Build IDs) are already used in the native language
ecosystem and supported by native container formats such as PE, ELF, MachO or
WASM.

The proposed solution offers the following benefits:

1. Improved File Identification: The introduction of globally unique Debug IDs
   will make it easier to identify and associate minified JavaScript files with
   their corresponding source maps.

2. Self-Identifying Files: This specification changes source maps and minified
   JavaScript files so that they become self-identifying, eliminating the need
   for external information to work with the files.

3. Streamlined Debugging Process: The implementation of Debug IDs will simplify
   and streamline the debugging process by reducing the likelihood of errors
   resulting from misidentification or misassociation of files.

4. Standardization: The adoption of this proposal as a web standard will
   encourage a consistent and unified approach to handling source maps and
   minified JavaScript files across the industry.

5. Guaranteed bidirectionality: Today source maps do not provide the ability to
   reliably resolve back to the transpiled file they are from.  However in
   practice tools often require this as they are often leveraging the
   transpiled artifact to resolve scope information by parsing the source.

6. Symbol server support: with Debug IDs and source maps with embedded sources
   it becomes possible to support symbol server lookup from symbol servers.

## Scope

This proposal sets some specific limitations on source maps to simplify the
processing in the wider ecosystem.  Debug IDs are at present only specified to
source maps with embedded sources or where sources are categorically not
available.  The lookup for original sources from a source map identified by a
debug ID is not defined.

Additionally, this specification applies only to non-indexed source maps and
currently specifies references only for JavaScript.

## Terms

In the context of this document:

- **Source Map:** Refers to a non-indexed, standard source map.
- **Transpiled File:** Refers to a transpiled (potentially minified) JavaScript file.
- **Debug ID:** Refers to a UUID as described in this document.

## Debug IDs

Debug IDs are globally unique identifiers for build artifacts.  They are
specified to be UUIDs.  In the context of this proposal, they are represented in
hexadecimal characters.  When comparing debug IDs they must be normalized.  This
means that `85314830-023f-4cf1-a267-535f4e37bb17` and
`85314830023F4CF1A267535F4E37BB17` are equivalent but the former representation
is the canonical format.

The way a debug ID is generated is specific to the toolchain and no requirements
are placed on it.  It is however recommended to generate deterministic debug IDs
(UUID v3 or v5) so that rebuilding the same artifacts yields stable IDs.

Debug IDs are embedded in both source maps and transpiled files, allowing a
bidirectional mapping between them. The linking of source maps and transpiled
files via HTTP headers is explicitly not desired.  A file identified by a Debug
ID must have that Debug ID embedded to ensure the file is self-identifying.

### Debug IDs in Source Maps

We propose adding a `debugId` property to the source map at the top level of
the source map object.  This property should be a string value representing
the Debug ID in hexadecimal characters, preferably in the canonical UUID
format:

```json
{
  "version": 3,
  "file": "app.min.js",
  "debugId": "85314830-023f-4cf1-a267-535f4e37bb17",
  "sources": [...],
  "sourcesContent": [...],
  "mappings": "..."
}
```

### Debug IDs in JavaScript Artifacts

Transpiled JavaScript files containing a Debug ID must embed the ID near the end
of the source, ideally on the last line, in the format `//# debugId=<DEBUG_ID>`:

```javascript
//# debugId=85314830-023f-4cf1-a267-535f4e37bb17
```

If the special `//# sourceMappingURL=` comment already exists in the file, it is
recommended to place the `debugId` comment in the line above to maintain
compatibility with existing tools.  Because the last line already has meaning in
the existing specification for the `sourceMappingURL` comment, tools are
required to examine the last 5 lines to discover the Debug ID.

## JavaScript API for Debug ID Resolution

Today `error.stack` in most runtimes only returns the URLs of the files referenced
by the stack trace.  For Debug IDs to be useful, a solution would need to be added
to enable mapping of JavaScript file URLs to Debug IDs.

The strawman proposal is to add the Debug ID in two locations:

* `import.meta.debugId`: a new property that should return the debug ID as UUID
  of the current module if has one
* `System.getDebugIdForUrl(url)` looks up the debug ID for a given script file by
  URL that has already been loaded by the browser in the current context.

## Appendix A: Self-Description of Files

Unfortunately, neither transpiled JavaScript files nor source maps can be easily
identified without employing heuristics. Unlike formats like ELF binaries, they
lack a distinctive header for identification purposes. When batch processing
files, the ability to differentiate between various files is invaluable, but
this capability is not fully realized in the context of source maps or
transpiled JavaScript files. Although solving this issue is beyond the scope of
this document, addressing it would significantly aid in distinguishing different
files without relying on intricate heuristics.

Nevertheless, we recommend that tools utilize the following heuristics to
determine self-identifying JavaScript files and source maps:

* a JSON file containing a toplevel object with the keys `mapping`, `version`,
  `debugId` and `sourcesContent` should be considered to be a self-identifying
  source map.
* a UTF-8 encoded text file matching the regular expression
  `(?m)^//# debugId=([a-fA-F0-9-]{12,})$` should be considered a transpiled
  JavaScript file.

## Appendix B: Symbol Server Support

With debug IDs it becomes possible to resolve source maps and minified JavaScript
files from the server.  That way a tool such as a browser or a crash reporter could
be pointed to a S3, GCS bucket or an HTTP server that can serve up source maps and
build artifacts keyed by debug id.

The structure itself is inspired by [debuginfod](https://sourceware.org/elfutils/Debuginfod.html):

* transpiled JavaScript artifact: `<DebugIdFirstTwo>/<DebugIdRest>/js`
* source map: `<DebugIdFirstTwo>/<DebugIdRest>/sourcemap`

with the following variables:

* `DebugIdFirstTwo`: the first two characters in lowercase of the hexadecimal Debug ID
* `DebugIdRest`: the remaining characters in lowercase of the hexadecimal Debug ID without dashes

## Appendix C: Emulating Debug IDs

In the absence of browser support for loading debug IDs a transpiler can inject
some code to maintain a global dictionary of loaded JavaScript files which allows
experimentation with this concept:

```javascript
(function() {
  try {
    throw new Error();
  } catch (err) {
    let match;
    if ((match = err.stack.match(/(?:\bat |@)(.*?):\d+:\d+$/m)) !== null) {
      let ids = (globalThis.__DEBUG_IDS__ = globalThis.__DEBUG_IDS__ || {});
      ids[match[1]] = "<DEBUG_ID>";
    }
  }
})();
```

```javascript
function getDebugIdForUrl(url) {
  return __DEBUG_IDS__ && _DEBUG_IDS__[url] || undefined;
}
```

## Appendix D: Parsing Debug IDs

The following Python code shows how Debug IDs are to be extracted from
transpiled JavaScript and source map files:

```python
import re
import uuid
import json


_debug_id_re = re.compile(r'^//# debugId=(.*)')


def normalize_debug_id(id):
    try:
        return uuid.UUID(id)
    except ValueError:
        return None


def debug_id_from_transpiled_javascript(source):
    for line in source.splitlines()[::-5]:
        match = _debug_id_re.index(line)
        if match is not None:
            debug_id = normalize_debug_id(match.group(1))
            if debug_id is not None:
                return debug_id


def debug_id_from_source_map(source):
    source_map = json.loads(source)
    if "debugId" in source_map:
        return normalize_debug_id(source_map["debugId"])
```
