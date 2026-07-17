import { useEffect, useMemo, useState } from 'react';
import { auditPlugin, buildPlugin, buildSelfPlugin, fetchAssets, fetchDecisions, scanAssets } from './api';
import { Shell } from './components/Shell';
import { AssetsPage } from './pages/AssetsPage';
import { MemoriesPage } from './pages/MemoriesPage';
import { OverviewPage } from './pages/OverviewPage';
import { PluginPage } from './pages/PluginPage';
import type { BuildPluginResult, DashboardAsset, DashboardAssetIndex, DashboardDecision, PluginRiskReport } from './types';
import { ASSET_LIMIT, assetLabel, filterAssets, type PageKey } from './viewHelpers';

type ThemeMode = 'system' | 'light' | 'dark';
type AssetView = 'all' | 'rule' | 'skill' | 'memory' | 'doc' | 'mcp-config' | 'command' | 'tool-config' | 'plugin';

function getStoredThemeMode(): ThemeMode {
  const value = window.localStorage.getItem('aida-dashboard-theme');
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function App() {
  const [activePage, setActivePage] = useState<PageKey>('overview');
  const [assets, setAssets] = useState<DashboardAssetIndex | null>(null);
  const [query, setQuery] = useState('');
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode);
  const [assetView, setAssetView] = useState<AssetView>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pluginPath, setPluginPath] = useState('');
  const [pluginRisk, setPluginRisk] = useState<PluginRiskReport | null>(null);
  const [pluginLoading, setPluginLoading] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [pluginName, setPluginName] = useState('');
  const [pluginDescription, setPluginDescription] = useState('');
  const [pluginVersion, setPluginVersion] = useState('0.1.0');
  const [pluginBuildResult, setPluginBuildResult] = useState<BuildPluginResult | null>(null);
  const [pluginBuildLoading, setPluginBuildLoading] = useState(false);
  const [decisions, setDecisions] = useState<DashboardDecision[]>([]);
  const [selfBuildLoading, setSelfBuildLoading] = useState(false);
  const [selfBuildResult, setSelfBuildResult] = useState<{ outputPath: string; skills: string[]; files: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
      const resolved = themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode;
      document.documentElement.dataset.theme = resolved;
    };
    syncTheme();
    window.localStorage.setItem('aida-dashboard-theme', themeMode);
    media.addEventListener('change', syncTheme);
    return () => media.removeEventListener('change', syncTheme);
  }, [themeMode]);

  useEffect(() => {
    void loadAll(true);
  }, []);

  async function loadAll(initial = false) {
    try {
      if (initial) setIsLoading(true);
      else setIsRefreshing(true);
      setError('');
      const [assetData, decisionsData] = await Promise.all([fetchAssets(), fetchDecisions()]);
      setAssets(assetData);
      setDecisions(decisionsData.decisions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载治理面板失败');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function handleScan() {
    try {
      setNotice('');
      setError('');
      setIsRefreshing(true);
      setAssets(await scanAssets());
      setNotice('资产已重新扫描，面板数据已刷新。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新扫描失败');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAuditPlugin() {
    if (!pluginPath.trim()) {
      setError('请先输入要审计的插件目录。');
      return;
    }
    try {
      setError('');
      setPluginLoading(true);
      setPluginRisk(await auditPlugin(pluginPath.trim()));
    } catch (err) {
      setPluginRisk(null);
      setError(err instanceof Error ? err.message : '插件审计失败');
    } finally {
      setPluginLoading(false);
    }
  }

  async function handleBuildPlugin() {
    if (!pluginName.trim()) { setError('请先填写 plugin 名称。'); return; }
    if (!pluginDescription.trim()) { setError('请先填写 plugin 描述。'); return; }
    if (selectedAssetIds.length === 0) { setError('请至少勾选一个资产后再导出 plugin。'); return; }
    try {
      setError('');
      setPluginBuildLoading(true);
      const result = await buildPlugin({
        name: pluginName.trim(),
        description: pluginDescription.trim(),
        version: pluginVersion.trim() || undefined,
        assetIds: selectedAssetIds,
      });
      setPluginBuildResult(result);
      setNotice(result.message);
    } catch (err) {
      setPluginBuildResult(null);
      setError(err instanceof Error ? err.message : '导出 plugin 失败');
    } finally {
      setPluginBuildLoading(false);
    }
  }

  async function handleBuildSelf() {
    try {
      setError('');
      setSelfBuildLoading(true);
      setSelfBuildResult(await buildSelfPlugin());
    } catch (err) {
      setError(err instanceof Error ? err.message : '打包 AIDA 失败');
    } finally {
      setSelfBuildLoading(false);
    }
  }

  function toggleAssetSelection(asset: DashboardAsset) {
    setSelectedAssetIds((current) =>
      current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id],
    );
  }

  const filtered = useMemo(() => filterAssets(assets?.assets || [], assetView, query), [assets, assetView, query]);
  const displayedAssets = filtered.slice(0, ASSET_LIMIT);
  const selectedAssets = useMemo(
    () => (assets?.assets || []).filter((item) => selectedAssetIds.includes(item.id)),
    [assets, selectedAssetIds],
  );

  const assetTypeTabs = useMemo(() => {
    const keys = ['all', 'rule', 'skill', 'memory', 'doc', 'mcp-config', 'command', 'tool-config', 'plugin'] as AssetView[];
    return keys.map((key) => ({
      key,
      label: assetLabel(key),
      count: key === 'all' ? assets?.assets.length || 0 : assets?.summary[key] || 0,
    }));
  }, [assets]);

  if (isLoading) return <div className="shell-state">正在加载 AIDA 治理面板…</div>;

  return (
    <Shell
      activePage={activePage}
      generatedAt={assets?.generatedAt}
      isRefreshing={isRefreshing}
      onNavigate={setActivePage}
      onRefresh={() => void loadAll()}
      onScan={handleScan}
      onThemeChange={setThemeMode}
      themeMode={themeMode}
    >
      {(notice || error) && <section className={error ? 'banner error' : 'banner'}>{error || notice}</section>}

      {activePage === 'overview' && (
        <OverviewPage
          assets={assets}
          onNavigate={setActivePage}
        />
      )}
      {activePage === 'assets' && (
        <AssetsPage
          assetView={assetView}
          assets={assets}
          displayedAssets={displayedAssets}
          filteredCount={filtered.length}
          query={query}
          selectedAssetIds={selectedAssetIds}
          tabs={assetTypeTabs}
          onAssetViewChange={(view) => setAssetView(view as AssetView)}
          onQueryChange={setQuery}
          onToggleAsset={toggleAssetSelection}
        />
      )}
      {activePage === 'memories' && (
        <MemoriesPage decisions={decisions} />
      )}
      {activePage === 'plugin' && (
        <PluginPage
          pluginBuildLoading={pluginBuildLoading}
          pluginBuildResult={pluginBuildResult}
          pluginDescription={pluginDescription}
          pluginLoading={pluginLoading}
          pluginName={pluginName}
          pluginPath={pluginPath}
          pluginRisk={pluginRisk}
          pluginVersion={pluginVersion}
          selectedAssets={selectedAssets}
          selfBuildLoading={selfBuildLoading}
          selfBuildResult={selfBuildResult}
          onAuditPlugin={() => void handleAuditPlugin()}
          onBuildPlugin={() => void handleBuildPlugin()}
          onBuildSelf={() => void handleBuildSelf()}
          onPluginDescriptionChange={setPluginDescription}
          onPluginNameChange={setPluginName}
          onPluginPathChange={setPluginPath}
          onPluginVersionChange={setPluginVersion}
          onToggleAsset={toggleAssetSelection}
        />
      )}
    </Shell>
  );
}

export default App;
