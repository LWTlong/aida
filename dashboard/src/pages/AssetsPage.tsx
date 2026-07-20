import { useState, useMemo } from 'react';
import type { DashboardAsset, DashboardAssetIndex } from '../types';
import { ASSET_LIMIT, assetLabel } from '../viewHelpers';

interface AssetsPageProps {
  assetView: string;
  assets: DashboardAssetIndex | null;
  displayedAssets: DashboardAsset[];
  filteredCount: number;
  query: string;
  selectedAssetIds: string[];
  tabs: Array<{ key: string; label: string; count: number }>;
  onAssetViewChange: (view: string) => void;
  onQueryChange: (query: string) => void;
  onToggleAsset: (asset: DashboardAsset) => void;
}

function groupAssets(assets: DashboardAsset[]) {
  const map = new Map<string, DashboardAsset[]>();
  for (const a of assets) {
    const list = map.get(a.sourcePath) ?? [];
    list.push(a);
    map.set(a.sourcePath, list);
  }
  return [...map.entries()].map(([path, items]) => ({ path, items }));
}

function shortPath(p: string) {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.length > 3 ? '…/' + parts.slice(-3).join('/') : p;
}

export function AssetsPage({
  assetView,
  assets,
  displayedAssets,
  filteredCount,
  onAssetViewChange,
  onQueryChange,
  onToggleAsset,
  query,
  selectedAssetIds,
  tabs,
}: AssetsPageProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupAssets(displayedAssets), [displayedAssets]);

  function toggleExpand(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function isAllSelected(items: DashboardAsset[]) {
    return items.every((a) => selectedAssetIds.includes(a.id));
  }

  function toggleGroup(items: DashboardAsset[]) {
    if (isAllSelected(items)) {
      items.forEach((a) => { if (selectedAssetIds.includes(a.id)) onToggleAsset(a); });
    } else {
      items.forEach((a) => { if (!selectedAssetIds.includes(a.id)) onToggleAsset(a); });
    }
  }

  return (
    <section className="panel page-card">
      <div className="section-head">
        <div>
          <h2>资产清单</h2>
          <p>检索当前被 AIDA 纳入治理视图的资产，并自由组合导出 plugin。</p>
        </div>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="按名称、类型、路径或信号筛选"
        />
      </div>
      <div className="tab-row">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={assetView === tab.key ? 'tab-button active' : 'tab-button'}
            onClick={() => onAssetViewChange(tab.key)}
          >
            {tab.label} · {tab.count}
          </button>
        ))}
      </div>
      <div className="asset-hints">
        <span>重复内容组：{assets?.signals.duplicateContentGroups.length ?? 0}</span>
        <span>未知目录：{assets?.signals.unknownDotDirs.length ?? 0}</span>
        <span>已选资产：{selectedAssetIds.length}</span>
        {filteredCount > ASSET_LIMIT && (
          <span>当前仅展示前 {ASSET_LIMIT} 条，请继续筛选后再操作。</span>
        )}
      </div>

      <div className="file-tree">
        {groups.length === 0 && (
          <div className="empty-state">暂无资产，请先在对话中运行 AIDA 扫描。</div>
        )}
        {groups.map(({ path, items }) => {
          const multi = items.length > 1;
          const isOpen = expanded.has(path);
          const representative = items[0];
          const allSel = isAllSelected(items);

          return (
            <div key={path} className="file-group">
              <div className="file-row">
                <input
                  type="checkbox"
                  checked={allSel}
                  onChange={() => (multi ? toggleGroup(items) : onToggleAsset(representative))}
                />
                <span className="file-path" title={path}>{shortPath(path)}</span>
                <span className="file-meta">
                  <span className="file-tool">{representative.sourceTool}</span>
                  <span className="file-type">{assetLabel(representative.type)}</span>
                  {multi && <span className="file-count">{items.length} 项</span>}
                </span>
                {multi && (
                  <button
                    className="expand-toggle"
                    onClick={() => toggleExpand(path)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? '收起' : '展开'}
                  </button>
                )}
              </div>

              {((multi && isOpen) || (!multi && representative.contentExcerpt)) && (
                <div className="asset-children">
                  {items.map((item) => (
                    <div key={item.id} className="asset-child-row">
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.includes(item.id)}
                        onChange={() => onToggleAsset(item)}
                      />
                      <div className="asset-child-body">
                        <span className="asset-child-title">{item.title}</span>
                        {item.contentExcerpt && (
                          <span className="asset-child-excerpt">{item.contentExcerpt}</span>
                        )}
                      </div>
                      <span className="file-type">{assetLabel(item.type)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
