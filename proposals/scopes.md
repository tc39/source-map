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
- the type of the scope (e.g. block, function or module scope)
- whether this scope appears in the original and/or the generated source
- whether this scope is the outermost scope representing an inlined function
- the start and end locations of the scope in the generated source
- only for scopes representing an inlined function: the location of the function call (the callsite)
- only for function scopes that appear in the original source: the original name of the function
- only for scopes that appear in the original source: the scope's bindings, for each binding we add
  - the original variable name
  - a javascript expression that can be evaluated by the debugger in the corresponding generated scope to get the binding's value (if such an expression is available)

Here's a scope representing an inlined function taken from [this example](https://github.com/hbenl/tc39-proposal-scope-mapping/blob/master/test/inline-across-modules.test.ts), encoded as JSON:
```js
{
  type: 2, /* ScopeType.OTHER */
  name: null,
  start: { line: 3, column: 1 },
  end: { line: 5, column: 22 },
  callsite: { sourceIndex: 0, line: 3, column: 1 },
  isInOriginalSource: true,
  isInGeneratedSource: false,
  isOutermostInlinedScope: true,
  bindings: [
    { varname: "increment", expression: "l" },
    { varname: "f", expression: null },
  ]
}
```

### Encoding

WORK IN PROGRESS

## Questions

WORK IN PROGRESS

## Related Discussions

- [Scopes and variable shadowing](https://github.com/tc39/source-map-rfc/issues/37)
- [Include record of inlined functions](https://github.com/tc39/source-map-rfc/issues/40)
- [Improve function name mappings](https://github.com/tc39/source-map-rfc/issues/33)
- [Encode scopes and variables in source map](https://github.com/tc39/source-map-rfc/issues/2)
- [Proposal: Source Maps v4 (or v3.1): Improved post-hoc debuggability](https://github.com/tc39/source-map-rfc/issues/12)

