# Scopes

* **Author**: Holger Benl
* **Date**: September, 2023
* **Prototype**: https://github.com/hbenl/tc39-proposal-scope-mapping/
* **Related**: https://github.com/tc39/source-map-rfc/blob/main/proposals/env.md, 

Discussion of this proposal is placed at [#37](https://github.com/tc39/source-map-rfc/issues/37)

## Abstract

This document describes an extension to the [source map format](https://tc39.es/source-map-spec/) for encoding scopes and bindings information to improve the debugging experience.
There is [another proposal](https://github.com/tc39/source-map-rfc/blob/main/proposals/env.md) that also trying to solve the same problem, but the proposal doesn't support variable shadowing.

## Motivation/use cases

During a debugging process, developers work a lot with source code and runtime values of different variables, properties, globals, constants, and function parameters.
Right now, source maps solve the exploring of the original sources' issue but not the exploring of the values around the original source code.

One of the solutions for this issue is to encode the source language's environment, scopes, and variables into the SourceMap file to provide debuggers with extra information about the environment.

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

WORK IN PROGRESS

## Questions

WORK IN PROGRESS

## Related Discussions

- [Scopes and variable shadowing](https://github.com/tc39/source-map-rfc/issues/37)
- [Include record of inlined functions](https://github.com/tc39/source-map-rfc/issues/40)
- [Improve function name mappings](https://github.com/tc39/source-map-rfc/issues/33)
- [Encode scopes and variables in source map](https://github.com/tc39/source-map-rfc/issues/2)
- [Proposal: Source Maps v4 (or v3.1): Improved post-hoc debuggability](https://github.com/tc39/source-map-rfc/issues/12)

