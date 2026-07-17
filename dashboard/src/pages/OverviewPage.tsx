import type { DashboardAssetIndex } from '../types';
import type { PageKey } from '../viewHelpers';
import { assetLabel } from '../viewHelpers';

interface OverviewPageProps {
  assets: DashboardAssetIndex | null;
  onNavigate: (page: PageKey) => void;
}

function ManifestBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="manifest-block">
      <div className="manifest-key">{label}</div>
      <div className="manifest-value">{children}</div>
    </div>
  );
}

export function OverviewPage({ assets, onNavigate }: OverviewPageProps) {
  if (!assets) return null;

  const { summary, signals, assets: allAssets } = assets;
  const total = allAssets.length;

  // Collect by source tool
  const byTool: Record<string, Record<string, number>> = {};
  for (const asset of allAssets) {
    if (!byTool[asset.sourceTool]) byTool[asset.sourceTool] = {};
    byTool[asset.sourceTool][asset.type] = (byTool[asset.sourceTool][asset.type] || 0) + 1;
  }
  const toolOrder = ['claude', 'cursor', 'codex', 'aida', 'generic', 'unknown'];
  const tools = toolOrder.filter((t) => byTool[t]);

  // Sorted asset types by count
  const typeEntries = Object.entries(summary).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0);

  const dupCount = signals.duplicateContentGroups.length;
  const unknownDirs = signals.unknownDotDirs;

  return (
    <section className="overview-page">
      <article className="overview-hero surface-card">
        <div>
          <div className="eyebrow">AI 资产清单</div>
          <h2>共 {total} 个资产</h2>
          <p>像 package.json 一样，快速了解本项目的全部 AI 资产分布。</p>
        </div>
        <button onClick={() => onNavigate('assets')}>浏览资产清单 →</button>
      </article>

      <section className="overview-columns" style={{ marginTop: 14 }}>
        {/* Left: manifest view */}
        <article className="surface-card page-card manifest-card">
          <div className="eyebrow" style={{ marginBottom: 14 }}>资产清单（类 package.json）</div>

          <ManifestBlock label="assets">
            <div className="manifest-rows">
              {typeEntries.map(([type, count]) => (
                <div key={type} className="manifest-row">
                  <span className="manifest-type">{assetLabel(type)}</span>
                  <span className="manifest-count">{count}</span>
                </div>
              ))}
            </div>
          </ManifestBlock>

          <ManifestBlock label="tools">
            <div className="manifest-rows">
              {tools.map((tool) => {
                const counts = byTool[tool];
                const toolTotal = Object.values(counts).reduce((s, n) => s + n, 0);
                return (
                  <div key={tool} className="manifest-row">
                    <span className="manifest-type">{tool}</span>
                    <span className="manifest-count">{toolTotal}</span>
                  </div>
                );
              })}
            </div>
          </ManifestBlock>

          <ManifestBlock label="signals">
            <div className="manifest-rows">
              <div className="manifest-row">
                <span className="manifest-type">重复内容组</span>
                <span className={`manifest-count${dupCount > 0 ? ' manifest-warn' : ''}`}>{dupCount}</span>
              </div>
              <div className="manifest-row">
                <span className="manifest-type">未知 dot-dirs</span>
                <span className={`manifest-count${unknownDirs.length > 0 ? ' manifest-warn' : ''}`}>{unknownDirs.length}</span>
              </div>
            </div>
          </ManifestBlock>
        </article>

        {/* Right: tool breakdown */}
        <article className="surface-card page-card">
          <div className="eyebrow" style={{ marginBottom: 14 }}>按工具分布</div>
          {tools.map((tool) => {
            const counts = byTool[tool];
            const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            return (
              <div key={tool} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>{tool}</div>
                <div className="manifest-rows">
                  {entries.map(([type, count]) => (
                    <div key={type} className="manifest-row">
                      <span className="manifest-type" style={{ color: 'var(--muted)' }}>{assetLabel(type)}</span>
                      <span className="manifest-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {unknownDirs.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'var(--accent-soft)', fontSize: 13 }}>
              <strong>未识别目录：</strong> {unknownDirs.join(', ')}
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
