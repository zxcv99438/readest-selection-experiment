# Readest Windows selection experiment

This is an experimental, unofficial derivative of [Readest](https://github.com/readest/readest), based on tag **v0.12.8**, commit **3e4f82107871b7125c08b37d2a8d9139ddaf589e**. Readest and its contributors retain their upstream attribution and copyright. The original [GNU AGPL v3 license](LICENSE) is preserved; this experiment is offered under the same license. It is not an official Readest release.

## What changed

Ordinary desktop mouse selection stays native to the book iframe. The patch moves full-selection text extraction out of the held-mouse selectionchange path, skips application mousemove work in scrolling mode, and coalesces page-edge geometry checks into animation frames in paginated mode. Cached geometry is invalidated on page turns and resize; pending work is cancelled when a drag ends. Copy and the annotation toolbar still use the finalized selection after release. Instant highlighting and fixed-layout cross-document gestures keep their existing paths.

The patch is limited to useTextSelector.ts, useAutoPageTurn.ts and a regression test. It does not remove touch/toolbar delays indiscriminately. It does not implement MCP integration or ship books, annotations, profiles, migration exports, user measurements, credentials, or private configuration.

## Evidence and limits

One Windows user reported smoother dragging, including sustained smoothness after finite diagnostics stopped. Synthetic tests showed less application work. Neither proves the cause of the original visual delay. The smooth diagnostic trial also had a different application identity and WebView profile; its business hook code was unchanged from the first patched trial. Those variables have not been isolated in a human, randomized comparison.

The production frontend was tested with a debug native host. A debug Rust host does not imply a React development build, but it is not an equivalent comparison to an official release binary. No universal latency fix, clinical frame time, or regression-free guarantee is claimed. This public build configuration uses a new identity and excludes diagnostics; that configuration has not yet received human drag testing.

The v0.12.16 upstream tag was compared statically. Its selection code includes additional gesture, popup and image fixes, but still calls selection.toString through isValidSelection during ordinary mouse movement and before the desktop selectionchange early return. No identical ordinary-mouse fast path or cached page geometry was found in those compared functions. This is a bounded source comparison, not a claim that no later upstream commit or other project has an equivalent fix. The older baseline does not contain subsequent upstream fixes.

## Building on Windows

Use upstream's prerequisites and locked dependencies: Node, pnpm, Rust MSVC target, Visual Studio C++ build tools and WebView2. Do not install a second toolchain if a compatible one is already present. Fetch the exact submodule commits from .gitmodules; the source archive includes initialized build submodules and an inventory for the optional development skill submodule. The optional gstack agent skill is not used to build the reader.

From the repository root:

```powershell
pnpm install --frozen-lockfile
if (Test-Path .git) { git submodule update --init --recursive }
./experiments/windows-selection/build.ps1
```

The build is serial, exports the frontend, disables source-map upload commands, and uses an independent application identifier without deep-link schemes or installer bundles. It removes global CARGO_TARGET_DIR because the upstream Windows thumbnail sub-build otherwise can wait on its parent's target lock; the outer build receives --target-dir instead. Personal profile, source, cache and build paths are remapped in Rust compilation, and the PE symbol locator keeps only a PDB filename. Changing remap flags can invalidate a previous Rust cache and take substantial time. `-TargetDirectory` selects an existing build cache. `-SkipFrontend` is only for a verified production export matching these sources; it does not run a frontend build or certify its contents. The script does not start the application, register formats, publish, log in, or start a development server.

No executable is included at this preparation stage. Existing private trial binaries embed a diagnostic asset containing a local output path; raw-string scanning cannot certify compressed embedded assets. They must not be uploaded as this public build. Build from this clean source and audit the resulting executable and expanded embedded assets before distribution. Ship corresponding source and this build documentation with every executable.

## Validation recorded for the patch

The three patch files match the previously verified local code. Relevant tests: 139 passed. Complete Biome check: 2,368 files passed. Production frontend export passed. TypeScript passed with declaration emit disabled; ordinary noEmit inherited a vendor PDF declaration diagnostic (TS9005). The full test run did not complete, so full-suite success is not claimed. A separate PDF mock adjustment used during local validation is intentionally excluded from this focused public patch.

Manual checks still required for the public binary: dragging in horizontal/vertical writing and scrolling/paginated layouts; copy; annotation toolbar and highlight creation; and page-edge turning. Preserve user data and compare the same text, display configuration, WebView version and native build mode. Do not treat reading or highlighting as a score or evidence of mastery.
