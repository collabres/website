# CR Engine — Changelog

Two lanes per release. **Substrate** entries are defect fixes to the capture layer —
free to every install, forever. **Intelligence** entries are improvements to the
synthesis layer — delivered to active clients. Written in plain language: the client
reads this file, verbatim, when `/cr-update` proposes an update.

---

## 1.0.2 — 2026-08-17 — your words stay yours, and every exchange carries its time

### Substrate
- **Fixed: running a skill command could overwrite your prompt in the record.**
  When a session turn started with a skill command (a "/" command), the capture
  hook could record the command's internal instructions in place of what you
  actually typed. Your words now always land in the record; the internal
  machinery never does. (Found and fixed the same day on CR's own record —
  four historical instances, all repaired by hand.)
- **Added: every exchange in your record is now stamped with the date and time
  it happened**, in your own local time — the same as the notes you capture on
  your phone have always been. Your record becomes searchable by when, not just
  by what: "what did we decide that Tuesday afternoon" is now a question it can
  answer. Existing entries are untouched; stamps begin from this update onward.

---

## 1.0.1 — 2026-07-10 — the self-test now shows your whole record

### Substrate
- **The self-test now enumerates your complete record**, not just the current
  month: every monthly file, the total number of exchanges, and the total size —
  so "is it all really being kept?" gets a full inventory as the answer, on your
  own machine, any time you ask.

---

## 1.0.0 — 2026-07-10 — first versioned release

The engine now has a version, a manifest, a self-test, and an update path. Installs
made before this release are "pre-1.0" and are brought current by a manual update.

### Substrate
- **Capture hook** at current fix level (see pre-1.0 history below — all three known
  capture defects fixed).
- **Hook now fires during the turn, not just at the end** (PostToolUse + Stop
  registration): the host application discards mid-turn assistant text from its own
  transcript when a turn completes; firing during the turn captures that text before
  it is discarded. A lockfile prevents overlapping firings from double-writing.
- **User label moved out of the hook** into `.claude/engine_config.json`: the hook
  file is now identical on every install (verifiable by checksum); your name lives
  in config the updater never touches.
- **New: capture self-test** (`.claude/selftest/capture_selftest.py`) — verifies the
  capture system is correctly installed and running: registration, hook integrity,
  record present and growing. Run it any time you want proof your record is safe.

### Intelligence
- **New: `/cr-update` skill** — your Claude checks for engine updates, tells you in
  one sentence what changed, applies only with your consent, verifies with the
  self-test, and logs what it did to `.claude/update_log.md`.
- Induction operating instructions (CLAUDE.md) at current standard.

---

## Pre-1.0 history (unversioned installs, for the record)

- **2026-07-10 — mid-turn text loss** *(substrate defect)*: the host application
  prunes between-tool-call assistant text at turn end; a Stop-only hook never saw
  it. Fixed by PostToolUse registration + lockfile guard. Long mid-turn passages
  (~600+ chars) may never reach disk at all — mitigated by an operating rule
  (substance is written in a turn's final message).
- **2026-07-09 — the flush race** *(substrate defect)*: the hook could read the
  transcript ~90ms before the turn's final message was written to disk, permanently
  losing a session's last response. Fixed by waiting (max ~1.8s) for the transcript
  tail to end in assistant text.
- **2026-06-24 — the K10 bug** *(substrate defect)*: on tool-heavy turns the hook
  logged only the turn's opening and silently dropped the final deliverable. Fixed
  by re-keying capture state on the last written assistant entry with per-prompt
  continuation.
