# ORBIT-MARKETING-OS — Braces Advisory Patch Verification

**Date:** 2026-10-04
**Verified commit:** `f9c931e3` (v1.0.0 tag at b326ba30)
**PR:** #196

## Claim

The governance exception permits ignoring GHSA-vfj7-8cjw-p6xm (braces uncontrolled resource consumption), but the patch referenced in PR #196 may not actually work.

## What I tested

1. **Patch integrity:**
   - Downloaded patch blob from GitHub (`f7b8577c6aa409a18d650762cce9bae178d30e4c9dbacf017b9fa94e46f788d1`)
   - Verified SHA256 matches governance test assertion (`f7b8577c...`)
   - Patch applies cleanly to installed braces 3.0.3

2. **Patch content:**
   - Applied via `git apply --verbose` to `node_modules/.pnpm/braces@3.0.3/node_modules/braces`
   - Files touched: `lib/compile.js`, `lib/constants.js`, `lib/expand.js`, `lib/parse.js`, `lib/stringify.js`
   - `lib/constants.js` adds `MAX_DEPTH: 100` and exports it
   - The patch adds **four** independent depth guards, not one:

     | File               | Guard                                                 | Error type    |
     | ------------------ | ----------------------------------------------------- | ------------- |
     | `lib/parse.js`     | counts `nesting` while scanning; `+ 1` in the message | `SyntaxError` |
     | `lib/expand.js`    | depth counter through expansion                       | `RangeError`  |
     | `lib/stringify.js` | depth counter through stringify                       | `RangeError`  |
     | `lib/compile.js`   | depth counter through the AST walk                    | `RangeError`  |

   - Each clamps its own limit: `Number.isFinite(opts.maxDepth) ? Math.min(MAX_DEPTH, opts.maxDepth) : MAX_DEPTH`,
     so a caller may lower the ceiling but never raise it above 100.
   - The interpolated limit is `${maxDepth}` (the effective value), not `${MAX_DEPTH}`:
     `throw new SyntaxError(\`Input depth (${nesting + 1}), exceeds max depth (${maxDepth})\`)`

3. **Behavioral testing:**
   - Built clean test tree with patched braces plus transitive deps (`fill-range`, `to-regex-range`, `is-number`)
   - **Depth 50 (under the limit):** returns the nesting preserved as a literal — the deep
     `{…a…}` payload is not a brace _expression_, so `expand` echoes it back rather than expanding
     it. The patched and unpatched trees produce identical output at depths 1, 2, 3, 5, 10, 50
     and 99, which is the actual evidence that the patch changes nothing below the limit.
   - **Depth 101 (over the limit):** `SyntaxError: Input depth (101), exceeds max depth (100)`
   - **Depth 150 and 300:** same `SyntaxError`
   - **Normal usage:** `expand('a{b,c}d')` → `["abd","acd"]`; `compile(parse('a{b,c}'))` → `a(b|c)`;
     `stringify(parse('a{b,c}'))` → `a{b,c}`
   - The error came from **`lib/parse.js`**, which is the first stage `expand` calls. The
     `RangeError` guards in `stringify`, `expand`, and `compile` were driven separately with
     hand-built deep ASTs — see below.
   - `stringify({a:1,b:2})` returns `""` — identical on unpatched and patched braces, so it is
     pre-existing behavior for a non-AST argument, not a regression from this patch.

### Each guard was executed, not just read

`expand()` calls `parse()` first, so a deep _string_ input is always stopped by
`lib/parse.js`. To reach the other three guards I hand-built ASTs deeper than the
limit and passed them in directly:

| Call                                 | Result                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| `parse` via `expand('{…101 deep…}')` | `SyntaxError: Input depth (101), exceeds max depth (100)` |
| `stringify(150-deep AST)`            | `RangeError: AST depth (101), exceeds max depth (100)`    |
| `compile(150-deep AST)`              | `RangeError: AST depth (101), exceeds max depth (100)`    |
| `stringify(99-deep AST)`             | no throw — inside the limit                               |

The `expand` guard is covered by the parse guard on this path; it was not
separately triggered, because `expand` cannot reach its own counter without first
passing `parse`.

### The clamp holds in both directions

```js
stringify(10-deep AST,  { maxDepth: 5 })    // RangeError: AST depth (6), exceeds max depth (5)
stringify(150-deep AST, { maxDepth: 9999 }) // RangeError: AST depth (101), exceeds max depth (100)
```

A caller can lower the ceiling but cannot lift it past 100, which is what keeps
`maxDepth` from being a way to re-enable the vulnerability.

4. **Dependency chain:**
   - `braces@3.0.3` reaches us transitively via `micromatch@4.0.8`
   - No direct `braces` entry in the dependency tree
   - `scripts/dependency-audit-exceptions.test.mjs` correctly asserts `braces` is not a shipped dependency

## Transitive dependency details

```bash
# Chain: packages/core (micromatch) → micromatch (braces)
$ grep -B 5 "braces:" pnpm-lock.yaml
  micromatch@4.0.8:
    dependencies:
      braces: 3.0.3
      picomatch: 2.3.2
```

The governance test's assertion that `braces` is not a shipped dependency is correct — it's not directly depended on, only transitively.

## Conclusion

**PR #196's braces patch is valid, applies cleanly, and blocks the uncontrolled resource consumption attack while preserving normal usage.**

The patch is:

- Byte-for-byte identical to the blob referenced in the governance test (SHA256 matches)
- Applied cleanly to installed braces 3.0.3 via `git apply`
- Functional: blocks depth > 100 on the `parse`, `stringify`, and `compile` paths, passes depth ≤ 100,
  and preserves the `expand`/`compile`/`stringify` API
- Minimal: 190 lines across 5 files
- Comparable to node-forge precedent (same governance pattern)

**Adopting it is safe and recommended.** It addresses GHSA-vfj7-8cjw-p6xm, which has no
upstream fix.

### What this verification does not cover

- **`lib/expand.js`'s own counter was never triggered.** `expand` parses first, so the parse
  guard always fires before the expansion walk can reach depth. Its guard is present in the
  patch and follows the same shape as the two that were executed, but it is untested here.
- **`braces`' own `test/` suite did not run.** The published tarball omits it (`devDependencies`
  are `mocha`, `ansi-colors`, `bash-path`, `gulp-format-md`), so there was no upstream suite to
  run against the patched tree.
- **Full-workspace regression was not run.** Behavior was verified against a patched copy of the
  package, not a `pnpm install` of the patched workspace. That needs a lockfile update and a
  rebuild, which the local disk cannot support: C: is at 100% (90 MB free) and D: at 99%
  (7.7 GB free). CI is where a patched install actually gets exercised.

## Governance status

- Exception in `pnpm-workspace.yaml` permits ignoring GHSA-vfj7-8cjw-p6xm
- Governance test in `scripts/dependency-audit-exceptions.test.mjs` asserts:
  - Allowlist contains exactly two entries (node-forge, braces)
  - Braces is not a shipped dependency
  - Patch path matches declared version
  - Exception expires after 2026-11-03
- The patch hash declared in the test (`f7b8577c6aa409a18d650762cce9bae178d30e4c9dbacf017b9fa94e46f788d1`) matches the real blob
- This verification confirms the patch actually works

## Verification commands

```bash
# Fetch the patch blob and confirm its integrity against the pinned hash.
cd orbit-repo
gh api "repos/ahmedsaturki/ORBIT-MARKETING-OS/git/blobs/a2a3a6bf40be785268211fe29a3c04b208617c26" \
  --jq .content | tr -d '\n' | base64 -d > .tmpv/b.patch
sha256sum .tmpv/b.patch
# => f7b8577c6aa409a18d650762cce9bae178d30e4c9dbacf017b9fa94e46f788d1

# Build a patched copy of the installed package. git init matters: without it
# `git apply --check` succeeds vacuously and prints "Skipped" for every file.
R="$PWD/node_modules/.pnpm"
cp -r "$R/braces@3.0.3/node_modules/braces" .tmpv/t
cd .tmpv/t && git init -q . && git apply ../b.patch
mkdir -p node_modules
for d in fill-range@7.1.1/node_modules/fill-range \
         to-regex-range@5.0.1/node_modules/to-regex-range \
         is-number@7.0.0/node_modules/is-number; do
  cp -r "$R/$d" node_modules/
done

# parse/expand path
node -e "
const b = require('./index.js');
console.log('depth 50:', b.expand('{'.repeat(50) + 'a' + '}'.repeat(50)));
try { b.expand('{'.repeat(101) + 'a' + '}'.repeat(101)); }
catch (e) { console.log('depth 101:', e.constructor.name + ':', e.message); }
"
# => depth 50: [ '{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{a}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}' ]
# => depth 101: SyntaxError: Input depth (101), exceeds max depth (100)

# stringify/compile path and the clamp
node -e "
const b = require('./index.js');
const mk = d => { let n = {open:true,close:true,value:'a',nodes:[]};
  for (let i=0;i<d;i++) n = {open:true,close:true,value:'',nodes:[n]}; return n; };
for (const [label, fn] of [['stringify', b.stringify], ['compile', b.compile]])
  { try { fn(mk(150)); console.log(label, '150: NO THROW'); }
    catch (e) { console.log(label, '150:', e.constructor.name + ':', e.message); } }
try { b.stringify(mk(10), {maxDepth:5}); } catch (e) { console.log('clamp down:', e.message); }
try { b.stringify(mk(150), {maxDepth:9999}); } catch (e) { console.log('clamp up:', e.message); }
"
# => stringify 150: RangeError: AST depth (101), exceeds max depth (100)
# => compile 150: RangeError: AST depth (101), exceeds max depth (100)
# => clamp down: AST depth (6), exceeds max depth (5)
# => clamp up: AST depth (101), exceeds max depth (100)
```

On Windows, remove `.tmpv` with `fs.rm(..., {recursive:true})` after unlinking any
symlink under `node_modules` first — a copied junction reports `Permission denied`
to both `rm -rf` and `cmd /c rmdir`.

Three of the four guards were executed and behaved as documented. The
`lib/expand.js` counter was not triggered, for the reason given above. The patch is
valid on the evidence collected.
