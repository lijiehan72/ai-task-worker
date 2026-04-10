# Feishu Source Intent

## 接入信息
轮询这个多维表格：
https://c95krpb1xv.feishu.cn/base/CgSpblMG3aXloZsa82KcpV9wnqb?table=tblYfaDXcea1msTv&view=vewxfc6zn6

使用 app_id：cli_a95cac27313bdbd3
使用 app_secret：MRxWbT3IZsgfO3ehKWlIhhQpnY3dgXjs
请求超时：30000

## 当满足这些条件时
- 监听 状态 为 new
- 是否交给Codex 为 true

## 把这些内容当作需求
- 标题来自 Bug标题
- 详细描述来自 Bug描述
- 重现步骤来自 重现步骤
- 预期结果来自 预期结果
- 优先级来自 优先级

## 交给哪个工程处理
项目名称：测试
去 /root/work/demo 修改代码
使用 codex
不额外执行校验命令

## 处理完成后
- 开始处理时把状态改成 processing
- 完成以后把状态改成 fixed
- 失败时把状态改成 failed
- 把处理结果写入 Codex处理结果
- 把处理时间写入 处理时间
- 失败时把错误写入 最后错误
