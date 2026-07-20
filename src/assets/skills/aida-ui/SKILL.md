---
name: aida-ui
description: 打开 AIDA Dashboard 本地 UI，查看项目 AI 资产。当用户说"打开 dashboard"、"看资产"、"aida ui"、"启动 AIDA 界面"时触发。
---

# AIDA UI

## Goal
检查本地是否安装了 `aida` npm 包，没有则引导用户安装，最终给出启动命令。

## Steps

1. **检查是否已安装**：运行 `npx --no aida --version 2>/dev/null || echo "NOT_INSTALLED"`
   - 有版本号输出 → 已安装，跳到步骤 3
   - 输出 `NOT_INSTALLED` → 未安装，继续步骤 2

2. **引导安装**：告知用户需要安装 `aida` npm 包才能使用 Dashboard，询问是否安装：
   - 用 AskUserQuestion 确认：
     - `header`: "安装 aida"
     - `question`: "Dashboard 需要本地安装 aida npm 包，是否现在安装？"
     - 选项 A "全局安装（推荐）" — `npm install -g aida --registry https://registry.npmjs.org`，任意目录可用
     - 选项 B "项目内安装" — `npm install aida --registry https://registry.npmjs.org`，仅当前项目可用
     - 选项 C "暂不安装" — 只给出手动安装命令，不执行
   - 用户选 A：运行 `npm install -g aida --registry https://registry.npmjs.org`，等待完成
   - 用户选 B：运行 `npm install aida --registry https://registry.npmjs.org`，等待完成
   - 用户选 C：输出手动命令后结束

3. **给出启动命令**：输出以下内容后结束，不要替用户运行（避免占用终端）：

   ```bash
   npx aida dashboard
   ```

   同时说明：命令运行后会自动打开浏览器，或手动访问终端输出的本地地址。

## Notes
- 不要自动运行 `aida dashboard`，它会占用终端进程，用户应自己在终端里跑
- 安装步骤需要用户授权后才执行，不要默默安装
- 如果安装失败（网络问题等），输出错误信息并建议用户手动运行安装命令
