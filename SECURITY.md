# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities via **GitHub Private Security Advisories** at:

https://github.com/postbote/postbote/security/advisories

Do **not** file a public issue for security vulnerabilities.

## What to include

- Affected package and version
- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact

## Response

You will receive a response within 72 hours. We will coordinate a fix and disclosure timeline.

## Scope

- All `@postbote/*` packages
- Build pipeline (npm provenance, supply chain)

Out of scope:
- API keys exposed in logs (prevented by `PostboteError.cause` — response body only, never request headers)
- Email header injection from unvalidated input (prevented by `normalizeMessage` — CRLF validation)
