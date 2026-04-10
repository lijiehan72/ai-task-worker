# AI Agent Rules

## Purpose

This repository is an automation worker for AI-driven engineering tasks.

Its job is to:

- scan one or more demand sources
- turn matched items into a normalized issue
- send the issue to an AI coding runner such as Codex or Claude Code
- optionally verify the target project
- write back status and keep local execution history

The human user should not need to understand internal code structure to use the system. Your role is to preserve that property.

## Core Model

There are two primary axes in this project:

- `source`: where demand comes from
- `runner`: which AI coding tool handles the change

Keep those concerns separate.

Examples:

- Feishu Bitable is a source
- future nginx log scanning is a source
- Codex is a runner
- Claude Code is a runner

Do not mix source logic into runner modules.
Do not mix runner logic into source adapters.

## Directory Ownership

- `config/`: config loading and normalized runtime config
- `sources/<type>/intent/`: human-readable source intent files
- `sources/<type>/config/`: compiled source config generated from intent files
- `lib/sources/`: source adapters
- `lib/engine/`: execution engine, runner dispatch, verification, logging, state
- `worker/index.js`: thin process entrypoint only
- `test/`: debugging or maintenance scripts
- `logs/`: runtime logs by source and system
- `data/`: local state

## Non-Negotiable Boundaries

- Keep `worker/index.js` thin. Do not add source-specific or runner-specific business logic there.
- Add new demand sources under `lib/sources/<source-name>/`.
- Add new AI runners under `lib/engine/`.
- Prefer extending normalized interfaces over branching ad hoc behavior across the codebase.
- Preserve source-scoped logging under `logs/<source-name>/`.
- Preserve the distinction between scan summaries and issue action logs.

## How To Work In This Repo

When asked to add or debug a source:

1. inspect `sources/<source-name>/intent/` first
2. inspect `sources/<source-name>/config/` if compiled output matters
3. inspect `lib/sources/`
4. inspect `logs/<source-name>/`
5. use the existing debug scripts in `test/` if applicable
6. keep the engine contract stable

Prefer editing intent files over hand-editing compiled source JSON unless the user explicitly asks otherwise.

Prefer the conversational AI flow inside `codex` or `claude` when the user wants to describe a source in natural language instead of editing files directly.

After changing intent files, run:

1. `npm run compile:intents`
2. the relevant debug or runtime command

When adding a new source type:

1. add its runtime adapter under `lib/sources/<type>/`
2. add a human-facing intent format under `sources/<type>/intent/`
3. keep compiled runtime config under `sources/<type>/config/`

When asked to add or debug a runner:

1. inspect `lib/engine/runner.js`
2. inspect the runner-specific module in `lib/engine/`
3. do not leak runner-specific assumptions into sources

When asked to debug behavior:

1. check `logs/system/`
2. check `logs/<source-name>/scan-*.jsonl`
3. check `logs/<source-name>/issues-*.jsonl`
4. check `data/state.json`

## User Intent

Humans use this repository together with AI tools.

They should be able to say things like:

- "use Codex to run this worker"
- "switch this project to Claude Code"
- "add a new demand source"
- "why did Feishu not trigger anything"

Your changes should make those workflows easier, not harder.

When the user wants to create or edit a source, act as a configuration concierge:

- let the user describe the source naturally
- infer the source type when possible
- ask only the missing questions
- prefer generating or editing `sources/<type>/intent/*.md`
- do not force the user to think in raw schema terms unless they explicitly ask for schema details

## Codex Team Pattern

When using Codex in a multi-agent style, prefer role separation over ad hoc parallelism.

Recommended roles:

- `orchestrator`: triage the request, split work, integrate findings, own final verification
- `source-agent`: own `sources/`, `lib/sources/`, and source-scoped logs
- `runner-agent`: own `lib/engine/runner.js` and runner-specific modules
- `verification-agent`: own `logs/`, `data/state.json`, `test/`, and validation commands

Rules:

- Split by repository boundary first, not by arbitrary file chunks.
- Do not have multiple agents editing the same area at the same time.
- Source work starts from `sources/<type>/intent/` before engine edits.
- Runner work stays out of source adapters unless a normalized interface must change.
- Verification agents should prefer reproducing and localizing failures before proposing code changes.

See `docs/codex-team.md` for the operator-facing playbook and prompt templates.

## Documentation Rule

Keep `README.md` human-oriented:

- explain what the system does
- explain how a human uses it with AI
- explain the big concepts

Do not overload `README.md` with low-level field names, source schema details, or internal implementation notes unless the user explicitly asks for them.

Put operational and architectural guidance for agents in `AGENTS.md` and `CLAUDE.md`.
