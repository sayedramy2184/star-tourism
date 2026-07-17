'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, Trash2, ImageIcon } from 'lucide-react'

type Logo = { url: string; kind: 'pdf' | 'image'; name: string } | null

export default function LogoUploader() {
  const [logo, setLogo] = useState<Logo>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement | null>(null)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    fetch('/api/societe/documents')
      .then(r => r.json())
      .then(({ data }) => setLogo(data?.logo ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  async function upload(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('type', 'logo')
      fd.append('file', file)
      const res = await fetch('/api/societe/documents', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setLogo(json.data)
      toast.success('Logo enregistré')
    } catch (err: any) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('Supprimer le logo ?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/societe/documents?type=logo', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setLogo(null)
      toast.success('Logo supprimé')
    } catch { toast.error('Erreur') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* Aperçu */}
        <div style={{
          width: 96, height: 96, flexShrink: 0,
          border: `1.5px solid ${logo ? 'rgba(154,122,40,0.3)' : '#d8d2c8'}`,
          background: logo ? '#fff' : '#f5f2ed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {loading ? (
            <span style={{ fontSize: '10px', color: '#8a8478' }}>…</span>
          ) : logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.url} alt="Logo société" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <ImageIcon size={30} style={{ color: '#c2bdb4' }} />
          )}
        </div>

        {/* Actions */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#16130e' }}>Logo de la société</div>
          <div style={{ fontSize: '11px', color: '#8a8478', marginTop: '2px', lineHeight: 1.5 }}>
            Image carrée de préférence (PNG, JPG ou WEBP). Fond transparent recommandé.
          </div>
          <input
            ref={el => { input.current = el }}
            type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => input.current?.click()} disabled={busy}
              className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}>
              <Upload size={12} /> {busy ? '…' : logo ? 'Remplacer' : 'Téléverser'}
            </button>
            {logo && (
              <button onClick={remove} disabled={busy}
                style={{ background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', padding: '6px 10px', cursor: 'pointer', color: '#9e2a2a', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Trash2 size={12} /> Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
