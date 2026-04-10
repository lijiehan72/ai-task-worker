# AI Task Worker

AI Task Worker 用来把“需求来源”连接到“AI 改代码”这条链路。

它会：

- 扫描需求来源
- 选出待处理事项
- 调用 Codex 或 Claude Code 修改目标工程
- 记录扫描和处理日志

## 当前能力

- 来源：Feishu 多维表格
- 执行器：Codex、Claude Code
- 日志：按来源分类落盘

后续可以扩展更多来源（例如 nginx / pm2 / 工单系统）和更多执行器。

## 推荐用法

在仓库目录直接运行 `codex` 或 `claude`，然后用自然语言描述你的目标。

例如：

- `我想为 /root/work/demo 项目接入飞书多维表格，实现 bug 自动修复。你先告诉我需要准备哪些信息，如果缺什么再继续问我。`
- `帮我看一下今天扫描到了哪些需求，哪些已处理，哪些失败。`
- `帮我新增一个来源，并按现有规则接入到处理流程。`

常用脚本可直接查看 [package.json](package.json)。

## 日志

```text
logs/
  <source-name>/
    scan-YYYY-MM-DD.jsonl
    issues-YYYY-MM-DD.jsonl
  system/
    worker-YYYY-MM-DD.jsonl
```

- `scan-*.jsonl`：每轮扫描摘要
- `issues-*.jsonl`：实际发生处理动作的事项
- `system/worker-*.jsonl`：启动、轮次和全局错误

空扫描只记摘要，不会刷大量明细日志。

## AI 规则文件

- [AGENTS.md](AGENTS.md)
- [CLAUDE.md](CLAUDE.md)

这些文件主要给 AI 助手使用，定义它在这个仓库里的边界、流程和推荐操作方式。
