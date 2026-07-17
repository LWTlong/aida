import { useState } from 'react';
import type { DashboardDecision } from '../types';

interface MemoriesPageProps {
  decisions: DashboardDecision[];
}

export function MemoriesPage({ decisions }: MemoriesPageProps) {
  const [selected, setSelected] = useState<DashboardDecision | null>(null);
  const [query, setQuery] = useState('');

  const filtered = decisions.filter((d) => {
    if (!query.trim()) return true;
    const kw = query.toLowerCase();
    return [d.title, d.context, d.decision, ...(d.tags || [])].join(' ').toLowerCase().includes(kw);
  });

  return (
    <div className="split-page" style={{ marginTop: 18 }}>
      {/* Left: decision list */}
      <div className="list-pane">
        <div style={{ marginBottom: 12 }}>
          <input
            placeholder="搜索决策标题、内容、标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 8, color: 'var(--muted)', fontSize: 13 }}>
          共 {filtered.length} 条决策记忆
        </div>
        <div className="compact-proposals">
          {filtered.length === 0 && (
            <div className="empty-state">
              {decisions.length === 0
                ? '暂无决策记忆。运行 /aida-remember 或 /aida-remember-branch 来记录第一条。'
                : '没有匹配的决策记忆。'}
            </div>
          )}
          {filtered.map((d) => (
            <button
              key={d.slug}
              className={selected?.slug === d.slug ? 'proposal-list-item active' : 'proposal-list-item'}
              style={{ padding: '12px 14px', marginBottom: 8 }}
              onClick={() => setSelected(d)}
            >
              <div className="item-title-row">
                <strong style={{ fontSize: 14 }}>{d.title}</strong>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{d.date}</span>
              </div>
              <small style={{ display: 'block', marginTop: 4 }}>
                {d.context.slice(0, 100)}{d.context.length > 100 ? '…' : ''}
              </small>
              {d.paths?.length ? (
                <em style={{ fontSize: 11 }}>{d.paths.join(', ')}</em>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Right: decision detail */}
      <div className="detail-page surface-card page-card">
        {!selected ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            从左侧选择一条决策查看详情
          </div>
        ) : (
          <div className="detail-stack">
            <div className="detail-block">
              <div className="detail-label">标题</div>
              <p style={{ fontWeight: 700, fontSize: 18 }}>{selected.title}</p>
            </div>
            {selected.paths?.length ? (
              <div className="detail-block">
                <div className="detail-label">生效路径（paths）</div>
                <p style={{ fontFamily: 'monospace', fontSize: 13 }}>{selected.paths.join(', ')}</p>
              </div>
            ) : null}
            <div className="detail-block">
              <div className="detail-label">背景（Context）</div>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{selected.context}</p>
            </div>
            <div className="detail-block">
              <div className="detail-label">决策（Decision）</div>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{selected.decision}</p>
            </div>
            {selected.consequences && (
              <div className="detail-block">
                <div className="detail-label">影响（Consequences）</div>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{selected.consequences}</p>
              </div>
            )}
            <div className="detail-block">
              <div className="detail-label">文件路径</div>
              <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{selected.filePath}</p>
            </div>
            {selected.tags?.length ? (
              <div className="detail-block">
                <div className="detail-label">标签</div>
                <p>{selected.tags.join(', ')}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
