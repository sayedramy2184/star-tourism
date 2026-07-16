# Élite Drive — Logiciel de gestion VTC

Application web multi-tenant pour la gestion de sociétés VTC.
Stack : **Next.js 14 · Supabase · Tailwind CSS · Vercel**

---

## 🚀 Mise en place — Sprint 1

### Étape 1 — Cloner et installer

```bash
git clone https://github.com/sayedramy2184/elitedrive.git
cd elitedrive
npm install
```

---

### Étape 2 — Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **New project**
2. Nom : `elitedrive` · Région : `eu-west-3` (Paris) · Mot de passe fort
3. Attends ~2 minutes que le projet démarre

---

### Étape 3 — Exécuter le schéma SQL

1. Dans Supabase → **SQL Editor** → **New query**
2. Copie-colle le contenu de `supabase/migrations/001_schema.sql`
3. Clique **Run** → tu devrais voir "Success"

---

### Étape 4 — Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Dans Supabase → **Settings → API**, copie :
- `URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

---

### Étape 5 — Créer le premier utilisateur admin

Dans Supabase → **Authentication → Users → Invite user**
- Email : ton email
- Mot de passe : choisis un mot de passe fort

Puis dans **SQL Editor**, exécute (remplace les valeurs) :

```sql
-- Remplace les UUIDs et valeurs par les tiens
insert into profiles (id, company_id, role, nom, prenom, email)
values (
  'UUID_DE_TON_USER_AUTH',          -- auth.users > ton user > id
  '00000000-0000-0000-0000-000000000001',  -- company de démo
  'admin',
  'Ton Nom',
  'Ton Prénom',
  'ton@email.fr'
);
```

---

### Étape 6 — Lancer en local

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000)
Tu seras redirigé vers `/auth/login`

---

### Étape 7 — Déployer sur Vercel

```bash
# Push sur GitHub d'abord
git add .
git commit -m "Sprint 1 — Structure de base"
git push origin main
```

1. Va sur [vercel.com](https://vercel.com) → **New Project**
2. Importe ton repo GitHub `elitedrive`
3. Dans **Environment Variables**, ajoute les 3 variables de `.env.local`
4. **Deploy** → ton app sera disponible sur `*.vercel.app`

---

## 📁 Structure du projet

```
elitedrive/
├── src/
│   ├── app/
│   │   ├── auth/login/          # Page de connexion
│   │   ├── dashboard/
│   │   │   ├── layout.tsx       # Layout avec sidebar
│   │   │   ├── dossiers/        # Module dossiers
│   │   │   ├── vehicules/       # Module véhicules
│   │   │   ├── chauffeurs/      # Module chauffeurs
│   │   │   ├── clients/         # Module clients
│   │   │   └── facturation/     # Module facturation
│   │   ├── api/                 # API Routes Next.js
│   │   ├── globals.css          # Design system CSS
│   │   └── layout.tsx           # Root layout
│   ├── components/
│   │   ├── layout/              # Sidebar, TopBar
│   │   ├── ui/                  # Composants réutilisables
│   │   ├── dossiers/            # Composants spécifiques
│   │   └── factures/
│   ├── lib/supabase/            # Clients Supabase (browser + server)
│   ├── types/                   # Types TypeScript
│   └── hooks/                   # React hooks custom
├── supabase/migrations/         # Schéma SQL
├── middleware.ts                # Auth + routing par rôle
├── tailwind.config.ts           # Design system couleurs/polices
└── .env.example                 # Template variables d'env
```

---

## 🗓️ Plan de développement

| Sprint | Contenu | Statut |
|--------|---------|--------|
| **1** | Auth + structure + DB + design system | ✅ Fait |
| **2** | Module Dossiers — CRUD + prestations + jours MAD | 🔜 Prochain |
| **3** | Véhicules + Chauffeurs + affectations | ⏳ |
| **4** | Facturation + génération PDF | ⏳ |
| **5** | Vue mobile chauffeur + planning + polish | ⏳ |

---

## 💡 Architecture multi-tenant

Chaque table contient un `company_id`. La politique RLS Supabase
(`Row Level Security`) garantit qu'un utilisateur ne voit **jamais**
les données d'une autre société, même en cas d'erreur de code.

Pour ajouter une nouvelle société VTC cliente :
1. Insérer dans `companies`
2. Créer les utilisateurs dans `auth.users`
3. Créer leurs `profiles` avec le bon `company_id`
C'est tout — les RLS font le reste automatiquement.
