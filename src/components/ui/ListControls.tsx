'use client'

import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'

export function SearchBar({ value, onChange, placeholder, onExport }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onExport?: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8a8478', pointerEvents: 'none' }} />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? 'Rechercher…'}
          className="input"
          style={{ paddingLeft: '32px' }}
        />
      </div>
      {onExport && (
        <button onClick={onExport} className="btn-ghost" style={{ padding: '8px 12px', fontSize: '11px', flexShrink: 0 }}>
          <Download size={13} /> Export CSV
        </button>
      )}
    </div>
  )
}

export function Pager({ page, pageCount, total, onPage }: {
  page: number
  pageCount: number
  total: number
  onPage: (p: number) => void
}) {
  if (total === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '11px', color: '#8a8478' }}>
        {total} résultat{total > 1 ? 's' : ''}{pageCount > 1 ? ` · page ${page}/${pageCount}` : ''}
      </span>
      {pageCount > 1 && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button onClick={() => onPage(page - 1)} disabled={page <= 1}
            className="btn-ghost" style={{ padding: '5px 9px', opacity: page <= 1 ? 0.4 : 1 }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#5a564e', minWidth: '54px', textAlign: 'center' }}>
            {page} / {pageCount}
          </span>
          <button onClick={() => onPage(page + 1)} disabled={page >= pageCount}
            className="btn-ghost" style={{ padding: '5px 9px', opacity: page >= pageCount ? 0.4 : 1 }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
