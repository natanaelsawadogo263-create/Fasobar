# Audit FasoBar — transformation local-first

**Date :** 6 août 2026  
**Périmètre :** dépôt `maquis-gestion` (lecture seule)  
**Objectif cible :** logiciel Windows installé localement, fonctionnement hors connexion (SQLite), synchronisation Supabase, mises à jour distantes, espace Super Admin (clients, abonnements, machines), **et expérience utilisateur de vrai logiciel desktop** (pas un site web emballé).

**Méthode :** inventaire du code (`src/`), du schéma (`supabase/migrations/`), des dépendances (`package.json`) et de la doc existante (`docs/database/`). Aucun fichier applicatif ni SQL n’a été modifié pour cet audit.

---

## 1. Verdict exécutif

FasoBar est aujourd’hui une **application cloud-first** :

| Couche | État actuel |
|--------|-------------|
| UI | Next.js 16 (App Router) + React 19 + Tailwind 4 |
| Backend métier | Server Actions → Supabase Postgres (RPC + RLS) |
| Auth | Supabase Auth (email / mot de passe) |
| Multi-tenant | `organizations` → `establishments` + memberships |
| « Sync » live | Supabase Realtime → `router.refresh()` (online uniquement) |
| Offline / SQLite | **Absent** |
| Shell Windows (Electron / Tauri) | **Absent** |
| Super Admin SaaS / licences machines | **Absent** |
| Abonnements / facturation | **Absent** |

Le cœur métier (caisse, commandes, paiements, stock, bar, rapports admin) est **largement livré en mode online**. La cible local-first / desktop / Super Admin est un **changement d’architecture**, pas un simple packaging.

**Contrainte UX non négociable :** FasoBar Desktop doit se comporter comme un **logiciel Windows natif** (navigation instantanée, UI fixe, données locales, sync invisible). Emballer l’App Router Next actuel dans une WebView **ne suffit pas** : le modèle SSR + `router.refresh()` + Server Actions produit aujourd’hui une UX de site web (latence réseau, pages blanches, rechargements).

---

## 2. Stack et architecture actuelle

### 2.1 Stack technique

| Élément | Version / détail |
|---------|------------------|
| Package | `maquis-gestion` `0.1.0` |
| Next.js | `16.2.12` |
| React | `19.2.4` |
| Supabase JS / SSR | `@supabase/supabase-js` `^2.112.0`, `@supabase/ssr` `^0.12.4` |
| Validation | Zod `^4.4.3` |
| Tests | Vitest (tests unitaires domaines, couverture partielle) |
| Desktop / SQLite / PWA | Aucune dépendance dédiée |

### 2.2 Clients Supabase

| Client | Fichier | Usage |
|--------|---------|--------|
| Browser | `src/lib/supabase/client.ts` | Realtime uniquement (`establishment-live-sync.tsx`) |
| Server (JWT user) | `src/lib/supabase/server.ts` | RSC + quasi toutes les Server Actions |
| Service role | `src/lib/supabase/admin.ts` | Auth Admin (employés), écritures produits privilégiées |
| Proxy session | `src/proxy.ts` + `src/lib/supabase/proxy.ts` | Refresh session + garde d’accès |

**Pattern dominant :** le navigateur n’écrit presque jamais en base. Les mutations passent par des **Server Actions** qui appellent des **RPC Postgres** (logique métier + ACL côté SQL).

### 2.3 Multi-tenant et espaces UI

Espaces produit (`src/lib/auth/roles.ts`) :

| Espace | Rôles DB | Accueil |
|--------|----------|---------|
| `admin` | `OWNER`, `ADMIN`, `MANAGER` | `/application/tableau-de-bord` |
| `cashier_kitchen` | `CASHIER_KITCHEN`, `CASHIER`, `KITCHEN_MANAGER` | `/application/caisse` |
| `bar_manager` | `BAR_MANAGER` | `/application/bar` |

- Pas de rôle `super_admin` / plateforme.
- Le workspace résout **une** org + **un** établissement préférés (`workspace-context.ts`) — pas de switcher multi-sites en UI.
- Statuts `INACTIVE` (profil / org / établissement) → `/acces-suspendu` (suspension tenant, pas facturation SaaS).

### 2.4 « Sync » actuelle (à ne pas confondre avec local-first)

`EstablishmentLiveSync` s’abonne aux changements Postgres sur :

- `orders`, `payments`, `cash_register_sessions`, `bar_sessions`
- `products`, `stock_items`

…puis déclenche un **rafraîchissement SSR**. Cela suppose **réseau + session Supabase**. Ce n’est ni une file offline, ni une réplication SQLite.

---

## 3. Fonctionnalités : terminé / partiel / manquant

Légende : **OK** = utilisable en production online · **Partiel** = schéma ou UI incomplète · **Manquant** = hors périmètre actuel.

### 3.1 Domaines métier établissement

| Domaine | Statut | Preuves / remarques |
|---------|--------|---------------------|
| Auth (connexion, inscription, reset MDP) | **OK** | `src/lib/auth/actions.ts`, routes `(auth)` |
| Onboarding org + établissement | **OK** | RPC `bootstrap_organization` |
| Première connexion (mdp temporaire) | **Partiel** | RPC `complete_password_change` + colonne `must_change_password` **utilisées en code**, **absentes des migrations trackées** |
| Catalogue produits / packagings / images | **OK** | CRUD + Storage + enhance image OpenAI |
| Stock (entrées, pertes, corrections, fournisseurs) | **OK** | RPC stock + pages bar/cuisine/admin |
| Inventaires physiques | **Partiel** | Démarrage session DRAFT + lignes ; **pas** de saisie de comptage / clôture / application d’écarts côté app |
| Commandes POS / caisse | **OK** | create / save items / ready-to-pay / cancel |
| Sessions caisse + encaissements + reçus | **OK** | open/close, paiements, void, admin `/caisses` |
| Sessions bar + bilan de clôture | **OK** | open/close, summary JSON, admin `/sessions-bar`, déconnexion auto à la clôture |
| Prep cuisine / bar | **OK** | `update_order_kitchen_status` / `update_order_bar_status` |
| Dépenses | **OK** | record / update / cancel |
| Rapports | **OK** | plusieurs types dans `src/lib/reports/` |
| Paramètres établissement | **OK** | `update_establishment_settings` |
| Gestion utilisateurs / employés | **Partiel** | UI + Auth Admin ; RPC provision/status **absentes des migrations trackées** |
| Multi-établissements (création / switch) | **Partiel** | Schéma OK ; app = 1 site bootstrapé |
| Offline / SQLite | **Manquant** | — |
| App Windows installable | **Manquant** | — |
| Mises à jour distantes du binaire | **Manquant** | — |
| Super Admin (clients, abo, machines) | **Manquant** | — |
| Abonnements / Stripe / facturation | **Manquant** | — |
| Licence machine / device binding | **Manquant** | — |

### 3.2 Routes principales (`src/app`)

**Admin :** tableau de bord, produits, stock, approvisionnements, inventaires, dépenses, ventes, commandes, caisses, sessions-bar, utilisateurs, rapports, paramètres.

**Caisse–Cuisine :** caisse, session, commandes ouvertes, cuisine, stock cuisine, encaissement, reçus.

**Bar :** dashboard, commandes, stock, approvisionnements, historique, session.

**Gates :** onboarding, première connexion, accès suspendu / refusé.

---

## 4. Appels directs à Supabase

### 4.1 Mutations via RPC (chemin nominal)

Les opérations critiques passent par RPC (garanties ACL + atomité côté Postgres) :

| RPC | Domaine |
|-----|---------|
| `bootstrap_organization` | Onboarding |
| `create_order`, `save_order_items`, `update_order_header`, `cancel_order` | Commandes |
| `update_order_kitchen_status`, `update_order_bar_status` | Prep |
| `open_cash_register_session`, `close_cash_register_session` | Session caisse |
| `record_order_payments`, `void_payment` | Paiements |
| `open_bar_session`, `close_bar_session`, `get_bar_session_closing_summary` | Session bar |
| `record_stock_entry`, `record_stock_loss`, `adjust_stock_quantity` | Stock |
| `record_expense`, `update_expense`, `cancel_expense` | Dépenses |
| `create_establishment_product`, `upsert_product_packaging` | Catalogue |
| `update_establishment_settings` | Paramètres |
| `ensure_caisse_catalog` | Seed catalogue |

### 4.2 Écritures directes table (hors RPC)

À traiter comme **chemins parallèles** dans une future couche sync (pas uniquement « rejouer les RPC ») :

| Zone | Opération | Fichiers typiques |
|------|-----------|-------------------|
| Produits | `insert` / `update` (fallback + images) | `produits/actions.ts`, `ensure-product-images.ts` |
| Packagings | `insert` fallback | `produits/actions.ts` |
| Fournisseurs | `insert` / `update` | `stock/actions.ts` |
| Stock items | `insert` (création + ensure bar) | `stock/actions.ts`, `bar/ensure-stock.ts` |
| Inventaires | `insert` sessions + lignes | `stock/actions.ts` |
| Audit | `insert` `audit_logs` | `stock/audit.ts` |
| Auth Admin | createUser / updateUser / delete | `utilisateurs/actions.ts`, `admin.ts` |
| Storage | upload images produits | migrations storage + actions produits |

### 4.3 Lectures massives (RSC / queries)

Nombreux `.from(...)` en lecture seule : dashboards, POS, stock, rapports, sessions admin. En local-first, ces lectures devront cibler **SQLite local** ; Supabase restera source de vérité cloud après sync.

### 4.4 RPC appelées en code mais absentes des migrations trackées

| RPC / colonne | Usages | Risque |
|---------------|--------|--------|
| `provision_employee_account` | `utilisateurs/actions.ts` | Échec runtime si base = migrations repo seules |
| `log_employee_creation_compensated` | idem | idem |
| `mark_temporary_password_reset` | idem | idem |
| `set_member_active_status` | idem | idem |
| `complete_password_change` | `premiere-connexion/actions.ts` | idem |
| `profiles.must_change_password`, `profiles.phone` | queries users / première connexion | **dérive de schéma** |

**Recommandation pré-transformation :** inventorier le SQL réellement déployé vs `supabase/migrations/` et combler l’écart (sans le faire dans cet audit).

---

## 5. Server Actions, RPC et migrations

### 5.1 Inventaire Server Actions

| Fichier | Actions clés |
|---------|--------------|
| `src/lib/auth/actions.ts` | signUp, signIn, signOut, reset / update password |
| `onboarding/actions.ts` | bootstrapOrganization |
| `premiere-connexion/actions.ts` | completeFirstLogin |
| `caisse/actions.ts` | saveOrder, prepareOrderForPayment, cancelOrder |
| `caisse/payment-actions.ts` | open/close cash session, recordPayments, voidPayment, quickCashCheckout |
| `cuisine/actions.ts` | updateKitchenStatus |
| `bar/actions.ts` | updateBarStatus, open/close bar session |
| `stock/actions.ts` | entry/loss/adjust, suppliers, stock item, startInventory, fetchMovements |
| `produits/actions.ts` | CRUD produit, prix, statut, packagings |
| `depenses/actions.ts` | create/update/cancel |
| `parametres/actions.ts` | updateEstablishmentSettings |
| `utilisateurs/actions.ts` | createEmployee, resetTempPassword, setMemberStatus, deleteEmployee |
| `rapports/actions.ts` | getReportData (lecture) |
| `caisses/actions.ts` | détail session caisse admin (lecture) |
| `sessions-bar/actions.ts` | détail session bar admin (lecture) |

### 5.2 Migrations (24 fichiers)

Ordre chronologique utile pour comprendre l’évolution du cloud :

1. `core_multi_tenant` — orgs, établissements, profils, memberships, helpers RLS  
2. `bootstrap_organization` — métadonnées établissement + bootstrap  
3. `products_catalog` — départements, catégories, produits, audit  
4. `stock_and_supply` — fournisseurs, stock, mouvements, inventaires, RPC stock  
5. `orders_and_cash_register` — commandes, séquences n° commande, RPC orders  
6. `payments_and_cash_sessions` — sessions caisse, paiements, reçus, séquences  
7. Seeds / ACL catalogue caisse, images produits, storage  
8. Dépenses, packagings, settings  
9. Statuts prep bar/cuisine  
10. Sessions bar + gate statut bar  
11. ACL caissier / `CASHIER_KITCHEN`  
12. Publications Realtime ops + catalogue  
13. Fix kitchen status sur `save_order_items`  
14. Bilan clôture session bar (`closing_summary`)

Beaucoup de fichiers notent une **application manuelle** (pas de pipeline CI migrate automatique visible dans le repo).

### 5.3 Séquences critiques (cloud)

Numérotation atomique côté Postgres :

- `establishment_order_sequences` → `next_order_number`
- `establishment_payment_sequences` → `next_payment_number`
- `establishment_receipt_sequences` → `next_receipt_number`

Ces objets sont le **principal point de friction** d’une sync multi-machines / offline.

---

## 6. Données à conserver localement (SQLite)

Objectif : permettre caisse + bar + stock **sans Internet**, puis remonter vers Supabase.

### 6.1 Doivent être locaux (runtime service)

| Groupe | Tables / artefacts | Pourquoi |
|--------|-------------------|----------|
| Identité locale | profils employés liés à la machine, rôles, hash/session locale | Login hors-ligne (Auth cloud ne marche pas offline) |
| Tenant binding | `organization_id`, `establishment_id`, licence machine | Isolation + Super Admin |
| Catalogue | departments, categories, products, packagings (+ chemins images locales) | Prise de commande |
| Stock | stock_items, stock_movements (file d’attente), suppliers | Sorties / pertes / entrées |
| Ops service | orders, order_items, cash_register_sessions, payments, receipts | Cœur POS |
| Sessions bar | bar_sessions + snapshot bilan | Clôture offline |
| Dépenses | expenses | Si utilisées hors-ligne |
| Paramètres | settings établissement (devise, infos ticket…) | Tickets / UI |
| Outbox sync | file d’événements / mutations en attente | Rejeu vers cloud |
| Meta sync | cursors, last_pulled_at, device_id, schema_version | Conflits & updates |

### 6.2 Peuvent rester cloud-first (pull occasionnel)

| Groupe | Motif |
|--------|-------|
| Rapports historiques longs | Agrégats lourds ; acceptable après sync |
| Supervision multi-sites admin distant | Vue cloud |
| Images HD originales | Cache local des optimisées suffit |
| Audit_logs complets | Append-only ; sync différée OK |
| Inventaires complets | À finaliser d’abord online, puis porter |

### 6.3 Ne doivent pas vivre « libres » en local sans contrôle Super Admin

| Groupe | Motif |
|--------|-------|
| Création d’organisations / nouveaux clients | Réservé Super Admin / onboarding cloud |
| Activation abonnement / prolongation licence | Source de vérité plateforme |
| Provisioning Auth cloud (`auth.users`) | Nécessite API Supabase ; offline = comptes locaux pré-provisionnés |

---

## 7. Opérations à synchroniser

### 7.1 Priorité P0 — argent, stock, service (idempotence obligatoire)

Chaque mutation locale doit produire un **événement outbox** avec `client_mutation_id` (UUID) unique.

| Opération | Aujourd’hui | Sync cible |
|-----------|-------------|------------|
| Créer / modifier / annuler commande | RPC orders | Push événement → appliquer côté cloud (ou RPC wrap) |
| Statuts cuisine / bar | RPC status | Push |
| Ouvrir / fermer session caisse | RPC cash | Push ; **une session ouverte / caissier** à réconcilier |
| Encaisser / void paiement | RPC payments | Push ; reçus / n° = résolution serveur |
| Ouvrir / fermer session bar | RPC bar | Push ; bilan recalculable cloud |
| Entrée / perte / correction stock | RPC stock | Push ; stock = dérivé de mouvements |

### 7.2 Priorité P1 — catalogue & admin établissement

| Opération | Notes sync |
|-----------|------------|
| CRUD produits / prix / actif | Conflits de prix fréquents → **last-write-wins versionné** ou « cloud gagne » |
| Packagings | Idem |
| Fournisseurs / création stock_item | Relativement simples |
| Dépenses | Append + cancel |
| Paramètres | Rare ; cloud gagne souvent |

### 7.3 Priorité P2 — identité & plateforme

| Opération | Notes |
|-----------|-------|
| Login offline | Cache credentials / PIN local chiffré ; refresh token cloud quand online |
| CRUD employés | Online only au début ; sync des memberships en pull |
| Bootstrap org | Online / Super Admin |
| Licence machine / heartbeat | Pull droits + push télémétrie |

### 7.4 Pull cloud → local (réplication)

Au démarrage / périodique / après reconnect :

1. Catalogue + settings  
2. Stock snapshot (ou mouvements depuis cursor)  
3. Memberships / rôles employés autorisés sur la machine  
4. Commandes ouvertes non closes (si multi-postes)  
5. État licence / abonnement  

---

## 8. Risques de conflits

### 8.1 Critiques

| Risque | Scénario | Impact | Stratégie recommandée |
|--------|----------|--------|------------------------|
| **Séquences n° commande / paiement / reçu** | Deux caisses offline génèrent les mêmes numéros | Doublons UNIQUE cloud, tickets incohérents | Numéros **locaux provisoires** (`LOCAL-…`) ; attribution définitive **uniquement au push** via `next_*` cloud |
| **Stock concurrent** | Bar offline perd 2 × Coca ; admin cloud ajuste | Quantité négative / écart inventaire | Stock cloud = **somme des mouvements** idempotents ; jamais « set quantity » brut hors correction explicite |
| **Double encaissement** | Rejeu réseau d’un même paiement | Caisse et reçus faussés | `client_mutation_id` UNIQUE + RPC idempotente |
| **Deux sessions caisse ouvertes** | Même user sur PC + tablette | Règles métier cassées | Verrou cloud « une OPEN par user/établissement » ; offline = session liée `device_id` |
| **Clôture session vs mouvements tardifs** | Mouvement stock daté dans la fenêtre session après close local | Bilan divergents | Bilan **recalculé cloud** à la sync ; local = preview |
| **Statut commande multi-écrans** | Cuisine online + caisse offline | Statuts écrasés | Horodatage + version / vector clock simple par commande |
| **Prix catalogue** | Admin change prix pendant service offline | Ticket ≠ cloud | Snapshot prix **sur la ligne de commande** à la création (déjà partiellement le cas via order_items) — à figer explicitement |

### 8.2 Moyens

| Risque | Mitigation |
|--------|------------|
| Images produits | Hash fichier ; sync binaire séparée |
| Fournisseurs renommés | Merge par id UUID |
| Inventaire DRAFT local + mouvements | Interdire clôture inventaire si outbox stock non vide |
| Déconnexion auto à la clôture | OK localement ; sync close **avant** purge session UI |

### 8.3 Organisationnels / produit

| Risque | Mitigation |
|--------|------------|
| Multi-machines sans Super Admin | Chaque install liée à `machine_id` + établissement |
| Abonnement expiré en offline | Grace period locale (N jours) + mode lecture seule |
| Schéma drift migrations | Version `schema_version` locale vs cloud ; bloquer sync si incompatible |
| RPC employés hors migrations | Corriger avant tout port desktop |

---

## 9. Architecture Super Admin (cible)

Espace **plateforme** distinct de l’espace `admin` établissement.

### 9.1 Responsabilités

| Module | Fonctions |
|--------|-----------|
| **Clients** | Organisations / établissements, contacts, statut commercial |
| **Abonnements** | Plans, périodes, essais, suspensions, facturation |
| **Machines** | Enregistrement device, empreinte, révocation, dernière sync |
| **Déploiements** | Canaux de mise à jour (stable/beta), versions autorisées |
| **Support** | Impersonation contrôlée, logs sync, export diagnostics |
| **Observabilité** | Heartbeats, erreurs outbox, rétention |

### 9.2 Modèle logique proposé (conceptuel — pas de SQL ici)

```
platform_users (super admins)
clients (organizations commerciales)
  └── subscriptions (plan, status, period)
  └── establishments (lien vers tenant métier)
        └── machines (device_id, public_key, last_seen, app_version)
              └── sync_cursors / licence_tokens
release_channels / app_releases (installers Windows)
```

Le schéma métier actuel (`organizations`, `establishments`, …) reste le **tenant data plane**. Le Super Admin opère un **control plane** au-dessus (tables plateforme + service role / edge sécurisé).

### 9.3 Séparation des accès

| Acteur | Voit |
|--------|------|
| Super Admin | Tous les clients, abos, machines — **pas** le détail POS quotidien sauf outil support |
| Admin établissement | Uniquement son tenant (comme aujourd’hui) |
| Caisse / Bar | SQLite local + sync restreinte à leur établissement |
| Machine non licenciée | Refus sync / mode démo |

### 9.4 Mises à jour distantes

Flux typique Windows :

1. App démarre → vérifie canal (`stable`) auprès du control plane.  
2. Télécharge installateur / patch signé.  
3. Applique hors heures ou au redémarrage.  
4. Migre schéma SQLite (`schema_version`).  
5. Heartbeat : `app_version`, `os`, `last_sync_ok`.  
6. Mises à jour **silencieuses** côté client (cf. §10.1 / Phase 6) : pas de blocage UI pendant le téléchargement.

Sans Super Admin + releases, le « logiciel installé » ne peut pas être opéré à l’échelle.

---

## 10. Exigence UX desktop (contrainte d’architecture)

Cette section est une **exigence produit**, pas un polish UI. Elle **impose** le local-first décrit aux §6–9 et invalide toute approche « site web dans une fenêtre ».

### 10.1 Cahier des charges UX

| Exigence | Signification architecture |
|----------|----------------------------|
| Ressembler à un vrai logiciel Windows | Fenêtre applicative, chrome natif minimal, pas d’URL / onglets / barre navigateur visibles |
| Données principales depuis SQLite | L’UI **ne bloque jamais** sur un round-trip Supabase pour afficher catalogue, panier, stock, commandes ouvertes |
| Navigation instantanée sans rechargement | SPA / client router **dans le process local** ; pas de navigation full document, pas de RSC round-trip pour changer d’écran |
| Fonctionnement hors ligne | Toutes les actions P0 (§7.1) disponibles sans réseau ; indicateurs discrets « hors ligne / sync en cours » |
| Synchronisation en arrière-plan | Worker hors UI ; jamais de spinner plein écran lié à la sync |
| Fenêtre sans interface de navigateur | Shell Electron/Tauri (ou équivalent) en mode frameless/custom titlebar Windows |
| Sidebar et topbar fixes | Shell layout **persistant** (monté une fois) ; seul le panneau contenu swap ; pas de remount layout à chaque route |
| Aucune page blanche de chargement | Boot : splash natif court → shell déjà peint → contenu hydraté depuis SQLite ; transitions locales (skeletons ciblés OK, écran blanc interdit) |
| Interactions immédiates | Optimistic UI : clic → état local immédiat → écriture SQLite → outbox ; rollback rare si contrainte métier |
| Raccourcis clavier | Couche shortcuts globale (F2 caisse, Entrée encaisser, Esc fermer modal, etc.) au niveau shell, indépendante du focus web « site » |
| Mises à jour silencieuses | Download + apply en fond (§9.4) ; pas de wizard modal bloquant pendant le service ; redémarrage différé |
| Fluide même avec connexion lente | Le réseau **n’est jamais** sur le chemin critique de l’UI ; latence cloud n’affecte que le badge sync |

### 10.2 Écart UX vs app actuelle (cloud web)

| Comportement actuel | Problème desktop | Remplacement cible |
|---------------------|------------------|--------------------|
| Server Components + fetch Supabase à chaque navigation | Attente réseau / flash blanc | Lecture SQLite synchrone ou quasi (IPC local) |
| `router.refresh()` après Realtime | Re-render « page web » | Invalidation store local / requêtes SQLite ciblées |
| Server Actions pour chaque mutation | Latence + échec offline | Domain API locale + optimistic UI |
| Layouts Next remountés par segment | Sidebar/topbar peuvent « clignoter » | Shell fixe hors routeur de contenu |
| Auth gate serveur | Écran vide si session cloud lente | Login local ; cloud en différé |
| Pas de raccourcis POS globaux structurés | UX navigateur | Registre de shortcuts au niveau fenêtre |
| Pas d’auto-update binaire | Maj manuelle / site | Updater silencieux shell |

### 10.3 Architecture UI cible (découpage)

```
┌─────────────────────────────────────────────────────────┐
│  Shell Windows (titlebar, menus, shortcuts, updater)    │
├──────────────┬──────────────────────────────────────────┤
│  Sidebar     │  Topbar (session, sync badge, user)      │
│  (fixe)      ├──────────────────────────────────────────┤
│              │  Contenu (vues métier)                   │
│              │  ← store local ← SQLite                  │
│              │  ← jamais ← Supabase direct pour l’UI    │
└──────────────┴──────────────────────────────────────────┘
         │                         │
         ▼                         ▼
  Local Domain API          Sync Engine (background)
  (mutations + queries)     outbox push / pull / licence
```

**Règle d’or :** l’UI ne parle qu’au **Local Domain API** (+ store mémoire). Le Sync Engine et Supabase sont **invisibles** pour l’opérateur, sauf statut discret.

### 10.4 Conséquences techniques imposées par l’UX

1. **Client-first UI** : vues desktop = composants client + état local (pas de dépendance au SSR Next pour le runtime caisse/bar).  
2. **Next.js cloud** peut rester pour Super Admin web et éventuellement admin distant ; **le runtime POS desktop** ne doit pas s’appuyer sur App Router SSR comme chemin chaud.  
3. **Préchargement** au démarrage : catalogue, stock, session ouverte, commandes actives → mémoire / SQLite avant affichage du premier écran utile.  
4. **Optimistic + confirmé** : chaque action POS a un état `pending_local` / `synced` sans bloquer l’opérateur.  
5. **File d’attente visuelle minimale** : badge « 3 en attente de sync » ; jamais de modal « Veuillez patienter, synchronisation… » sur le chemin de vente.  
6. **Mode offline first by default** : online = bonus (sync), pas le mode nominal de l’UI.  
7. **Raccourcis** documentés par espace (caisse / bar / admin local) dès la phase UI desktop.  
8. **Updater** : téléchargement silencieux ; installation à la fermeture de session ou au prochain lancement — jamais pendant un encaissement.

### 10.5 Critères d’acceptation UX (non fonctionnels)

À valider avant de déclarer une phase « desktop » terminée :

| Critère | Seuil indicatif |
|---------|-----------------|
| Changement d’écran sidebar (caisse ↔ commandes) | < 100 ms perçus, 0 page blanche |
| Ajout ligne panier | feedback < 50 ms (optimistic) |
| Ouverture app → shell utilisable | splash ≤ 2 s machine standard ; ensuite UI déjà peinte |
| Couper le réseau en plein service | aucune régression UI ; badge offline uniquement |
| Connexion 2G simulée | UI identique ; sync ralentit en fond seulement |
| Raccourci encaissement | fonctionne sans souris sur le flux principal |

---

## 11. Écart architecture : cloud-first → local-first desktop

```
AUJOURD’HUI (UX site web)
[ Browser UI / SSR ] → [ Next Server Actions ] → [ Supabase RPC/RLS ]
         ↑____________________ Realtime refresh (réseau sur chemin UI)

CIBLE (UX logiciel Windows)
[ Shell natif + UI client fixe ] → [ Store + Local Domain API ] → [ SQLite ]
                                         ↓ (jamais bloquant pour l’UI)
                                [ Sync Engine arrière-plan ] ↔ [ Supabase ]
                                         ↑
                                [ Super Admin : licences + updates silencieux ]
```

**Point clé :** il ne suffit pas d’embarquer Next dans Electron. Il faut :

1. une **couche domaine locale** (lectures/écritures SQLite) ;  
2. un **shell UI persistant** (sidebar/topbar fixes, navigation client) ;  
3. un **sync engine découplé** de l’UI ;  
4. un **updater silencieux** piloté par le Super Admin.

Options shell (à trancher en phase design) : Electron + SQLite, Tauri + SQLite, ou service Windows + UI locale. Quel que soit le choix, les exigences §10 s’appliquent.

---

## 12. Ordre précis de transformation

Ordre **séquentiel** recommandé. Chaque phase a un critère de sortie mesurable. Ne pas démarrer N+1 tant que N n’est pas stable.

### Phase 0 — Assainir le cloud actuel (prérequis)

1. Aligner migrations repo ↔ base déployée (RPC employés, `must_change_password`, `phone`).  
   → Migration créée (non exécutée) : `supabase/migrations/20260806180000_reconcile_employee_accounts.sql`  
2. Finaliser inventaires (clôture / application) **ou** les exclure explicitement du périmètre v1 offline.  
3. Documenter contrats RPC (entrées / sorties / erreurs) comme API de sync.  
4. Introduire systématiquement des **IDs clients** côté app pour les mutations critiques (préparation idempotence), sans encore SQLite.

**Sortie :** schéma unique, RPC employé reproductibles, inventaire inventorié (pardon) ou scoped out.

### Phase 1 — Control plane Super Admin (minimal)

1. Modèle clients / abonnements / machines (cloud).  
2. UI Super Admin (CRUD clients, lier établissement existant, activer/suspendre abo).  
3. Endpoint licence : machine s’enregistre, reçoit JWT/licence + `establishment_id`.  
4. Heartbeat + révocation.

**Sortie :** une machine de test ne sync qu’avec un établissement licencié.

### Phase 2 — Runtime local + SQLite + **shell UX desktop** (lecture d’abord)

1. Choisir shell Windows (fenêtre sans chrome navigateur, titlebar applicative).  
2. Schéma SQLite miroir **restreint** (catalogue, stock snapshot, settings, users locaux).  
3. Sync **pull-only** catalogue + stock + settings **en arrière-plan**.  
4. UI client : **sidebar + topbar fixes**, navigation instantanée entre vues, **zéro page blanche** (précharge SQLite → store).  
5. L’UI lit uniquement le local ; cloud hors chemin critique.

**Sortie :** app Windows qui **ressemble déjà à un logiciel** ; POS offline en **lecture** catalogue/stock ; navigation < 100 ms perçus.

### Phase 3 — Écritures locales P0 + outbox + **optimistic UI**

1. Domain local : commandes, session caisse, paiements (n° locaux provisoires), stock, session bar.  
2. Chaque action POS : feedback immédiat → SQLite → outbox (jamais d’attente sync).  
3. Worker sync online invisible ; badge « en attente / synchronisé / hors ligne ».  
4. Adaptateurs cloud idempotents ; remplacer Realtime-as-UI-refresh.  
5. Premiers **raccourcis clavier** du flux caisse/bar.

**Sortie :** service complet offline mono-machine ; UX « clic = immédiat » ; sync sans perte au retour réseau.

### Phase 4 — Conflits & multi-postes

1. Règles explicites (cf. §8) + tests de rejeu.  
2. Deuxième machine (si produit le veut) sans dégrader la fluidité UI.  
3. Recalcul bilans cloud après sync (UI locale non bloquée).  
4. Mode dégradé abonnement expiré (lecture seule, message discret).

**Sortie :** conflits P0 couverts ; UI reste fluide sous sync concurrente.

### Phase 5 — Auth offline & employés

1. Comptes machine (PIN / hash local) ; écran login **local** (pas de spinner cloud).  
2. Sync memberships en fond.  
3. Création employés online au début.

**Sortie :** ouverture de service sans Internet ; login instantané.

### Phase 6 — Mises à jour **silencieuses**

1. Pipeline build Windows signé.  
2. Canaux + versions Super Admin.  
3. Download en fond ; apply à la fermeture de session / prochain lancement — **jamais** pendant un encaissement.  
4. Migrations SQLite versionnées ; refus sync si client trop vieux (message non bloquant hors service).

**Sortie :** patch déployé sans wizard ni interruption de vente.

### Phase 7 — Durcissement & cutover

1. Observabilité sync (sans polluer l’UI).  
2. Backup SQLite.  
3. Doc exploitant + **carte des raccourcis**.  
4. Grille d’acceptation §10.5 passée sur machine type maquis.  
5. Découpler définitivement le runtime POS desktop du SSR Next (Next cloud = Super Admin / admin web optionnel).

**Sortie :** offre « FasoBar Desktop » = logiciel Windows, pas un site emballé.

---

## 13. Ce qu’il ne faut pas faire (pièges)

1. **Emballer Next+Supabase dans Electron** en gardant SSR / Server Actions sur le chemin UI — on obtient un site web lent dans une fenêtre.  
2. **Laisser `router.refresh()` / Realtime** piloter le rendu desktop — le réseau redevient critique.  
3. **Afficher une page blanche** au boot ou à chaque navigation « le temps que Supabase réponde ».  
4. **Bloquer la caisse** sur « synchronisation en cours… ».  
5. **Remount sidebar/topbar** à chaque changement de vue.  
6. **Réutiliser les numéros de séquence locaux** comme numéros cloud.  
7. **Écrire le stock par `UPDATE quantity`** multi-sources sans journal de mouvements.  
8. **Mélanger Super Admin et Admin établissement** dans les rôles RLS actuels.  
9. **Ignorer la dérive migrations employés** avant de figer SQLite.  
10. **Promettre multi-caisses offline** avant sync mono-machine stable.  
11. **Forcer une mise à jour modale** pendant le service.

---

## 14. Synthèse des livrables manquants vs cible

| Cible | État repo | Effort relatif |
|-------|-----------|----------------|
| Windows installé localement | Manquant | Élevé (shell + install + update) |
| UX logiciel (shell fixe, nav instantanée, pas de page blanche) | Manquant — app = site Next | Élevé (réécriture chemin UI chaud) |
| Hors connexion SQLite | Manquant | Très élevé (domaine + sync) |
| Sync arrière-plan (invisible UI) | Realtime online sur chemin UI | Très élevé (outbox + découplage) |
| Raccourcis clavier POS | Manquant / partiel | Moyen |
| Mises à jour silencieuses | Manquant | Moyen (après shell) |
| Super Admin clients / abo / machines | Manquant | Élevé (control plane neuf) |
| Métier POS online | Majoritairement OK | Base réutilisable (RPC = contrats) |

**Conclusion :** le métier FasoBar est une **base solide cloud**. La transformation local-first est un **programme multi-phases** centré sur (1) assainissement schéma, (2) Super Admin / licences, (3) SQLite + shell UX desktop, (4) outbox + optimistic UI, (5) conflits & updates silencieux.

L’exigence §10 change la donne : **SQLite et le shell UI fixe ne sont pas optionnels** — sans eux, FasoBar restera un site web, même installé. Le code actuel indique **où** brancher la sync (Server Actions / RPC §4–5), **quoi** synchroniser (§6–8), et **comment** l’UI doit se découpler du réseau (§10–11).

---

## 15. Index des chemins d’audit

| Sujet | Chemins |
|-------|---------|
| Stack | `package.json` |
| Rôles / espaces | `src/lib/auth/roles.ts`, `src/lib/navigation/space-navigation.ts` |
| Workspace | `src/lib/auth/workspace-context.ts` |
| Clients Supabase | `src/lib/supabase/{client,server,admin,proxy}.ts` |
| Live online (anti-pattern desktop) | `src/components/ops/establishment-live-sync.tsx` |
| Actions métier | `src/app/(protected)/application/**/actions.ts`, `payment-actions.ts` |
| Layouts web actuels (à remplacer par shell fixe) | `src/components/layout/`, topbars espace |
| Schéma | `supabase/migrations/*.sql` |
| Doc multi-tenant | `docs/database/core-multi-tenant.md` |
| Exigence UX desktop | §10 de ce document |

---

*Fin du rapport — document de cadrage ; aucune implémentation associée.*
