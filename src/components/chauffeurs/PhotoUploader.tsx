'use client'

import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, Trash2, User } from 'lucide-react'

export default function PhotoUploader({ chauffeurId, initialUrl }: {
  chauffeurId: string
  initialUrl?: string | null
}) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement | null>(null)

  async function upload(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/chauffeurs/${chauffeurId}/photo`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      // cache-buster pour rafraîchir l'aperçu immédiatement
      setUrl(json.data.url ? `${json.data.url}?t=${Date.now()}` : null)
      toast.success('Photo enregistrée')
    } catch (err: any) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('Supprimer la photo ?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/chauffeurs/${chauffeurId}/photo`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setUrl(null)
      toast.success('Photo supprimée')
    } catch { toast.error('Erreur') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        border: `1.5px solid ${url ? 'rgba(154,122,40,0.4)' : '#d8d2c8'}`, background: '#f5f2ed',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <User size={28} style={{ color: '#c2bdb4' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: '#63605a', lineHeight: 1.5, marginBottom: '8px' }}>
          Photo du chauffeur (PNG, JPG ou WEBP). Format portrait/carré recommandé.
        </div>
        <input ref={el => { input.current = el }} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}>
            <Upload size={12} /> {busy ? '…' : url ? 'Remplacer' : 'Téléverser'}
          </button>
          {url && (
            <button type="button" onClick={remove} disabled={busy}
              style={{ background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', padding: '6px 10px', cursor: 'pointer', color: '#9e2a2a', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Trash2 size={12} /> Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
