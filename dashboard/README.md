# AIDA 3.0 Dashboard

本目录是 AIDA 3.0 的前端治理控制台。

## 用途

- 展示资产扫描结果
- 审核 proposal 与报告
- 执行 proposal 应用前的人类确认
- 审计待导入插件的静态风险

## 本地开发

```bash
npm --prefix dashboard install
npm --prefix dashboard run dev
```

开发时通过 Vite 启动前端；生产构建会输出到 `src/dashboard/`，再由 `aida dashboard` 启动的本地服务提供页面和 `/api/*` 数据。

## 构建

在仓库根目录执行：

```bash
npm run build
```

该命令会先构建本前端，再构建 CLI 与 MCP 产物。
