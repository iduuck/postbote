# @postbote/plugin-react-email

Render a React email component to HTML and plain text before Postbote validates and sends the message.

```tsx
import { createPostbote } from "@postbote/core";
import { reactEmail } from "@postbote/plugin-react-email";

const postbote = createPostbote({ adapter, plugins: [reactEmail()] });

await postbote.send({
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Welcome",
  body: <Welcome name="Nick" />,
});
```

`body` accepts `ReactElement`, not `ReactNode`, so accidental string templates are rejected. The plugin removes `body` after rendering; adapters receive only normalized `html` and `text` fields.
When both `body` and `html` are provided, rendered `body` HTML takes precedence.

## Options

`plainText` defaults to `true`. It renders a text version unless the input already contains `text`. Set it to `false` to render HTML only.

## Type Inference

The `body` field exists only when `reactEmail()` is preserved in the plugin tuple:

```ts
const plugins = [reactEmail()] as const;
const postbote = createPostbote({ adapter, plugins });
```

A value widened to `Middleware[]` intentionally loses the input extension. Multiple input-extending plugins are combined as an intersection.

Render failures become non-retryable `INVALID_MESSAGE` errors from provider `plugin-react-email`.

## License

MIT - see [LICENSE.md](LICENSE.md).
