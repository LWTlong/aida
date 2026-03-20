import { useRunData, ALL_PROJECT_ID } from './hooks/useRunData'
import { useOverviewData } from './hooks/useOverviewData'
import { Header } from './components/Header'
import { KpiRow } from './components/KpiRow'
import { ChartCard } from './components/ChartCard'
import { TaskChart } from './components/charts/TaskChart'
import { DeviationPie } from './components/charts/DeviationPie'
import { DeviationBar } from './components/charts/DeviationBar'
import { FileHotspot } from './components/charts/FileHotspot'
import { DeviationTrend } from './components/charts/DeviationTrend'
import { NodeTimeChart } from './components/charts/NodeTimeChart'
import { TaskTimeRanking } from './components/charts/TaskTimeRanking'
import { StageTimeDistribution } from './components/charts/StageTimeDistribution'
import { FirstPassRateTrend } from './components/charts/FirstPassRateTrend'
import { ReviewIssueTypes } from './components/charts/ReviewIssueTypes'
import { BugSeverityChart } from './components/charts/BugSeverityChart'
import { Timeline } from './components/Timeline'
import { RulesTable } from './components/RulesTable'
import { ReviewsTable } from './components/ReviewsTable'
import { ProjectOverview } from './components/ProjectOverview'

function App() {
  const { runs, currentRunId, setCurrentRunId, runData, loading, connected } = useRunData()
  const { data: overviewData, loading: overviewLoading } = useOverviewData()

  const isOverview = currentRunId === ALL_PROJECT_ID

  if (loading && !runData && !isOverview) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#6b7b8d]">
        加载中...
      </div>
    )
  }

  if (isOverview && overviewLoading && !overviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#6b7b8d]">
        加载中...
      </div>
    )
  }

  // Handle selecting a branch from overview table
  const handleSelectBranch = (branch: string) => {
    const run = runs.find((r) => r.branch === branch)
    if (run) {
      setCurrentRunId(run.runId)
    }
  }

  // No data at all
  if (!isOverview && !runData) {
    return (
      <div>
        <Header
          runs={runs}
          currentRunId={currentRunId}
          onSelectRun={setCurrentRunId}
          meta={null}
          connected={connected}
        />
        <div className="text-center py-20 text-[#6b7b8d]">
          <h2 className="text-lg mb-2 text-[#e0e6ed]">暂无运行数据</h2>
          <p>
            使用 <code className="bg-[#162231] px-2 py-0.5 rounded text-[13px]">aidevos start FEATURE-001</code> 开始一次开发运行
          </p>
        </div>
      </div>
    )
  }

  // Project overview mode
  if (isOverview) {
    return (
      <div>
        <Header
          runs={runs}
          currentRunId={currentRunId}
          onSelectRun={setCurrentRunId}
          meta={null}
          connected={connected}
        />
        {overviewData ? (
          <ProjectOverview data={overviewData} onSelectBranch={handleSelectBranch} />
        ) : (
          <div className="text-center py-20 text-[#6b7b8d]">
            <h2 className="text-lg mb-2 text-[#e0e6ed]">暂无项目总览数据</h2>
            <p>
              使用 <code className="bg-[#162231] px-2 py-0.5 rounded text-[13px]">aidevos reindex</code> 生成项目索引
            </p>
          </div>
        )}
        <div className="text-center py-6 text-[#3d4f5f] text-xs border-t border-[#1e2d3d] mt-5">
          AIDevOS 项目总览
        </div>
      </div>
    )
  }

  // Branch detail mode
  return (
    <div>
      <Header
        runs={runs}
        currentRunId={currentRunId}
        onSelectRun={setCurrentRunId}
        meta={runData!.meta}
        connected={connected}
      />

      <KpiRow data={runData!} />

      <div className="grid grid-cols-2 gap-4 px-8 pb-5 max-md:grid-cols-1">
        {/* 效率与耗时 */}
        <ChartCard title="各节点累计耗时">
          <NodeTimeChart metrics={runData!.metrics} />
        </ChartCard>

        <ChartCard title="任务耗时排行 TOP 10">
          <TaskTimeRanking tasks={runData!.tasks} />
        </ChartCard>

        <ChartCard title="阶段时间分布">
          <StageTimeDistribution workflow={runData!.workflow} />
        </ChartCard>

        <ChartCard title="开发时间线">
          <Timeline items={runData!.timeline} prdPhases={runData!.meta.prdPhases} />
        </ChartCard>

        {/* 质量与偏差 */}
        <ChartCard title="各阶段任务完成情况">
          <TaskChart tasks={runData!.tasks} prdPhases={runData!.meta.prdPhases} />
        </ChartCard>

        <ChartCard title="首次通过率趋势">
          <FirstPassRateTrend reviews={runData!.reviews} />
        </ChartCard>

        <ChartCard title="偏差根因分析">
          <DeviationPie deviations={runData!.deviations} />
        </ChartCard>

        <ChartCard title="偏差类别分布">
          <DeviationBar deviations={runData!.deviations} />
        </ChartCard>

        <ChartCard title="Bug 严重度分布">
          <BugSeverityChart bugs={runData!.bugs} />
        </ChartCard>

        <ChartCard title="自检问题分类">
          <ReviewIssueTypes reviews={runData!.reviews} />
        </ChartCard>

        <ChartCard title="文件修改热点（偏差/缺陷修复）">
          <FileHotspot deviations={runData!.deviations} bugs={runData!.bugs} />
        </ChartCard>

        <ChartCard title="偏差数量与规则沉淀趋势">
          <DeviationTrend deviations={runData!.deviations} rules={runData!.rules} />
        </ChartCard>

        <ChartCard title="偏差沉淀的规则" full>
          <RulesTable rules={runData!.rules} deviations={runData!.deviations} />
        </ChartCard>

        <ChartCard title="自检报告汇总" full>
          <ReviewsTable reviews={runData!.reviews} />
        </ChartCard>
      </div>

      <div className="text-center py-6 text-[#3d4f5f] text-xs border-t border-[#1e2d3d] mt-5">
        AIDevOS AI 开发质量看板
      </div>
    </div>
  )
}

export default App
