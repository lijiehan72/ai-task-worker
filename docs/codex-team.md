# Codex Team Playbook

这份说明把 Codex 用成一个轻量的 "agent team"。

目标不是引入新的中心化编排层，而是让多个 Codex agent 按这个仓库现有边界分工：

- `source`: 需求从哪里来
- `runner`: 交给哪个 AI 执行
- `verification`: 运行结果是否成立
- `orchestrator`: 负责拆任务、合并结论、决定下一步

## 什么时候用

以下场景值得开多个 agent：

- "为什么 Feishu 没触发"
- "帮我新增一个来源"
- "把这个项目切到 Codex runner"
- "为什么执行成功了但没有回写"

如果只是改一个很小的单点 bug，单个 Codex agent 通常更快。

## 角色分工

### 1. Orchestrator

主控 agent，只做这些事：

- 判断问题属于 `source`、`runner`、`verification` 还是混合问题
- 把子任务分配给其他 agent
- 约束每个 agent 的目录边界
- 合并结果
- 决定要不要继续改代码、跑验证、回看日志

它不应该自己先把所有目录翻一遍。

### 2. Source Agent

负责：

- `sources/<type>/intent/`
- `sources/<type>/config/`
- `lib/sources/<type>/`
- `logs/<source-name>/`

适合处理：

- 新增来源
- 修 source 匹配规则
- 排查为什么 source 没产出 issue

### 3. Runner Agent

负责：

- `lib/engine/runner.js`
- `lib/engine/codex-runner.js`
- `lib/engine/claude-runner.js`
- 其他 runner 相关模块

适合处理：

- 切换 runner
- runner 参数问题
- 某个 runner 执行失败

### 4. Verification Agent

负责：

- `logs/system/`
- `logs/<source-name>/scan-*.jsonl`
- `logs/<source-name>/issues-*.jsonl`
- `data/state.json`
- `test/` 调试脚本
- `npm run compile:intents`
- 相关 debug / once 命令

适合处理：

- 排查是否扫描到了需求
- 判断失败点是在扫描、派发、执行还是回写
- 给出复现步骤和验证结论

## 推荐工作流

### 模式 A: 排障

例子："为什么 Feishu 今天没触发"

拆法：

1. Orchestrator 定义问题和输出格式
2. Source Agent 检查 intent、source adapter、source logs
3. Verification Agent 检查 state、system logs、debug script 输出
4. 如果怀疑执行层，再开 Runner Agent
5. Orchestrator 合并结论并决定是否改代码

### 模式 B: 新增来源

例子："帮我新增一个来源"

拆法：

1. Source Agent 先产出或更新 `sources/<type>/intent/*.md`
2. 如果 runtime 已支持，再检查 `lib/sources/<type>/`
3. Verification Agent 运行 `npm run compile:intents`
4. 再跑对应 debug 或 `npm run once`

### 模式 C: 切换执行器

例子："把这个项目切到 Claude Code / Codex"

拆法：

1. Runner Agent 检查 `lib/engine/runner.js` 和 runner 模块
2. Source Agent 只确认 source intent 中是否引用了 runner 文本
3. Verification Agent 跑一次最小验证

## 操作原则

- 先按边界拆，再按文件拆
- Source 问题优先看 `sources/.../intent/`，不要一开始就改 engine
- 改了 intent 后，先 `npm run compile:intents`
- 只让一个 agent 对同一片目录拥有写权限
- Orchestrator 负责最后的整合和验证

## 写权限建议

为了减少冲突，推荐这样分：

- Source Agent: `sources/`, `lib/sources/`, `logs/<source-name>/`
- Runner Agent: `lib/engine/`
- Verification Agent: 默认只读；如果需要，可以改 `test/`
- Orchestrator: 文档、整合性小改动、最终收尾

## 直接可用的 Prompt 模板

仓库里已经放了这些模板：

- [prompts/codex-team/orchestrator.md](../prompts/codex-team/orchestrator.md)
- [prompts/codex-team/source-agent.md](../prompts/codex-team/source-agent.md)
- [prompts/codex-team/runner-agent.md](../prompts/codex-team/runner-agent.md)
- [prompts/codex-team/verification-agent.md](../prompts/codex-team/verification-agent.md)

## 一个最小体验方式

你可以直接把下面这句话发给 Codex 当主任务：

```text
按 docs/codex-team.md 的分工处理这个问题：为什么 Feishu 今天没有触发任何任务。先用 orchestrator 思路拆解，再并行检查 source 和 verification，最后给我结论和修复建议。
```

或者：

```text
按 docs/codex-team.md 的分工，帮我新增一个来源。先像配置 concierge 一样确认缺失信息，优先生成 sources/<type>/intent/*.md，再决定是否需要改运行时代码。
```
