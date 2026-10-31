# Versioning

Project packages use Semantic Versioning. The published beta is **0.2.0-beta.1**. Wire protocols **0.1** and **0.2**
are supported; the built-in UI profile remains **0.1**. Third-party dependencies
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
Beta releases use matching `vX.Y.Z-beta.N` Git tags and the npm `beta` dist-tag
for published packages. Version 0.2 adds extensible surface semantics;
0.1 retains its original semantics. Profile versions change independently. Promote to an ordinary release only by a separate
release decision; never overwrite a published beta version.

Pushing source updates to the public GitHub repository does not publish packages
on npm. The four library packages are public; each new npm release requires
separate authorization. The workspace root and examples retain `private: true`
to prevent accidental npm publication.
Use immutable `vX.Y.Z` Git tags for releases, with changelog and validation evidence.
Never reuse a released version, force-update a release tag or publish from failing
checks. A GitHub source preview may disclose outstanding validation gaps without
claiming stable or production-ready status. Ordinary CI does not publish; the
explicitly dispatched `publish.yml` workflow publishes through npm Trusted Publishing
and then verifies a fresh installation of all four registry packages.
