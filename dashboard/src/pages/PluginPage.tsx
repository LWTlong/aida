import type { BuildPluginResult, DashboardAsset, PluginRiskReport } from '../types';
import { assetLabel, RISK_LABELS } from '../viewHelpers';

interface SelfBuildResult {
  outputPath: string;
  skills: string[];
  files: number;
}

interface PluginPageProps {
  pluginBuildLoading: boolean;
  pluginBuildResult: BuildPluginResult | null;
  pluginDescription: string;
  pluginLoading: boolean;
  pluginName: string;
  pluginPath: string;
  pluginRisk: PluginRiskReport | null;
  pluginVersion: string;
  selectedAssets: DashboardAsset[];
  selfBuildLoading: boolean;
  selfBuildResult: SelfBuildResult | null;
  onAuditPlugin: () => void;
  onBuildPlugin: () => void;
  onBuildSelf: () => void;
  onPluginDescriptionChange: (value: string) => void;
  onPluginNameChange: (value: string) => void;
  onPluginPathChange: (value: string) => void;
  onPluginVersionChange: (value: string) => void;
  onToggleAsset: (asset: DashboardAsset) => void;
}

export function PluginPage({
  onAuditPlugin,
  onBuildPlugin,
  onBuildSelf,
  onPluginDescriptionChange,
  onPluginNameChange,
  onPluginPathChange,
  onPluginVersionChange,
  onToggleAsset,
  pluginBuildLoading,
  pluginBuildResult,
  pluginDescription,
  pluginLoading,
  pluginName,
  pluginPath,
  pluginRisk,
  pluginVersion,
  selectedAssets,
  selfBuildLoading,
  selfBuildResult,
}: PluginPageProps) {
  return (
    <section className="plugin-page-grid">
      <article className="panel page-card">
        <div className="section-head"><div><h2>自由组合导出 Plugin</h2><p>从“资产”页勾选内容后，生成 Claude plugin 目录。</p></div></div>
        <div className="selected-assets-box">
          <div className="detail-label">已选资产预览</div>
          {selectedAssets.length === 0 ? (
            <div className="empty-inline">暂未选择资产。请先到“资产”页勾选后再导出。</div>
          ) : (
            <div className="selected-assets-list">
              {selectedAssets.map((asset) => (
                <button key={asset.id} className="selected-chip" onClick={() => onToggleAsset(asset)}>
                  <span>{asset.title}</span>
                  <em>{assetLabel(asset.type)}</em>
                  <strong>移除</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="build-form">
          <input value={pluginName} onChange={(event) => onPluginNameChange(event.target.value)} placeholder="Plugin 名称，例如 aida-governance-pack" />
          <input value={pluginDescription} onChange={(event) => onPluginDescriptionChange(event.target.value)} placeholder="Plugin 描述，说明用途与适用场景" />
          <input value={pluginVersion} onChange={(event) => onPluginVersionChange(event.target.value)} placeholder="版本号，例如 0.1.0" />
          <button onClick={onBuildPlugin} disabled={pluginBuildLoading}>{pluginBuildLoading ? '导出中…' : '导出 Plugin'}</button>
        </div>
        {pluginBuildResult && (
          <div className="plugin-result">
            <strong>导出完成</strong>
            <p>{pluginBuildResult.message}</p>
            <div className="detail-label">输出目录</div>
            <div className="path-inline">{pluginBuildResult.outputPath}</div>
            <div className="detail-label">写入文件</div>
            <ul className="operation-list compact-list">
              {pluginBuildResult.filesWritten.slice(0, 8).map((file) => <li key={file}><span>{file}</span></li>)}
            </ul>
          </div>
        )}
      </article>

      <div style={{ display: 'grid', gap: 18 }}>
        <article className="panel page-card">
          <div className="section-head"><div><h2>打包 AIDA 本身</h2><p>将 AIDA 内置技能打包成 Claude Plugin，方便团队共享。</p></div></div>
          <button onClick={onBuildSelf} disabled={selfBuildLoading} style={{ marginTop: 8 }}>
            {selfBuildLoading ? '打包中…' : '打包 AIDA 技能'}
          </button>
          {selfBuildResult && (
            <div className="plugin-result" style={{ marginTop: 12 }}>
              <strong>打包完成</strong>
              <div className="detail-label" style={{ marginTop: 8 }}>输出目录</div>
              <div className="path-inline">{selfBuildResult.outputPath}</div>
              <div className="detail-label" style={{ marginTop: 8 }}>包含技能 ({selfBuildResult.skills.length})</div>
              <ul className="operation-list compact-list">
                {selfBuildResult.skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </div>
          )}
        </article>

        <article className="panel page-card">
          <div className="section-head"><div><h2>Plugin 风险审计</h2><p>导入外部插件前先做静态检查，不执行任何脚本。</p></div></div>
        <div className="plugin-form">
          <input value={pluginPath} onChange={(event) => onPluginPathChange(event.target.value)} placeholder="输入本地插件目录，例如 /Users/me/Downloads/team-plugin" />
          <button onClick={onAuditPlugin} disabled={pluginLoading}>{pluginLoading ? '审计中…' : '开始审计'}</button>
        </div>
        {pluginRisk ? (
          <div className="plugin-result">
            <div className={`risk-pill ${pluginRisk.level}`}>{RISK_LABELS[pluginRisk.level]}</div>
            <p>{pluginRisk.summary}</p>
            {pluginRisk.findings.slice(0, 6).map((item) => (
              <div key={`${item.filePath}-${item.kind}`} className="finding-row">
                <strong>{item.signal}</strong>
                <span>{item.recommendation}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">这里适合先审计外部插件，再决定是否生成导入 proposal。</div>
        )}
      </article>
      </div>
    </section>
  );
}
