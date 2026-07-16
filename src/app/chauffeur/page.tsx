import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MissionsJour from '@/components/chauffeur/MissionsJour'

export const dynamic = 'force-dynamic'

export default async function ChauffeurHomePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/chauffeur/login')

  // Chauffeur lié à ce compte
  const { data: chauffeur } = await supabase
    .from('chauffeurs')
    .select('id, nom, prenom')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!chauffeur) {
    return (
      <div style={{ padding: '40px 24px', minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '22px', color: '#16130e', marginBottom: '10px' }}>
          Compte non associé
        </div>
        <p style={{ fontSize: '13px', color: '#5a564e', lineHeight: 1.6, marginBottom: '20px' }}>
          Ce compte n'est lié à aucune fiche chauffeur. Contactez votre dispatcher pour
          associer votre compte à votre profil chauffeur.
        </p>
        <a href="/chauffeur/login" style={{ fontSize: '12px', color: '#9a7a28', textDecoration: 'underline' }}>
          Se connecter avec un autre compte
        </a>
      </div>
    )
  }

  return <MissionsJour chauffeurNom={`${chauffeur.prenom} ${chauffeur.nom}`} />
}
