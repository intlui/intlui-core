# Versioning

Project packages use Semantic Versioning. The current package version is **0.1.0-beta.1**;
the wire protocol and built-in UI profile use **0.1**. Third-party dependencies
retain their own versions. Test cases may intentionally use unsupported versions.

Protocol 0.1 includes both implicit UI and explicit language profiles. Omitting
`capabilities.profile` selects the built-in UI profile; an explicit selection must
match the profile on created blocks. Profile IDs, profile versions, package
versions and protocol versions are distinct concepts, even with the same initial
number. Do not infer compatibility from matching package numbers.

## Package releases

Record releases in CHANGELOG.md. The four public packages advance
together; update package manifests, internal dependency versions and lockfile.
Examples track the package version they demonstrate.

- Compatible fixes: patch release, for example 0.1.1.
- New features or breaking changes before 1.0: minor release, for example 0.2.0.
  Clearly mark breaking changes and provide migration instructions.
- From 1.0: compatible additions use minor; breaking changes use major.

Change the wire protocol version only when its observable contract changes.
Breaking wire changes require a new explicitly selected protocol version; never
silently reinterpret an already published version. Document accepted peers and
test rejection/migration. Package-only fixes do not bump the protocol.

Language profiles are independently identified by ID/version. A change to syntax,
meaning or runtime contracts that breaks existing documents requires a new profile
version. Compatible implementation fixes can keep the profile version. An app
must explicitly select a supported profile; never silently switch its grammar.

## Release actions

Development uses `main` with short-lived branches and checked pull requests.
There is no permanent development or release branch. Releases are explicit;
merging a change does not publish it. All four packages share one version.
Beta releases use matching `v0.1.0-beta.N` Git tags and the npm `beta` dist-tag
when npm publishing is enabled. Keep the wire protocol/profile at 0.1 unless
their contracts change. Promote to an ordinary release only by a separate
release decision; never overwrite a published beta version.

Publishing source on GitHub does not publish packages on npm. Keep `private: true`
until a separate npm release is authorized. The workspace root remains private.
Use immutable `vX.Y.Z` Git tags for releases, with changelog and validation evidence.
Never reuse a released version, force-update a release tag or publish from failing
checks. A GitHub source preview may disclose outstanding validation gaps without
claiming stable or production-ready status. No publish operation runs in CI.
