'use client'

// Sélecteur véhicule souhaité : catégorie (config Paramètres) puis modèle précis.
// La valeur stockée (modele_souhaite) = le modèle si choisi, sinon la catégorie.

interface Cat { id: string; nom: string; modeles: string[] }

export default function VehiculeCategorieSelect({
  categories, value, onChange, selectClass, selectStyle,
  anyLabel = '— Catégorie souhaitée —', modelAnyLabel = '— Modèle (indifférent) —',
}: {
  categories: Cat[]
  value: string
  onChange: (v: string) => void
  selectClass?: string
  selectStyle?: React.CSSProperties
  anyLabel?: string
  modelAnyLabel?: string
}) {
  const selCat =
    categories.find(c => c.nom === value) ??
    categories.find(c => (c.modeles ?? []).includes(value)) ??
    null
  const model = selCat && (selCat.modeles ?? []).includes(value) ? value : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <select className={selectClass} style={selectStyle} value={selCat?.nom ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">{anyLabel}</option>
        {categories.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
      </select>
      {selCat && (selCat.modeles?.length ?? 0) > 0 && (
        <select className={selectClass} style={selectStyle} value={model} onChange={e => onChange(e.target.value || selCat.nom)}>
          <option value="">{modelAnyLabel}</option>
          {selCat.modeles.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}
    </div>
  )
}
