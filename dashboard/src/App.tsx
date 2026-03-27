import { useState } from 'react'
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
import { ProjectOverview } from './components/ProjectOverview'
import { LocaleContext, getTranslations, getStoredLocale, storeLocale, type Locale } from './i18n'

function App() {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale)
  const t = getTranslations(locale)

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    storeLocale(l)
  }

  const { runs, currentRunId, setCurrentRunId, runData, loading, connected } = useRunData()
  const { data: overviewData, loading: overviewLoading } = useOverviewData()

  const isOverview = currentRunId === ALL_PROJECT_ID

  if (loading && !runData && !isOverview && runs.length !== 0) {
    return (
      <LocaleContext.Provider value={{ locale, setLocale, t }}>
        <div className="min-h-screen flex items-center justify-center text-[#6b7b8d]">
          {t.loading}
        </div>
      </LocaleContext.Provider>
    )
  }

  if (isOverview && overviewLoading && !overviewData) {
    return (
      <LocaleContext.Provider value={{ locale, setLocale, t }}>
        <div className="min-h-screen flex items-center justify-center text-[#6b7b8d]">
          {t.loading}
        </div>
      </LocaleContext.Provider>
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
      <LocaleContext.Provider value={{ locale, setLocale, t }}>
        <div>
          <Header
            runs={runs}
            currentRunId={currentRunId}
            onSelectRun={setCurrentRunId}
            meta={null}
            connected={connected}
          />
          <div className="text-center py-20 text-[#6b7b8d]">
            <h2 className="text-lg mb-2 text-[#e0e6ed]">{t.noRunData}</h2>
            <p dangerouslySetInnerHTML={{ __html: t.noRunDataHint }} className="[&_code]:bg-[#162231] [&_code]:px-2 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]" />
          </div>
        </div>
      </LocaleContext.Provider>
    )
  }

  // Project overview mode
  if (isOverview) {
    return (
      <LocaleContext.Provider value={{ locale, setLocale, t }}>
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
              <h2 className="text-lg mb-2 text-[#e0e6ed]">{t.noOverviewData}</h2>
              <p dangerouslySetInnerHTML={{ __html: t.noOverviewDataHint }} className="[&_code]:bg-[#162231] [&_code]:px-2 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]" />
            </div>
          )}
          <div className="text-center py-6 text-[#3d4f5f] text-xs border-t border-[#1e2d3d] mt-5">
            {t.footerOverview}
          </div>
        </div>
      </LocaleContext.Provider>
    )
  }

  // Branch detail mode
  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
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
          {Object.keys(runData!.metrics.nodeTimeBreakdown || {}).length > 0 && (
            <ChartCard title={t.chartNodeTime}>
              <NodeTimeChart metrics={runData!.metrics} />
            </ChartCard>
          )}

          {runData!.tasks.length > 0 && (
            <ChartCard title={t.chartTaskRanking}>
              <TaskTimeRanking tasks={runData!.tasks} />
            </ChartCard>
          )}

          {runData!.workflow.length > 0 && (
            <ChartCard title={t.chartStageTime}>
              <StageTimeDistribution workflow={runData!.workflow} />
            </ChartCard>
          )}

          <ChartCard title={t.chartTimeline}>
            <Timeline items={runData!.timeline} prdPhases={runData!.meta.prdPhases} />
          </ChartCard>

          {runData!.tasks.length > 0 && (
            <ChartCard title={t.chartTaskCompletion}>
              <TaskChart tasks={runData!.tasks} prdPhases={runData!.meta.prdPhases} />
            </ChartCard>
          )}

          {runData!.reviews.length > 0 && (
            <ChartCard title={t.chartFirstPassRate}>
              <FirstPassRateTrend reviews={runData!.reviews} />
            </ChartCard>
          )}

          {runData!.deviations.length > 0 && (
            <ChartCard title={t.chartDeviationPie}>
              <DeviationPie deviations={runData!.deviations} />
            </ChartCard>
          )}

          {runData!.deviations.length > 0 && (
            <ChartCard title={t.chartDeviationBar}>
              <DeviationBar deviations={runData!.deviations} />
            </ChartCard>
          )}

          {runData!.bugs.length > 0 && (
            <ChartCard title={t.chartBugSeverity}>
              <BugSeverityChart bugs={runData!.bugs} />
            </ChartCard>
          )}

          {runData!.reviews.length > 0 && (
            <ChartCard title={t.chartReviewIssues}>
              <ReviewIssueTypes reviews={runData!.reviews} />
            </ChartCard>
          )}

          {(runData!.deviations.length > 0 || runData!.bugs.length > 0) && (
            <ChartCard title={t.chartFileHotspot}>
              <FileHotspot deviations={runData!.deviations} bugs={runData!.bugs} />
            </ChartCard>
          )}

          {runData!.deviations.length > 0 && (
            <ChartCard title={t.chartDeviationTrend}>
              <DeviationTrend deviations={runData!.deviations} rules={runData!.rules} />
            </ChartCard>
          )}

          {runData!.rules.length > 0 && (
            <ChartCard title={t.chartRulesTable} full>
              <RulesTable rules={runData!.rules} deviations={runData!.deviations} />
            </ChartCard>
          )}
        </div>

        <div className="text-center py-6 text-[#3d4f5f] text-xs border-t border-[#1e2d3d] mt-5">
          {t.footerDashboard}
        </div>
      </div>
    </LocaleContext.Provider>
  )
}

export default App
