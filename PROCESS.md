# Process to introduce new source map features

## Stage 1

- The problem is defined in an explainer document. There might already be a sketch of a solution, but it's not required. There does not need to be agreement on the direction of the solution yet.

## Stage 2

- There's a concrete set of details written out for the precise format and what it does. The details are not final and further iteration is expected.

When a proposal reaches Stage 2, experimental implementation in all areas is encouraged. There is a very high risk of incompatible changes, so they should not be exposed to production users.

## Stage 3

- There is a complete written description of the solution.
- There's at least 1 implementation (in generating tools, ideally also at other levels)
- A test suite has been started (but it might not be complete)

When a proposal reaches Stage 3, no further improvements are possible without implementing the solution and testing it in real-world scenarios. All the other types of research have already been done in the previous stages.

## Stage 4 (complete)

- 2 generators
- 2 debuggers
- 1 complete end to end workflow
- Test suite is complete

When a proposal reaches Stage 4, it is ready to land in the editor draft. There might still be editorial changes, but all the semantics are final.
