# Changelog

## 0.1.0-beta.1 — 2026-10-31

- Protocol 0.1 with streaming events, scoped identities, revisions and optional
  explicit language profiles.
- HTTP client, React chat and renderer, shared advanced components and custom
  profile adapters.
- Standalone server with authentication hooks, conversation storage, bounded
  translation and OpenAI transport.
- Vite/Node, Next.js, advanced component and custom profile examples.

This is an initial beta release. Validation evidence and known gaps
are recorded in TESTING.md and STATUS.md; no stable release is claimed.

### Release validation

- 113 package tests; chat and advanced Chrome scenarios.
- Installation of four local archives in an external Next.js consumer,
  strict TypeScript compilation and Next.js production build.
- Public-content checks, license notices and version consistency.

Browser coverage is limited to the tested Chrome scenarios. Physical dragging,
media playback, GPU behavior and a running Next production server need further
integration coverage. Provider tests are synthetic, with no live model calls.
All four packages are published to npm on the `beta` channel.
