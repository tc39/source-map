# Proposal for Encoding Source-Level Environment Information Within Source Maps

Author: Nick Fitzgerald <fitzgen@mozilla.com>, Mozilla

Date: July, 2015

This work is licensed under a
[Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).

## Abstract

This document describes a proposed extension to the
[source map format](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#)
for encoding source-level environment debugging information, such as scopes and
bindings.

## Introduction

When boiled down to their essence, stepping debuggers enable users to do two
things:

1. Set breakpoints in a program's source and incrementally step through its
   execution.

2. Inspect the values of variables and function parameters when a program's
   execution is paused.

A debugging format encodes information about a program that is lost at compile
time, enabling source-level debugging of the compiled program. Source maps can
reconstruct source-level location information (filename, line, and column) which
enables (1). However, the source map format does not encode enough information
for JavaScript debuggers to solve (2).

This document describes a proposed extension to the source map format to enable
JavaScript debuggers to provide (2) for languages that use JavaScript as a
compilation target.

### Goals

1. Enabling JavaScript debuggers to rematerialize source-level scopes and
   bindings when debugging JavaScript emitted by a compiler.

2. Locating a source-level binding's JavaScript value. This encompasses
   situations where:

    * The binding was renamed in the compiled JS. For example, the binding is
      named `atom?` in the original source and renamed to `atom_question` in the
      compiled JavaScript. Or a minifier renames `getLatestFooWidget` to `aF`.

    * The binding does not have a corresponding binding in the compiled
      JavaScript. For example, the compiler inlined the binding's value after
      recognizing that the binding was never mutated.

3. Remain backwards compatible with the current source map revision 3 format.

4. Remain extensible in such a way that future additions or modifications can
   trivially remain backwards compatible with this proposal.

5. Compact data representation.

#### Non-Goals

* Custom formatting of source-level values within JavaScript debuggers beyond
  giving the debugger an arbitrary JavaScript value for a given binding. This is
  outside of the scope of this proposal.

## Syntax

This proposal adds an `"env"` property to source maps, which contains a string
of base 64 VLQ numbers. Legacy consumers and generators do not use the `"env"`
property, thus goal (3) is satisfied.

The basic syntactic unit is a "record" which has a type and a open ended set of
property/value pairs. Records are loosely inspired by DWARF's Debugging
Information Entries, but in a "source mappy" way. While the grammar below
defines known record types, known properties, and known values, it explicitly
allows for unknown record types, unknown properties, and unknown values for use
by future extensions. Thus goal (4) is satisfied.

In order to satisfy goal (5), we provide an abbreviation mechanism for records
(again, similar to DWARF). This allows for the definition of an abbreviation
that includes a record type and the set of properties. Then, when serializing a
record whose type and property set already has an abbreviation definition, the
record's type and properties can be omitted, emitting only the property
values. Additionally, a property's value is encoded relative to the last value
emitted for that property. This technique is used in encoding segments in the
`"mappings"` property of the source map format, and has proved valuable in
reducing file size.

The `"env"` property can be parsed with the following BNF-like grammar, where
`pattern*` means zero or more repetitions of `pattern`, and `[ pattern ]` means
zero or one instance of `pattern`.

    env = record*

    ; Records

    record = verbose_record
           | abbreviation_definition
           | abbreviated_record

    verbose_record = record_type
                     property_value_pair*
                     [ children ]
                     tag_record_done

    children = tag_record_children record*

    ; Abbreviations

    abbreviation_definition = tag_record_abbreviation_definition
                              abbreviation_id
                              record_type
                              property*
                              tag_record_done

    abbreviation_id = ? any single base 64 VLQ ?

    abbreviated_record = tag_record_abbreviated
                         abbreviation_id
                         value*
                         [ children ]
                         tag_record_done

    ; Record Types

    record_type = known_record_type | unknown_record_type
    known_record_type = tag_record_scope | tag_record_binding
    unknown_record_type = ? any single base 64 VLQ ?

    ; Properties

    property = known_property | unknown_property
    known_property = tag_property_type
                   | tag_property_start
                   | tag_property_end
                   | tag_property_name
                   | tag_property_value
    unknown_property = ? any single base 64 VLQ ?

    property_value_pair = property value

    ; Values

    value = known_value | unknown_value
    known_value = tag_value_type_block
                | tag_value_type_function
                | tag_value_type_local
                | tag_value_type_param
                | tag_value_type_const
    unknown_value = ? any single base 64 VLQ ?

    ; Tags. Note that these should be kept within [-15, 15] if possible, as that
    ; is the range of values that can be encoded as a base 64 VLQ with a single
    ; digit.

    tag_record_done                    = ? 0 as base 64 VLQ ?
    tag_record_scope                   = ? 1 as base 64 VLQ ?
    tag_record_binding                 = ? 2 as base 64 VLQ ?
    tag_record_children                = ? 3 as base 64 VLQ ?
    tag_record_abbreviation_definition = ? 4 as base 64 VLQ ?
    tag_record_abbreviated             = ? 5 as base 64 VLQ ?

    tag_property_type  = ? 6 as base 64 VLQ ?
    tag_property_start = ? 7 as base 64 VLQ ?
    tag_property_end   = ? 8 as base 64 VLQ ?
    tag_property_name  = ? 9 as base 64 VLQ ?
    tag_property_value = ? 10 as base 64 VLQ ?

    tag_value_type_BLOCK    = ? 11 as base 64 VLQ ?
    tag_value_type_FUNCTION = ? 12 as base 64 VLQ ?
    tag_value_type_LOCAL    = ? 13 as base 64 VLQ ?
    tag_value_type_PARAM    = ? 14 as base 64 VLQ ?
    tag_value_type_CONST    = ? 15 as base 64 VLQ ?

## Semantics

### Parsing and Validation

Note that all lists are assumed to be indexable from [0, N-1] where N is the
length of the list.

When comparing mappings, the generated line and generated column are always
compared. A mapping's other properties are ignored.

#### 1. Abstract State

##### 1.1. Global Constants

These constants are the decoded base 64 VLQ values matching the `tag_*`
productions in the grammar above.

    let RECORD_DONE                    = 0
    let RECORD_SCOPE                   = 1
    let RECORD_BINDING                 = 2
    let RECORD_CHILDREN                = 3
    let RECORD_ABBREVIATION_DEFINITION = 4
    let RECORD_ABBREVIATED             = 5

    let PROPERTY_TYPE  = 6
    let PROPERTY_START = 7
    let PROPERTY_END   = 8
    let PROPERTY_NAME  = 9
    let PROPERTY_VALUE = 10

    let VALUE_TYPE_BLOCK    = 11
    let VALUE_TYPE_FUNCTION = 12
    let VALUE_TYPE_LOCAL    = 13
    let VALUE_TYPE_PARAM    = 14
    let VALUE_TYPE_CONST    = 15

##### 1.2. Types

    type Mapping = ( GeneratedLine, GeneratedColumn, ... )

    type RecordType = RECORD_SCOPE | RECORD_BINDING | Unknown
    type Property = PROPERTY_TYPE | PROPERTY_START | PROPERTY_END
                  | PROPERTY_NAME | PROPERTY_VALUE | Unknown
    type AbbreviationDefinition = ( RecordType, List of Property )

    type ScopeStart = Mapping
    type ScopeEnd = Mapping
    type ScopeType = Integer
    type ScopeName = String | None
    type ScopeBindings = Set of Binding
    type ScopeChildScopes = Set of Scope
    type Scope = ( ScopeStart, ScopeEnd, ScopeType, ScopeName, ScopeBindings,
                   ScopeChildScopes )

    type BindingType = VALUE_TYPE_LOCAL | VALUE_TYPE_PARAM | VALUE_TYPE_CONST
                     | Unknown
    type BindingName = String
    type BindingValue = String
    type Binding = ( BindingType, BindingName, BindingValue )

    type ScopeOrBinding = Scope | Binding

##### 1.3. Globals

Let the following definitions be the abstract state used while parsing and
validation:

    let mappings = List of Mapping
    let names = List of String

    let abbreviations = Map from Integer to AbbreviationDefinition
    let siblings = Set of ScopeOrBinding

    let last_value_by_property = Map from Property to Integer

#### 2. Abstract Procedures

##### 2.1. `initialize`

Before beginning parsing and validation begins, invoke the following procedure:

    initialize():
        mappings = parse this source map's "mappings" property
        names = this source map's "names" property

        abbreviations = new empty Map
        siblings = new empty Set

##### 2.2. `fail`

The `fail` abstract procedure is called when validation fails during parsing,
and the string being parsed is not valid. The implementation must discontinue
parsing and validation.

    fail():
        exit

##### 2.3. `warn`

The `warn` abstract procedure is invoked when an unknown or unexpected record
type, property, or value is encountered. Implementations may choose to emit a
diagnostic warning, but they must not treat it as a failure in parsing or
validation and they must continue parsing and validation. This enables goal (4).

    warn():
        no operationx

##### 2.5. `save_record`

The `save_record` abstract procedure is invoked whenever a record has
successfully been parsed. The data is passed through to specializations for each
known type of record, so that it may save the parsed data for querying once
parsing and validation has completed.

    save_record(record_type, property_value_pairs, children):
        if record_type is RECORD_SCOPE:
            save_scope(property_value_pairs, children)
        else if record_type is RECORD_BINDING:
            save_binding(property_value_pairs, children)
        else:
            warn()

##### 2.6. `save_scope`

The `save_scope` abstract procedure is invoked when a scope record has been
parsed and must be validated and saved. The procedure maintains the following
invariants:

1. A scope's child scopes must always be contained within its start and end
   boundaries.
2. A scope's start and end boundaries must not overlap any of its sibling
   scopes' boundaries.
3. A scope's start boundary must not be after its end boundary.

For simplicity and clarity, the abstract `save_scope` procedure asserts these
invariants as each new scope is saved, but this naive approach leads to poor
time complexity. Implementations are free to ensure these invariants are
maintained however they see fit, as long as they reject all `"env"` strings that
break these invariants.

    save_scope(property_value_pairs, children):
        let start = None
        let end = None
        let type = Unknown
        let name = None

        for each ( property, value ) in property_value_pairs:
            if property is PROPERTY_START:
                if 0 =< value < length of mappings:
                    start = mappings[value]
            if property is PROPERTY_END:
                if 0 =< value < length of mappings:
                    end = mappings[value]
            if property is PROPERTY_TYPE:
                if value is one of { VALUE_TYPE_FUNCTION, VALUE_TYPE_BLOCK }:
                    type = value
            if property is PROPERTY_NAME:
                if 0 =< value < length of names:
                    name = names[value]

        if start is None or end is None or start is after end:
            fail()

        let child_bindings = the Set of each b in children if b is a Binding

        let child_scopes = the Set of each s in children if s is a Scope
        assert_scopes_contained(start, end, child_scopes)

        let sibling_scopes = the Set of each s in siblings if s is a Scope
        assert_non_overlapping(start, end, sibling_scopes)

        let scope = ( start, end, type, name, child_bindings, child_scopes )
        add scope to siblings

##### 2.7. `assert_scopes_contained`

The `assert_scopes_contained` abstract procedure ensures that invariant (1) from
section 2.6. is maintained.

    assert_scopes_contained(start, end, scopes):
        for each ( scope_start, scope_end, ...) in scopes:
            if scope_start is not within the inclusive range [start, end]:
                fail()
            if scope_end is not within the inclusive range [start, end]:
                fail()

##### 2.8. `assert_non_overlapping`

The `assert_non_overlapping` abstract procedure ensures that invariant (2) from
section 2.6. is maintained.

    assert_non_overlapping(start, end, scopes):
        for each ( scope_start, scope_end, ... ) in scopes:
            if start is within the inclusive range [scope_start, scope_end]:
                fail()
            if end is within the inclusive range [scope_start, scope_end]:
                fail()

##### 2.9. `save_binding`

The `save_binding` abstract procedure is invoked when a binding record has been
parsed and must be validated and saved.

    save_binding(property_value_pairs, children):
        if children is not the empty Set:
            warn()

        let type = Unknown
        let name = None
        let binding_value = None

        for each ( property, value ) in property_value_pairs:
            if property is PROPERTY_TYPE:
                if value is one of { VALUE_TYPE_CONST, VALUE_TYPE_LOCAL, VALUE_TYPE_PARAM }:
                    type = value
            if property is PROPERTY_NAME:
                if 0 =< value < length of names:
                    name = names[value]
            if property is PROPERTY_VALUE:
                if 0 =< value < length of names:
                    binding_value = names[value]

        if name is None or binding_value is None:
            fail()

        let binding = ( type, name, binding_value )
        add binding to siblings

##### 2.10. `get_value_from_relative`

To help keep the format compact and support goal (5), values are encoded
relative to the last value parsed for the current value's property. The
`get_value_from_relative` abstract procedure is used to transform relative
values into absolute values, and to bookkeep the last value seen for any given
property.

    get_value_from_relative(property, relative_value):
        let last_value = 0
        if last_value_by_property has property:
            last_value = last_value_by_property[property]
        let absolute_value = last_value + relative_value
        last_value_by_property[property] = absolute_value
        return absolute_value

#### 3. Abstract Visitor Procedures

The following abstract visitor procedures must be invoked when encountering a
given production while parsing. Collectively, they perform validation during
parsing and rematerialize the serialized environment into the abstract state.

##### 3.1. `on_unknown_record_type`

When encountering an `unknown_record_type` production during parsing, invoke the
following visitor procedure:

    on_unknown_record_type():
        warn()

##### 3.2. `on_unknown_property`

When encountering an `unknown_property` production during parsing, invoke the
following visitor procedure:

    on_unknown_property():
        warn()

##### 3.3. `on_unknown_value`

When encountering an `unknown_value` production during parsing, invoke the
following visitor procedure:

    on_unknown_value():
        warn()

##### 3.4. `on_abbreviation_definition`

When encountering an `abbreviation_definition` production during parsing, invoke
the following visitor procedure:

    on_abbreviation_definition():
        let id = parse `abbreviation_id`
        if abbreviations[id] already exists:
            fail()
        else:
            let type = parse `record_type`
            let properties = parse `property*` into a new List
            parse `tag_record_done`
            abbreviations[id] = ( type, properties )

##### 3.5. `on_abbreviated_record`

When encountering an `abbreviated_record` production during parsing, invoke the
following visitor procedure:

    on_abbreviated_record():
        let id = parse abbreviation_id
        if abbreviations does not have an entry keyed by id:
            fail()
        else:
            let Definition = abbreviations[id]
            let ( record_type, properties ) = Definition
            let pairs = new empty List

            for each property in properties:
                let relative_value = parse one `value` from `value*`
                let value = get_value_from_relative(property, relative_value)
                append ( property, value ) to pairs

            let old_siblings = siblings
            siblings = new empty Set

            parse [ children ]
            parse tag_record_done

            let children = siblings
            siblings = old_siblings

            save_record(record_type, pairs, children)

##### 3.6. `on_verbose_record`

When encountering an `verbose_record` production during parsing, invoke the
following visitor procedure:

    on_verbose_record():
        let record_type = parse record_type

        let relative_pairs = parse `property_value_pair*`n
        let pairs = the empty list
        for each (p, rv) in relative_pairs:
            append (p, get_value_from_relative(p, rv)) to pairs

        let old_siblings = siblings
        siblings = new empty Set

        parse [ children ]
        parse tag_record_done

        let children = siblings
        siblings = old_siblings

        save_record(record_type, pairs, children)

### Querying for the Scope Chain at a Generated Location

This section provides the abstract `get_scope_chain` procedure for querying for
the scope chain at a given generated location. This procedure should be
implemented by JavaScript debuggers implementing source-level inspection of
scopes and bindings. This section shows how the proposed extension accomplishes
goal (1).

The abstract `get_scope_chain` procedure assumes that the `"env"` property is
already parsed and validated, that it was found to be a valid string, and that
we have access to the abstract global state generated by parsing and validation.

The input to the abstract `get_scope_chain` procedure is the generated location
we want the scope chain for.

The returned value is the input location's scope chain as a list sorted from
enclosing to enclosed scopes.

    get_scope_chain(target_generated_location):
        let top_level_scopes = the Set of each s in siblings if s is a Scope
        recursive_get_scope_chain_helper(target_generated_location, top_level_scopes)

    recursive_get_scope_chain_helper(location, scopes):
        for each s in scopes:
            if location is within [s.start, s.end):
                let (_, _, _, _, _, new_scopes) = s
                let rest = recursive_get_scope_chain_helper(location, new_scopes)
                prepend s to rest
                return rest
        return the empty list

To enumerate all bindings in scope at a given location, enumerate the bindings
in each scope in the list returned by `get_scope_chain` and the top level
`Binding` records within the abstract global `siblings` state.

### Locating a Binding's Value

Given that a `Binding` B is either in a scope in the list returned by
`get_scope_chain` or is a top level binding, its value can be located by a
JavaScript debugger by evaluating the B's `BindingValue` string in the target
generated location's frame.

Evaluating the `BindingValue` string should not throw, and well-behaved
compilers will not generate `Binding`s such strings. JavaScript debuggers are
free to handle errors and thrown values from misbehaving `BindingValue`s in any
way they choose.

This satisfies goal (2).

## Reference Implementation

There is a reference implementation for serializing and deserializing this
source map extension in a branch of the `source-map` library:
<https://github.com/fitzgen/source-map/tree/scopes>.

Note that it uses `"x_env"` instead of `"env"`.

* Constant tag definitions:
  <https://github.com/fitzgen/source-map/blob/0c768e6/lib/source-map/tags.js>

* Serializing scopes and bindings:
  <https://github.com/fitzgen/source-map/blob/0c768e6/lib/source-map/source-map-generator.js#L565-L670>
  and
  <https://github.com/fitzgen/source-map/blob/0c768e6/lib/source-map/source-map-generator.js#L698-L755>

* Deserializing scopes and bindings:
  <https://github.com/fitzgen/source-map/blob/0c768e6/lib/source-map/source-map-consumer.js#L884-L995>

* Some initial tests:
  <https://github.com/fitzgen/source-map/blob/0c768e6/test/source-map/test-env.js>

* Here is the full commit that adds serializing and deserializing the `"env"` property:
  <https://github.com/fitzgen/source-map/commit/0c768e6>
