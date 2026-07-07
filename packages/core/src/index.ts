export type { ErrorCode } from "./errors.js";
export {
  isPostboteError,
  PostboteError,
  toPostboteError,
} from "./errors.js";
export {
  encodeAttachment,
  normalizeMessage,
  parseAddress,
} from "./normalize.js";
export type { Middleware, Next, SendAttempt, SendContext } from "./pipeline.js";
export type { Postbote, PostboteConfig } from "./postbote.js";
export { createPostbote } from "./postbote.js";
export type {
  Adapter,
  Address,
  Attachment,
  EmailMessage,
  EmailMessageInput,
  SendOptions,
  SendResult,
} from "./types.js";
