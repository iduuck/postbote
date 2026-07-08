---
"@postbote/testing": minor
---

Initial release of @postbote/testing — consumer test kit for Postbote

- createTestAdapter: in-memory test adapter with send recording
- TestInbox: query API (to/from/withSubject/find), defensive copies, descriptive errors on empty/out-of-range
- Error simulation: failNext (queue), failIf (predicate), failAlways
- All send attempts tracked in calls[] (including errors)
- latencyMs option for artificial delay
- Deterministic messageIds: test-1, test-2, …
- Vitest matchers via @postbote/testing/matchers (toHaveSentEmail, toHaveSentEmailTo, toHaveSentEmailMatching)
- Full type augmentation for Vitest
- 74 tests, 100 % coverage
