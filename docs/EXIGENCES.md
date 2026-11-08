# Matrice des exigences

Version initiale (checkpoint 1). Toutes les exigences du travail sont listées avec leur statut actuel. Plusieurs ne sont pas encore faites, je préfère l'indiquer honnêtement.

Statut : `complet`, `partiel` ou `non fait`. Un `partiel` dit ce qui manque.

## TECH — Contraintes techniques

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| TECH-01 | complet | `app/[lang]/layout.tsx`, `package.json` | — | Next.js 16 avec l'App Router et React 19. |
| TECH-02 | complet | `tsconfig.json`, `eslint.config.mjs` | — | `strict: true`; `no-explicit-any` est une erreur ESLint (config `eslint-config-next/typescript`); aucun fichier `.js`/`.jsx` et aucun `@ts-ignore`. |
| TECH-03 | complet | `app/globals.css` | — | Tailwind CSS 4. |
| TECH-04 | partiel | `db/schema.ts`, `db/migrations/`, `db/seed.ts` | — | PostgreSQL avec Drizzle, migrations versionnées (`users`, `texts`, `rooms`, `room_members`). Le seed (`bun run db:seed`) charge le corpus de 600 passages ; les utilisateurs et l'historique de démo manquent encore. |
| TECH-05 | complet | `deploy/deploy.sh`, `deploy/typeracer.service`, `docker-compose.prod.yml` | — | VPS AWS EC2 (Ubuntu 26.04, t4g.small) à https://nelumbotype.online. Caddy (`deploy/Caddyfile`) gère le HTTPS avec un certificat Let's Encrypt renouvelé automatiquement. PostgreSQL tourne dans Docker, accessible seulement depuis le serveur. Next.js tourne comme service systemd et redémarre seul. `deploy/deploy.sh` met à jour la production en une commande (pull, migrations, build, redémarrage). |
| TECH-06 | partiel | `server.ts`, `lib/realtime/handlers.ts`, `lib/realtime/client.ts` | — | Socket.IO sur un serveur personnalisé (ADR 1) : membres, hôte et liste des salles se mettent à jour en direct. La progression des participants pendant la course n'existe pas encore. |
| TECH-07 | partiel | `lib/auth/validation.ts`, `app/[lang]/rooms/actions.ts`, `lib/rooms/settings.ts` | `lib/rooms/code.test.ts`, `lib/rooms/settings.test.ts`, `lib/auth/validation.test.ts` | Les server actions (inscription, connexion, créer/rejoindre/quitter une salle) valident leurs entrées avec Zod ; la config lue en base est aussi revalidée. Les messages temps réel n'existent pas encore. |
| TECH-08 | complet | — | — | Le seul coût est le serveur EC2, payé avec les crédits gratuits d'AWS. Aucun autre service payant. L'enseignant n'a rien à payer pour corriger. À revérifier si un service externe est ajouté (ex. stockage des photos de profil). |
| TECH-09 | complet | `.github/workflows/ci.yml`, `package.json` (script `typecheck`) | les tests unitaires `bun test` (TEST-01) | À chaque push et pull request : `bun install --frozen-lockfile`, lint, `bun run typecheck` (`next typegen` puis `tsc --noEmit`, car les types des routes sont générés dans `.next/`, absent du dépôt), migrations appliquées à un service Postgres 17 `typeracer_test`, puis `bun test`. Vérifié en local sur un clone propre avec une base vide, puis sur GitHub : le workflow passe sur `main` (89 tests, environ 30 s). Les tests e2e (Playwright) n'en font pas partie. |
| TECH-10 | complet | `.env.example` | — | Documente `DATABASE_URL`, `SESSION_SECRET` et `POSTGRES_PASSWORD` (production seulement). Aucun secret dans le dépôt : en production, ils sont dans `.env.production.local` sur le serveur. |

## DES — Identité visuelle et design

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| DES-01 | complet | `docs/DEMARCHE-CREATIVE.md` | — | Nom : NelumboType. Démarche décrite dans la section « Nom et logo ». |
| DES-02 | complet | `app/icon.png`, `app/components/site-header.tsx` | — | Croquis joints. Le même fichier `app/icon.png` (fond transparent) sert de favicon et de logo dans l'en-tête; le favicon par défaut de Next.js est supprimé. |
| DES-03 | complet | `docs/DEMARCHE-CREATIVE.md` | — | Moodboard de 5 références, palette de couleurs et typographie. |
| DES-04 | partiel | `app/globals.css`, `app/[lang]/login/auth-screen.tsx` | — | Seules les pages d'accueil et de connexion existent. La piste de progression (fleurs qui poussent) n'est pas encore faite. |
| DES-05 | complet | `app/components/theme-toggle.tsx`, `app/[lang]/layout.tsx` | — | Bouton clair/sombre, préférence du système par défaut, script inline qui applique le thème avant le premier affichage (pas de flash). |
| DES-06 | partiel | `app/components/site-header.tsx` | — | Les pages existantes s'adaptent aux petits écrans. Le message pour mobile sur la page de course n'est pas fait. |

## AUTH — Comptes et profil

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| AUTH-01 | partiel | `app/[lang]/login/actions.ts`, `lib/auth/session.ts` | — | Inscription et connexion par nom d'utilisateur et mot de passe faites. OAuth Discord et GitHub pas encore. |
| AUTH-02 | complet | `app/[lang]/rooms/[code]/join-room.tsx`, `app/[lang]/rooms/actions.ts`, `lib/rooms/rooms.ts` | `lib/auth/validation.test.ts`, `lib/auth/users.test.ts`, `lib/rooms/rooms.test.ts`, `e2e/guest-flow.e2e.ts` | Un visiteur sans session qui clique sur « Entrer » choisit un pseudo (3 à 20 caractères, lettres de toutes langues, chiffres, espaces, `. _ ' -`), validé par Zod côté serveur. L'invité est une ligne `users` avec `is_guest` et sans nom d'utilisateur ni mot de passe; sa session est le même cookie JWT signé que les comptes. Choix : chacun, invité ou compte, choisit son nom en entrant dans une salle (et l'hôte en la créant); le champ part du pseudo de l'invité ou du nom affiché du compte. Ce nom est stocké sur l'appartenance (`room_members.name`) et unique dans la salle sans tenir compte de la casse (index unique en base); s'il est pris, la personne en choisit un autre. Personne ne peut prendre le nom d'utilisateur d'un autre compte. Les noms d'utilisateur des comptes sont uniques en base (index unique sur `lower(username)`). Les lignes d'invités ne sont pas encore nettoyées. |
| AUTH-03 | partiel | `app/[lang]/rooms/actions.ts`, `lib/auth/current-user.ts` | — | Un invité ne peut pas créer de salle (refusé par l'action, et `/rooms/new` le renvoie à la connexion); il ne devient jamais hôte, même par transfert (SALLE-08). Pas de profil ni de photo pour lui. Reste à faire quand les courses existeront : ne pas garder d'historique pour les invités, et l'avatar généré. |
| AUTH-04 | non fait | — | — | |
| AUTH-05 | non fait | `db/schema.ts` | — | La colonne `display_name` existe, mais pas encore de page pour la modifier. |
| AUTH-06 | non fait | — | — | |

## SALLE — Salles et visibilité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| SALLE-01 | complet | `app/[lang]/rooms/actions.ts`, `lib/rooms/rooms.ts`, `app/[lang]/rooms/new/create-room-form.tsx` | `lib/rooms/rooms.test.ts` | Un utilisateur connecté crée la salle et en devient l'hôte, comme coureur ou spectateur. Vérifié dans le navigateur. |
| SALLE-02 | complet | `lib/rooms/code.ts`, `db/schema.ts` | `lib/rooms/code.test.ts` | 6 caractères parmi `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`crypto.randomInt`), index unique et `check` du format en base ; nouvelle tentative en cas de collision. |
| SALLE-03 | partiel | `lib/rooms/rooms.ts`, `lib/rooms/settings.ts` | — | Les trois visibilités se choisissent et sont enregistrées. Seules les salles publiques sont listées et rejoignables ; une salle par code ou privée répond « introuvable » pour l'instant. |
| SALLE-04 | non fait | — | — | |
| SALLE-05 | complet | `lib/rooms/rooms.ts`, `db/schema.ts` | `lib/rooms/rooms.test.ts`, `lib/rooms/settings.test.ts` | Capacité 2–30 validée par Zod et par un `check` en base. En rejoignant, seuls les coureurs comptent, sous verrou de ligne (`for update`) pour que la dernière place ne soit pas prise deux fois. |
| SALLE-06 | complet | `db/schema.ts`, `lib/rooms/rooms.ts`, `app/[lang]/rooms/[code]/join-room.tsx` | `lib/rooms/rooms.test.ts` | Index unique sur `room_members.user_id`. Créer ou rejoindre en étant déjà ailleurs propose de retourner dans sa salle ou de la quitter ; un deuxième onglet ne crée pas de doublon. Les invités sont des lignes `users`, donc la même contrainte s'applique à eux. |
| SALLE-07 | complet | `lib/rooms/rooms.ts`, `app/[lang]/rooms/[code]/kick-member.tsx`, `db/schema.ts` | `lib/rooms/rooms.test.ts`, `e2e/kick.e2e.ts` | L'hôte retire un coureur ou un spectateur, à tout moment, avec une confirmation. La personne est inscrite dans `room_bans` et ne peut plus revenir dans cette salle (ni coureur, ni spectateur, sous aucun nom) ; les autres salles restent ouvertes. Sa page l'apprend en direct. Choix : un invité qui efface ses cookies devient un nouvel utilisateur, la base ne peut pas le reconnaître. La révocation des liens d'invitation au moment de l'exclusion fait partie de SALLE-04, pas encore fait. |
| SALLE-08 | complet | `lib/rooms/rooms.ts`, `lib/realtime/presence.ts`, `lib/realtime/notify.ts`, `app/components/room-closed.tsx` | `lib/rooms/rooms.test.ts`, `lib/realtime/presence.test.ts`, `e2e/host-leaves.e2e.ts` | Quand l'hôte quitte, le membre connecté (un onglet ouvert) avec un compte, présent depuis le plus longtemps, devient hôte ; un invité ne le devient jamais. Choix : « humain » est compris comme « connecté avec un compte ». S'il n'y a personne pour reprendre le rôle (seulement des invités, ou personne de connecté), la salle se ferme et libère ses membres, qui voient en direct « Ta salle a été supprimée ». Un membre sans onglet ouvert depuis 30 s est considéré comme parti. Limite : un membre qui n'avait pas d'onglet ouvert à ce moment-là voit seulement une page introuvable en revenant. |
| SALLE-09 | partiel | `lib/rooms/rooms.ts`, `lib/rooms/settings.ts` | `lib/rooms/rooms.test.ts` | `joinRoom` refuse hors des états `waiting` et `results`. Testé en forçant l'état de la salle (`countdown`, `racing`, `results`) ; les courses n'existent pas encore, donc pas encore vérifié dans une vraie course. |
| SALLE-10 | non fait | — | — | |

## JOIN — Rejoindre une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| JOIN-01 | non fait | — | — | |
| JOIN-02 | partiel | `app/[lang]/rooms/page.tsx`, `lib/rooms/rooms.ts`, `app/components/live-updates.tsx` | — | Liste des salles publiques ouvertes : coureurs/capacité, langue, type, difficulté, hôte, état ; mise à jour en direct sans recharger. Manquent les filtres par langue et difficulté. |
| JOIN-03 | non fait | — | — | |

## CONF — Configuration de la course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| CONF-01 | partiel | `lib/rooms/settings.ts` | `lib/rooms/settings.test.ts` | Aucune limite ou 30 s à 10 min, choisi à la création et enregistré. Pas encore appliqué (pas de course) ni modifiable entre les courses. |
| CONF-02 | partiel | `lib/rooms/settings.ts`, `lib/texts/generate.ts` | `lib/texts/random-text.test.ts` | Langue du texte FR/EN indépendante de l'interface ; le générateur la respecte. Pas encore modifiable entre les courses. |
| CONF-03 | partiel | `lib/texts/generate.ts`, `lib/texts/random-text.ts`, `lib/texts/passage-text.ts` | `lib/texts/*.test.ts` | Cohérent : extraits de 600 passages Gutenberg en base ; aléatoire : listes de 10 000 mots par langue. Voir `docs/TEXTES.md`. `generateText` sera appelé au lancement des courses, pas encore codé. |
| CONF-04 | partiel | `lib/texts/random-text.ts`, `lib/texts/passage-text.ts` | `lib/texts/*.test.ts`, `lib/rooms/settings.test.ts` | Aléatoire : nombre exact de mots. Cohérent : phrases entières à ±15 % (choix documenté dans `docs/TEXTES.md`). Pas encore utilisé en course. |
| CONF-05 | partiel | `lib/texts/complexity.ts` | `lib/texts/*.test.ts` | Critères mesurables documentés dans `docs/TEXTES.md` : rang de fréquence et longueur (aléatoire), score longueur moyenne + 5 × mots peu courants (cohérent). Pas encore utilisé en course. |
| CONF-06 | partiel | `lib/texts/random-text.ts`, `lib/texts/passage-text.ts` | `lib/texts/*.test.ts` | Les quatre options agissent sur les deux types de texte (tableau dans `docs/TEXTES.md`) ; en cohérent, « chiffres » ne peut qu'exclure les passages qui en ont. Pas encore utilisé en course. |
| CONF-07 | partiel | `lib/texts/word-pool.ts`, `lib/rooms/settings.ts` | `lib/texts/random-text.test.ts`, `lib/rooms/settings.test.ts` | Aléatoire seulement : chaque mot contient au moins une lettre « à inclure », les caractères exclus n'apparaissent jamais. Désactivé et vidé en mode cohérent (choix documenté). Une config sans aucun mot est refusée. Pas encore utilisé en course. |
| CONF-08 | partiel | `lib/rooms/settings.ts` | — | Choisi et enregistré ; sera appliqué dans la zone de frappe. |
| CONF-09 | partiel | `lib/rooms/settings.ts` | — | Activé/désactivé et enregistré ; les bonus ne sont pas encore codés. |
| CONF-10 | non fait | — | — | |
| CONF-11 | partiel | `lib/rooms/settings.ts`, `lib/rooms/rooms.ts` | — | Visibilité et capacité choisies à la création ; pas encore modifiables entre les courses. |
| CONF-12 | partiel | `lib/realtime/notify.ts`, `app/components/live-updates.tsx` | — | La page de salle (réglages, membres, hôte) se met à jour en direct pour tout le monde. La configuration ne peut pas encore être modifiée entre les courses, donc seul l'avis de changement existe pour l'instant. |

## COURSE — Déroulement d'une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| COURSE-01 | partiel | `docs/ARCHITECTURE.md`, `lib/rooms/settings.ts`, `db/schema.ts` | — | Machine à états documentée ; les états existent dans la colonne `rooms.state` (`check` en base), mais les transitions ne sont pas encore codées. |
| COURSE-02 | non fait | — | — | |
| COURSE-03 | non fait | `lib/texts/generate.ts` | — | Le texte est généré par `generateText`, prévu pour être appelé au début du décompte ; le décompte n'existe pas encore. |
| COURSE-04 | non fait | — | — | |
| COURSE-05 | non fait | — | — | |
| COURSE-06 | non fait | — | — | |
| COURSE-07 | non fait | — | — | |
| COURSE-08 | non fait | `lib/realtime/presence.test.ts` | Seul le délai de 30 s existe (un membre sans onglet ouvert depuis 30 s compte comme parti, testé avec de faux minuteurs). La reprise de la course et l'abandon n'existent pas encore. |
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
| I18N-01 | complet | `lib/i18n/dictionaries/fr.ts`, `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries.ts` | — | Tous les textes de l'interface (libellés, erreurs de formulaire, métadonnées, page 404, pages d'erreur `app/[lang]/error.tsx` et `app/global-error.tsx`) viennent des dictionnaires français et anglais; le type `Dictionary` empêche d'oublier une clé en anglais. Les erreurs Zod et des server actions sont des codes traduits côté client. Il n'y a pas encore d'états vides; chaque nouvelle page devra suivre le même modèle pour que l'exigence reste complète. |
| I18N-02 | complet | `app/components/language-switch.tsx`, `proxy.ts`, `lib/i18n/config.ts` | — | Choix : la langue est dans l'URL (`/fr/...`, `/en/...`), comme le recommande la doc de Next.js 16, ce qui garde une page prérendue par langue. Le sélecteur FR/EN est dans l'en-tête de chaque page, y compris la 404 (`app/[lang]/[...rest]/page.tsx` envoie les URL inconnues vers `app/[lang]/not-found.tsx`). Le choix est gardé dans un cookie `locale`; sans cookie, `proxy.ts` utilise `Accept-Language`, sinon le français. |
| I18N-03 | partiel | `lib/i18n/format.ts` | — | Les nombres passent par `Intl` selon la langue (pourcentage « 42 % » / « 42% », pluriels avec `Intl.PluralRules`). Aucune date n'est encore affichée; les dates (historique, courses) devront utiliser `Intl.DateTimeFormat` de la même façon. |

## TEST — Tests

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| TEST-01 | partiel | `lib/texts/*.test.ts`, `lib/rooms/*.test.ts`, `lib/auth/*.test.ts`, `lib/realtime/presence.test.ts` | idem | `bun test` : génération de textes (filtres, longueur, graine, options), extraits de passages, codes de salle, règles des noms, réglages de salle, délai de présence (faux minuteurs). Les règles des salles (créer, rejoindre, capacité, une salle par personne, passation d'hôte, fermeture) sont testées sur la base `typeracer_test` (`test/setup.ts` la force et refuse toute base dont le nom ne finit pas par `_test`). Formules, classement, machine à états, bots et bonus pas encore testés. |
| TEST-02 | partiel | `playwright.config.ts`, `e2e/guest-flow.e2e.ts` | `e2e/guest-flow.e2e.ts` | `bun run test:e2e` : build de production et serveur personnalisé (Next + Socket.IO) sur le port 3100, sur la base `typeracer_test`; les comptes et invités `e2e_` sont supprimés à la fin. Parcours invité couvert dans deux navigateurs : un hôte s'inscrit et crée une salle publique, un visiteur la trouve dans la liste, reçoit les erreurs de nom, entre sous un pseudo, reste après un rechargement et repart; la page de l'hôte suit en direct. Les parcours de course (décompte, frappe, résultats) n'existent pas encore.
| TEST-03 | complet | `e2e/guest-flow.e2e.ts` | `e2e/guest-flow.e2e.ts` | Les tests e2e créent leur compte par le formulaire d'inscription, puis se connectent par le formulaire de connexion avec nom d'utilisateur et mot de passe (un mauvais mot de passe est d'abord refusé). OAuth n'est jamais utilisé. |

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
| A11Y-02 | partiel | `app/components/site-header.tsx`, `app/[lang]/page.tsx` | — | Les pages existantes utilisent `<header>`, `<main>`, `<button>` et `<a>` correctement. À vérifier pour chaque nouvelle page. |
| A11Y-03 | partiel | `app/components/text-field.tsx` | — | Les champs ont un `<label>` et leurs erreurs sont liées avec `aria-describedby`. À vérifier pour chaque nouvelle page. |
| A11Y-04 | partiel | `app/globals.css` | — | Indicateur de focus visible (`:focus-visible`). Navigation au clavier pas encore testée sur toutes les pages. |

## SEC — Sécurité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| SEC-01 | partiel | `lib/rooms/rooms.ts`, `app/[lang]/rooms/actions.ts` | `lib/rooms/rooms.test.ts` | Exclure est vérifié sur le serveur : l'hôte vient du cookie de session, jamais du message, et doit être l'hôte actuel d'une salle ouverte (testé avec un membre ordinaire et un ancien hôte). Démarrer, configurer, générer des liens et fermer n'existent pas encore. |
| SEC-02 | non fait | — | — | |
| SEC-03 | complet | `lib/auth/password.ts`, `app/[lang]/login/actions.ts` | — | Argon2id avec les paramètres minimaux de l'OWASP. Les erreurs de base de données sont journalisées sans les paramètres de la requête, donc jamais le mot de passe. |
