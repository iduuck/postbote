export type { AdapterSpec } from "./define-adapter.js";
export { defineAdapter, httpStatusToErrorCode } from "./define-adapter.js";
export type { ErrorCode } from "./errors.js";
export {
  isPostboteError,
  PostboteError,
  toPostboteError,
} from "./errors.js";
export {
  encodeAttachment,
  formatAddress,
  normalizeMessage,
  parseAddress,
} from "./normalize.js";
export type { Middleware, Next, SendAttempt, SendContext } from "./pipeline.js";
export type {
  PluginInputExt,
  PluginProviderNames,
  PluginSendReturn,
} from "./plugin-types.js";
export type { Postbote } from "./postbote.js";
export { createPostbote } from "./postbote.js";
export type {
  Adapter,
  AdapterName,
  Address,
  Attachment,
  EmailMessage,
  EmailMessageInput,
  PluginObject,
  PostbotePlugin,
  SendOptions,
  SendResult,
} from "./types.js";
