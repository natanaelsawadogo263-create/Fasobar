# FasoBar Desktop — Phase 1 (Electron LAN)

## Architecture

FasoBar Windows embarque l’application Next.js existante (build **standalone**)
dans une fenêtre Electron. Aucun second frontend.

Deux modes d’installation (choix au premier lancement, stocké dans userData) :

| Mode | Rôle |
|------|------|
| `SERVEUR_CAISSE` | PC Caisse : démarre Next sur `0.0.0.0:3180`, tray, auto-start Windows |
| `POSTE_TRAVAIL` | Admin / Bar : se connecte à `http://<IP-caisse>:3180`, aucun serveur local |

```
PC Caisse                         PC Admin / Bar
┌─────────────────────┐           ┌──────────────────┐
│ Electron + Tray     │           │ Electron fenêtre │
│ Next standalone     │◄── LAN ───│ loadURL serveur  │
│ :3180 / 0.0.0.0     │           └──────────────────┘
└─────────┬───────────┘
          │ HTTPS public keys only
          ▼
     Supabase Cloud
```

## Port

- Défaut : **3180**
- Fenêtre serveur : `http://127.0.0.1:3180`
- Autres postes : `http://<IPv4-LAN>:3180`

Health check : `GET /api/desktop/health` → `{ status, app: "FasoBar", version, mode: "desktop" }`

## userData

Fichier : `%APPDATA%/FasoBar/fasobar-desktop-config.json` (nom produit Electron)

Champs : `installationMode`, `serverPort`, `serverUrl`, `installationId`, `appVersion`.

Pas de mots de passe. Config corrompue → écran de configuration.

## Arrière-plan (SERVEUR_CAISSE)

Fermer la fenêtre **masque** l’UI (tray).  
« Quitter complètement FasoBar » arrête le serveur Next et quitte l’app.

## Build

```powershell
npm install
npm run build
npm run desktop:prepare
npm run desktop:check-secrets
npm run desktop:make
```

Installateur attendu :

`out/make/squirrel.windows/x64/FasoBar-Setup-0.1.0.exe`

> **Note build Windows :** `desktop:make` packagée l’app via Electron Forge puis
> génère le Setup avec `scripts/make-setup-manual.mjs` (nuget + WriteZipToSetup).
> Le `--releasify` Squirrel natif peut échouer sur certains PC (accès refusé sur
> `d3dcompiler_47.dll` dans `%LOCALAPPDATA%\\SquirrelTemp`) ; le script contourne
> cette étape tout en produisant un Setup.exe Squirrel compatible.


Scripts :

- `desktop:dev` — build Next + prepare + Forge start
- `desktop:build` / `desktop:package` — package
- `desktop:make` — installateur
- `desktop:start-server` — Next standalone seul (test LAN)
- `desktop:check-secrets` — refuse SECRET / SERVICE_ROLE / OPENAI dans les ressources

## Test à deux PC

1. Sur le PC Caisse : installer, choisir **Serveur principal + Poste Caisse**.
2. Noter l’adresse LAN (tray → Copier l’adresse), ex. `http://192.168.1.10:3180`.
3. Pare-feu Windows : autoriser le port 3180 (entrée entrante).
4. Sur le PC Admin : installer, choisir **Poste de travail**, saisir l’adresse, valider.
5. Vérifier login et navigation métier.

## Secrets — règle critique

Le package **ne doit pas** contenir :

- `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Uniquement `NEXT_PUBLIC_*` (injectées au build / environnement machine de build).

### Fonctions dégradées sans service_role

- Création / reset comptes employés (Auth Admin)
- Enrichissement e-mails Super Admin (Auth Admin)
- Signup admin bypass confirmation e-mail
- Amélioration d’images produits (OpenAI)
- Certains bypass lecture stock / ventes / packagings si le client admin n’est pas configuré

Ces chemins restent cloud / serveur ; le desktop refuse d’embarquer la clé.

## Limites phase 1

- ~~Pas de SQLite / sync offline~~ → [phase-2-local-database.md](./phase-2-local-database.md)
- Pas d’impression silencieuse
- Pas d’auto-update
- Pas de pairing machines / licence locale
- Connexion poste = saisie manuelle d’IP (pas de découverte mDNS)

## Prochaine phase

SQLite local-first, outbox, sync, autorisation postes, UX offline caisse.
