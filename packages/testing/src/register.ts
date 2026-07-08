import { expect } from "vitest";
import {
  toHaveSentEmail,
  toHaveSentEmailMatching,
  toHaveSentEmailTo,
} from "./matchers.js";

expect.extend({
  toHaveSentEmail,
  toHaveSentEmailTo,
  toHaveSentEmailMatching,
});

declare module "vitest" {
  interface Assertion<T> {
    toHaveSentEmail(expectedCount?: number): T;
    toHaveSentEmailTo(email: string): T;
    toHaveSentEmailMatching(query: import("./matchers.js").EmailQuery): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveSentEmail(expectedCount?: number): unknown;
    toHaveSentEmailTo(email: string): unknown;
    toHaveSentEmailMatching(query: import("./matchers.js").EmailQuery): unknown;
  }
}
