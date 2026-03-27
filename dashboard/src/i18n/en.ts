export const en = {
  // Common
  loading: 'Loading...',
  noData: 'No data',
  save: 'Save & Calculate',
  saving: 'Saving...',
  clickToSet: 'Click to set',
  hours: 'hours',
  eg: 'e.g.',

  // Currency
  currency: '$',
  currencyLabel: 'USD',
  perHour: '$/h',
  exchangeRate: '1',

  // Header
  branch: 'Branch',
  developer: 'Developer',
  cycle: 'Cycle',
  projectOverviewNav: 'Project Overview',
  dashboardTitle: 'AI Dev Dashboard',
  projectOverviewTitle: 'AIDevOS Project Overview',
  sseConnected: 'SSE Connected',
  sseDisconnected: 'SSE Disconnected',

  // App
  noRunData: 'No data yet',
  noRunDataHint: 'Start a development run with your AI tool to collect data.<br/><br/>1. Add MCP config to your project (<code>.mcp.json</code>)<br/>2. Start coding with your AI tool — AIDA collects data automatically<br/>3. Refresh this page to see your data',
  noOverviewData: 'No project overview data',
  noOverviewDataHint: 'Use <code>aida reindex</code> to generate project index',
  footerDashboard: 'AIDevOS AI Development Quality Dashboard',
  footerOverview: 'AIDevOS Project Overview',

  // Chart titles (App.tsx)
  chartNodeTime: 'Cumulative Time per Node',
  chartTaskRanking: 'Latest 15 Tasks Duration',
  chartStageTime: 'Phase Time Distribution',
  chartTimeline: 'Development Timeline',
  chartTaskCompletion: 'Task Completion by Phase',
  chartFirstPassRate: 'First Pass Rate Trend',
  chartDeviationPie: 'Deviation Root Cause',
  chartDeviationBar: 'Deviation Category Distribution',
  chartBugSeverity: 'Bug Severity Distribution',
  chartReviewIssues: 'Review Issue Types',
  chartFileHotspot: 'File Modification Hotspots',
  chartDeviationTrend: 'Deviation & Rule Trend',
  chartRulesTable: 'Rules from Deviations',
  chartReviewsTable: 'Review Report Summary',

  // KPI cards
  kpiPrd: 'PRD Progress',
  kpiTasks: 'Tasks',
  kpiDeviation: 'Deviations',
  kpiBug: 'Bugs Fixed',
  kpiReviewRate: 'Review Pass Rate',
  kpiTokens: 'Token Usage',
  kpiFiles: 'Files Changed',
  kpiTime: 'Work Hours',
  kpiRoi: 'Cost Savings',

  // KPI modals
  modalTasks: 'Task Details',
  modalDeviation: 'Deviation Details',
  modalBug: 'Bug Details',
  modalPrd: 'PRD Phases',
  modalReview: 'Review Report',
  modalFiles: 'Changed Files',
  modalTime: 'Work Hours Details',
  modalRoi: 'Cost Analysis',
  modalTokens: 'Token Usage Details',

  // Table headers
  thId: 'ID',
  thTitle: 'Title',
  thPhase: 'Phase',
  thPrd: 'PRD',
  thStatus: 'Status',
  thRootCause: 'Root Cause',
  thCategory: 'Category',
  thFiles: 'Files',
  thSeverity: 'Severity',
  thFix: 'Fix',
  thNumber: 'No.',
  thDate: 'Date',
  thScope: 'Scope',
  thIssueCount: 'Issues',
  thResult: 'Result',
  thFilePath: 'File Path',
  thOperation: 'Action',
  thLineChanges: '+/-',
  thChangeCount: 'Changes',
  thDuration: 'Duration',
  thStartTime: 'Start Time',

  // KPI modal: tasks completed
  tasksCompleted: 'tasks completed',

  // KPI modal: time
  timeActualAi: 'Actual AI Work Hours',
  timeEstManual: 'Est. Manual Hours',
  timeEfficiency: 'Efficiency Multiplier',
  timeNodeDetail: 'Node Time Breakdown',

  // KPI modal: ROI
  roiSettingTitle: 'Cost Settings',
  roiSettingHint: 'Fill in the info below to calculate cost savings',
  roiEstManualHours: 'Est. Manual Hours',
  roiHourlyRate: 'Hourly Rate',
  roiCostComparison: 'Cost Comparison',
  roiManualCost: 'Manual Cost',
  roiAiCost: 'AI Token Cost',
  roiSaved: 'Cost Saved',
  roiValue: 'Savings per $1 AI Cost',
  roiTimeComparison: 'Time Comparison',
  roiHoursSaved: 'Human Hours Replaced by AI',
  roiAiProcessTime: 'AI Processing Time',

  // KPI modal: tokens
  tokenTotal: 'Total Tokens',
  tokenInput: 'Input Tokens',
  tokenOutput: 'Output Tokens',
  tokenCacheCreation: 'Cache Creation',
  tokenCacheRead: 'Cache Read',
  tokenPerPhase: 'Token Usage per Phase',

  // Charts
  chartNoData: 'No data',
  chartNoNodeTime: 'No node time data',
  chartNoTaskTime: 'No task time data',
  chartNoTimeline: 'No timeline data',
  chartNoBug: 'No bug data',
  chartNoReviewIssue: 'No review issue data',
  chartNoTrend: 'No trend data',
  chartTotalTokens: 'Total Token Usage',
  chartDeviationCount: 'Deviations',
  chartAccumRules: 'Accumulated Rules',
  chartQuantity: 'Quantity',
  chartRules: 'Rules',

  // Bug severity
  bugCritical: 'Critical',
  bugHigh: 'High',
  bugMedium: 'Medium',
  bugLow: 'Low',

  // Team chart
  chartNoTeam: 'No team data',
  chartCompletedTasks: 'Tasks Done',
  chartDeviations: 'Deviations',
  chartBugs: 'Bugs',

  // Rules table
  rulesNoData: 'No rules yet',
  rulesSource: 'Source',
  rulesCategory: 'Category',
  rulesRule: 'Rule',
  rulesTargetFile: 'Target File',
  rulesPending: '(pending)',

  // Reviews table
  reviewsNoData: 'No review reports',
  reviewsIssues: 'issues',
  reviewsDetail: 'Review Details',
  reviewsScope: 'Scope:',
  reviewsDate: 'Date:',
  reviewsIssueCount: 'Issues:',
  reviewsIssueList: 'Issue List:',

  // Project overview
  ovTotalReqs: 'Total Requirements',
  ovInProgress: 'In Progress',
  ovCompleted: 'Completed',
  ovTaskCompletion: 'Task Completion',
  ovTotalDeviations: 'Total Deviations',
  ovTotalBugs: 'Total Bugs',
  ovCodeLines: 'Lines of Code',
  ovReqStatus: 'Requirement Status',
  ovTeamEfficiency: 'Team Efficiency',
  ovReqList: 'Requirement List',
  ovTeamSummary: 'Team Summary',
  ovBranch: 'Branch',
  ovTitle: 'Title',
  ovStatus: 'Status',
  ovTasks: 'Tasks',
  ovDeviations: 'Deviations',
  ovDeveloper: 'Developer',
  ovStartTime: 'Start Time',
  ovLinesAdded: '+Lines',
  ovAiHours: 'AI Hours',
  ovModule: 'Module',
  ovHighlights: 'Business Value Highlights',
  ovAi: 'AI',
  ovManual: 'Manual',

  // Label map
  lmRuleMissing: 'Rule Missing',
  lmContextInsufficient: 'Insufficient Context',
  lmHallucination: 'Hallucination',
  lmReqMisunderstand: 'Requirement Misunderstanding',
  lmRefCopy: 'Reference Copy',
  lmProcessOmission: 'Process Omission',
  lmMultiRound: 'Multi-round Unconverged',
  lmContextLost: 'Context Lost',
  lmOtherReason: 'Other',
  lmUiSpacing: 'UI/Spacing',
  lmLayout: 'Layout/Structure',
  lmComponent: 'Component Usage',
  lmI18n: 'i18n',
  lmApi: 'API',
  lmLogicError: 'Logic Error',
  lmArchitecture: 'Architecture',
  lmStyle: 'Style Issue',
  lmProcessCache: 'Process/Cache',
  lmOther: 'Other',

  // NodeTimeChart
  nodeCodeGen: 'Code Generation',
  nodeBugFix: 'Bug Fix',
  nodeDeviationFix: 'Deviation Fix',
  nodeSelfReview: 'Self Review',
  nodeTaskSplit: 'Task Split',
  nodeReqAnalysis: 'Requirement Analysis',
  nodeReqIngestion: 'Requirement Ingestion',
  nodeBuildVerify: 'Build Verification',

  // StageTimeDistribution
  stageUncategorized: 'Uncategorized',
  chartNoStageTime: 'No stage time data',

  // FirstPassRateTrend
  chartNoReviewData: 'No review data',

  // FileHotspot
  chartNoFileHotspot: 'No file hotspot data',

  // DeviationPie / DeviationBar
  chartNoDeviation: 'No deviation data',

  // RequirementStatusChart
  reqCompleted: 'Completed',
  reqInProgress: 'In Progress',
  reqPending: 'Pending',
  reqFailed: 'Failed',
  chartNoReqData: 'No requirement data',

  // Tooltip labels
  tipDuration: 'Duration',
  tipTaskCount: 'Tasks',
} as const
