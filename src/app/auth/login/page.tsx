'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect'
        : error.message
      )
      setLoading(false)
      return
    }

    toast.success('Connexion réussie')
    router.push('/dashboard/dossiers')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 border-2 border-or flex items-center justify-center
                          font-display text-xl text-or font-semibold">
            ✦
          </div>
          <div>
            <div className="font-display text-2xl font-medium text-noir tracking-[2px]">
              STAR TOURISM
            </div>
            <div className="text-2xs tracking-[3px] text-gris uppercase mt-0.5">
              Services Drive
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border-dk shadow-md">
          <div className="bg-noir px-6 py-4 border-b-2 border-border-dk">
            <h1 className="font-display text-lg font-400 text-white tracking-wide">
              Connexion
            </h1>
          </div>

          <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="form-label">Adresse e-mail</label>
              <input
                type="email"
                className="input"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2 text-sm tracking-wider"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="px-6 pb-5 text-center">
            <a
              href="/auth/reset-password"
              className="text-xs text-gris hover:text-or transition-colors"
            >
              Mot de passe oublié ?
            </a>
          </div>
        </div>

        <p className="text-center text-2xs text-gris mt-6">
          Star Tourism Services Drive © {new Date().getFullYear()} — Logiciel de gestion VTC
        </p>
      </div>
    </div>
  )
}
