# Strict Mode

- Stage: 0
- Author: Jonathan Kuperman
- Date: June, 2024

## Objective

Introduce stricter validation for source maps with the goal of improving reliability and consistency across implementations, while maintaining backward compatibility for existing maps.

## Motivation

The current source map specification contains vague areas that lead to inconsistent implementations and unpredictable behavior across different tools and browsers. By introducing stricter validation, we can ensure data integrity, reduce ambiguities, and enhance the developer experience. This approach balances the need for improved standards with the necessity of maintaining backward compatibility for existing source maps, avoiding disruption.

## Proposal

I propose adding specific validation requirements for all parts of the source maps specification. This includes clear definitions for data types, permissible values, and required checks. However, these stricter validation rules should only be enforced if the source map is in “strict mode.” Strict mode is triggered when one of the following new features is present: `originalScopes`, `generatedRanges`, or `rangeMappings`.

### Key Validation Rules in Strict Mode

> **_NOTE:_** This needs to be filled in more

- **version**: Should be the literal number 3.
- **sources**: Must be an array. Must contain non-null strings that represent valid filenames.
- **mappings**: Must be an array. Validate the format and integrity of the mappings data.
- **names**: Must be an array. Check for non-null, unique string values.

### Implementation Approach

- Incremental Validation: Apply strict validation rules only when new features are detected, ensuring that newly created source maps meet higher standards without disrupting existing source maps.
- Backward Compatibility: Maintain current lenient validation for legacy source maps, ensuring no breakage for previously working implementations.
- Clear Specification: Provide detailed guidelines and reference implementations to support tool and browser developers in adopting these new validation standards.
