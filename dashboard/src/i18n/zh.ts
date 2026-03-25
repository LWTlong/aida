export const zh = {
  // Common
  loading: '加载中...',
  noData: '暂无数据',
  save: '保存并计算',
  saving: '保存中...',
  clickToSet: '点击设置',
  hours: '小时',
  eg: '例如',

  // Currency
  currency: '¥',
  currencyLabel: '人民币',
  perHour: '¥/h',
  exchangeRate: '7',

  // Header
  branch: '分支',
  developer: '开发者',
  cycle: '周期',
  projectOverviewNav: '项目总览（负责人视角）',
  dashboardTitle: 'AI 开发看板',
  projectOverviewTitle: 'AIDevOS 项目总览',
  sseConnected: 'SSE 已连接',
  sseDisconnected: 'SSE 未连接',

  // App
  noRunData: '还没有数据',
  noRunDataHint: '用 AI 工具开始写代码，AIDA 会自动采集数据。<br/><br/>1. 在项目中配置 MCP（<code>.mcp.json</code>）<br/>2. 用 AI 工具正常开发 —— AIDA 自动采集<br/>3. 刷新此页面查看数据',
  noOverviewData: '暂无项目总览数据',
  noOverviewDataHint: '使用 <code>aida reindex</code> 生成项目索引',
  footerDashboard: 'AIDevOS AI 开发质量看板',
  footerOverview: 'AIDevOS 项目总览',

  // Chart titles (App.tsx)
  chartNodeTime: '各节点累计耗时',
  chartTaskRanking: '任务耗时排行 TOP 10',
  chartStageTime: '阶段时间分布',
  chartTimeline: '开发时间线',
  chartTaskCompletion: '各阶段任务完成情况',
  chartFirstPassRate: '首次通过率趋势',
  chartDeviationPie: '偏差根因分析',
  chartDeviationBar: '偏差类别分布',
  chartBugSeverity: 'Bug 严重度分布',
  chartReviewIssues: '自检问题分类',
  chartFileHotspot: '文件修改热点（偏差/缺陷修复）',
  chartDeviationTrend: '偏差数量与规则沉淀趋势',
  chartRulesTable: '偏差沉淀的规则',
  chartReviewsTable: '自检报告汇总',

  // KPI cards
  kpiPrd: 'PRD 进度',
  kpiTasks: '任务完成',
  kpiDeviation: '偏差发现',
  kpiBug: '缺陷修复',
  kpiReviewRate: '自检通过率',
  kpiTokens: 'Token 消耗',
  kpiFiles: '文件变更',
  kpiTime: '实际工时',
  kpiRoi: '成本回报率',

  // KPI modals
  modalTasks: '任务详情',
  modalDeviation: '偏差详情',
  modalBug: '缺陷详情',
  modalPrd: 'PRD 阶段',
  modalReview: '自检报告',
  modalFiles: '变更文件',
  modalTime: '工时详情',
  modalRoi: '成本分析',
  modalTokens: 'Token 消耗详情',

  // Table headers
  thId: 'ID',
  thTitle: '标题',
  thPhase: '阶段',
  thPrd: 'PRD',
  thStatus: '状态',
  thRootCause: '根因',
  thCategory: '类别',
  thFiles: '涉及文件',
  thSeverity: '严重程度',
  thFix: '修复',
  thNumber: '编号',
  thDate: '日期',
  thScope: '范围',
  thIssueCount: '问题数',
  thResult: '结果',
  thFilePath: '文件路径',
  thOperation: '操作',
  thLineChanges: '+/-',
  thChangeCount: '修改次数',

  // KPI modal: tasks completed
  tasksCompleted: '任务完成',

  // KPI modal: time
  timeActualAi: '实际 AI 工时',
  timeEstManual: '预估人工工时',
  timeEfficiency: '效率倍数',
  timeNodeDetail: '节点耗时明细',

  // KPI modal: ROI
  roiSettingTitle: '成本参数设置',
  roiSettingHint: '填写以下信息后，系统将自动计算成本回报',
  roiEstManualHours: '预估人工工时',
  roiHourlyRate: '时薪',
  roiCostComparison: '成本对比',
  roiManualCost: '人工成本',
  roiAiCost: 'AI Token 成本',
  roiSaved: '节省费用',
  roiValue: '每 ¥1 AI 成本节省',
  roiTimeComparison: '时间对比',
  roiHoursSaved: 'AI 替代人工工时',
  roiAiProcessTime: 'AI 累计处理时间',

  // KPI modal: tokens
  tokenTotal: '总 Token',
  tokenInput: 'Input Tokens',
  tokenOutput: 'Output Tokens',
  tokenCacheCreation: 'Cache Creation',
  tokenCacheRead: 'Cache Read',
  tokenPerPhase: '各阶段 Token 消耗',

  // Charts
  chartNoData: '暂无数据',
  chartNoNodeTime: '暂无节点耗时数据',
  chartNoTaskTime: '暂无任务耗时数据',
  chartNoTimeline: '暂无时间线数据',
  chartNoBug: '暂无缺陷数据',
  chartNoReviewIssue: '暂无自检问题数据',
  chartNoTrend: '暂无趋势数据',
  chartTotalTokens: '总 Token 消耗',
  chartDeviationCount: '偏差数量',
  chartAccumRules: '累计规则',
  chartQuantity: '数量',
  chartRules: '规则',

  // Bug severity
  bugCritical: '严重',
  bugHigh: '高',
  bugMedium: '中',
  bugLow: '低',

  // Team chart
  chartNoTeam: '暂无团队数据',
  chartCompletedTasks: '完成任务',
  chartDeviations: '偏差数',
  chartBugs: 'Bug 数',

  // Rules table
  rulesNoData: '暂无沉淀规则',
  rulesSource: '来源',
  rulesCategory: '类别',
  rulesRule: '规则',
  rulesTargetFile: '目标文件',
  rulesPending: '（待沉淀）',

  // Reviews table
  reviewsNoData: '暂无自检报告',
  reviewsIssues: '个问题',
  reviewsDetail: '自检详情',
  reviewsScope: '范围：',
  reviewsDate: '日期：',
  reviewsIssueCount: '问题数：',
  reviewsIssueList: '问题列表：',

  // Project overview
  ovTotalReqs: '总需求数',
  ovInProgress: '进行中',
  ovCompleted: '已完成',
  ovTaskCompletion: '任务完成',
  ovTotalDeviations: '总偏差',
  ovTotalBugs: '总缺陷',
  ovCodeLines: '代码行数',
  ovReqStatus: '需求状态分布',
  ovTeamEfficiency: '团队效率对比',
  ovReqList: '需求列表',
  ovTeamSummary: '团队成员汇总',
  ovBranch: '分支',
  ovTitle: '标题',
  ovStatus: '状态',
  ovTasks: '任务',
  ovDeviations: '偏差',
  ovDeveloper: '开发者',
  ovStartTime: '开始时间',
  ovLinesAdded: '+行数',
  ovAiHours: 'AI 工时',
  ovModule: '模块',
  ovHighlights: '业务价值亮点',
  ovAi: 'AI',
  ovManual: '手动',

  // Label map
  lmRuleMissing: '规则缺失',
  lmContextInsufficient: '上下文不足',
  lmHallucination: '盲目照搬/臆想',
  lmReqMisunderstand: '需求理解偏差',
  lmRefCopy: '参考照搬',
  lmProcessOmission: '流程遗漏',
  lmMultiRound: '多轮未收敛',
  lmContextLost: '上下文丢失',
  lmOtherReason: '其他原因',
  lmUiSpacing: 'UI/间距',
  lmLayout: '布局/结构',
  lmComponent: '组件使用',
  lmI18n: 'i18n/国际化',
  lmApi: 'API 接口',
  lmLogicError: '逻辑错误',
  lmArchitecture: '架构设计',
  lmStyle: '样式问题',
  lmProcessCache: '流程/缓存',
  lmOther: '其他',

  // NodeTimeChart
  nodeCodeGen: '代码生成',
  nodeBugFix: 'Bug 修复',
  nodeDeviationFix: '偏差修复',
  nodeSelfReview: '自检审查',
  nodeTaskSplit: '任务拆分',
  nodeReqAnalysis: '需求分析',
  nodeReqIngestion: '需求接入',
  nodeBuildVerify: '构建验证',

  // StageTimeDistribution
  stageUncategorized: '未分类',
  chartNoStageTime: '暂无阶段耗时数据',

  // FirstPassRateTrend
  chartNoReviewData: '暂无自检数据',

  // FileHotspot
  chartNoFileHotspot: '暂无文件热点数据',

  // DeviationPie / DeviationBar
  chartNoDeviation: '暂无偏差数据',

  // RequirementStatusChart
  reqCompleted: '已完成',
  reqInProgress: '进行中',
  reqPending: '待开始',
  reqFailed: '失败',
  chartNoReqData: '暂无需求数据',

  // Tooltip labels
  tipDuration: '耗时',
  tipTaskCount: '任务数',
} as const
