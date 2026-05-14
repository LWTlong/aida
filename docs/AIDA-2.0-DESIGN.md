# AIDA 2.0 方案草案

## 背景

AIDA 1.x 在真实项目连续迁移、补丁升级和多工具接入后，暴露出几个集中问题：

- JSON 真源边界不稳定，生成视图、迁移逻辑、导入逻辑对结构理解不一致
- `update / import / build / migrate` 语义互相踩踏，用户难以建立稳定心智
- `runs / task` 体系过重，真实使用价值低，反而制造噪音
- `memories` 结构不够分层，AI 恢复上下文时容易上下文膨胀
- MCP 与 CLI 耦合过深，能力边界不清

2.0 的目标不是继续堆功能，而是先把系统收紧成一个稳定、轻量、可长期维护的内核。

## 产品定位

AIDA 2.0 的核心定位是：

1. 管理 AI 工具共享的项目级规则、技能和模块记忆
2. 帮助 AI 用最小上下文成本快速恢复历史业务模块认知
3. 为需求分支保留轻量摘要，供后续回顾、汇报和分析使用

2.0 不再把自己定义为“全面采集 AI 开发全过程”的重型系统。

## 设计原则

### 1. JSON 是唯一真源

所有核心资产最终都落在 `.aida` 下的 JSON 文件中。Markdown、工具目录、dashboard 输入都不是最终真源。

### 2. CLI 负责资产管理

CLI 的职责是管理、同步、构建、迁移和修复 JSON 资产，而不是承担实时采集主脑。

### 3. MCP 是可选增强层

MCP 为 AI 模型提供更丝滑的结构化调用方式，但不是系统成立前提。没有 MCP 时，系统仍可通过规则约束和 CLI 能力运转。

### 4. 采集规则由规则定义

“什么必须采集、什么禁止采集、什么进入 memory、什么只记录轻量摘要”优先由规则定义，由模型按规则判断。

### 5. 模块记忆优先于过程流水账

对后续代码生成最有价值的是模块级业务上下文、关键约束和历史需求变更，而不是细碎任务流水账。

### 6. 收敛范围，分阶段落地

2.0.0 先解决真源统一、memory 分层、命令收拢、迁移清洗和通道解耦。手改 Markdown 回写、dashboard 增强、自动检测工具目录变化等能力放到后续版本。

## 2.0 核心真源模型

2.0 保留的核心真源如下：

- `.aida/rules.json`
- `.aida/skills.json`
- `.aida/memories/index.json`
- `.aida/memories/modules/*.json`
- `.aida/summary.json`

不再把 `runs/<branch>/...` 和细粒度 `task` 作为 2.0 的核心持久化模型。

### 真源分工

#### `rules.json`

项目级规则真源，用于在不同 AI 工具之间统一分发规则。

#### `skills.json`

项目级技能真源，用于在不同 AI 工具之间统一分发技能。一个 skill package 永远只对应一条 skill entry。

#### `memories/index.json`

全局模块索引，供 AI 用低 token 成本先完成模块筛选，再决定是否深入读取具体模块正文。

#### `memories/modules/*.json`

模块级长期记忆正文，记录：

- 模块职责
- 业务背景
- 关键文件
- 关键约束
- 历史需求变更摘要
- 注意事项 / 坑点

#### `summary.json`

项目级轻量需求摘要索引，主要服务于：

- 汇报分析
- 年中/年终总结
- 需求回顾
- 为 AI 提供“最近做了什么”的高层概览

## JSON Root 统一方案

2.0 中所有核心 JSON 统一采用对象包裹结构，而不再使用裸数组：

```json
{
  "schemaVersion": "2.0",
  "updatedAt": "2026-04-30T00:00:00.000Z",
  "items": []
}
```

适用于：

- `rules.json`
- `skills.json`
- `summary.json`

`memories/index.json` 和 `memories/modules/*.json` 保留对象结构，但同样必须带 `schemaVersion` 与统一的公共元字段。

## Memory 两层结构

### 目标

Memory 的首要目标不是存储更多信息，而是让 AI 以最小上下文成本恢复正确业务认知。

### 第一层：全局索引

`memories/index.json` 是 memory 恢复的强制入口。AI 恢复上下文时必须先读索引，再决定要读哪些模块正文。

索引至少需要支持：

- `moduleKey`
- `title`
- `summary`
- `keywords`
- `keyFiles`
- `lastTickets`
- `updatedAt`

### 模块唯一标识

2.0 中每个模块必须有稳定的 `moduleKey` 作为唯一主键。`title` 只用于展示，不参与唯一性判断。

推荐格式：

```text
<namespace>/<name>
```

例如：

- `auth/login`
- `auth/pow-check`
- `template/preview`
- `touch-config/sms`

约束：

- 全部小写
- `/` 表示逻辑层级
- `-` 表示词内连接
- 优先显式指定
- 未显式指定时，可由主入口路径推导

路径和关键词只作为模块归并证据，不是主键本身。

### 第二层：模块正文

命中模块后，再读取 `memories/modules/*.json`。正文不写过程流水账，而是写高信息密度的模块知识卡片。

建议重点信息包括：

- 模块是什么
- 为什么这样设计
- 最近被哪些需求单改过
- 哪些业务约束不能破坏
- 哪些代码点位最关键

### 分支/需求挂载方式

需求分支不再独立维护 `run/task` 目录，而是作为需求变更摘要挂在对应模块 memory 上。一个需求可挂多个模块。

示例：

- `MTR-123` 修改了登录、滑块、POW
- 则在 `auth-login`、`slider-check`、`pow-check` 三个模块下分别记录本次需求变更摘要

建议模块正文中的 `changes` 使用 `branch/ticket + moduleKey` 聚合：

```json
{
  "branch": "MTR-123",
  "ticket": "MTR-123",
  "title": "登录链路增强",
  "summary": "新增滑块验证，并调整验证码与 POW 的前置判断顺序。",
  "updatedAt": "2026-05-08T12:00:00.000Z"
}
```

同一需求分支分多次对话完成时，不新增很多条，而是更新同一模块下对应的 `change` 记录。

## Summary 定位

`summary.json` 是轻量摘要，不是第二套 memory。

它的目标是：

- 快速告诉 AI 最近有哪些需求分支
- 每个需求改了哪些模块
- 帮助后续自动生成汇报、亮点、需求总结

建议每条摘要至少包含：

- `branch`
- `ticket`
- `title`
- `summary`
- `modules`
- `highlights`
- `keyFiles`
- `updatedAt`
- `status`

## CLI 与 MCP 分层

### CLI

CLI 是主资产管理入口，负责：

- 初始化
- JSON 资产同步
- 工具视图构建
- 迁移
- 诊断与修复

### MCP

MCP 是 AI 运行时的结构化调用入口，负责：

- 提供更顺滑的读写入口
- 减少模型拼接 shell 命令的负担
- 在会话中更自然地读写统一 service 能力

### 统一要求

MCP 和 CLI 不能各自维护一套逻辑。两者必须共用同一套 domain/service 层：

- rules service
- skills service
- memories service
- summary service
- sync service
- health service

MCP 和 CLI 只是不同通道，不是两套系统。

## 命令收拢

2.0 目标命令集收敛到：

- `aida init`
- `aida sync`
- `aida doctor`
- `aida rules`
- `aida skills`
- `aida memory`

### 命令语义

#### `aida init`

初始化 `.aida` 真源结构、规则引用、工具接入。

#### `aida sync`

统一承担：

- JSON 真源同步
- tools 投影重建
- memory / summary 更新
- 工具侧分发

#### `aida doctor`

负责健康检查和安全修复，例如：

- schema 不一致
- memory 索引断链
- 旧结构残留
- 工具视图缺失

### 废弃方向

2.0 中应废弃或弱化：

- `build`
- `migrate`
- `merge`
- `update`
- `import`
- `reindex`
- 面向用户的细粒度 task 命令心智

## 数据采集收敛

2.0.0 不再以细粒度 task 为核心。采集重点调整为：

- 模块级 memory 沉淀
- 分支/需求级 summary 摘要
- 规则与技能资产同步

### 禁止采集

- 方案讨论
- 只读排查
- git 历史查看
- 环境操作
- 未落地的临时实验
- 没有形成最终有效结果的失败尝试

### 允许采集

- 已经落到项目代码/配置的稳定改动
- 模块级长期有效知识
- 需求级轻量摘要

### 暂不纳入 2.0.0 的能力

- 用户手改 Markdown 反向同步
- 太细的 task 流水账
- 自动监听用户工具目录变化
- dashboard 大幅重构

## 迁移与清洗

2.0 必须提供正式迁移能力，而不是继续依赖补丁式升级。

### 迁移目标

- 旧结构识别
- schema 统一
- 已知污染清洗
- 旧数据压缩到 memory / summary
- 明确可保留、可丢弃、需确认的数据类别

### 清洗重点

- 旧 `task` 流水账压缩或丢弃
- 非长期价值的过程记录不再保留为核心真源
- tool 侧历史导入污染按 2.0 规则重建
- `run.json / timeline / events / task status` 不再作为 2.0 核心持久化模型保留
- 迁移目标是提炼出 `rules / skills / memories / summary`，而不是完整继承 1.x 运行态结构

## 分阶段路线

### 2.0.0

先做：

- JSON 真源统一
- memory 两层结构
- summary 结构
- service 分层
- CLI 命令收拢
- MCP / CLI 解耦
- migration / 清洗
- CLI 交互样式升级

### 2.1+

后续再做：

- 用户手改 Markdown / tool 目录回写 JSON
- dashboard 体验升级
- 更智能的差异发现
- 更顺滑的自动同步体验

## 当前设计结论

1. 2.0 继续沿用 v1 的核心对象语义，但重构真源层级
2. `rules / skills / memories / summary` 是核心真源
3. `run/task` 从核心持久化模型中移出
4. memory 采用“全局索引 + 模块正文”两层结构
5. CLI 是主资产管理通道，MCP 是可选增强调用通道
6. 2.0.0 先做收敛、统一、清洗，不急着做 Markdown 双向同步
