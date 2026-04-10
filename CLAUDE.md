# Claude Code Guidance

This repository is designed for human + AI operation.

If you are Claude Code working in this repo, follow these rules.

## What This Project Is

This is an orchestration worker, not a product app.

It does not exist to expose UI.
It exists to connect:

- demand intake
- AI code execution
- verification
- logging and traceability

## Preferred Mental Model

Think in terms of:

- intake adapters
- normalized issues
- execution runners
- audit logs

If a request is about "where work comes from", it belongs in a source adapter.
If a request is about "which coding AI performs the work", it belongs in a runner.

## Safe Defaults

- Prefer small, local changes.
- Preserve existing logging behavior.
- Preserve source-specific logs and system logs.
- Keep commands simple for the human operator.
- Prefer new files over overloading central files when introducing a new source.

## Where To Look First

- entrypoint: `worker/index.js`
- config loading: `config/index.js`
- runner dispatch: `lib/engine/runner.js`
- source adapters: `lib/sources/`
- logs: `logs/`
- debug scripts: `test/`

## What Not To Do

- Do not turn the README into an internal developer manual.
- Do not hardcode one source as the only supported intake path.
- Do not hardcode one runner as the only supported execution path.
- Do not bury operational knowledge in scattered comments when it belongs in agent rules.

## Operator Experience

The human operator should be able to use plain requests such as:

- "run with codex"
- "run with claude"
- "check what Feishu scanned today"
- "add nginx as a new source"

Favor changes that support that style of operation.

This repository also includes a project-level Claude subagent and skill for source configuration:

- subagent: `source-configurator`
- skill: `/create-source`

Prefer using them when the user wants to configure or troubleshoot demand sources.
