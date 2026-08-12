# FasoBar Desktop — Phase 3A (identité & auth online/offline)

## Objectif

Authentification personnelle sur le **PC SERVEUR_CAISSE** :

- online via Supabase Auth (identifiant FasoBar → e-mail Auth interne) ;
- offline via vérificateur scrypt local (après activation) ;
- sessions locales HttpOnly ;
- roster `local_users` synchronisé sans secrets.

Hors scope : commandes/paiements offline (Phase 3B).

## login_identifier

- Champ cloud `profiles.login_identifier` (+ `login_identifier_normalized` UNIQUE).
- Nouveaux employés : Auth e-mail = `{normalized}@users.fasobar.internal`.
- Formulaire Desktop : Identifiant FasoBar + mot de passe (pas l’e-mail interne).
- Compat temporaire : saisie d’un vrai e-mail encore acceptée.

Aucune RPC publique qui résout identifiant → e-mail personnel.

## credential_version

Incrémenté par `finalize_employee_password_change` et `mark_temporary_password_reset`.
Si cloud > local → `offline_credentials_ready = 0` (ancien mot de passe offline invalide).

## SQLite v2

Migration `002_local_auth` : `local_users` enrichi, `local_sessions`, `local_login_attempts`.

## Sécurité

- scrypt N=16384,r=8,p=1,keylen=64 + salt 16 octets
- pas de fallback offline si le cloud refuse le mot de passe
- rate-limit 5 échecs / 15 min / identifiant
- message générique unique
- package Desktop sans service_role / secrets
