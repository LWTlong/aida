# Component Rules

- [RULE-001] 需要"确认后再切换"的表单控件（radio-group、switch 等），必须使用 :model-value（单向只读绑定）+ @change 组合，在确认回调里手动赋值；禁止使用 v-model + catch 恢复方案，因为 v-model 会立即更新 UI，导致页面在确认框弹出前已切换。
- [RULE-007] 列表页刷新必须使用 mittBus 定向事件通知，禁止在 onActivated 中无条件调用 getDataList（破坏 keep-alive 缓存）
- [RULE-008] UI 实现必须优先使用 Element Plus 标准组件，保持与项目主题风格一致。只有当 Element Plus 没有满足需求的组件时才考虑自定义实现
- [RULE-009] 运营后台中展示「邮件模板 HTML」只读预览时：禁止在业务页面用 v-html 直接挂载模板片段（避免模板内 <style> / 全局选择器污染主应用）。应使用 iframe（如 srcdoc）形成独立文档，且包装层仅保留最小必要结构（如 <!DOCTYPE> + <meta charset>），不得再注入 viewport、html/body 重置、强制 table 宽度等与制作端不一致的样式。宿主容器仅保留边框与 max-height 溢出滚动，不得设置背景色、圆角、内边距装饰等与邮件无关的样式，不应对正文居中；边框内所见以模板 HTML 自身样式为准。
- [RULE-010] el-descriptions 内部条件分组必须使用 `<template v-if>`，禁止使用 `<div v-if>`。Element Plus 的 el-descriptions 只渲染直接子级的 el-descriptions-item，`<div>` 包裹层会被忽略导致内容不渲染。同理适用于 el-select（el-option）、el-menu（el-menu-item）等所有 slot 严格要求直接子节点的组件。
- [RULE-013] 在 FormJ 表单中，凡是已在 src/components/formJ/installElement.ts 中注册的业务组件（如 PermissionProductSelect、ScenarioCategory、ProductByUser、SendMethods 等），必须直接通过 type: 'ComponentName' 配置使用，禁止在页面组件中自行调用对应接口并手动构建 options。组件所需参数通过 componentProps 传入。