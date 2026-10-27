# PROMPT MAÎTRE — Reconstruction intégrale de "FasoBar" (logiciel de gestion de commerce multi-activités)

> **Comment utiliser ce document :** copie l'intégralité de ce fichier tel quel dans une nouvelle conversation avec Claude (de préférence Claude Code, avec accès à un dépôt Git vide). C'est le prompt système/mission complet. Il décrit un produit réel à reconstruire à l'identique, fonctionnalité par fonctionnalité, écran par écran, règle par règle. Ne saute aucune section : chaque partie est nécessaire à la cohérence du tout.

---

## 0. MISSION

Tu dois construire, de zéro, une application **SaaS multi-tenant de gestion de commerce** appelée **"FasoBar"** (tu peux la renommer si le client le souhaite, mais garde la même architecture, les mêmes fonctionnalités et les mêmes règles métier). C'est un logiciel destiné à des commerçants en Afrique de l'Ouest (Burkina Faso) pour gérer : ventes en caisse, stock, commandes, personnel, finances — avec un modèle **multi-activités** (un même moteur logiciel s'adapte à un restaurant/bar, un supermarché, une pharmacie, une station-service, une quincaillerie, etc.) et un **espace Super Admin** qui gère tous les clients de la plateforme (abonnements payants, licences, machines autorisées).

Le produit doit finir avec :
1. Une application web (Next.js) utilisable en navigateur, déployée sur Vercel.
2. Un site marketing public (vitrine, tarifs, téléchargement).
3. Une application desktop Windows (Electron) qui embarque le même code, avec un objectif cible **local-first** (fonctionnement hors-ligne avec base SQLite locale + synchronisation).
4. Une PWA installable (notifications push, service worker).
5. Un espace **Super Admin ("Platform")** séparé, pour piloter tous les clients, abonnements, paiements et machines.

Procède par phases (voir section 14 — Ordre de construction). Avant chaque phase, relis les sections concernées de ce document. Ne raccourcis jamais une règle métier pour "aller plus vite" : la cohérence des statuts et des flux d'argent (caisse, stock, abonnements) est la priorité absolue.

---

## 1. STACK TECHNIQUE EXACTE

| Élément | Choix | Version |
|---|---|---|
| Framework web | Next.js (App Router) | 16.x |
| UI | React | 19.x |
| Langage | TypeScript strict (aucun `any`, aucun `@ts-ignore` sans justification) | 5.x |
| Style | Tailwind CSS | v4 (via `@tailwindcss/postcss`) |
| Base de données / Auth / Storage / Realtime | Supabase (PostgreSQL) | `@supabase/supabase-js` ^2.x, `@supabase/ssr` ^0.12.x |
| Validation de schémas | Zod | ^4.x |
| Icônes | lucide-react | |
| Codes-barres | jsbarcode | |
| Notifications push | web-push (VAPID) | |
| Tests unitaires | Vitest + jsdom | |
| App desktop | Electron + Electron Forge (plugin-vite) + electron-builder (NSIS pour l'installeur Windows) | Electron ^37.x |
| Démarrage électron sur Windows | electron-squirrel-startup | |
| Hébergement web | Vercel | |
| Gestionnaire de paquets | npm | |

Règles transverses :
- TypeScript strict partout, jamais de contournement de typage — corriger la cause racine des erreurs.
- Zod pour valider **toutes** les entrées de Server Actions et de routes API.
- Le navigateur n'écrit (quasiment) jamais directement en base : les mutations passent par des **Server Actions** Next.js qui appellent des **fonctions RPC PostgreSQL** (logique métier + contrôle d'accès côté SQL). Ce pattern est **non négociable** — c'est le cœur de la sécurité multi-tenant.
- Toute la sécurité d'isolation entre clients doit être garantie par **Row Level Security (RLS)** PostgreSQL, pas seulement par du code applicatif.

---

## 2. MODÈLE MULTI-TENANT (le socle absolu)

```
organizations (= "le client", l'entreprise)
  ├── organization_memberships (utilisateur ↔ org, rôle global, statut ACTIVE/INACTIVE)
  └── establishments (= les sites / points de vente de ce client)
        └── establishment_memberships (utilisateur ↔ établissement, rôle local, statut)
profiles (identité : nom, téléphone, avatar, liée à auth.users Supabase)
```

Règles :
- Un utilisateur peut appartenir à plusieurs établissements mais l'app résout **un contexte courant** (org + établissement "préféré") — pas de switcher multi-sites visible dans la v1.
- `organizations.status` (enum `entity_status`: `ACTIVE` | `INACTIVE`) = interrupteur technique bas niveau (soft-disable), **jamais réutilisé pour l'état commercial SaaS** (voir section 9 — c'est une règle stricte à respecter).
- Une seule ligne **OWNER** active par organisation (contrainte unique).
- Isolation stricte : toute requête doit être scoping par `organization_id` / `establishment_id`, vérifiée en RLS avec des fonctions helper du type `user_in_org(org_id)`, `user_in_establishment(est_id)`.
- Séquences numériques par établissement pour les numéros métier (commande, paiement, reçu) : tables dédiées `establishment_order_sequences`, `establishment_payment_sequences`, `establishment_receipt_sequences` avec une fonction `next_order_number(establishment_id)` atomique — jamais de génération de numéro côté client.

---

## 3. RÔLES ET ESPACES APPLICATIFS

Rôles possibles (au niveau organisation ou établissement) : `OWNER`, `ADMIN`, `MANAGER`, `BAR_MANAGER`, `CASHIER_KITCHEN`, `CASHIER`, `KITCHEN_MANAGER`.

Le rôle "effectif" d'un utilisateur est calculé en donnant priorité au rôle établissement s'il est plus spécifique que le rôle organisation (implémente une fonction `resolveEffectiveRole(orgRole, establishmentRole)` avec cette logique : Admin > Bar Manager > Cashier/Kitchen > défaut `MEMBER`).

Trois **espaces UI** (+ un espace station-service dérivé + l'espace plateforme) :

| Espace | Rôles qui y accèdent | Page d'accueil |
|---|---|---|
| `admin` | OWNER, ADMIN, MANAGER | `/application/tableau-de-bord` |
| `cashier_kitchen` | CASHIER_KITCHEN, CASHIER, KITCHEN_MANAGER | `/application/caisse` |
| `bar_manager` | BAR_MANAGER | `/application/bar` |
| `platform` (Super Admin) | table dédiée `platform_admins` | `/platform` |

Cas particulier **station-service** : si l'établissement a l'activité `gas_station`, alors :
- L'espace `cashier_kitchen` redirige vers `/application/station/pompiste/session` (écran pompiste).
- L'espace `admin`/`bar_manager` redirige vers `/application/station` (dashboard station).

Cas particulier **commerce de détail** (boutique, quincaillerie, etc., voir section 5) : le rôle bar_manager redirige vers `/application/stock` au lieu du bar (il n'y a pas de "bar" dans une boutique).

Règle `canOperateCashRegister(orgRole, establishmentRole, activityCode)` : un `admin` peut aussi opérer la caisse si l'activité est un commerce de détail (ex. le patron d'une quincaillerie vend lui-même).

Gates d'accès (pages dédiées, à créer) :
- `/attente-validation` — compte créé mais pas encore validé.
- `/acces-suspendu` — org/établissement/profil `INACTIVE`.
- `/acces-refuse` — accès refusé générique.
- `/acces-saas-bloque` — abonnement plateforme expiré/suspendu (voir section 9).
- `/onboarding` — première mise en place (créer organisation + établissement).
- `/premiere-connexion` — mot de passe temporaire à changer à la première connexion d'un employé créé par un admin.
- `/invitation/accepter`, `/invitation/mot-de-passe` — flux d'invitation d'un nouvel employé.

---

## 4. AUTHENTIFICATION

Basée sur Supabase Auth (email + mot de passe). Pages sous un groupe de routes `(auth)` :
- `/connexion` — connexion (email OU identifiant employé, voir "login-identifier")
- `/inscription` — inscription (email, mot de passe, société) puis `/inscription/activite` pour choisir l'activité métier (voir section 5)
- `/mot-de-passe-oublie` puis `/nouveau-mot-de-passe`
- `/auth/callback`, `/auth/confirm` — retours Supabase Auth (magic link / confirmation email)

Comportements spécifiques à répliquer :
- **Employés créés par un Admin** : ne s'inscrivent pas eux-mêmes. L'admin les crée via `/application/utilisateurs` (Server Action qui provisionne un compte Supabase Auth avec **service role**), avec un mot de passe temporaire. Le champ `profiles.must_change_password` force l'écran "première connexion" au prochain login.
- **Connexion par identifiant** (pas seulement email) pour les employés opérant en caisse (ex. identifiant court + mot de passe), voir `login-identifier.ts`.
- **Politique de mot de passe** dédiée (`password-policy.ts`) : longueur minimale, complexité — à définir explicitement et documenter dans le code.
- **Rotation de version de credential** (`bump_own_credential_version` RPC) — permet d'invalider les sessions locales desktop après un changement de mot de passe.
- Cookie `fb_activity` mémorise l'activité métier choisie pendant l'onboarding.

---

## 5. SYSTÈME "MULTI-ACTIVITÉS" (cœur de l'adaptabilité produit)

C'est la caractéristique la plus originale du produit : **une seule base de code s'adapte automatiquement au métier du client**. Implémente exactement cette liste d'activités (`BusinessActivityId`) :

| id | Libellé | Description |
|---|---|---|
| `restaurant` | Restaurant / Maquis / Bar / Buvette | Restauration, maquis, bar et buvette |
| `supermarket` | Supermarché / Alimentation | Épicerie, produits frais, grande distribution |
| `clothing` | Boutique de vêtements | Prêt-à-porter, chaussures, accessoires mode |
| `phones` | Téléphones / Ordinateurs / Accessoires | High-tech |
| `pharmacy` | Pharmacie / Parapharmacie | Médicaments, soins, bien-être |
| `cosmetics` | Cosmétiques | Beauté, parfums, soins, maquillage |
| `moto-parts` | Pièces moto | Deux-roues |
| `auto-parts` | Pièces auto | Pièces détachées et entretien véhicules |
| `vehicles` | Ventes d'engins | Motos, voitures, engins motorisés |
| `hardware` | Quincaillerie | Outillage, bricolage, fournitures |
| `construction` | Matériaux de construction | Ciment, fer, bois, gros œuvre |
| `wholesale` | Grossiste / Distribution | Vente en volume, B2B |
| `gas_station` | Station-service | Carburant, lubrifiants, services auto |
| `other` | Autre commerce | Activité hors liste |

Deux "familles" (`kind`) découlent de l'activité :
- `food` (uniquement `restaurant`) → vocabulaire "produit", unités BOTTLE/CAN/JERRYCAN/SACHET, conditionnements activés, catégories restaurant par défaut (Boissons, Nourriture, Plats, Accompagnements, Desserts).
- `retail` (toutes les autres) → vocabulaire adapté par activité ("article", "pièce", "matériau", "engin"...), champ "Référence" visible (taille/couleur, IMEI, DCI/dosage, référence pièce OEM, etc.), catégories suggérées propres à chaque activité, unités de vente adaptées (kg, litre, sac, carton, pièce, pack, bundle, case...).

Implémente une fonction centrale `getCatalogFormProfile(activityCode)` retournant un objet `CatalogFormProfile` avec : `kind`, `itemNoun`/`itemNounPlural`, tous les libellés de formulaire produit (titres, placeholders), `hideDepartment`, `showReference`, `showBarcode`, `showPurchasePrice`, `showPackaging`, `defaultUnit`, `units[]`, `suggestedCategories[]`. Reproduis fidèlement les valeurs métier ci-dessus pour chacune des 14 activités (unités, catégories suggérées, libellés) — ce sont des choix produits mûrement réfléchis, ne les invente pas différemment.

`mapActivityToEstablishmentType(activityId)` : mappe vers un enum SQL réduit à deux valeurs `RESTAURANT` | `COMMERCE` (le `restaurant` seul donne `RESTAURANT`, tout le reste donne `COMMERCE`) — ça garde le schéma de bootstrap simple pendant que la richesse du multi-activité vit au niveau applicatif (`activity_code` en texte libre sur l'établissement).

`isGasStationActivity` / `isFoodServiceActivity` : helpers utilisés partout dans le routing et les permissions pour brancher les écrans spécifiques (station vs bar/cuisine).

---

## 6. MODÈLE DE DONNÉES — DOMAINE MÉTIER (data plane)

Construis les migrations SQL dans cet ordre logique (chaque bloc = un ou plusieurs fichiers de migration horodatés) :

1. **Socle multi-tenant** : `organizations`, `establishments`, `profiles`, `organization_memberships`, `establishment_memberships`, enum `entity_status`, fonctions helpers RLS (`user_in_org`, `user_in_establishment`, `is_owner_or_admin`...), policies RLS de base.
2. **Bootstrap** : RPC `bootstrap_organization(name, activity_code, ...)` qui crée en une transaction : organisation (`status = ACTIVE`), établissement, membership OWNER actif pour l'appelant, et une ligne `organization_platform_states` à `PENDING_CHOICE` (voir section 9).
3. **Catalogue produits** : `departments` (ou "rayons"/"magasins" selon activité), `categories`, `products` (nom, prix de vente, prix d'achat optionnel, unité, actif/inactif, image, code-barres), `audit_logs` pour tracer les changements sensibles.
4. **Conditionnements / lots** (packagings) : structure arborescente permettant par ex. `carton → pack de 6 → bouteille` avec un facteur de conversion (`containsQty`) à chaque niveau, un flag `purchasable`/`sellable` et un prix par niveau. Implémente une fonction pure `toBaseFactor(nodes, id)` qui calcule le facteur de conversion vers l'unité de base en remontant la chaîne parent, avec détection : conversion circulaire, quantité non strictement positive, nœud qui se contient lui-même — retourne une erreur métier explicite dans ces cas (pas une exception silencieuse).
5. **Stock & approvisionnement** : `suppliers` (fournisseurs), `stock_items` (état courant dérivé), `stock_movements` (journal append-only : entrée, perte, correction, vente — **le stock ne doit JAMAIS être mis à jour par un simple `UPDATE quantity`**, toujours par insertion d'un mouvement, le solde est une somme des mouvements), `supply_receipts` (bons de réception fournisseur, avec statut brouillon/validé/réouvert), sessions d'inventaire physique (`DRAFT` + lignes de comptage).
6. **Commandes & caisse** : `orders`, `order_items` (avec prix figé sur la ligne au moment de la commande — jamais recalculé depuis le catalogue courant), statuts de préparation cuisine/bar par commande, `cash_register_sessions` (une session ouverte par caissier par établissement à la fois), séquences de numérotation.
7. **Paiements & sessions caisse** : `payments` (moyens de paiement, montant, statut, void), reçus, séquences de paiement/reçu.
8. **Dépenses** : `expenses` (montant, catégorie/zone, justification, statut annulé/actif).
9. **Statuts de préparation bar/cuisine** : colonnes de statut sur `orders`/`order_items`, RPC `update_order_kitchen_status`, `update_order_bar_status`.
10. **Sessions bar** : `bar_sessions` (ouverture/fermeture, snapshot JSON du bilan de clôture calculé côté SQL via une RPC `get_bar_session_closing_summary`), déconnexion automatique de l'opérateur à la clôture.
11. **Paramètres établissement** : devise, informations ticket (nom, adresse, logo), périmètre de service (`service_scope`).
12. **Gestion utilisateurs / employés** : RPC `provision_employee_account`, `log_employee_creation_compensated` (log + compensation si l'étape Auth échoue après création DB, pattern saga), `mark_temporary_password_reset`, `set_member_active_status`, `purge_employee_account`, `complete_password_change`. Colonnes `profiles.must_change_password`, `profiles.phone`.
13. **Module station-service** (si tu répliques cette verticale) : `fuel_types`, `fuel_tanks` (avec volume courant, capacité, seuil minimum), `fuel_pumps` (liées à une cuve, avec index compteur courant), sessions pompiste multi-opérateurs par ligne de carburant, "fiche de session" (sheet engine : calcule les ventes à partir de la différence d'index compteur, gère les raisons d'écart), livraisons carburant, pertes, jaugeage de cuve. RPC : `record_fuel_delivery`, `record_fuel_loss`, `record_fuel_tank_gauge`, `open_station_sheet_session`, `close_pump_session`.
14. **Notifications** : `admin_notifications` (avec Realtime + fonction `mark_admin_notifications_read`), abonnements push (`push_subscriptions`) avec endpoints VAPID, table de dispatch pour un cron.
15. **Codes-barres** : unicité **inter-tables** (un même code-barres ne doit pas exister sur deux produits différents, y compris entre variantes d'unité) — contrainte à gérer explicitement, pas seulement une unique index sur une seule table.
16. **Sécurité comptes employés renforcée** : durcissement RLS spécifique pour empêcher un employé de s'auto-promouvoir ou de modifier son propre statut/rôle.

Pour chaque RPC métier, applique systématiquement ce pattern : `SECURITY DEFINER`, vérification explicite d'appartenance (org/établissement) en début de fonction, écriture atomique en transaction, retour d'une erreur SQL lisible (levée via `RAISE EXCEPTION` avec un message métier clair) plutôt qu'un échec silencieux.

### RPC métier à reproduire (liste vérifiée, ne pas en oublier)

Onboarding : `bootstrap_organization`
Commandes/caisse : `create_order`, `update_order_header`, `save_order_items`, `cancel_order`
Cuisine/bar : `update_order_kitchen_status`, `update_order_bar_status`, `open_bar_session`, `close_bar_session`, `get_bar_session_closing_summary`
Sessions caisse & paiements : `open_cash_register_session`, `close_cash_register_session`, `record_order_payments`, `void_payment`
Stock : `record_stock_entry`, `record_stock_loss`, `adjust_stock_quantity`, `validate_supply_receipt`, `reopen_supply_receipt`
Catalogue : `create_establishment_product`, `upsert_product_packaging`
Paramètres : `update_establishment_settings`
Dépenses : `record_expense`, `update_expense`, `cancel_expense`
Utilisateurs : `provision_employee_account`, `log_employee_creation_compensated`, `mark_temporary_password_reset`, `set_member_active_status`, `purge_employee_account`
Notifications : `mark_admin_notifications_read`, `mark_platform_expiry_alerts_read`
Auth : `bump_own_credential_version`
Station-service : `record_fuel_delivery`, `record_fuel_loss`, `record_fuel_tank_gauge`, `open_station_sheet_session`, `close_pump_session`
Abonnement (côté client organisation) : `start_organization_trial`, `submit_subscription_request`, `change_open_subscription_request_plan`, `submit_subscription_payment_proof`
Plateforme : `is_active_platform_admin`
Desktop / sync : `apply_desktop_outbox_event` (ingestion idempotente d'événements offline), `list_establishment_users_for_sync`

---

## 7. FONCTIONNALITÉS APPLICATIVES — PAR MODULE (spécification écran par écran)

### 7.1 Tableau de bord Admin (`/application/tableau-de-bord`)
KPIs du jour/période : chiffre d'affaires, nombre de commandes, dépenses, alertes stock bas, sessions ouvertes.

### 7.2 Produits (`/application/produits`)
- Liste filtrable/recherchable, formulaire d'ajout/édition (modal), champs pilotés dynamiquement par `getCatalogFormProfile(activityCode)`.
- Upload d'image produit avec compression côté client puis "amélioration IA" optionnelle (appel à une API d'édition d'image, ex. OpenAI images) via une route API dédiée (`/api/products/enhance-image`).
- Éditeur de conditionnements (packagings) en arborescence avec calcul de facteur en direct.
- Génération et impression d'étiquette produit avec code-barres (jsbarcode), format 50×30mm.
- Import/scan de code-barres pour retrouver un produit en caisse.

### 7.3 Stock (`/application/stock`)
- Vue d'ensemble par article : quantité courante, seuil minimum, statut (ok/bas/rupture — badge coloré).
- Modals : entrée de stock, perte, correction manuelle (ajustement avec motif obligatoire), historique des mouvements par article.
- Fournisseurs (CRUD).
- Approvisionnements (`/application/approvisionnements`) : création de bons de réception, réception effective (RPC `record_stock_entry` ou `validate_supply_receipt`), réouverture d'un bon validé par erreur.
- Inventaires (`/application/inventaires`) : démarrage d'une session de comptage.

### 7.4 Caisse / POS (`/application/caisse`, `/application/caisses`)
- Grille produits par catégorie (sidebar catégories + recherche), panier avec quantités et remarques.
- Gestion des commandes ouvertes (`/application/commandes-ouvertes`), reprise, modification, annulation.
- Session caisse : ouverture (fond de caisse déclaré) / fermeture (comptage, écart affiché) — une session active par caissier.
- Encaissement (`/application/encaissement`) : choix moyen de paiement, rendu monnaie, ticket thermique imprimable (format 80mm), annulation de paiement (`void_payment`) tracée.
- Raccourcis clavier dédiés à la caisse (F-touches, Entrée = encaisser, Échap = fermer modal) — implémente un hook centralisé de gestion clavier (`use-pos-keyboard`).
- Vue admin des sessions caisse (`/application/caisses`) : historique, détail, écarts de caisse.

### 7.5 Cuisine (`/application/cuisine`)
Écran dédié à la préparation : liste des commandes par statut (en attente / en préparation / prêt), changement de statut par article ou globalement, badges sonores pour nouvelle commande (chime).

### 7.6 Bar (`/application/bar`, espace `bar_manager` complet)
- Dashboard bar, commandes bar, stock bar (partagé avec le stock général mais filtré), historique bar.
- Sessions bar (`/application/sessions-bar` côté admin) : ouverture/fermeture avec bilan JSON détaillé (ventes, stock consommé, écarts), déconnexion automatique de l'opérateur bar à la clôture de sa session.

### 7.7 Station-service (`/application/station`)
- Dashboard admin station : cuves, pompes, types de carburant, ventes du jour.
- Gestion cuves/pompes/types de carburant (CRUD), jaugeage.
- Sessions pompiste (`/application/station/pompiste/session`) : ouverture de session avec relevés d'index de départ par pompe, saisie des ventes, clôture avec calcul automatique (delta d'index × prix) et gestion des écarts avec motif obligatoire à l'ouverture s'il y a un écart de jauge.
- Livraisons carburant, pertes.
- Interface "Sheet" (fiche de session) recalculée côté serveur, jamais côté client seul.

### 7.8 Dépenses (`/application/depenses`)
Liste, création, modification, annulation, catégorisation/zone.

### 7.9 Ventes / Rapports (`/application/ventes`, `/application/rapports`)
Rapports multiples : ventes par période, bénéfices (calcul du coût des marchandises vendues à partir des mouvements de stock + prix d'achat, marge, surplus de vente), export CSV.

### 7.10 Utilisateurs (`/application/utilisateurs`)
CRUD employés : création avec mot de passe temporaire + modal "identifiants créés avec succès" (à copier/imprimer), réinitialisation de mot de passe, activation/désactivation, suppression avec confirmation.

### 7.11 Paramètres (`/application/parametres`)
Infos établissement, logo, devise, format ticket, périmètre de service.

### 7.12 Notifications (`/application/notifications`, cloche admin)
Flux temps réel (Supabase Realtime) des événements importants (nouvelle commande, stock bas, etc.), badge non-lu, marquage lu.

### 7.13 Mon abonnement (`/application/mon-abonnement`, `/abonnement`)
Vue côté client organisation : statut d'abonnement, choix essai gratuit ou formule payante, soumission de preuve de paiement Orange Money, historique de demandes, reçu imprimable.

### 7.14 Mode hors-connexion (`/application/mode-hors-connexion`)
Écran affiché quand la synchro cloud est indisponible en mode desktop — indicateur discret, jamais un blocage plein écran (voir section 12).

---

## 8. DESIGN SYSTEM / UX

- Palette : fond `#f8fafc`, texte `#0f172a`, couleur primaire verte `#059669` (dark `#047857`) — thème "vert Burkina/nature", à utiliser en accent (boutons primaires, badges succès).
- Police : Geist Sans (UI), Geist Mono (nombres tabulaires en caisse, reçus thermiques).
- **Shells fixes** (`admin-shell`, `pos-shell`, `checkout-shell`, `fasobar-shell`, `space-shell`, `platform-shell`) : chacun occupe `100dvh`, `overflow: hidden` — pas de scroll de page globale, seul le panneau de contenu interne scrolle. Sidebar + topbar montés une seule fois, jamais remontés à la navigation (exigence UX no-flash).
- Barres de défilement personnalisées : fines, discrètes, invisibles dans certaines listes tactiles (listes caisse) avec `scroll-snap` (listes plateforme : clients, demandes, abonnements, machines).
- Nombres tabulaires (`font-variant-numeric: tabular-nums`) dans toute l'UI caisse/rapports pour l'alignement des montants.
- **Impression** : quatre gabarits distincts et strictement isolés au print (via classes `html.printing-*` + clone DOM dédié) :
  1. Ticket thermique 80mm (commande/addition, avec logo établissement).
  2. Reçu d'abonnement plateforme, format A4 210mm.
  3. Étiquette produit code-barres 50×30mm.
  4. Rapports admin multi-pages avec en-têtes de tableau répétés et anti-coupure de ligne.
- Mobile-first : cibles tactiles ≥ 44px, `-webkit-tap-highlight-color: transparent`, scroll horizontal fluide au pouce sur les tableaux admin.
- Composants UI réutilisables à construire : `ActionButton`, `Badge`, `ModalShell`/`ModalFooter`, `Toast`, `ExpandPanel`, `FullscreenButton`, `LiveClock`, contrôles de formulaire génériques (`form-controls.tsx`).

---

## 9. ESPACE SUPER ADMIN / "PLATFORM" — CONTROL PLANE SAAS (section critique, très détaillée)

C'est la partie la plus subtile du produit : **la séparation stricte entre le statut technique d'une organisation et son droit d'accès commercial (SaaS)**. Respecte ce modèle à la lettre, il évite des bugs de facturation graves.

### 9.1 Principe fondamental
- `organizations.status` (`ACTIVE`/`INACTIVE`) = "l'organisation existe et n'est pas désactivée techniquement" → **ne sert jamais** à représenter essai, abonnement, suspension commerciale ou suppression. Ne jamais étendre cet enum avec des valeurs SaaS.
- `organization_platform_states` (table **1–1** avec `organizations`, PK = `organization_id`) = **seule source de vérité** de l'accès SaaS. Statuts possibles : `PENDING_CHOICE`, `TRIAL`, `TRIAL_EXPIRED`, `ACTIVE`, `EXPIRED`, `SUSPENDED`, `PENDING_DELETION`.
- Les deux couches doivent être considérées ensemble pour autoriser une opération métier (voir §9.6 — gate d'accès).

### 9.2 Définition du "client" côté Super Admin
Un client FasoBar = le compte **OWNER** actif d'une organisation. Ne crée **jamais** de table `clients` qui dupliquerait `organizations` — résous l'UI "client" en joignant `organizations` + `organization_memberships WHERE role='OWNER' AND status='ACTIVE'` + `profiles`.

### 9.3 Tables du control plane (à créer, séparées du data plane métier)
- `organization_platform_states` — voir §9.1 (colonnes : `status`, `status_changed_at`, `billing_phone`, `primary_owner_user_id`, `deletion_requested_at`, `deletion_purge_after`, `previous_status`).
- `platform_admins` — Super Admins (`user_id` unique, `status`).
- `subscription_plans` — formules (`code`, `name`, `billing_period` MONTHLY/YEARLY, `duration_months`, `price_xof`, `currency` XOF, `max_machines`, `features` jsonb, `is_active`, `sort_order`). Seed : Mensuel 1 mois / **10 000 FCFA**, Annuel 12 mois / **100 000 FCFA**. Tarifs modifiables par le Super Admin.
- `organization_trials` — au plus **un** essai gratuit par organisation (contrainte unique), `starts_at`/`ends_at`, statut `ACTIVE`/`EXPIRED`/`CANCELLED`/`CONVERTED`. Durée par défaut : 7 jours (configurable via des platform_settings).
- `subscription_requests` — demande d'abonnement/renouvellement : `plan_id`, `billing_period`, `duration_months`, `expected_amount_xof`, `reference_code` (unique), `status` (`PENDING_PAYMENT`, `PAYMENT_SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`), `payment_instructions`, `orange_money_number` (défaut `+22657537299`), `requires_new_proof`, décisions Super Admin. **Au plus une demande ouverte par organisation** (contrainte partielle sur statuts non terminaux).
- `subscription_payment_proofs` — capture d'écran, numéro de transaction, numéro payeur ; une seule preuve `is_current` par demande.
- `platform_subscription_payments` — paiement confirmé (canal `ORANGE_MONEY`), distinct de `payments` (caisse) — **ne jamais confondre les deux tables**.
- `organization_subscriptions` — périodes payantes (`ACTIVE`/`EXPIRED`/`SUSPENDED`/`CANCELLED`), une seule `is_current=true` par organisation.
- `registered_machines` — machines desktop autorisées, liées à un **établissement** (`device_id` unique, statut `PENDING`/`ACTIVE`/`REVOKED`/`DISABLED`, `last_sync_at`, version app).
- `organization_licenses` — licence numérique dérivée de l'abonnement (`license_payload` jsonb, `valid_from`/`valid_until`, `max_machines`), une seule `ACTIVE` par organisation.
- `platform_suspensions` — suspensions exceptionnelles ciblant `ORGANIZATION` | `ESTABLISHMENT` | `EMPLOYEE`, statut `ACTIVE`/`LIFTED`, motif.
- `platform_audit_logs` — audit append-only des actions Super Admin (distinct de l'`audit_logs` métier).

### 9.4 Parcours officiel (à reproduire exactement)
```
Bootstrap organisation → organization_platform_states = PENDING_CHOICE
        ↓
Client choisit essai gratuit OU formule payante
        ↓ (essai)                         ↓ (payant)
organization_trials ACTIVE          subscription_requests PENDING_PAYMENT
plateforme = TRIAL                  + référence unique + instructions Orange Money
        ↓ fin essai                        ↓
plateforme = TRIAL_EXPIRED          Client envoie preuve (capture + n° transaction + n° payeur)
                                            ↓
                                     subscription_requests = PAYMENT_SUBMITTED
                                            ↓
                                     Super Admin vérifie
                            ┌───────────────┼────────────────┐
                         REJECTED    UNDER_REVIEW (preuve   APPROVED
                                      insuffisante)                ↓
                                                          organization_subscriptions ACTIVE
                                                          plateforme = ACTIVE
                                                          licence numérique générée/renouvelée
                                                          quota machines appliqué
```

Règles de dates de période :
- Premier abonnement ou renouvellement après expiration : `starts_at = date de confirmation`, `ends_at = starts_at + duration_months`.
- Renouvellement avant expiration : `starts_at = ends_at` de la période courante (enchaînement, pas de recouvrement), puis `+ duration_months`.

### 9.5 Actions Super Admin
- Lister **tous** les clients, leurs établissements, employés, rôles, statuts.
- Voir les machines par client/établissement (empreinte device, dernière synchro, statut).
- Confirmer / refuser / remettre en vérification une demande d'abonnement.
- **Suspendre** exceptionnellement un client, un établissement, ou un employé (table `platform_suspensions`) — cela bascule `organization_platform_states.status = SUSPENDED` **sans jamais toucher** `organizations.status`.
- **Supprimer** un client → `PENDING_DELETION` avec fenêtre de récupération (`deletion_purge_after`), restauration possible vers `previous_status`, puis purge complète (data plane + control plane) après expiration de la fenêtre.
- Consulter l'historique complet (demandes, paiements, périodes, licences, suspensions).

### 9.6 Gate d'accès métier (à brancher sur TOUTES les Server Actions métier sensibles)
Une opération métier (caisse, bar, admin, stock…) n'est autorisée que si **toutes** ces conditions sont vraies :
1. `organizations.status = ACTIVE` + memberships/profil/établissement `ACTIVE` (couche technique existante).
2. `organization_platform_states.status ∈ {TRIAL, ACTIVE}` (couche SaaS).
3. (Desktop) machine autorisée + licence locale valide, non expirée.
4. Pas de `platform_suspensions` `ACTIVE` visant cette cible.

En dehors de ces statuts (`TRIAL_EXPIRED`, `EXPIRED`, `SUSPENDED`), l'utilisateur est redirigé vers `/acces-saas-bloque` mais garde le droit de consulter/soumettre une demande d'abonnement et une preuve de paiement (sauf `SUSPENDED`/`PENDING_DELETION`, hors lecture du motif).

### 9.7 Paiement (v1, pas de passerelle en ligne)
- Canal unique : Orange Money, numéro `+226 57 53 72 99`.
- Aucune intégration de paiement automatisé — FasoBar trace la demande, le client paie hors-app, le Super Admin vérifie manuellement puis confirme dans l'outil, ce qui déclenche l'automatisation (dates, statut, licence).

---

## 10. NOTIFICATIONS PUSH

- Web Push (VAPID) avec `web-push` côté serveur.
- Table `push_subscriptions` (endpoint, clés, utilisateur/établissement).
- Composant `EnableNotificationsButton` pour demander la permission navigateur et enregistrer l'abonnement.
- Route API `/api/cron/dispatch-push` acceptant GET et POST (POST pour être appelable par un **Database Webhook Supabase** déclenché sur insertion d'un événement à notifier).
- Un cron (Vercel — plan Hobby : une exécution par jour max) sert de **filet de sécurité** de repli, la voie principale étant le webhook temps réel.
- Alerte de fin d'abonnement à venir (`/api/platform/expiry-alerts`) : notifie les clients dont l'abonnement expire bientôt.
- Badges de navigation Super Admin en temps réel (`/api/platform/nav-badges` + hook `use-platform-nav-badges-live`).

---

## 11. PWA

- `manifest.ts`, service worker (`public/sw.js`), bouton d'installation (`fasobar-install-button.tsx`), hook `use-fasobar-pwa-install`.
- Icônes multi-résolutions, `apple-icon.png`, `icon.png`, favicon.
- `robots.ts`, `sitemap.ts`, JSON-LD pour le SEO du site marketing.

---

## 12. APPLICATION DESKTOP (Electron) — cible "local-first"

### 12.1 Exigence produit non négociable
L'app Windows doit se comporter comme un **vrai logiciel installé**, pas un site web dans une fenêtre :
- Fenêtre avec titlebar personnalisée, pas de chrome navigateur visible.
- Navigation instantanée (< 100ms perçus), zéro page blanche au démarrage ou à la navigation.
- Toutes les données de service (catalogue, panier, stock, commandes ouvertes) proviennent d'une base **locale**, jamais d'un aller-retour réseau bloquant.
- La synchro réseau tourne en arrière-plan, jamais un spinner plein écran ni un blocage de la caisse "synchronisation en cours".
- Mise à jour silencieuse en tâche de fond, appliquée à la fermeture de session ou au prochain lancement — jamais pendant un encaissement.
- Raccourcis clavier globaux indépendants du focus DOM.

### 12.2 Architecture technique à construire
```
Shell Electron (main process) : fenêtre frameless, tray icon, menu, updater
   └── serveur Next embarqué localement (le même code web, mode "desktop")
         └── UI cliente : lit depuis un store local alimenté par SQLite
               └── Local Domain API (lectures/écritures locales : commandes, stock,
                   sessions caisse/bar avec numéros PROVISOIRES "LOCAL-...")
                     └── Sync Engine (outbox) : queue d'événements avec
                         client_mutation_id UUID unique par mutation → push idempotent
                         vers Supabase dès que le réseau revient
```

Composants à répliquer (dossier `desktop/`) :
- `desktop/main/main.ts`, `windows.ts`, `tray.ts`, `network.ts`, `health-probe.ts`, `allowed-origins.ts`, `local-server.ts`, `runtime-config.ts` — process principal Electron : fenêtre, détection réseau, healthcheck du serveur local, liste blanche d'origines autorisées à naviguer.
- `desktop/preload/preload.ts` — pont sécurisé (contextBridge) entre le renderer et le main process.
- `desktop/renderer/splash.html`, `setup.html`, `error.html` — écrans natifs légers (pas de dépendance React) pour le boot, la première configuration, et les erreurs fatales.
- `desktop/shared/config-schema.ts` — schéma de config partagé (Zod) entre main/preload/renderer.
- Base SQLite locale (`src/lib/local-db/`) : `database.ts`, `migrations.ts` + dossier de migrations SQLite versionnées, `backup.ts`, `health.ts`, `paths.ts` (emplacement du fichier `.sqlite` sur disque Windows), `transaction.ts`.
- `src/lib/local-domain/` : logique métier locale miroir du data plane cloud — `checkout-local.ts`, `orders-local.ts`, `cash-sessions.ts`, `catalog-service.ts`, `catalog-pull.ts`, `products-repository.ts`, `numbering.ts` (numéros locaux provisoires), `device.ts` (identité machine).
- `src/lib/local-auth/` : login **hors-ligne** avec utilisateurs pré-synchronisés (`users-repository.ts`, `password-verifier.ts` — hash local, jamais le mot de passe cloud en clair —, `rate-limit.ts` anti brute-force local, `session.ts`).
- `src/lib/sync/` : `outbox.ts` (file d'attente d'événements), `push.ts` (envoi vers `apply_desktop_outbox_event`, idempotent via `client_mutation_id`), `status.ts` (badge "X en attente / synchronisé / hors-ligne").
- `src/lib/desktop/` : `runtime.ts` (détection "je tourne dans Electron"), `cloud-reachability.ts` (test de connectivité), `connectivity-label.ts`, `logger.ts`, `require-cloud-online.ts` (garde pour les opérations qui exigent le cloud, ex. création d'un nouvel employé).
- Scripts de build (`scripts/desktop-*.mjs`) : génération d'icônes, préparation du build Next standalone à embarquer, vérification des secrets absents du build, packaging electron-forge, génération de l'installeur NSIS, vérification finale du package.
- `forge.config.ts`, `electron-builder.yml`, `vite.main.config.ts`, `vite.preload.config.ts`.

### 12.3 Règles de synchronisation et de résolution de conflits (à respecter impérativement)
| Risque | Règle |
|---|---|
| Numéros de commande/paiement/reçu | Toujours des numéros **locaux provisoires** (`LOCAL-...`) tant qu'offline ; le numéro **définitif** est attribué **uniquement côté cloud** à la synchro, via les séquences `next_*` existantes. |
| Stock concurrent (deux machines) | Le stock cloud est **toujours** une somme de mouvements idempotents, jamais un `SET quantity` brut sauf correction explicite avec motif. |
| Double encaissement (rejeu réseau) | `client_mutation_id` UUID unique + RPC idempotente côté serveur (ne pas rejouer un mouvement déjà appliqué). |
| Deux sessions caisse ouvertes pour le même utilisateur | Verrou "une session OPEN par caissier/établissement" côté cloud ; en local, la session est liée au `device_id`. |
| Bilan de clôture vs mouvements tardifs | Le bilan officiel est **recalculé côté cloud** à la synchronisation ; l'affichage local est un aperçu ("preview"), pas la vérité définitive. |
| Prix catalogue changé pendant le service offline | Le prix est **figé sur la ligne de commande** au moment de la vente, jamais recalculé depuis le catalogue courant. |
| Abonnement expiré en offline | Période de tolérance locale (grace) en jours, puis mode lecture seule discret — jamais un blocage brutal en plein service. |

---

## 13. SITE MARKETING PUBLIC

Pages (`(marketing)`) : accueil (héros vidéo/bandeau, présentation), fonctionnalités, tarifs (cartes de prix générées depuis `subscription_plans`, avec repli statique si la base est indisponible), solutions par secteur (une page par activité, ex. `/solutions/gestion-de-stock-burkina-faso`), FAQ, aide, contact (bouton WhatsApp), conditions d'utilisation, politique de confidentialité, page téléchargement de l'app desktop, affiche promotionnelle imprimable.

Prix affichés (repli si base indisponible) :
- Mensuel : **10 000 FCFA** / 1 mois
- Annuel : **100 000 FCFA** / 12 mois
- Essai gratuit : 7 jours
- Offre "Kit + annuel" (matériel caisse/clavier/souris/imprimante + abonnement an) : **350 000 FCFA**

---

## 14. ORDRE DE CONSTRUCTION (ne pas paralléliser, chaque phase doit être stable avant la suivante)

**Phase 0 — Socle & Auth**
Multi-tenant (org/établissements/profiles/memberships) + RLS de base, Supabase Auth, onboarding (`bootstrap_organization`), sélection d'activité métier, rôles/espaces/routing.

**Phase 1 — Catalogue & Stock**
Produits, catégories, conditionnements, code-barres, fournisseurs, mouvements de stock, approvisionnements.

**Phase 2 — Vente (cœur POS)**
Commandes, panier, sessions caisse, paiements, reçus thermiques, annulations. Tester intensivement l'atomicité des RPC (concurrence, idempotence).

**Phase 3 — Verticales spécifiques**
Cuisine + Bar (restaurant), puis Station-service (carburant) si le client cible ce secteur. Adapter dynamiquement via `activity_code`/`getCatalogFormProfile`.

**Phase 4 — Gestion & pilotage**
Dépenses, rapports/bénéfices, paramètres établissement, gestion utilisateurs/employés, notifications admin temps réel.

**Phase 5 — Control plane Super Admin**
Tables plateforme (section 9), UI `/platform`, workflow abonnement/preuve/validation, suspensions, machines, audit.

**Phase 6 — Site marketing & PWA**
Vitrine publique, tarifs dynamiques, notifications push, installabilité PWA.

**Phase 7 — Desktop local-first**
Shell Electron, SQLite local, Local Domain API, Sync Engine/outbox, login offline, gestion des conflits (section 12.3), updater silencieux, installeur Windows signé (NSIS).

**Phase 8 — Durcissement**
Tests Vitest sur toute logique pure (calculs de facteur de conversion, calcul de bilan, politique de mot de passe, résolution de rôle/espace, validation Zod), audit de sécurité RLS, documentation des contrats RPC (entrées/sorties/erreurs) comme API de synchro.

---

## 15. RÈGLES TRANSVERSES À NE JAMAIS VIOLER

1. Jamais d'écriture de stock par `UPDATE quantity` direct hors mouvement journalisé.
2. Jamais de recalcul de prix de vente depuis le catalogue courant sur une commande déjà créée — le prix est figé à la ligne.
3. Jamais de génération de numéro de séquence métier (commande/paiement/reçu) côté client — toujours via la fonction serveur atomique.
4. Jamais de mélange entre `organizations.status` (technique) et le statut SaaS (`organization_platform_states`) — ce sont deux sources de vérité strictement séparées.
5. Jamais de table `clients` dupliquant `organizations`.
6. Jamais de blocage plein écran de l'UI caisse/bar pour une synchronisation réseau.
7. Jamais de remount de la sidebar/topbar à chaque navigation dans le shell desktop.
8. Toute mutation sensible passe par une Server Action → RPC PostgreSQL avec vérification d'appartenance organisation/établissement.
9. Toute nouvelle activité métier doit pouvoir être ajoutée en étendant uniquement `BUSINESS_ACTIVITIES` + son profil catalogue, sans toucher au moteur central.
10. Le paiement d'abonnement reste manuel/vérifié par un humain (Super Admin) en v1 — ne pas ajouter de passerelle de paiement automatisée sans que ce soit explicitement demandé.

---

## 16. INSTRUCTIONS FINALES POUR L'IA QUI EXÉCUTE CE PROMPT

- Si une information manque pour une décision structurante (ex. contenu exact d'un écran non détaillé ici), **pose la question** plutôt que d'inventer une règle métier qui contredirait ce document.
- Documente chaque migration SQL avec un commentaire d'en-tête expliquant son objectif (comme un historique de projet réel).
- Écris les tests Vitest au fur et à mesure de chaque module de logique pure, pas à la fin.
- Vise du code TypeScript strict, des Server Actions systématiquement validées par Zod, et une UI cohérente avec le design system de la section 8.
- Le livrable final doit permettre : un patron de maquis de créer son compte, choisir "Restaurant", configurer son catalogue, vendre en caisse, gérer son stock et son bar — **et** un patron de quincaillerie de faire strictement la même chose avec le vocabulaire et les unités adaptés à son métier, dans la même base de code.
- Ne livre jamais une fonctionnalité "à moitié" en la présentant comme terminée : si une pièce reste hors scope (ex. clôture d'inventaire), dis-le explicitement dans ton rapport d'avancement.

---

*Fin du prompt de reconstruction. Ce document décrit un produit réel et fonctionnel — traite-le comme un cahier des charges de production, pas comme un exercice.*
