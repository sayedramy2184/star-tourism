'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, FileCheck2, ScrollText, PenLine, ExternalLink, Trash2, Check } from 'lucide-react'

type DocEntry = { url: string; kind: 'pdf' | 'image'; name: string } | null

const ROWS = [
  { key: 'attestation', label: "Attestation d'assurance", hint: 'Transport de personnes — PDF ou image', icon: FileCheck2, accept: '.pdf,image/*' },
  { key: 'licence', label: 'Licence EVTC', hint: 'Exploitation VTC (ex-LOTI) — PDF ou image', icon: ScrollText, accept: '.pdf,image/*' },
  { key: 'signature', label: 'Signature / cachet du gérant', hint: "Image — apparaît sur l'ordre de mission", icon: PenLine, accept: 'image/*' },
] as const

export default function DocumentsOfficiels() {
  const [docs, setDocs] = useState<Record<string, DocEntry>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    fetch('/api/societe/documents')
      .then(r => r.json())
      .then(({ data }) => setDocs(data ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  async function upload(type: string, file: File) {
    setBusy(type)
    try {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('file', file)
      const res = await fetch('/api/societe/documents', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setDocs(prev => ({ ...prev, [type]: json.data }))
      toast.success('Document téléversé')
    } catch (err: any) { toast.error(err.message) }
    finally { setBusy(null) }
  }

  async function remove(type: string) {
    if (!confirm('Supprimer ce document ?')) return
    setBusy(type)
    try {
      const res = await fetch(`/api/societe/documents?type=${type}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDocs(prev => ({ ...prev, [type]: null }))
      toast.success('Document supprimé')
    } catch { toast.error('Erreur') }
    finally { setBusy(null) }
  }

  return (
    <div className="card">
      <div className="card-header"><span className="card-header-title">Documents officiels (contrôle chauffeur)</span></div>
      <div style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: '12px', color: '#5a564e', lineHeight: 1.6, marginBottom: '16px' }}>
          Ces documents sont affichables par les chauffeurs sur leur téléphone en cas de contrôle.
          L'ordre de mission est généré automatiquement ; l'attestation et la licence sont les fichiers ci-dessous.
        </p>

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#8a8478', fontSize: '12px' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ROWS.map(row => {
              const Icon = row.icon
              const doc = docs[row.key]
              return (
                <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: doc ? '#eaf4ee' : '#f5f2ed', border: `1.5px solid ${doc ? 'rgba(30,94,58,0.25)' : '#d8d2c8'}` }}>
                  <Icon size={20} style={{ color: doc ? '#1e5e3a' : '#8a8478', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#16130e' }}>{row.label}</div>
                    {doc ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#1e5e3a', marginTop: '2px' }}>
                        <Check size={12} /> Fourni ·
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: '#1e3f70', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <ExternalLink size={11} /> Voir
                        </a>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#8a8478', marginTop: '2px' }}>{row.hint}</div>
                    )}
                  </div>
                  <input
                    ref={el => { inputs.current[row.key] = el }}
                    type="file" accept={row.accept} style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) upload(row.key, f); e.target.value = '' }} />
                  <button onClick={() => inputs.current[row.key]?.click()} disabled={busy === row.key}
                    className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0 }}>
                    <Upload size={12} /> {busy === row.key ? '…' : doc ? 'Remplacer' : 'Téléverser'}
                  </button>
                  {doc && (
                    <button onClick={() => remove(row.key)} disabled={busy === row.key}
                      style={{ background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', padding: '6px 8px', cursor: 'pointer', color: '#9e2a2a', flexShrink: 0 }} title="Supprimer">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
