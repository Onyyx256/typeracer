# Matrice des exigences

Version initiale (checkpoint 1). Toutes les exigences du travail sont listées avec leur statut actuel. Plusieurs ne sont pas encore faites, je préfère l'indiquer honnêtement.

Statut : `complet`, `partiel` ou `non fait`. Un `partiel` dit ce qui manque.

## TECH — Contraintes techniques

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| TECH-01 | complet | `app/layout.tsx`, `package.json` | — | Next.js 16 avec l'App Router et React 19. |
| TECH-02 | complet | `tsconfig.json`, `eslint.config.mjs` | — | `strict: true`; `no-explicit-any` est une erreur ESLint (config `eslint-config-next/typescript`); aucun fichier `.js`/`.jsx` et aucun `@ts-ignore`. |
| TECH-03 | complet | `app/globals.css` | — | Tailwind CSS 4. |
| TECH-04 | partiel | `db/schema.ts`, `db/migrations/`, `drizzle.config.ts` | — | PostgreSQL avec Drizzle, migrations versionnées. Seulement la table `users` pour l'instant. Pas encore de script de seed. |
| TECH-05 | complet | `deploy/deploy.sh`, `deploy/typeracer.service`, `docker-compose.prod.yml` | — | VPS AWS EC2 (Ubuntu 26.04, t4g.small) à https://nelumbotype.online. Caddy (`deploy/Caddyfile`) gère le HTTPS avec un certificat Let's Encrypt renouvelé automatiquement. PostgreSQL tourne dans Docker, accessible seulement depuis le serveur. Next.js tourne comme service systemd et redémarre seul. `deploy/deploy.sh` met à jour la production en une commande (pull, migrations, build, redémarrage). |
| TECH-06 | non fait | — | — | Choix de la technologie décrit dans `docs/ARCHITECTURE.md` (ADR 1). |
| TECH-07 | partiel | `lib/auth/validation.ts`, `app/login/actions.ts` | — | Les server actions d'inscription et de connexion valident leurs entrées avec Zod. Les autres entrées (salles, temps réel) n'existent pas encore. |
| TECH-08 | complet | — | — | Le seul coût est le serveur EC2, payé avec les crédits gratuits d'AWS. Aucun autre service payant. L'enseignant n'a rien à payer pour corriger. À revérifier si un service externe est ajouté (ex. stockage des photos de profil). |
| TECH-09 | non fait | — | — | Pas encore de workflow GitHub Actions. |
| TECH-10 | complet | `.env.example` | — | Documente `DATABASE_URL`, `SESSION_SECRET` et `POSTGRES_PASSWORD` (production seulement). Aucun secret dans le dépôt : en production, ils sont dans `.env.production.local` sur le serveur. |

## DES — Identité visuelle et design

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| DES-01 | complet | `docs/DEMARCHE-CREATIVE.md` | — | Nom : NelumboType. Démarche décrite dans la section « Nom et logo ». |
| DES-02 | partiel | `public/logo.png`, `app/components/site-header.tsx` | — | Croquis joints et logo affiché dans l'en-tête. Le favicon est encore celui de Next.js par défaut. |
| DES-03 | complet | `docs/DEMARCHE-CREATIVE.md` | — | Moodboard de 5 références, palette de couleurs et typographie. |
| DES-04 | partiel | `app/globals.css`, `app/login/auth-screen.tsx` | — | Seules les pages d'accueil et de connexion existent. La piste de progression (fleurs qui poussent) n'est pas encore faite. |
| DES-05 | complet | `app/components/theme-toggle.tsx`, `app/layout.tsx` | — | Bouton clair/sombre, préférence du système par défaut, script inline qui applique le thème avant le premier affichage (pas de flash). |
| DES-06 | partiel | `app/components/site-header.tsx` | — | Les pages existantes s'adaptent aux petits écrans. Le message pour mobile sur la page de course n'est pas fait. |

## AUTH — Comptes et profil

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| AUTH-01 | partiel | `app/login/actions.ts`, `lib/auth/session.ts` | — | Inscription et connexion par nom d'utilisateur et mot de passe faites. OAuth Discord et GitHub pas encore. |
| AUTH-02 | non fait | — | — | |
| AUTH-03 | non fait | — | — | |
| AUTH-04 | non fait | — | — | |
| AUTH-05 | non fait | `db/schema.ts` | — | La colonne `display_name` existe, mais pas encore de page pour la modifier. |
| AUTH-06 | non fait | — | — | |

## SALLE — Salles et visibilité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| SALLE-01 | non fait | — | — | |
| SALLE-02 | non fait | — | — | |
| SALLE-03 | non fait | — | — | |
| SALLE-04 | non fait | — | — | |
| SALLE-05 | non fait | — | — | |
| SALLE-06 | non fait | — | — | |
| SALLE-07 | non fait | — | — | |
| SALLE-08 | non fait | — | — | |
| SALLE-09 | non fait | — | — | |
| SALLE-10 | non fait | — | — | |

## JOIN — Rejoindre une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| JOIN-01 | non fait | — | — | |
| JOIN-02 | non fait | — | — | |
| JOIN-03 | non fait | — | — | |

## CONF — Configuration de la course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| CONF-01 | non fait | — | — | |
| CONF-02 | non fait | — | — | |
| CONF-03 | non fait | — | — | |
| CONF-04 | non fait | — | — | |
| CONF-05 | non fait | — | — | |
| CONF-06 | non fait | — | — | |
| CONF-07 | non fait | — | — | |
| CONF-08 | non fait | — | — | |
| CONF-09 | non fait | — | — | |
| CONF-10 | non fait | — | — | |
| CONF-11 | non fait | — | — | |
| CONF-12 | non fait | — | — | |

## COURSE — Déroulement d'une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| COURSE-01 | partiel | `docs/ARCHITECTURE.md` | — | La machine à états est documentée, mais pas encore codée. |
| COURSE-02 | non fait | — | — | |
| COURSE-03 | non fait | — | — | |
| COURSE-04 | non fait | — | — | |
| COURSE-05 | non fait | — | — | |
| COURSE-06 | non fait | — | — | |
| COURSE-07 | non fait | — | — | |
| COURSE-08 | non fait | — | — | |
| COURSE-09 | non fait | — | — | |
| COURSE-10 | non fait | — | — | |
| COURSE-11 | non fait | — | — | |

## BOT — Bots

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| BOT-01 | non fait | — | — | Approche prévue dans `docs/ARCHITECTURE.md`. |
| BOT-02 | non fait | — | — | |
| BOT-03 | non fait | — | — | |
| BOT-04 | non fait | — | — | |
| BOT-05 | non fait | — | — | |

## BONUS — Bonus de rattrapage

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| BONUS-01 | non fait | — | — | |
| BONUS-02 | non fait | — | — | Idées liées au thème (pluie, soleil, nuit) dans `docs/DEMARCHE-CREATIVE.md`. |
| BONUS-03 | non fait | — | — | |
| BONUS-04 | non fait | — | — | |

## RES — Résultats et statistiques

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| RES-01 | non fait | — | — | |
| RES-02 | non fait | — | — | |
| RES-03 | non fait | — | — | |
| RES-04 | non fait | — | — | |
| RES-05 | non fait | — | — | |

## HIST — Historique

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| HIST-01 | non fait | — | — | |
| HIST-02 | non fait | — | — | |

## I18N — Internationalisation

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| I18N-01 | non fait | — | — | L'interface est seulement en français, avec les textes directement dans les composants. |
| I18N-02 | non fait | — | — | |
| I18N-03 | non fait | — | — | |

## TEST — Tests

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| TEST-01 | non fait | — | — | |
| TEST-02 | non fait | — | — | |
| TEST-03 | non fait | — | — | La connexion par mot de passe existe déjà pour les futurs tests e2e. |

## PERF — Performance

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| PERF-01 | non fait | — | — | Lighthouse pas encore mesuré. |
| PERF-02 | non fait | — | — | |
| PERF-03 | non fait | — | — | |

## A11Y — Accessibilité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| A11Y-01 | partiel | `app/globals.css` | — | Palette ajustée pour le contraste (ex. vert assombri pour le texte blanc des boutons). Pas encore vérifié avec un outil dans les deux thèmes. |
| A11Y-02 | partiel | `app/components/site-header.tsx`, `app/page.tsx` | — | Les pages existantes utilisent `<header>`, `<main>`, `<button>` et `<a>` correctement. À vérifier pour chaque nouvelle page. |
| A11Y-03 | partiel | `app/components/text-field.tsx` | — | Les champs ont un `<label>` et leurs erreurs sont liées avec `aria-describedby`. À vérifier pour chaque nouvelle page. |
| A11Y-04 | partiel | `app/globals.css` | — | Indicateur de focus visible (`:focus-visible`). Navigation au clavier pas encore testée sur toutes les pages. |

## SEC — Sécurité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| SEC-01 | non fait | — | — | Aucune action d'hôte n'existe encore. |
| SEC-02 | non fait | — | — | |
| SEC-03 | complet | `lib/auth/password.ts`, `app/login/actions.ts` | — | Argon2id avec les paramètres minimaux de l'OWASP. Les erreurs de base de données sont journalisées sans les paramètres de la requête, donc jamais le mot de passe. |
