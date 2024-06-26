# Proposal for adding information about scopes and their bindings to source maps

* **Author**: Holger Benl
* **Date**: September, 2023
* **Prototype**: https://github.com/hbenl/tc39-proposal-scope-mapping/
* **Related**: https://github.com/tc39/source-map-rfc/blob/main/proposals/env.md

Discussion of this proposal is placed at [#37](https://github.com/tc39/source-map-rfc/issues/37)

## Abstract

This document describes an extension to the [source map format](https://tc39.es/source-map-spec/) for encoding scopes and bindings information to improve the debugging experience.
There is [another proposal](https://github.com/tc39/source-map-rfc/blob/main/proposals/env.md) that is also trying to solve the same problem, but it includes less information about the scopes and hence doesn't support all scenarios that this proposal supports, like dealing with inlined functions or variable shadowing that was introduced by minification.

## Motivation/use cases

Currently source maps enable a debugger to map locations in the generated source to corresponding locations in the original source. This allows the debugger to let the user work with original sources when adding breakpoints and stepping through the code. However, this information is generally insufficient to reconstruct the original frames, scopes and bindings:
- when the debugger is paused in a function the was inlined, the stack doesn't contain a frame for the inlined function but the debugger should be able to reconstruct that frame
- the debugger should be able to reconstruct scopes that were removed by the compiler
- the debugger should be able to hide scopes that were added by the compiler
- when a variable was renamed in the generated source, the debugger should be able to get its original name; this is possible with the current source maps format by looking for mappings that map the declaration of a generated variable to one of an original variable and optionally using the `names` array, but this approach requires parsing the sources, is hard to implement and experience shows that it doesn't work in all situations
- the debugger should be able to reconstruct original bindings that have no corresponding variables in the generated source
- the debugger should be able to hide generated bindings that have no corresponding variables in the original source
- it should be possible to find the original function names for frames in a stack trace

#### Use cases:

1. Defining boundaries of inline functions

With the defined information about scopes and their types, it's possible to define boundaries of inline functions.
So, for the case like the next one:
```js
// Example is inspired by https://github.com/bloomberg/pasta-sourcemaps

// Before inlining
const penne     = () => { throw Error(); }
const spaghetti = () => penne();
const orzo      = () => spaghetti();
orzo();

// After inlining
throw Error()
```
With the encoded environment it becomes possible to:
- Reconstruct the stack trace with the original function names for the `Error` 
- Have `Step Over` and `Step Out` actions during the debugging for the inlined functions

2. Debugging folded or erased variables

Also, with the encoded information about variables in the original scopes debugger can reconstruct folded and erased variables and their values.
The first example is taken from the [discussion](https://github.com/tc39/source-map-rfc/issues/2#issuecomment-74966399) and it's an example of a possible way to compile Python comprehension into JS:
```python
# source code
result = [x + 1 for x in list]
```
```js
// compiled code
var result = [];
for (var i = 0; i < list.length; i++) {
    // Note: no `x` binding in this generated JS code.
    result.push(list[i] + 1);
}
```
With the encoded scopes we can include the information about the `x` binding and "map" it on the `list[i]` expression

The second example is related to code compression tools such as [terser](https://github.com/terser/terser) or [google/closure-compiler](https://github.com/google/closure-compiler).
For the next code snippet:
```js
// Before the compression
const a = 3
const b = 4
console.log(a + b)

// After the compression
console.log(7)
```
With the encoded bindings of `a` and `b` constants, it's also possible for the debugger to reconstruct and give the ability to explore folded constants.

3. Customizing representation of the internal data structures

Also, it's possible to post-process values during the debug process to show to the end user a "more eloquent" representation of different values.
One of the examples is representing new JS values in browsers that still do not support them. Imagine that the `bigint` is still not supported.
In this case, for the next code snippet:
```js
// https://github.com/GoogleChromeLabs/jsbi
const a = JSBI.BigInt(Number.MAX_SAFE_INTEGER) // JSBI [1073741823, 8388607]
```

It's possible to encode the `a` binding and put as a value an expression that converts the `JSBI [1073741823, 8388607]` into at least a string like `"BigInt(9007199254740991)"` that helps more during a debug process.

Also, such post-processing could include hiding unnecessary properties from objects.

## Detailed design

The sourcemap should include information for every scope in the generated source and every scope in the original sources that contains code which appears in the generated source.
More precisely, for every location `loc_gen` in the generated code that is mapped to `loc_orig` in the original code:
- the generated scopes described in the sourcemap which contain `loc_gen` should be exactly the scopes in the generated source which contain `loc_gen`
- the original scopes described in the sourcemap which contain `loc_gen` should be exactly
  - the scopes in the original source which contain `loc_orig` and
  - if `loc_gen` is in an inlined function, the scopes in the original source which contain the function call that was inlined

The following information describes a scope in the source map:
- whether this is a function scope
- whether bindings from outer scopes are accessible within this scope
- whether the debugger should step over this scope
- whether this scope should be shown among the original scopes
- the start and end locations of the scope in the generated source
- an optional name (the original name of the function for function scopes)
- optionally the start and end locations of the scope in the original source
- only for scopes representing an inlined function: the location of the function call (the callsite)
- the scope's bindings, for each binding we add
  - the original variable name
  - a javascript expression that can be evaluated by the debugger in the corresponding generated scope to get the binding's value (if such an expression is available)

The following code snippet specifies the scope information **conceptually** in TypeScript notation. See the [Encoding](#encoding) section
on how this information is actually VLQ encoded. We chose the name `GeneratedRange` instead of `GeneratedScope` to make it explicit that a `GeneratedRange` does not necessarily correspond to a lexical ECMAScript scope (e.g. in the case of an inlined function body).

```ts
interface SourceMap {
  // ...
  originalScopes?: OriginalScope[];
  generatedRanges?: GeneratedRange;
}

interface OriginalScope {
  start: OriginalPosition;
  end: OriginalPosition;
  kind: ScopeKind;
  /** Class/module/function name. Can be used for stack traces or naming scopes in a debugger's scope view */
  name?: string;
  /** Symbols defined in this scope */
  variables?: string[];
  children?: OriginalScope[];
}

interface GeneratedRange {
  start: GeneratedPosition;
  end: GeneratedPosition;
  isScope: boolean;
  originalScope?: OriginalScope;
  /** If this scope corresponds to an inlined function body, record the callsite of the inlined function in the original code */
  callsite?: OriginalPosition;
  /**
   * Expressions that compute the values of the variables of this OriginalScope. The length
   * of `values` must match the length of `originalScope.variables`.
   *
   * For each variable this can either be a single expression (valid for the full `GeneratedRange`),
   * or an array of `BindingRange`s, e.g. if computing the value requires different expressions
   * throughout the range or if the variable is only available in parts of the `GeneratedRange`.
   */
  bindings?: (string | undefined | BindingRange[])[];
  children?: GeneratedRange[];
}

type ScopeKind = 'global' | 'class' | 'function' | 'block';

interface BindingRange {
  from: GeneratedPosition;
  to: GeneratedPosition;
  expression?: string;
}

interface GeneratedPosition {
  line: number;
  column: number;
}

interface OriginalPosition {
  sourceIndex: number;
  line: number;
  column: number;
}
```

### Encoding

We introduce two new fields "originalScopes" and "generatedRanges" respectively:

  * "originalScopes" is an array of original scope tree descriptors (a string). Each element in the array describes the scope tree of the corresponding "sources" entry.
  * "generatedRanges" is a single generated range tree descriptor (a string) of the generated file.

Like the "mappings" field, the data in a "generated range tree descriptor" is grouped by line and lines are separated by `;`. Within a line, items are separated by `,`. A "original scope tree descriptor" is NOT grouped by line, but items are separated by `,`.

There are two different kinds of items that will appear in a "original scope descriptor": "Start Original Scope" and "End Original Scope".
There are two different kinds of items that will appear in the "generated range descriptor": "Start Generated Range" and "End Generated Range".

The kind of an item can be determined by looking at how many VLQ-encoded numbers it contains: "End" items contain one number, "Start" items contain two or more numbers.

Note: Each DATA represents one VLQ number.

#### Start Original Scope

* DATA line in the original code
  * Note: this is the point in the original code where the scope starts. `line` is relative to the `line` of the preceding "start/end original scope" item.
* DATA column in the original code
  * Note: Column is always absolute.
* DATA kind
  * Note: This is type of the scope.
  * 0x1 toplevel
  * 0x2 function
  * 0x3 class
  * 0x4 block
* DATA field flags
  * Note: binary flags that specify if a field is used for this scope.
  * Note: Unknown flags would skip the whole scope.
  * 0x1 has name
* name: (only exists if `has name` flag is set)
  * DATA offset into `names` field
  * Note: This name should be shown as function name in the stack trace for function scopes.
* variables:
  * for each variable:
    * DATA offset into `names` field for the original symbol name defined in this scope

#### End Original Scope

* DATA line in the original code
  * Note: `line` is relative to the `line` of the preceding "start/end original scope" item.
* DATA column in the original code
  * Note: Column is always absolute.

#### Start Generated Range

* DATA column in the generated code
  * Note: This is the point in generated code where the range starts. The line is the number of `;` preceding this item plus one.
  * Note: The column is relative to the column of the previous item on the same line or absolute if there is no such item.
* DATA field flags
  * Note: binary flags that specify if a field is used for this range and if the range is a scope in the generated source.
  * Note: Unknown flags would skip the whole scope.
  * 0x1 has definition
  * 0x2 has callsite
  * 0x4 is scope
* definition: (only existing if `has definition` flag is set)
  * DATA offset into `sources`
    * Note: This offset is relative to the offset of the last definition or absolute if this is the first definition
  * DATA scope offset into `originalScopes[offset]`
    * Note: This is an offset to the "Start Original Scope" item of the corresponding original scope tree. This offset is relative to the  `scope offset` of the previous definition if the definition is in the same source, otherwise it is absolute.
* callsite: (only existing if `has callsite` flag is set)
  * DATA relative offset into `sources`
  * DATA line
    * Note: This is relative to the line of the last callsite if it had the same offset into `sources` or absolute otherwise
  * DATA column
    * Note: This is relative to the start column of the last callsite if it had the same offset into `sources` and the same line or absolute otherwise
  * Note: When this field is set, it's an inlined function, called from that expression.
* bindings:
  * Note: the number of bindings must match the number of variables in the definition scope
  * for each binding:
    * Note: The value expression for the current variable either for the whole generated range (if M == 1), or for the sub-range that starts at the beginning of this generated range.
    * Note: Use -1 to indicate that the current variable is unavailable (e.g. due to shadowing) in this range.
    * DATA M either an index into `names` field (if M is >= -1), or the number of sub-ranges for the current variable in this generated range (where the expression differs on how to obtain the current variable’s value)
    * If M == -1, then
        * Do nothing.
        * Note: The variable is not accessible within this generated range.
    * Else if M >= 0, then
        * M is used as an index into `names` field
        * Note: The variable is accessible by evaluating the value expression for the entirety of this generated range.
    * Else,
      * Note: there are at least 2 sub-ranges.
      * DATA offset into `names` field or -1
        * Note: The variable is accessible using this value expression starting from the beginning of the generated range until the start of the next sub-range.
        * Note: Use -1 to indicate that the current variable is unavailable (e.g. due to shadowing) in this sub-range.
      * (M - 1) times
        * DATA line in the generated code
          * Note: The line is relative to the previous sub-range line or the start of the current generated range item if it’s the first for this loop.
        * DATA column in the generated code
          * Note: The column is relative to the column of the previous sub-range if it’s on the same line or absolute if it’s on a new line.
        * DATA offset into `names` field or -1
          * Note: The expression to obtain the current variable’s value in the sub-range that starts at line/column and ends at either the next sub-range start or this generated range’s end.
          * Note: Use -1 to indicate that the current variable is unavailable (e.g. due to shadowing) in this sub-range.

#### End Generated Range

* DATA column in the generated code `**`
  * Note: This is the point in generated code where the range ends. The line is the number of `;` preceding this item plus one.
  * Note: The column is relative to the column of the previous item on the same line or absolute if there is no such item.

### Example

Original Code (file.js):

``` js
var x = 1;
function z(message) {
  let y = 2;
  console.log(message + y);
}
z("Hello World");
```

Generated Code:

``` js
var _x = 1;
function _z(_m) {
  let _y = 2;
  console.log(_m + _y);
}
console.log("Hello World2"); // <- Inlined
```

Scopes:

```
A|    var _x = 1;
 | B| function _z(_m) {
 |  |   let _y = 2;
 |  |   console.log(_m + _y);
 |  | }
 | C| console.log("Hello World2");
```

`LX CY`: Line X Column Y

```
Start Scope C0 { // A
  field flags: has definition
  info flags:
  definition: file.js L1 C0 - L6 C17
  bindings: x -> _x, z -> _z
}
;
Start Scope C16 { // B
  field flags: has name, has definition
  info flags: function, inherit parent bindings
  name: z
  definition: file.js L2 C20 - L5 C1
  bindings: message -> _m, y -> _y
}
;
;
;
End Scope C1 // B
;
Start Scope C0 { // C
  field flags: has name, has definition, has callsite
  info flags: function, inherit parent bindings
  name: z
  definition: file.js L2 C0 - L5 C1
  callsite: file.js L6 C0
  bindings: message -> "Hello World", y -> 2
}
End Scope C28 // C
End Scope C28 // A
```

`XXXX` stands for a "Start Scope" item, `X` for an "End Scope" item
```
XXXX;XXXX;;;X;XXXX,X,X
```

## Questions

WORK IN PROGRESS

## Related Discussions

- [Scopes and variable shadowing](https://github.com/tc39/source-map-rfc/issues/37)
- [Include record of inlined functions](https://github.com/tc39/source-map-rfc/issues/40)
- [Improve function name mappings](https://github.com/tc39/source-map-rfc/issues/33)
- [Encode scopes and variables in source map](https://github.com/tc39/source-map-rfc/issues/2)
- [Proposal: Source Maps v4 (or v3.1): Improved post-hoc debuggability](https://github.com/tc39/source-map-rfc/issues/12)

