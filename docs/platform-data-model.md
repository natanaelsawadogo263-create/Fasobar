# FasoBar — Modèle de données Super Admin (Phase 1B)

**Statut :** spécification officielle du modèle (cadrage)  
**Références :** `docs/platform-control-plane.md`, `docs/database/core-multi-tenant.md`, `docs/audit-local-first.md`  
**Hors périmètre :** migrations SQL, pages UI, code applicatif

Ce document fixe le **modèle exact** du control plane selon les règles officielles ci-dessous.

---

## 1. Définition du client

| Couche | Définition |
|--------|------------|
| **Interface Super Admin** | Un **client FasoBar** = le compte **OWNER** principal (personne affichée : nom, e-mail, téléphone) |
| **Technique** | Toutes les données commerciales et structurelles restent rattachées à **`organizations`** |
| **Interdit** | Créer une table `clients` qui duplique `organizations` |
| **Employés** | Restent dans **`profiles`** + **`organization_memberships`** / **`establishment_memberships`** |

Résolution UI Super Admin « client » :

```
organizations
  └── organization_memberships WHERE role = 'OWNER' AND status = 'ACTIVE'
        └── profiles (+ e-mail via Auth Admin)
  └── organization_platform_states (1–1)  ← accès SaaS
```

Un seul OWNER actif par organisation (contrainte déjà prévue dans le socle multi-tenant).

---

## 2. Séparation des statuts (règle critique)

### 2.1 Ne pas toucher `organizations.status`

| Champ | Type | Valeurs | Rôle |
|-------|------|---------|------|
| `organizations.status` | `entity_status` **existant** | **`ACTIVE`**, **`INACTIVE`** | Soft-enable opérationnel de l’org (RLS, onboarding, memberships) |

**Interdit :**
- remplacer `entity_status` ;
- étendre l’enum `entity_status` avec des valeurs SaaS ;
- ajouter une colonne `access_status` sur `organizations` ;
- réutiliser `organizations.status` pour essai, abo, suspension commerciale ou suppression.

Le fonctionnement actuel reste inchangé : RLS et helpers multi-tenant continuent de tester `o.status = 'ACTIVE'::entity_status`.

### 2.2 État SaaS séparé — table 1–1

L’accès commercial / licence vit dans **`organization_platform_states`**, relation **1–1** avec `organizations` (`organization_id` PK et FK).

Valeurs de `organization_platform_states.status` :

| Statut | Signification |
|--------|----------------|
| `PENDING_CHOICE` | Compte créé ; essai ou abo immédiat pas encore choisi |
| `TRIAL` | Essai gratuit d’un mois en cours |
| `TRIAL_EXPIRED` | Essai terminé, pas d’abonnement actif |
| `ACTIVE` | Abonnement payant valide (ou accès SaaS pleinement ouvert) |
| `EXPIRED` | Abonnement terminé ; données conservées ; ops métier bloquées ; abo + preuve autorisés |
| `SUSPENDED` | Suspension Super Admin |
| `PENDING_DELETION` | Suppression demandée ; fenêtre de récupération |

**Hors de cette liste** (volontairement) : `PENDING_PAYMENT`, `GRACE_PERIOD`, `CANCELLED` — le paiement se lit sur la **demande** ; l’annulation commerciale d’une période se lit sur l’**abonnement**.

### 2.3 Statuts demande d’abonnement

Sur `subscription_requests.status` uniquement :

| Statut | Signification |
|--------|----------------|
| `PENDING_PAYMENT` | Demande créée ; instructions Orange Money + référence ; en attente de preuve |
| `PAYMENT_SUBMITTED` | Capture + n° transaction + n° payeur reçus |
| `UNDER_REVIEW` | Examen Super Admin / nouvelle preuve demandée |
| `APPROVED` | Paiement validé ; activation auto effectuée |
| `REJECTED` | Paiement refusé |
| `CANCELLED` | Demande annulée (client ou Super Admin) sans validation |

### 2.4 Statuts abonnement (période)

Sur `organization_subscriptions.status` uniquement :

| Statut | Signification |
|--------|----------------|
| `ACTIVE` | Période en cours |
| `EXPIRED` | Période terminée |
| `SUSPENDED` | Coupée par suspension client |
| `CANCELLED` | Résiliée |

### 2.5 Compatibilité avec l’existant (ne pas casser)

| Couche actuelle | Dépendance | Impact Phase 1B |
|-----------------|------------|-----------------|
| **RLS** (`user_in_org`, `user_in_establishment`, …) | `organizations.status = ACTIVE`, memberships `ACTIVE`, établissements `ACTIVE` | **Aucun changement** de predicates RLS. L’état SaaS n’entre **pas** dans les policies SQL Phase 1B. |
| **Onboarding** | Crée org `status = ACTIVE` + OWNER membership `ACTIVE` | **Conservé**. En parallèle : insert 1–1 `organization_platform_states` avec `PENDING_CHOICE`. |
| **Memberships** | `organization_memberships.status` / `establishment_memberships.status` = `entity_status` | **Inchangés**. Suspension SaaS ne bascule pas automatiquement tous les memberships en `INACTIVE` (évite de casser la structure) ; le **gate applicatif** SaaS bloque l’usage. |
| **Gates Admin / Caisse / Bar** | Aujourd’hui : workspace + `organizations.status`, memberships, profil | **Enrichissement applicatif ultérieur** : après les checks actuels, lire `organization_platform_states.status ∈ {TRIAL, ACTIVE}`. Tant que cette couche n’est pas branchée, le comportement actuel reste valide. |

**Principe :**  
`organizations.status` = « l’org existe et n’est pas soft-disabled »  
`organization_platform_states.status` = « le client a le droit SaaS d’exploiter »

Les deux doivent être `ACTIVE` (côté SaaS : `TRIAL` ou `ACTIVE`) pour les opérations métier une fois les gates plateforme branchés.

---

## 3. Règles métier officielles (résumé)

### 3.1 Création du compte

1. Après création / bootstrap : le client choisit **essai 1 mois** ou **abonnement immédiat**.  
2. État SaaS initial : **`PENDING_CHOICE`** (table plateforme 1–1).  
3. `organizations.status` reste **`ACTIVE`** (comportement actuel).  
4. **Un seul essai gratuit** par organisation.  
5. Choix essai → SaaS **`TRIAL`**.  
6. Expiration essai → SaaS **`TRIAL_EXPIRED`**.

Pendant un parcours de paiement, l’état SaaS reste typiquement `PENDING_CHOICE`, `TRIAL_EXPIRED` ou `EXPIRED` ; le suivi du paiement est sur `subscription_requests.status` (`PENDING_PAYMENT`, etc.).

### 3.2 Formules initiales (catalogue)

| Formule | Durée | Tarif initial |
|---------|-------|---------------|
| Mensuelle | 1 mois | **10 000 FCFA** |
| Annuelle | 12 mois | **100 000 FCFA** |

Tarifs **modifiables** par le Super Admin via `subscription_plans`.

### 3.3 Paiement

- Orange Money au **`+226 57 53 72 99`**.  
- Demande auto avec **référence unique**.  
- Preuve : capture + n° transaction + n° payeur.  
- Statuts demande : §2.3.

### 3.4 Validation Super Admin

- Confirmer, refuser, demander une nouvelle preuve, ou annuler la demande (`CANCELLED`).  
- Après **APPROVED** : créer/renouveler l’abonnement (`ACTIVE`), dates auto, SaaS → **`ACTIVE`**, licence, rétablissement d’accès pour OWNER + employés actifs (gates), sans altérer `organizations.status` s’il est déjà `ACTIVE`.

### 3.5 Expiration

- Conserver toutes les données.  
- Bloquer les opérations métier (gate SaaS → `EXPIRED`).  
- Conserver l’accès abonnement + envoi de preuve.  
- Renouvellement **APPROVED** → SaaS `ACTIVE` + abo `ACTIVE`.

### 3.6 Gestion Super Admin

- **Suspendre** ⇒ SaaS `SUSPENDED` ; bloquer OWNER, employés, machines, licences (gates + licences/machines) ; **ne pas** forcer `organizations.status = INACTIVE` (sauf action soft-disable distincte).  
- **Supprimer** ⇒ SaaS `PENDING_DELETION` + période de récupération, puis purge de toute la structure.

---

## 4. Frontière data plane / control plane

| Zone | Tables | Rôle |
|------|--------|------|
| **Data plane** (réutilisé) | `organizations`, `establishments`, `profiles`, `organization_memberships`, `establishment_memberships`, + ops restaurant | Structure client + exploitation |
| **Control plane** (nouveau) | `organization_platform_states`, `platform_admins`, `subscription_plans`, `subscription_requests`, `subscription_payment_proofs`, `platform_subscription_payments`, `organization_subscriptions`, `organization_trials`, `registered_machines`, `organization_licenses`, `platform_suspensions`, `platform_audit_logs` | Commercial, licence, gouvernance |

`public.payments` (caisse) ≠ `platform_subscription_payments`.

---

## 5. Autres enums control plane

### 5.1 Essai — `trial_status`

| Statut | Signification |
|--------|----------------|
| `ACTIVE` | En cours |
| `EXPIRED` | Terminé |
| `CANCELLED` | Révoqué |
| `CONVERTED` | Remplacé par un abonnement `APPROVED` |

### 5.2 Machine / licence / suspension

- Machines : `PENDING`, `ACTIVE`, `REVOKED`, `DISABLED`  
- Licences : `ACTIVE`, `EXPIRED`, `REVOKED`, `SUPERSEDED`  
- Suspensions : cible `ORGANIZATION` | `ESTABLISHMENT` | `EMPLOYEE` ; statut `ACTIVE` | `LIFTED`

---

## 6. Tables réutilisées (data plane)

### 6.1 `organizations`

| | |
|--|--|
| **Rôle** | Conteneur technique du **client** |
| **Colonnes** | **Uniquement l’existant** : `id`, `name`, `slug`, `status` (`entity_status` : `ACTIVE` \| `INACTIVE`), `phone`, timestamps — **aucune colonne SaaS ajoutée** |
| **Relations** | 1–1 `organization_platform_states` ; 1–* établissements, memberships, essais, abos, demandes, licences, machines (via établissements), suspensions |
| **Contraintes / index** | `UNIQUE (slug)` (existant) |
| **Lecture / écriture** | Inchangées (RLS actuelles) |
| **Réutilisé** | Oui — **pas** de table `clients` |

**Création :** bootstrap actuel conserve `status = ACTIVE`. En parallèle, création obligatoire de la ligne plateforme `PENDING_CHOICE`.

### 6.2 `establishments`

| | |
|--|--|
| **Rôle** | Sites du client ; **propriétaire des machines** |
| **Colonnes** | Existantes (`organization_id`, `name`, `slug`, `status` `entity_status`, …) |
| **Relations** | N–1 `organizations` ; 1–* `registered_machines` |
| **Contraintes** | `UNIQUE (organization_id, slug)` |
| **Accès** | RLS actuel ; Super Admin lecture cross-tenant |
| **Réutilisé** | Oui |

### 6.3 `profiles`

| | |
|--|--|
| **Rôle** | Identité OWNER, employés, Super Admins (Auth) |
| **Réutilisé** | Oui — pas de table employés plateforme |

### 6.4 `organization_memberships`

| | |
|--|--|
| **Rôle** | Lien user ↔ org + rôle + `status` `entity_status` |
| **Contraintes** | `UNIQUE (organization_id, user_id)` ; un seul OWNER actif |
| **Réutilisé** | Oui — définit le « client » UI via rôle `OWNER` |
| **Note SaaS** | Une suspension commerciale **ne modifie pas** massivement ces lignes ; le gate SaaS s’applique en plus |

### 6.5 `establishment_memberships`

| | |
|--|--|
| **Rôle** | Affectation opérationnelle |
| **Réutilisé** | Oui |

---

## 7. Tables control plane

### 7.1 `organization_platform_states` ⭐ (accès SaaS 1–1)

| | |
|--|--|
| **Rôle** | État d’accès SaaS du client ; **seule** source de vérité pour essai / actif / expiré / suspendu / suppression |
| **Colonnes** | `organization_id` uuid **PK** FK → `organizations(id)` ON DELETE CASCADE ; `status` `organization_platform_status` NOT NULL DEFAULT `'PENDING_CHOICE'` ; `status_changed_at` timestamptz NOT NULL DEFAULT now() ; `billing_phone` text NULL ; `primary_owner_user_id` uuid NULL FK → `profiles(id)` ; `deletion_requested_at` timestamptz NULL ; `deletion_purge_after` timestamptz NULL ; `previous_status` `organization_platform_status` NULL (restauration après récupération) ; `created_at` ; `updated_at` |
| **Relations** | **1–1** avec `organizations` |
| **Contraintes** | PK = `organization_id` ; check dates suppression cohérentes si `PENDING_DELETION` |
| **Index** | `(status)` ; `(deletion_purge_after) WHERE status = 'PENDING_DELETION'` ; `(primary_owner_user_id)` |
| **Statuts** | §2.2 uniquement |
| **Lecture** | Membres org (Owner/Admin) pour écrans abo ; Super Admin toutes ; service role pour gates |
| **Écriture** | Uniquement automatismes plateforme / Super Admin / choix essai-abo (RPC) — **pas** d’update libre côté client hors parcours prévu |
| **RLS data plane** | Cette table **n’est pas** lue par les policies SQL existantes |

**Création :** à chaque nouvelle `organizations`, insert immédiat `status = PENDING_CHOICE`.

### 7.2 `platform_admins`

| | |
|--|--|
| **Rôle** | Super Admins FasoBar |
| **Colonnes** | `id` ; `user_id` uuid NOT NULL FK → `profiles` ; `status` (`ACTIVE`/`INACTIVE`) ; timestamps ; `created_by` NULL |
| **Contraintes** | `UNIQUE (user_id)` |
| **Accès** | Super Admins / bootstrap |

### 7.3 `subscription_plans`

| | |
|--|--|
| **Rôle** | Formules ; tarifs modifiables Super Admin |
| **Colonnes** | `id` ; `code` ; `name` ; `description` ; `billing_period` (`MONTHLY`/`YEARLY`) ; `duration_months` ; `price_xof` ; `currency` DEFAULT `'XOF'` ; `max_machines` DEFAULT 1 ; `features` jsonb DEFAULT `'{}'` ; `is_active` ; `sort_order` ; timestamps |
| **Seed** | Mensuel 10 000 / 1 mois ; Annuel 100 000 / 12 mois |
| **Contraintes** | `UNIQUE (code)` ; `price_xof >= 0` ; `duration_months > 0` |
| **Écriture** | Super Admin |

### 7.4 `organization_trials`

| | |
|--|--|
| **Rôle** | Essai gratuit 1 mois ; **au plus un** par org |
| **Colonnes** | `id` ; `organization_id` FK ; `status` ; `starts_at` ; `ends_at` ; `chosen_by` FK profiles ; `converted_subscription_id` NULL ; timestamps |
| **Contraintes** | **`UNIQUE (organization_id)`** ; `ends_at > starts_at` |
| **Index** | `(status, ends_at)` |
| **Statuts** | §5.1 |
| **Effet** | Choix essai → trial `ACTIVE` + **`organization_platform_states.status = TRIAL`**. Expiration → trial `EXPIRED` + plateforme `TRIAL_EXPIRED`. |

### 7.5 `subscription_requests`

| | |
|--|--|
| **Rôle** | Demande abo / renouvellement + référence unique + workflow preuve |
| **Colonnes** | `id` ; `organization_id` ; `plan_id` ; `billing_period` ; `duration_months` ; `expected_amount_xof` ; `currency` ; `reference_code` ; `status` ; `payment_instructions` ; `orange_money_number` DEFAULT `'+22657537299'` ; `requested_by` ; `reviewed_by` ; `reviewed_at` ; `review_note` ; `rejection_reason` ; `requires_new_proof` bool DEFAULT false ; `cancelled_at` NULL ; `cancelled_by` NULL ; `resulting_subscription_id` NULL ; `resulting_payment_id` NULL ; timestamps |
| **Contraintes** | `UNIQUE (reference_code)` ; index partiel : au plus une demande ouverte (`PENDING_PAYMENT` \| `PAYMENT_SUBMITTED` \| `UNDER_REVIEW`) par org |
| **Index** | `(organization_id, created_at DESC)` ; `(status, created_at)` |
| **Statuts** | §2.3 |
| **Note** | Ne pas écrire `PENDING_PAYMENT` dans `organization_platform_states` |

### 7.6 `subscription_payment_proofs`

| | |
|--|--|
| **Rôle** | Preuves Orange Money |
| **Colonnes** | `id` ; `subscription_request_id` FK CASCADE ; `organization_id` ; `submitted_by` ; `screenshot_storage_path` ; `transaction_number` ; `payer_phone` ; `submitted_at` ; `is_current` ; `superseded_at` NULL |
| **Contraintes** | Index unique partiel une preuve `is_current` par demande |
| **Effet** | Insert ⇒ demande `PAYMENT_SUBMITTED` |

### 7.7 `platform_subscription_payments`

| | |
|--|--|
| **Rôle** | Paiement abo confirmé (≠ caisse) |
| **Colonnes** | `id` ; `organization_id` ; `subscription_request_id` ; `reference_code` ; `amount_xof` ; `currency` ; `channel` DEFAULT `'ORANGE_MONEY'` ; `orange_money_number` ; `transaction_number` ; `payer_phone` ; `proof_id` ; `status` (`CONFIRMED`) ; `confirmed_by` ; `confirmed_at` ; `notes` ; timestamps |
| **Contraintes** | `UNIQUE (subscription_request_id)` |
| **Écriture** | Uniquement à l’APPROVED |

### 7.8 `organization_subscriptions`

| | |
|--|--|
| **Rôle** | Périodes d’abonnement payantes |
| **Colonnes** | `id` ; `organization_id` ; `plan_id` ; `status` ; `starts_at` ; `ends_at` ; `billing_period` ; `duration_months` ; `amount_paid_xof` ; `source_request_id` ; `source_payment_id` ; `is_current` bool DEFAULT false ; `cancelled_at` NULL ; timestamps |
| **Contraintes** | Index unique partiel `UNIQUE (organization_id) WHERE is_current` ; `ends_at > starts_at` |
| **Index** | `(status, ends_at)` ; `(organization_id, starts_at DESC)` |
| **Statuts** | §2.4 uniquement (`ACTIVE`, `EXPIRED`, `SUSPENDED`, `CANCELLED`) |

**Après APPROVED :**
- période `ACTIVE`, dates calculées, `is_current = true` ;  
- **`organization_platform_states.status = ACTIVE`** ;  
- licence ; rétablissement gates.

**Dates :**
- 1er abo / renouvellement après expiration : `starts_at = confirmation_at`, `ends_at = starts_at + duration_months`.  
- Renouvellement avant expiration : `starts_at = ends_at` courant, puis + durée.

**Expiration période :** subscription `EXPIRED` ; plateforme `EXPIRED` (si plus de période courante valide).

### 7.9 `registered_machines`

| | |
|--|--|
| **Rôle** | Machines ; appartiennent à un **établissement** |
| **Colonnes** | `id` ; `organization_id` ; `establishment_id` NOT NULL ; `device_id` ; `display_name` ; `status` ; sync fields ; `activated_at` ; `revoked_at` ; `revoked_by` ; timestamps |
| **Contraintes** | `UNIQUE (device_id)` ; check org = org de l’établissement |
| **Suspension client** | Machines → `DISABLED` (recommandé) sans toucher `organizations.status` |

### 7.10 `organization_licenses`

| | |
|--|--|
| **Rôle** | Licence numérique |
| **Colonnes** | `id` ; `organization_id` ; `status` ; `license_payload` jsonb ; `license_key` NULL ; `plan_id` ; `max_machines` ; `valid_from` ; `valid_until` ; `issued_at` ; `source_subscription_id` NULL ; `source_trial_id` NULL ; `supersedes_license_id` NULL ; timestamps |
| **Contraintes** | Une licence `ACTIVE` max par org (index partiel) |
| **Suspension** | Licence courante → `REVOKED` ; levée / renouvellement → nouvelle `ACTIVE` |

### 7.11 `platform_suspensions`

| | |
|--|--|
| **Rôle** | Suspensions exceptionnelles |
| **Colonnes** | `id` ; `target_type` ; `organization_id` NOT NULL ; `establishment_id` NULL ; `employee_user_id` NULL ; `status` (`ACTIVE`/`LIFTED`) ; `reason` ; acteurs + timestamps |
| **Effet ORGANIZATION** | `organization_platform_states.status = SUSPENDED` ; abo courant éventuellement `SUSPENDED` ; licences/machines bloquées ; **`organizations.status` inchangé** |
| **Accès** | Super Admin |

### 7.12 `platform_audit_logs`

| | |
|--|--|
| **Rôle** | Audit append-only Super Admin / automatismes (≠ `audit_logs` métier) |
| **Colonnes** | `id` ; `actor_user_id` NULL ; `action` ; `organization_id` NULL ; `entity_type` ; `entity_id` ; `metadata` jsonb ; `created_at` |
| **Index** | `(organization_id, created_at DESC)` ; `(action, created_at DESC)` |

---

## 8. Gates d’accès (applicatifs — futurs)

### 8.1 Opérations métier (Admin, Caisse, Bar)

Autorisées seulement si **tous** les checks suivants passent :

1. **Existants (inchangés) :** `organizations.status = ACTIVE` ; memberships / profil / établissement `ACTIVE` ; contexte workspace valide.  
2. **Nouveau (plateforme) :** `organization_platform_states.status ∈ {TRIAL, ACTIVE}`.  
3. Desktop : machine autorisée + licence locale valide.  
4. Pas de suspension org `platform_suspensions` `ACTIVE` (redondant si déjà reflété dans l’état SaaS).

### 8.2 Abonnement + envoi de preuve

Autorisé Owner/Admin si SaaS ∈  
`{PENDING_CHOICE, TRIAL, TRIAL_EXPIRED, ACTIVE, EXPIRED}`  
et **pas** `SUSPENDED` / `PENDING_DELETION` (hors lecture motif).

En `TRIAL_EXPIRED` / `EXPIRED` : métier bloqué (gate §8.1), demande + preuve OK. Le statut **`PENDING_PAYMENT`** se lit sur la demande, pas sur l’état SaaS.

### 8.3 Rétablissement

Demande `APPROVED` ⇒ abo `ACTIVE` + plateforme `ACTIVE` + licence ⇒ employés actifs retrouvent l’usage **sans** modifier les memberships ni `organizations.status`.

---

## 9. Suppression client

| Étape | Effet |
|-------|--------|
| 1. Demande suppression | `organization_platform_states.status = PENDING_DELETION` ; `previous_status` mémorisé ; `deletion_requested_at` / `deletion_purge_after` ; accès métier coupés |
| 2. Récupération | Données conservées ; restauration possible vers `previous_status` |
| 3. Purge | Suppression de **toute** la structure client (data plane + control plane liés) |

`organizations.status` peut rester `ACTIVE` jusqu’à la purge (ou passer `INACTIVE` uniquement si une procédure soft-disable distincte le décide) — **la source de vérité « en cours de suppression » est l’état SaaS**.

---

## 10. Cycles de vie (mapping)

| Événement | Écritures |
|-----------|-----------|
| Bootstrap org | `organizations.status = ACTIVE` (existant) + `organization_platform_states` `PENDING_CHOICE` |
| Choix essai | `organization_trials` ACTIVE 1 mois ; plateforme `TRIAL` ; licence essai |
| Fin essai | trial `EXPIRED` ; plateforme `TRIAL_EXPIRED` |
| Choix abo / renouvellement | `subscription_requests` `PENDING_PAYMENT` + référence ; **plateforme inchangée** (sauf déjà `PENDING_CHOICE`) |
| Envoi preuve | preuve + request `PAYMENT_SUBMITTED` |
| Nouvelle preuve | `requires_new_proof` ; `UNDER_REVIEW` |
| APPROVED | payment ; request `APPROVED` ; subscription `ACTIVE` ; plateforme `ACTIVE` ; licence |
| REJECTED / CANCELLED | request `REJECTED` ou `CANCELLED` ; plateforme inchangée |
| Expiration abo | subscription `EXPIRED` ; plateforme `EXPIRED` |
| Suspendre client | `platform_suspensions` ; plateforme `SUSPENDED` ; abo courant `SUSPENDED` ; licences/machines |
| PENDING_DELETION → purge | dates + cascade structure |

---

## 11. Paiement Orange Money (v1)

| Paramètre | Valeur |
|-----------|--------|
| Canal | Orange Money |
| Numéro | `+226 57 53 72 99` |
| Stockage | `subscription_requests.orange_money_number` + `payment_instructions` |

Preuve : `screenshot_storage_path` + `transaction_number` + `payer_phone`.

---

## 12. Synthèse créer vs réutiliser

| Besoin | Décision |
|--------|----------|
| Client (UI = OWNER) | **Réutiliser** `organizations` + membership OWNER + `profiles` |
| Soft-status org | **Réutiliser** `organizations.status` (`ACTIVE`/`INACTIVE`) **sans extension** |
| Accès SaaS | **Créer** `organization_platform_states` (1–1) |
| Établissements / employés | **Réutiliser** `establishments`, `profiles`, memberships |
| Super Admins | **Créer** `platform_admins` |
| Formules | **Créer** `subscription_plans` |
| Essai unique | **Créer** `organization_trials` |
| Demandes / preuves / paiements | **Créer** `subscription_requests`, `subscription_payment_proofs`, `platform_subscription_payments` |
| Abonnements | **Créer** `organization_subscriptions` |
| Machines / licences | **Créer** `registered_machines`, `organization_licenses` |
| Suspensions / audit | **Créer** `platform_suspensions`, `platform_audit_logs` |
| Table `clients` | **Interdite** |
| Colonne SaaS sur `organizations` | **Interdite** |

---

## 13. Non-objectifs Phase 1B

- Migration SQL / pages / code.  
- Modification de `entity_status` ou des RLS existantes.  
- Paiement en ligne automatisé.  
- Table `clients` dupliquant `organizations`.

---

*Phase 1B — séparation stricte `entity_status` vs état SaaS 1–1 — documentation uniquement.*
