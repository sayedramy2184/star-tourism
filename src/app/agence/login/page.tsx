'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function AgencyLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message)
      setLoading(false)
      return
    }
    toast.success('Signed in')
    router.replace('/agence')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#16130e', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '28px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div style={{ width: '84px', height: '84px', background: '#fff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
          <img src="/logo.png" alt="Star Tourism Services" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', color: '#fff', letterSpacing: '2px', marginTop: '14px' }}>STAR TOURISM</div>
        <div style={{ fontSize: '10px', letterSpacing: '3px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: '4px' }}>Agency portal</div>
      </div>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '420px', width: '100%', margin: '0 auto' }}>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="username" placeholder="contact@agency.com"
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', fontSize: '15px', outline: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" placeholder="••••••••"
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', fontSize: '15px', outline: 'none' }} />
        </div>
        <button type="submit" disabled={loading}
          style={{ width: '100%', background: '#9a7a28', color: '#fff', border: 'none', padding: '15px', fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', marginTop: '8px' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
