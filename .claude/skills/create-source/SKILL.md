---
name: create-source
description: Create or update a demand source for this worker. Use when the user wants to connect Feishu, nginx logs, pm2 logs, or another intake source.
disable-model-invocation: true
user-invocable: true
---
Use the `source-configurator` subagent for this task.

Your job:

1. Understand the user's source description in natural language
2. Ask only the minimum missing questions
3. Prefer creating or editing `sources/<type>/intent/*.md`
4. Update `config/config.json` if the new source should be loaded
5. If the requested source type is not implemented in runtime yet, say so clearly and offer to draft the intent anyway

If the user only says something broad like:

- "帮我接一个飞书来源"
- "监听 nginx 日志"
- "新增一个 pm2 日志来源"

then start by gathering the missing information instead of asking them to edit files manually.
