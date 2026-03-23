---
name: audit
description: 扫描项目代码，生成与项目完全匹配的 AI 开发规范，直接写入 .aidevos/rules/。
globs: ['.aidevos/rules/*.md', 'CLAUDE.md', '.cursor/rules/*/*.md']
---

# audit (项目审计)

## 提示

此 Skill 由用户人工触发，不纳入 workflow-orchestrator 自动化流程。

## 角色

你是一个顶级的架构师，擅长通过分析现有项目代码库（逻辑、公共组件、业务组件）来沉淀自动化指令。你的目标是编写能让 AI 生成代码"如出一辙"的规则。

## 核心目标

通过扫描真实项目代码 + 分析现有规则，构建一套与项目完全匹配的 AI 开发规范体系，使 AI 生成代码一次通过率达到 90% 以上。

## 执行阶段

### 阶段一：加载现有规则

读取并理解项目现有的所有规则来源：
1. **AIDevOS 规则**：`.aidevos/rules/*.md`
2. **全局规则文件**：
   - Claude Code 用户：`CLAUDE.md`
   - Cursor 用户：`.cursor/rules/*/*.md`

### 阶段二：项目真实结构建模

1. 扫描范围（排除 node_modules/dist/build/.git）
2. 技术栈识别（框架、UI 库、状态管理、请求封装、路由模式）
3. 深度分析：
   - 公共组件：使用方式、Props 约定、插槽设计
   - API 封装：请求函数命名、参数传递、错误处理
   - 状态管理：Store 结构、Action/Mutation 模式
   - 路由模式：路由配置、权限控制、懒加载
   - 类型系统：接口定义、泛型使用、枚举约定
   - 样式方案：CSS Modules / Tailwind / CSS-in-JS
   - i18n 方案：文案管理、语言切换、命名约定

### 阶段三：规则审计

对现有 `.aidevos/rules/` 进行审计：
- **重复检测**：语义重复、约束重复
- **冲突检测**：A 强制 vs B 禁止
- **失配检测**：引用不存在的组件/API
- **缺失关键约束**：对照真实代码，发现未覆盖的模式

### 阶段四：生成规则并直接写入

基于真实代码生成或更新 `.aidevos/rules/` 下的规则文件：

| 文件 | 内容 |
|------|------|
| `code-style.md` | 编码风格：命名规范、文件组织、注释要求 |
| `component-usage.md` | 组件使用：UI 库组件选择、自定义组件约定、Props 传递 |
| `api-patterns.md` | API 封装：请求函数模式、错误处理、类型定义 |
| `state-management.md` | 状态管理：Store 结构、Action 命名、数据流 |
| `i18n-rules.md` | 国际化：文案位置、key 命名、禁止硬编码 |
| `architecture.md` | 架构约束：目录结构、模块划分、依赖关系 |
| `type-system.md` | 类型系统：接口定义、泛型使用、any 禁用 |

**所有规则必须**：
1. 基于真实项目代码（不臆造）
2. 可执行、可验证（不能是模糊建议）
3. 包含正确示例和错误示例
4. 引用真实存在的组件/API 路径

### 阶段五：输出确认

生成完成后输出：
```
✓ 已生成/更新 .aidevos/rules/ 下的规则文件：
  - code-style.md
  - component-usage.md
  - api-patterns.md
  - state-management.md
  - i18n-rules.md
  - architecture.md
  - type-system.md

基于项目代码扫描，识别：
  - 技术栈：[Vue 3 + TypeScript + Pinia + Element Plus]
  - 请求封装：[src/api/request.ts]
  - 公共组件：[src/components/common/]
  - 状态管理：[src/store/]
```

## 质量控制原则

1. 所有结论必须基于真实代码
2. 不允许猜测组件、虚构 API 模式
3. 优化目标为"AI 生成代码一致性"
4. 所有规则必须可执行、可验证
5. 规则文件使用 Markdown 格式，结构清晰
