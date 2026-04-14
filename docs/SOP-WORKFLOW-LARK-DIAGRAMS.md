# AIDevOS 流程图（飞书文本绘图格式）

> Historical workflow reference. For the current public CLI and `.aida` asset flow, use [README.md](../README.md) and [COMMANDS.md](../COMMANDS.md) as the canonical docs.

> 以下 Mermaid 代码块可直接粘贴到飞书文档中：
> 输入 `/` → 选择「绘图」 → 粘贴对应代码即可渲染。

---

## 图1：完整工作流程图

```mermaid
flowchart TD
    START["用户输入需求（prd.md 或 prd.docx）"] --> DETECT_FORMAT{"检测文件格式"}
    DETECT_FORMAT -->|.md| MD_READY["prd.md 就绪"]
    DETECT_FORMAT -->|.docx| DOCX_CONVERT["docx-to-markdown 转换"]
    DOCX_CONVERT --> MD_READY

    MD_READY --> DETECT_API{"检测接口文档（可选）"}
    DETECT_API -->|"api.md/docx\ninterface.md/docx\n接口文档.md/docx"| API_CONVERT["如有 .docx 自动转 .md"]
    DETECT_API -->|无接口文档| SKIP_API["跳过，后续可追加"]
    API_CONVERT --> WO
    SKIP_API --> WO

    subgraph WO ["1. workflow-orchestrator（流程编排器）"]
        WO_1["检测并转换文档"]
        WO_2["初始化 run.json"]
        WO_3["识别 PRD 阶段"]
        WO_4["设置 meta.prdPhases"]
        WO_5["写入 workflow[] 和 timeline[]"]
        WO_1 --> WO_2 --> WO_3 --> WO_4 --> WO_5
    end

    WO --> RA

    subgraph RA ["2. requirement-analyzer（需求分析器）"]
        RA_1["读取 prd.md"]
        RA_2["读取接口文档（如存在）"]
        RA_3["读取项目规范"]
        RA_4["生成 analysis.md"]
        RA_5["输出需求理解要点"]
        RA_1 --> RA_2 --> RA_3 --> RA_4 --> RA_5
    end

    RA --> CP1

    CP1{{"关键控制点 #1\n用户确认需求理解"}}
    CP1 -->|"确认理解正确"| CP1_DATA["写入数据：\ncontext.currentStage = requirement-confirmed\ntimeline[] 添加确认事件"]
    CP1 -->|"需要修正"| RA

    CP1_DATA --> TS

    subgraph TS ["3. task-splitter（任务拆分器）"]
        TS_1["读取 analysis.md"]
        TS_2["读取 .aida/rules/"]
        TS_3["识别 PRD 阶段"]
        TS_4["拆分为原子任务"]
        TS_5["aida log task ..."]
        TS_1 --> TS_2 --> TS_3 --> TS_4 --> TS_5
    end

    TS --> LOOP["任务循环开始"]

    LOOP --> CG

    subgraph CG ["4. code-generator（代码生成器）"]
        CG_1["读取第一个 pending 任务"]
        CG_2["读取项目规范 + 接口文档"]
        CG_3["严格按规范生成代码"]
        CG_4["aida log file ...（记录文件变更）"]
        CG_5["aida log task-done --id TASK-XX"]
        CG_1 --> CG_2 --> CG_3 --> CG_4 --> CG_5
    end

    CG --> SR

    subgraph SR ["5. self-reviewer（质量自检员）"]
        SR_1["读取最近完成的任务"]
        SR_2["执行全维度自检"]
        SR_3["aida log review ..."]
        SR_1 --> SR_2 --> SR_3
    end

    SR --> REVIEW_RESULT{"自检结果"}
    REVIEW_RESULT -->|"PASS"| HAS_MORE{"还有待执行任务？"}
    REVIEW_RESULT -->|"FAIL"| BF

    subgraph BF ["6. bug-fixer（缺陷修复器）"]
        BF_1["读取 fail 记录"]
        BF_2["定位问题文件"]
        BF_3["修复代码"]
        BF_4["aida log bug ..."]
        BF_5["aida log bug-fix ..."]
        BF_1 --> BF_2 --> BF_3 --> BF_4 --> BF_5
    end

    BF -->|"重新自检"| SR

    HAS_MORE -->|"是"| CG
    HAS_MORE -->|"否"| COMPLETE

    COMPLETE["所有任务完成\nmeta.status = completed\nmetrics 计算最终指标"]
    COMPLETE --> USER_TEST["用户测试验证阶段"]
    USER_TEST --> HAS_DEVIATION{"发现 AI 偏差？"}
    HAS_DEVIATION -->|"是"| DR
    HAS_DEVIATION -->|"否"| DONE["工作流闭环结束"]

    subgraph DR ["7. deviation-recorder（偏差记录器）"]
        DR_1["用户触发 /deviation"]
        DR_2["提取偏差描述"]
        DR_3["判断根因"]
        DR_4["修复偏差代码"]
        DR_5["aida log deviation ..."]
        DR_1 --> DR_2 --> DR_3 --> DR_4 --> DR_5
    end

    DR --> RULE_JUDGE{"根因是 rule-missing？"}
    RULE_JUDGE -->|"否"| DONE
    RULE_JUDGE -->|"是"| NATURE{"技术规范 or 业务逻辑？"}
    NATURE -->|"技术规范"| SEDIMENT["创建 pending 规则\n正式沉淀到 .aida/rules/"]
    NATURE -->|"业务逻辑"| NO_SEDIMENT["仅记录偏差，不沉淀"]
    SEDIMENT --> DONE
    NO_SEDIMENT --> DONE

    style CP1 fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style COMPLETE fill:#51cf66,stroke:#2b8a3e,color:#fff
    style DONE fill:#339af0,stroke:#1864ab,color:#fff
    style START fill:#845ef7,stroke:#5f3dc4,color:#fff
```

---

## 图2：任务执行循环（详细）

```mermaid
flowchart TD
    A["取出第一个 pending 任务"] --> B["code-generator 生成代码"]
    B --> C["记录文件变更\naida log file --path ... --change-type ... --lines-added ... --lines-removed ..."]
    C --> D["标记任务完成\naida log task-done --id TASK-XX"]
    D --> E["self-reviewer 质量自检\naida log review --task-id TASK-XX --result ..."]
    E --> F{"自检结果"}
    F -->|"PASS"| G{"还有待执行任务？"}
    F -->|"FAIL"| H["bug-fixer 修复\naida log bug ...\naida log bug-fix ..."]
    H --> I["记录修复文件变更\naida log file ..."]
    I -->|"重新自检"| E
    G -->|"是"| A
    G -->|"否"| J["所有任务完成"]

    style F fill:#ffa94d,stroke:#e8590c
    style J fill:#51cf66,stroke:#2b8a3e,color:#fff
```

---

## 图3：偏差记录与规则沉淀

```mermaid
flowchart TD
    A["用户发现 AI 偏差"] --> B["触发 /deviation"]
    B --> C["提取偏差描述"]
    C --> D["回顾项目规范判断根因"]
    D --> E["修复偏差代码"]
    E --> F["aida log deviation ..."]
    F --> G{"根因类别"}
    G -->|"rule-missing"| H{"技术规范 or 业务逻辑？"}
    G -->|"其他根因"| K["仅记录偏差"]

    H -->|"技术规范\n（无业务逻辑）"| I["创建 pending 规则\naida log rule --status pending"]
    H -->|"业务逻辑\n（有业务逻辑）"| J["不沉淀规则"]

    I --> L["正式沉淀到 .aida/rules/*.md\naida log rule --file ..."]

    subgraph TECH ["技术规范示例"]
        T1["el-dialog 内 Table 需要 min-height"]
        T2["Table columns 必须放在 computed 中"]
        T3["API 请求必须走统一封装"]
        T4["公共组件 props 使用规范"]
    end

    subgraph BIZ ["业务逻辑示例"]
        B1["用户列表需要显示注册时间"]
        B2["订单详情需要增加物流信息"]
        B3["某表单需要特定校验规则"]
    end

    style H fill:#ffa94d,stroke:#e8590c
    style I fill:#51cf66,stroke:#2b8a3e,color:#fff
    style J fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style TECH fill:#d0ebff,stroke:#1864ab
    style BIZ fill:#ffe3e3,stroke:#c92a2a
```

---

## 图4：数据契约四层一致性

```mermaid
flowchart LR
    SCHEMA["src/schemas/run-json.ts\n（唯一数据源）"]
    SCHEMA --> SKILLS["Skills\n读写 run.json"]
    SCHEMA --> CLI["CLI\nsrc/cli/commands/log.ts"]
    SCHEMA --> SERVER["Dashboard Server\n数据服务"]
    SCHEMA --> DASHBOARD["Dashboard UI\ndashboard/src/types.ts"]

    SKILLS -->|"写入"| RUNJSON[("run.json")]
    CLI -->|"写入"| RUNJSON
    SERVER -->|"读取"| RUNJSON
    DASHBOARD -->|"展示"| RUNJSON

    style SCHEMA fill:#845ef7,stroke:#5f3dc4,color:#fff
    style RUNJSON fill:#ffd43b,stroke:#e67700
```

---

## 图5：工程控制论 - 反馈循环

```mermaid
flowchart LR
    A["偏差发现"] --> B["规则沉淀"]
    B --> C["规范约束"]
    C --> D["减少偏差"]
    D -->|"持续优化"| A

    style A fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style B fill:#ffa94d,stroke:#e8590c
    style C fill:#ffd43b,stroke:#e67700
    style D fill:#51cf66,stroke:#2b8a3e,color:#fff
```

---

## 图6：需求错误成本模型

```mermaid
flowchart LR
    A["分析阶段纠错\n成本 = 1"] --> B["开发阶段纠错\n成本 = 10"]
    B --> C["测试阶段纠错\n成本 = 100"]

    style A fill:#51cf66,stroke:#2b8a3e,color:#fff
    style B fill:#ffa94d,stroke:#e8590c,color:#fff
    style C fill:#ff6b6b,stroke:#c92a2a,color:#fff
```

---

## 使用说明

1. 打开飞书文档
2. 在需要插入流程图的位置输入 `/`
3. 选择「绘图」或「Mermaid」
4. 将上方对应的 mermaid 代码块内容（不含 ` ```mermaid ` 标记）粘贴进去
5. 即可自动渲染为可视化流程图

**推荐插入顺序：**
- 文档开头插入「图1：完整工作流程图」作为全局概览
- 「第2关」小节插入「图2：任务执行循环」
- 「第3关」小节插入「图3：偏差记录与规则沉淀」
- 「数据契约」小节插入「图4：数据契约四层一致性」
- 「工程控制论」小节插入「图5」和「图6」
