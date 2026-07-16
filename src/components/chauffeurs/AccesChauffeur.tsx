'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { KeyRound, ShieldCheck, Copy, Check, RefreshCw, Trash2, Smartphone } from 'lucide-react'

interface Props {
  chauffeurId: string
  hasAccess: boolean
  email: string | null
}

export default function AccesChauffeur({ chauffeurId, hasAccess, email }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [formEmail, setFormEmail] = useState(email ?? '')
  const [formPassword, setFormPassword] = useState('')
  const [busy, setBusy] = useState<null | 'create' | 'reset' | 'revoke'>(null)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/chauffeur` : '/chauffeur'

  async function create() {
    if (!formEmail.trim()) return toast.error('Email requis')
    setBusy('create')
    try {
      const res = await fetch(`/api/chauffeurs/${chauffeurId}/acces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail.trim(), password: formPassword || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setCreds(json.data)
      setShowForm(false)
      toast.success('Accès créé')
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setBusy(null) }
  }

  async function resetPassword() {
    setBusy('reset')
    try {
      const res = await fetch(`/api/chauffeurs/${chauffeurId}/acces`, { method: 'PATCH' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setCreds(json.data)
      toast.success('Nouveau mot de passe généré')
    } catch (err: any) { toast.error(err.message) }
    finally { setBusy(null) }
  }

  async function revoke() {
    if (!confirm("Révoquer l'accès de ce chauffeur ? Son compte sera supprimé.")) return
    setBusy('revoke')
    try {
      const res = await fetch(`/api/chauffeurs/${chauffeurId}/acces`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setCreds(null)
      toast.success('Accès révoqué')
      router.refresh()
    } catch (err: any) { toast.error(err.message) }
    finally { setBusy(null) }
  }

  function copyCreds() {
    if (!creds) return
    navigator.clipboard.writeText(
      `Application chauffeur Star Tourism Services\n${appUrl}\n\nEmail : ${creds.email}\nMot de passe : ${creds.password}`
    ).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="card">
      <div className="card-header"><span className="card-header-title">Accès application chauffeur</span></div>
      <div style={{ padding: '14px 16px' }}>

        {/* Panneau identifiants (après création/reset) */}
        {creds && (
          <div style={{ background: '#fdf6e3', border: '1.5px solid #9a7a28', padding: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9a7a28', marginBottom: '8px' }}>
              Identifiants — à communiquer une seule fois
            </div>
            <div style={{ fontSize: '11px', color: '#5a564e', marginBottom: '3px' }}>Email</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px', color: '#16130e', marginBottom: '8px', wordBreak: 'break-all' }}>{creds.email}</div>
            <div style={{ fontSize: '11px', color: '#5a564e', marginBottom: '3px' }}>Mot de passe</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '14px', fontWeight: 600, color: '#16130e', marginBottom: '10px' }}>{creds.password}</div>
            <button onClick={copyCreds} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '11px', padding: '8px' }}>
              {copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier les identifiants</>}
            </button>
            <div style={{ fontSize: '10px', color: '#7a5c10', marginTop: '8px', lineHeight: 1.5 }}>
              <Smartphone size={10} style={{ display: 'inline', marginRight: '3px' }} />
              App : <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{appUrl}</span> — installable depuis le navigateur (« Ajouter à l'écran d'accueil »).
            </div>
          </div>
        )}

        {hasAccess ? (
          <>
            {!creds && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#eaf4ee', border: '1px solid rgba(30,94,58,0.2)', marginBottom: '12px' }}>
                <ShieldCheck size={15} style={{ color: '#1e5e3a', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e5e3a' }}>Accès actif</div>
                  {email && <div style={{ fontSize: '10px', color: '#5a564e', wordBreak: 'break-all' }}>{email}</div>}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={resetPassword} disabled={busy !== null} className="btn-ghost"
                style={{ justifyContent: 'center', gap: '8px' }}>
                <RefreshCw size={13} /> {busy === 'reset' ? 'Génération…' : 'Réinitialiser le mot de passe'}
              </button>
              <button onClick={revoke} disabled={busy !== null}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'none', border: '1.5px solid rgba(158,42,42,0.3)', color: '#9e2a2a', padding: '7px 16px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                <Trash2 size={13} /> {busy === 'revoke' ? 'Révocation…' : "Révoquer l'accès"}
              </button>
            </div>
          </>
        ) : showForm ? (
          <div>
            <label className="form-label">Email de connexion</label>
            <input type="email" className="input" value={formEmail} onChange={e => setFormEmail(e.target.value)}
              placeholder="chauffeur@elitedrive.fr" style={{ marginBottom: '10px' }} />
            <label className="form-label">Mot de passe (optionnel)</label>
            <input type="text" className="input" value={formPassword} onChange={e => setFormPassword(e.target.value)}
              placeholder="Laisser vide = généré automatiquement" style={{ marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Annuler</button>
              <button onClick={create} disabled={busy !== null} className="btn-or" style={{ flex: 1, justifyContent: 'center' }}>
                {busy === 'create' ? 'Création…' : "Créer l'accès"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '11px', color: '#5a564e', lineHeight: 1.6, marginBottom: '12px' }}>
              Donnez à ce chauffeur l'accès à l'application mobile (missions du jour, adresses, saisie des heures).
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', gap: '8px' }}>
              <KeyRound size={14} /> Créer l'accès chauffeur
            </button>
          </>
        )}
      </div>
    </div>
  )
}
