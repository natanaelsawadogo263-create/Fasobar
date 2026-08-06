# FasoBar — Socle multi-tenant (core)

Migration : `supabase/migrations/*_core_multi_tenant.sql`

Ce document décrit le modèle de données, les rôles, les politiques RLS et les garanties de sécurité du socle multi-tenant FasoBar. **RLS reste activé sur toutes les tables** ; aucune donnée n’est accessible sans politique explicite.

## Vue d’ensemble

FasoBar isole les données par **organisation**. Chaque **établissement** appartient à une organisation. Les utilisateurs (identité Supabase Auth) possèdent un **profil** et peuvent être membres d’une ou plusieurs organisations et d’un ou plusieurs établissements, avec un **rôle** et un **statut** distincts par appartenance.

```
auth.users (1) ── (1) profiles
                        │
        organization_memberships ── organizations (1) ── (*) establishments
                        │                                      │
                        └──────── establishment_memberships ───┘
```

## Tables

### `organizations`

| Colonne      | Description                                      |
|-------------|--------------------------------------------------|
| `id`        | UUID, clé primaire                               |
| `name`      | Nom affiché                                      |
| `slug`      | Identifiant URL unique (kebab-case)              |
| `status`    | `ACTIVE` ou `INACTIVE`                           |
| `created_at`, `updated_at` | Horodatage automatique              |

### `establishments`

| Colonne           | Description                                      |
|------------------|--------------------------------------------------|
| `id`             | UUID, clé primaire                               |
| `organization_id`| FK vers `organizations` (CASCADE)              |
| `name`, `slug`   | Nom et slug unique **par organisation**        |
| `status`         | `ACTIVE` ou `INACTIVE`                           |
| `created_at`, `updated_at` | Horodatage automatique              |

### `profiles`

| Colonne      | Description                                      |
|-------------|--------------------------------------------------|
| `id`        | UUID = `auth.users.id` (CASCADE)                 |
| `full_name` | Nom complet (optionnel)                          |
| `avatar_url`| URL avatar (optionnel)                           |
| `status`    | `ACTIVE` ou `INACTIVE`                           |
| `created_at`, `updated_at` | Horodatage automatique              |

Création automatique via trigger `on_auth_user_created` à l’insertion dans `auth.users`.

### `organization_memberships`

Lien utilisateur ↔ organisation avec rôle.

| Contrainte | Détail |
|-----------|--------|
| UNIQUE | `(organization_id, user_id)` |
| UNIQUE partiel | Un seul `OWNER` actif par organisation |

### `establishment_memberships`

Lien utilisateur ↔ établissement avec rôle.

| Contrainte | Détail |
|-----------|--------|
| UNIQUE | `(establishment_id, user_id)` |

## Rôles (`membership_role`)

| Rôle | Usage typique |
|------|----------------|
| `OWNER` | Propriétaire de l’organisation (unique actif par org) |
| `ADMIN` | Administration organisation et membres |
| `MANAGER` | Gestion opérationnelle |
| `CASHIER` | Caisse |
| `BAR_MANAGER` | Gestion bar |
| `KITCHEN_MANAGER` | Gestion cuisine |
| `STOCK_AGENT` | Gestion stock |

Les rôles organisation et établissement partagent le même enum ; la couche applicative restreindra les rôles autorisés selon le contexte.

## Fonctions SQL sécurisées

Toutes les fonctions d’autorisation sont `SECURITY DEFINER` avec `SET search_path = ''` et noms qualifiés (`public.*`).

| Fonction | Rôle |
|----------|------|
| `user_belongs_to_organization(user_id, organization_id)` | Membre actif de l’organisation |
| `user_belongs_to_establishment(user_id, establishment_id)` | Membre actif de l’établissement **ou** OWNER/ADMIN de l’organisation parente |
| `user_has_organization_role(user_id, organization_id, role)` | Rôle précis au niveau organisation |
| `user_has_establishment_role(user_id, establishment_id, role)` | Rôle précis au niveau établissement |
| `user_is_organization_owner_or_admin(user_id, organization_id)` | OWNER ou ADMIN actif |
| `establishment_organization_id(establishment_id)` | Résout l’organisation d’un établissement (pour les politiques RLS) |

Seuls les utilisateurs `authenticated` peuvent exécuter ces fonctions. Le rôle `anon` n’a **aucun** droit sur les tables ni sur ces fonctions.

## Politiques RLS

RLS est **activé et forcé** sur les cinq tables. Comportement par défaut : **refus** si aucune politique ne s’applique.

### `organizations`

| Action | Règle |
|--------|-------|
| SELECT | Membre actif de l’organisation |
| INSERT | Utilisateur authentifié (création d’org ; l’app doit ensuite créer le membership OWNER) |
| UPDATE / DELETE | OWNER ou ADMIN de l’organisation |

### `establishments`

| Action | Règle |
|--------|-------|
| SELECT | Accès établissement autorisé (membership établissement ou OWNER/ADMIN org) |
| INSERT / UPDATE / DELETE | OWNER ou ADMIN de l’organisation parente |

### `profiles`

| Action | Règle |
|--------|-------|
| SELECT / UPDATE | Uniquement son propre profil (`id = auth.uid()`) |
| INSERT / DELETE | Interdit côté client (création par trigger, suppression via cascade Auth) |

### `organization_memberships`

| Action | Règle |
|--------|-------|
| SELECT | Membre de la même organisation |
| INSERT | OWNER ou ADMIN de l’organisation, **ou** bootstrap : l’utilisateur s’ajoute comme premier `OWNER` actif |
| UPDATE / DELETE | OWNER ou ADMIN de l’organisation |

### `establishment_memberships`

| Action | Règle |
|--------|-------|
| SELECT | Accès établissement autorisé |
| INSERT / UPDATE / DELETE | OWNER ou ADMIN de l’organisation parente |

## Risques de sécurité couverts

| Risque | Mitigation |
|--------|------------|
| Fuite inter-organisations | RLS sur toutes les tables ; helpers vérifient org + statut `ACTIVE` |
| Élévation de privilèges via `search_path` | `SET search_path = ''` sur fonctions `SECURITY DEFINER` |
| Accès anonyme aux données métier | REVOKE explicite sur `anon` ; politiques limitées à `authenticated` |
| Utilisation de `service_role` côté client | Non utilisé dans le code applicatif ; clé publishable uniquement |
| Membres inactifs ou entités désactivées | Filtrage `status = ACTIVE` dans les helpers |
| Multiples OWNER | Index unique partiel (un OWNER actif par organisation) |
| Profils orphelins | Trigger sécurisé à la création Auth ; FK `profiles.id → auth.users` |

## Index

Index sur `organization_id`, `establishment_id`, `user_id`, `status` et `role` pour les requêtes d’appartenance et de filtrage fréquentes.

## Déploiement

Cette migration est **locale uniquement** tant qu’elle n’a pas été validée :

```bash
# Après revue humaine
npx supabase db push
```

Ne pas pousser vers la base distante sans validation du modèle, des politiques RLS et d’un scénario de création d’organisation (membership OWNER initial).

## Validation humaine recommandée

1. **Bootstrap organisation** : enchaîner `INSERT organizations` puis `INSERT organization_memberships` (OWNER) dans la même transaction ; une politique RLS dédiée autorise le premier OWNER actif.
2. **Middleware Auth** : prévoir un middleware Next.js pour le refresh de session avant les pages protégées.
3. **Tests RLS** : exécuter des tests avec deux organisations distinctes pour confirmer l’isolation.
4. **Rôles établissement** : confirmer quels rôles org vs établissement sont autorisés en production.
