import type { PageKey } from '../viewHelpers';
import { formatTime } from '../viewHelpers';

type ThemeMode = 'system' | 'light' | 'dark';

interface ShellProps {
  activePage: PageKey;
  generatedAt?: string;
  isRefreshing: boolean;
  themeMode: ThemeMode;
  children: React.ReactNode;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
  onScan: () => void;
  onThemeChange: (mode: ThemeMode) => void;
}

const NAV_ITEMS: Array<{ key: PageKey; label: string; desc: string }> = [
  { key: 'overview', label: '总览', desc: '状态与下一步' },
  { key: 'assets', label: '资产', desc: '检索 / 选择' },
  { key: 'memories', label: '决策记忆', desc: '项目决策 MADR' },
  { key: 'plugin', label: '插件', desc: '审计 / 导出' },
];

export function Shell({
  activePage,
  children,
  generatedAt,
  isRefreshing,
  onNavigate,
  onRefresh,
  onScan,
  onThemeChange,
  themeMode,
}: ShellProps) {

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">A</div>
          <div>
            <strong>AIDA 3.0</strong>
            <span>Local Governance</span>
          </div>
        </div>
        <nav className="nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={activePage === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => onNavigate(item.key)}
            >
              <span>{item.label}</span>
              <em>{item.desc}</em>
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="scan-meta">
            <span>最近扫描</span>
            <strong>{formatTime(generatedAt)}</strong>
          </div>
          <div className="topbar-actions">
            <div className="theme-switcher icon-switcher" aria-label="主题切换">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  className={themeMode === mode ? 'theme-button icon-theme-button active' : 'theme-button icon-theme-button'}
                  onClick={() => onThemeChange(mode)}
                  title={mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色模式' : '深色模式'}
                >
                  {mode === 'system' ? '◐' : mode === 'light' ? '☼' : '☾'}
                </button>
              ))}
            </div>
            <button onClick={onScan} disabled={isRefreshing} title="重新扫描本地 AI 资产并写入索引">{isRefreshing ? '处理中…' : '扫描资产'}</button>
            <button className="ghost-button" onClick={onRefresh} disabled={isRefreshing} title="只刷新 Dashboard 数据，不重新扫描文件">刷新</button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
