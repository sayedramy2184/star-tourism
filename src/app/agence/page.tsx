import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppAccount } from '@/lib/appAccount'
import AgencyPortal from '@/components/agence/AgencyPortal'

export const dynamic = 'force-dynamic'

export default async function AgencyHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/agence/login')

  const account = await getAppAccount(supabase, user.id)
  if (!account || account.type !== 'agence') {
    return (
      <div style={{ padding: '40px 24px', minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', color: '#16130e', marginBottom: '10px' }}>Account not linked</div>
        <p style={{ fontSize: '13px', color: '#5a564e', lineHeight: 1.6, marginBottom: '20px' }}>
          This account is not linked to an agency. Please contact Star Tourism Services.
        </p>
        <a href="/agence/login" style={{ fontSize: '12px', color: '#9a7a28', textDecoration: 'underline' }}>Sign in with another account</a>
      </div>
    )
  }

  return <AgencyPortal agencyName={account.label} />
}
