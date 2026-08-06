# FasoBar — Control plane & Super Admin

**Statut :** spécification officielle (cadrage)  
**Périmètre :** fonctionnement du Super Admin, abonnements hors paiement en ligne, licences machines  
**Hors périmètre de ce document :** pages UI, migrations SQL, code applicatif

Ce document définit le **control plane** FasoBar : l’espace Super Admin et les règles d’abonnement / licence qui gouvernent l’accès des organisations clientes. Il complète `docs/audit-local-first.md` sans le remplacer.

---

## 1. Principes

1. Le **Super Admin** opère la plateforme FasoBar (tous les clients).  
2. L’**Admin établissement** et les employés opèrent uniquement leur organisation / établissement.  
3. L’**abonnement appartient à l’organisation cliente**, jamais à un employé individuel.  
4. **Aucun paiement en ligne** dans la première version : le règlement se fait **directement** entre le client et le propriétaire de FasoBar.  
5. FasoBar automatise la **demande**, la **confirmation métier** et l’**activation** (abonnement + licence) ; le Super Admin **vérifie** le paiement reçu.  
6. L’accès runtime d’un employé est la **conjonction** de plusieurs conditions (voir §6).

---

## 2. Rôle Super Admin

### 2.1 Visibilité

Le Super Admin peut :

| Domaine | Capacités |
|---------|-----------|
| **Clients** | Voir **tous** les clients FasoBar |
| **Organisation** | Consulter l’organisation liée à chaque client |
| **Établissements** | Consulter les établissements du client |
| **Personnes** | Voir les administrateurs et les employés |
| **Rôles & statuts** | Consulter rôle et statut de chaque employé |
| **Machines** | Consulter les machines autorisées et leurs **dernières synchronisations** |

Le Super Admin n’est **pas** l’opérateur POS quotidien. La consultation des données métier (commandes, stock détaillé, caisse) reste réservée aux outils support éventuellement prévus plus tard ; ce document ne les exige pas en v1.

### 2.2 Actions exceptionnelles de suspension

Le Super Admin peut **suspendre exceptionnellement** :

- un **client** (organisation / compte commercial) ;
- un **établissement** ;
- un **employé**.

Ces suspensions sont des décisions plateforme. Elles s’ajoutent aux règles d’abonnement (§5–6) et bloquent immédiatement l’accès concerné dès que le control plane est consulté (online) ou dès le prochain contrôle licence / sync (desktop).

### 2.3 Machines

Pour chaque organisation / établissement lié :

- liste des machines autorisées ;
- identité machine (empreinte / `device_id`) ;
- dernière synchronisation réussie ;
- version applicative connue (si remontée) ;
- statut machine (autorisée, révoquée, en attente).

---

## 3. Abonnements — modèle commercial v1

### 3.1 Pas de paiement en ligne

- Aucune passerelle Stripe / Mobile Money / carte dans la v1.  
- Le client et le propriétaire FasoBar s’accordent **hors application** sur le mode de règlement (virement, espèces, etc.).  
- FasoBar ne collecte pas d’argent ; il **trace** demandes, montants attendus, confirmations et historique.

### 3.2 Choix de formule dans FasoBar

Depuis FasoBar, le client (typiquement Admin / Owner de l’organisation) :

1. choisit une **formule** (plan) ;  
2. choisit une **durée** ;  
3. valide → FasoBar crée **automatiquement** une **demande d’abonnement**.

### 3.3 Contenu d’une demande d’abonnement

Chaque demande contient au minimum :

| Champ | Description |
|-------|-------------|
| Client | Organisation / client FasoBar concerné |
| Formule | Plan choisi |
| Durée | Période demandée |
| Montant attendu | Montant dû pour cette demande |
| Référence unique | Identifiant de paiement / demande (affichable au client et au Super Admin) |
| Statut de demande | Voir §4 |
| Horodatages | Création, mises à jour, décision |

### 3.4 Paiement direct

1. Le client paie le propriétaire FasoBar **en dehors** de l’app.  
2. Il peut communiquer la **référence unique** de la demande.  
3. Le Super Admin vérifie la réception réelle du paiement.

### 3.5 Décision Super Admin sur une demande

Le Super Admin peut :

| Action | Effet |
|--------|--------|
| **Confirmer** | Paiement accepté → déclenche l’activation automatique (§5) |
| **Refuser** | Demande rejetée ; pas d’abonnement / pas de renouvellement |
| **Placer en vérification** | Demande en attente d’éléments complémentaires (preuve, montant, etc.) |

---

## 4. Statuts

### 4.1 Statuts d’abonnement (organisation)

| Statut | Signification |
|--------|----------------|
| `PENDING_PAYMENT` | Demande créée ; paiement non encore confirmé (ou en cours) |
| `ACTIVE` | Abonnement valide ; accès normal selon formule |
| `GRACE_PERIOD` | Période de tolérance après expiration / incident (hors ligne ou fin de période) |
| `EXPIRED` | Période écoulée et tolérance terminée |
| `SUSPENDED` | Suspension plateforme (Super Admin ou règle métier) |
| `CANCELLED` | Résiliation ; pas de reconduction automatique |

Une organisation peut avoir un **historique** de périodes d’abonnement ; la période **courante** (ou la plus récente pertinente) détermine l’accès.

### 4.2 Statuts de demande (workflow paiement)

Les demandes d’abonnement suivent un cycle distinct, par exemple :

- créée / en attente de paiement ;  
- en vérification (Super Admin) ;  
- confirmée ;  
- refusée.

La confirmation d’une demande est le **seul** déclencheur officiel d’activation automatique (§5) en v1.

---

## 5. Après confirmation du paiement

Dès que le Super Admin **confirme** le paiement d’une demande, FasoBar exécute **automatiquement** la chaîne suivante (sans re-saisie manuelle des dates métier) :

1. **Créer ou renouveler** l’abonnement de l’organisation.  
2. **Calculer la date de début**.  
3. **Calculer la date d’expiration** (selon formule + durée).  
4. **Définir le statut** `ACTIVE`.  
5. **Enregistrer le paiement** (montant, référence, date de confirmation, acteur Super Admin).  
6. **Appliquer les fonctionnalités** de la formule (droits / modules inclus).  
7. **Définir le nombre de machines autorisées** selon la formule.  
8. **Générer ou renouveler la licence numérique** de l’organisation (et le contingent machines).

### 5.1 Règles de dates (renouvellement)

| Situation | Date de début | Date d’expiration |
|-----------|---------------|-------------------|
| **Premier abonnement** | À la confirmation (ou règle métier fixe documentée à l’implémentation) | Début + durée |
| **Renouvellement avant expiration** | Enchaînement : la nouvelle période commence à l’expiration de la période courante (ou prolonge la période active) | Nouvelle fin = fin courante + durée |
| **Renouvellement après expiration** | À la confirmation (reprise) | Début + durée |

Les détails exacts de calendrier (fuseau, jour inclus/exclu) seront figés à l’implémentation ; le principe officiel reste : **pas de double saisie manuelle** des dates après confirmation.

### 5.2 Appartenance

- L’abonnement est rattaché à l’**organisation cliente**.  
- Les employés **héritent** de l’accès via leur appartenance ; ils n’ont pas d’abonnement personnel.

---

## 6. Matrice d’accès d’un employé

L’accès d’un employé (y compris sur le logiciel local) dépend **automatiquement** de **toutes** les conditions suivantes :

| # | Condition | Si faux |
|---|-----------|---------|
| 1 | Organisation **active** (non suspendue / non annulée côté plateforme) | Accès refusé |
| 2 | Abonnement **valide** (`ACTIVE` ou, selon règles, `GRACE_PERIOD`) | Accès refusé ou mode dégradé (§7) |
| 3 | Établissement **actif** | Accès refusé pour cet établissement |
| 4 | Machine **autorisée** (dans le quota licence) | Sync / usage desktop refusé |
| 5 | Compte employé **actif** | Connexion refusée |

Suspension Super Admin d’un client, établissement ou employé ⇒ la condition correspondante devient fausse.

---

## 7. Hors connexion & tolérance

### 7.1 Période de tolérance (grace)

- Une **période de tolérance hors connexion** (et éventuellement post-expiration) est prévue.  
- Pendant `GRACE_PERIOD`, le logiciel local peut continuer à fonctionner selon une politique restrictive documentée à l’implémentation (ex. service autorisé, sync limitée, bandeau d’alerte).  
- À l’issue de la grâce sans régularisation ⇒ `EXPIRED` (ou maintien `SUSPENDED` si suspension plateforme).

### 7.2 Récupération de licence au retour réseau

Dès que la connexion revient, le logiciel local doit :

1. contacter le control plane ;  
2. **récupérer / rafraîchir la licence numérique** ;  
3. mettre à jour le statut d’abonnement localement ;  
4. appliquer immédiatement les conséquences (levée de grâce, blocage, nouveaux quotas machines, fonctionnalités de formule).

La sync métier (commandes, stock, etc.) reste définie dans l’audit local-first ; ce document impose seulement que la **licence** soit récupérable au reconnect.

---

## 8. Historique

Le control plane conserve l’historique :

- des **demandes** d’abonnement (création, vérification, confirmation, refus) ;  
- des **paiements** enregistrés (référence, montant, date de confirmation) ;  
- des **périodes** d’abonnement (début, fin, formule, statut) ;  
- des **licences** générées / renouvelées ;  
- des **suspensions** exceptionnelles (qui, quoi, quand, motif si saisi).

---

## 9. Parcours officiel (v1)

```
Client choisit une formule (+ durée) dans FasoBar
        ↓
Demande d'abonnement créée automatiquement
  (client, formule, durée, montant attendu, référence unique)
        ↓
Paiement effectué directement
  (client ↔ propriétaire FasoBar, hors app)
        ↓
Super Admin vérifie le paiement
        ↓
    ┌───┴───┐
 Refus   Vérification   Confirmation
    │         │              │
    │         └─ attente ────┤
    │                        ↓
    │         Paiement confirmé
    │                        ↓
    │         Abonnement créé / renouvelé
    │         Dates début & expiration calculées
    │         Statut ACTIVE
    │         Paiement enregistré
    │         Fonctionnalités formule appliquées
    │         Quota machines défini
    │         Licence numérique générée / renouvelée
    ↓
 (pas d'activation)
```

---

## 10. Entités logiques (conceptuel — pas de SQL)

```
platform_users                 → Super Admins
clients / organizations        → clients FasoBar (tenant)
  ├── establishments
  ├── memberships / employees  → rôles & statuts
  ├── subscription_requests    → demandes (référence unique, montant, formule, durée)
  ├── payments                 → paiements confirmés / historisés
  ├── subscriptions            → périodes (statuts §4.1)
  ├── plan_entitlements        → fonctionnalités & quota machines par formule
  └── licenses                 → licence numérique + contingent machines
        └── machines           → device_id, last_sync_at, statut
```

Le **data plane** métier actuel (`orders`, `stock`, sessions caisse/bar, etc.) reste isolé par organisation / établissement. Le control plane **gouverne l’accès** ; il ne remplace pas le POS.

---

## 11. Séparation des responsabilités

| Acteur | Responsabilité |
|--------|----------------|
| **Client (Admin / Owner)** | Choisir formule & durée ; obtenir la référence ; payer hors app |
| **Propriétaire FasoBar / Super Admin** | Vérifier le paiement ; confirmer / refuser / mettre en vérification ; suspensions exceptionnelles |
| **FasoBar (automatisme)** | Créer la demande ; après confirmation : abonnement, dates, statut, paiement, entitlements, quota, licence |
| **Logiciel local** | Respecter la licence ; grâce hors ligne ; récupérer la licence au reconnect |

---

## 12. Non-objectifs v1

- Paiement en ligne intégré.  
- Facturation électronique automatisée multi-pays.  
- Abonnement par employé.  
- Impersonation POS complète (hors scope de ce document).  
- Implémentation UI ou migrations (explicitement hors de ce livrable).

---

## 13. Références

- `docs/audit-local-first.md` — transformation local-first, SQLite, sync, UX desktop, phases  
- `docs/database/core-multi-tenant.md` — socle multi-tenant data plane  

---

*Document de cadrage control plane — aucune implémentation associée.*
