'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FileText } from 'lucide-react'

interface Props {
  dossierId: string
  variant?: 'header' | 'sidebar'
}

export default function GenererFactureButton({ dossierId, variant = 'header' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleGenerer() {
    setLoading(true)
    try {
      const res = await fetch('/api/factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossier_id: dossierId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')

      toast.success(json.existing
        ? `Facture ${json.data.numero} déjà émise — ouverture`
        : `Facture ${json.data.numero} générée !`)
      window.open(`/api/factures/${json.data.id}/pdf`, '_blank')
      router.push('/dashboard/facturation')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'sidebar') {
    return (
      <button className="btn-or" onClick={handleGenerer} disabled={loading}
        style={{ width: '100%', marginTop: '12px', padding: '10px', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', justifyContent: 'center' }}>
        {loading ? 'Génération…' : 'Générer la facture'}
      </button>
    )
  }

  return (
    <button className="btn-ghost" onClick={handleGenerer} disabled={loading}
      style={{ padding: '5px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }}>
      <FileText size={11} /> {loading ? 'Génération…' : 'Facturer'}
    </button>
  )
}
