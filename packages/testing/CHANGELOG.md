# @postbote/testing

## 1.0.0

### Minor Changes

- d724e9d: Initial release of @postbote/testing — consumer test kit for Postbote

  - createTestAdapter: in-memory test adapter with send recording
  - TestInbox: query API (to/from/withSubject/find), defensive copies, descriptive errors on empty/out-of-range
  - Error simulation: failNext (queue), failIf (predicate), failAlways
  - All send attempts tracked in calls[] (including errors)
  - latencyMs option for artificial delay
  - Deterministic messageIds: test-1, test-2, …
  - Vitest matchers via @postbote/testing/matchers (toHaveSentEmail, toHaveSentEmailTo, toHaveSentEmailMatching)
  - Full type augmentation for Vitest
  - 74 tests, 100 % coverage

### Patch Changes

- Updated dependencies [0be62a1]
- Updated dependencies [84c87a5]
  - @postbote/core@1.0.0
