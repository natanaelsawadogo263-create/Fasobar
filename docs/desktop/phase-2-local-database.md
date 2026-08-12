# FasoBar Desktop — Phase 2 (SQLite local-first)

## Objectif

Socle local sur le **PC SERVEUR_CAISSE** uniquement :

Interface → services métier → **SQLite** → outbox → sync Supabase (plus tard)

Les postes Admin / Bar / Cuisine **n’ont pas** de SQLite : ils appellent le Next
standalone du Caisse via le LAN.

## Choix SQLite

**`node:sqlite` (`DatabaseSync`)** — API synchrone intégrée à Node.js 22+ /
Electron 37 (`ELECTRON_RUN_AS_NODE`).

Pourquoi :

- pas de module natif `better-sqlite3` à recompiler pour l’ABI Electron ;
- déploiement Windows simplifié dans le standalone Next ;
- WAL + foreign keys + transactions explicites.

La feature reste expérimentale côté Node ; encapsulée dans `src/lib/local-db/`.

### Bundling Next (important)

Ne **jamais** lister `node:sqlite` dans `serverExternalPackages` : Turbopack le
traite alors comme external URL CommonJS et remplace le `require` par un stub
`Cannot find module 'node:sqlite': Unsupported external type Url for commonjs reference`.

Chunk Turbopack typique (build web) :
`.next/server/chunks/ssr/src_lib_local-domain_catalog-service_ts_*.js`

Sous Webpack Desktop, le builtin reste un vrai require, ex. :
`.next/server/app/api/desktop/health/route.js` → `require("node:sqlite")`

- **Web** : `npm run build` (Turbopack) — `turbopack: {}` dans `next.config` ;
  SQLite non chargé sans `FASOBAR_RUNTIME=desktop-server`.
- **Desktop standalone** : `npm run desktop:build-next` → `next build --webpack`,
  avec `webpack.externals` → `commonjs node:sqlite` pour résolution native Node.

Le smoke `desktop:verify-package` échoue si le stub Turbopack est présent ou si
`database.status !== "ok"` / `fasobar.db` absent.

## Emplacement

Sous le `userData` Electron (jamais Program Files / projet / `public` / `.next`) :

```
%APPDATA%/FasoBar/
  data/fasobar.db
  backups/fasobar-*.db
  logs/fasobar-desktop.log
  logs/fasobar-server.log
  fasobar-desktop-config.json
```

Variables d’environnement injectées par Electron (`local-server.ts`) :

| Variable | Valeur |
|----------|--------|
| `FASOBAR_RUNTIME` | `desktop-server` |
| `FASOBAR_USER_DATA` | `app.getPath('userData')` |
| `FASOBAR_INSTALLATION_ID` | UUID stable du config |
| `FASOBAR_APP_VERSION` | version app |

Sans `FASOBAR_RUNTIME=desktop-server`, **aucune** ouverture SQLite (web intact).

## Schéma local

Version actuelle : **1** (`LOCAL_SCHEMA_VERSION`).

Migrations embarquées (`src/lib/local-db/migrations/`), table
`local_schema_migrations` (version, name, applied_at, checksum).

Tables principales :

- `local_installation` — `installation_id` stable
- `local_users` — placeholder auth offline
- `local_categories` / `local_products` / `local_product_packagings`
- `local_orders` / `local_order_items` (snapshots prix/nom)
- `local_cash_register_sessions` / `local_payments` / `local_receipts`
- `local_stock_items` / `local_stock_movements`
- `local_bar_sessions` / `local_expenses`
- `local_number_sequences` — ex. `LOCAL-CAISSE-000001`
- `sync_outbox` — PENDING / PROCESSING / SYNCED / FAILED / CONFLICT
- `sync_state` — cursors, cloud_available, erreurs

## Repositories

| Module | Rôle |
|--------|------|
| `LocalProductRepository` | CRUD catalogue local |
| `catalog-pull` / `catalog-service` | Pull Supabase → upsert SQLite |
| `sync/outbox` | Événements + `writeWithOutbox` atomique |
| `sync/status` | UI status ONLINE_SYNCED / … / ERROR |
| `numbering` | Numéros locaux imprimables |

SQL uniquement dans cette couche — pas de requêtes dispersées dans l’UI.

## Catalogue pilote (Phase 2)

1. `ensureCaisseCatalog` (desktop) → pull cloud best-effort
2. `listCashierProducts` / `listCashierCategories` lisent **SQLite** si non vide
3. Fallback cloud si SQLite vide ; si cloud down → données locales

**Web** : chemin Supabase inchangé.

## API desktop

| Route | Usage |
|-------|--------|
| `GET /api/desktop/health` | status, runtime, DB ok, schemaVersion, installationId, syncStatus — **sans** chemin DB ni secrets |
| `GET /api/desktop/catalog?establishmentId=` | catalogue LAN (desktop-server only) |
| `POST /api/desktop/catalog/sync` | pull authentifié (workspace) |

Pas d’endpoint SQL générique. Pairing LAN sécurisé = **Phase ultérieure**.

## Backups

`VACUUM INTO` au démarrage (si DB existante), rétention max 10 fichiers sous
`backups/`. Pas d’UI de restauration dans cette phase.

## Sécurité

Le package reste sans `SUPABASE_SECRET_KEY` / service_role / OpenAI.
`desktop:check-secrets` inchangé.

## Tests

`src/lib/local-db/database.test.ts` : migrations, WAL, FK, installation_id,
outbox atomique, numéros locaux, catalogue persisté, backup, runtime.

## Limites (hors Phase 2)

Commandes / paiements / stock / sessions / auth offline, sync bidirectionnelle
complète, pairing, licence locale, impression silencieuse.

## Phase 3 (indicatif)

- Mutations caisse offline (orders + payments + outbox)
- Push outbox vers Supabase idempotent (`client_mutation_id`)
- Pairing postes + auth locale minimale
- Indicateur sync dans l’UI
