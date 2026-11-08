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
| TECH-06 | complet | `lib/race/manager.ts`, `lib/realtime/handlers.ts`, `app/[lang]/rooms/[code]/race/race-track.tsx` | `lib/race/manager.test.ts`, `e2e/race.e2e.ts` | Socket.IO sur un serveur personnalisé (ADR 1). Membres, hôte et liste des salles se mettent à jour en direct, et pendant la course le serveur envoie la progression de chaque participant 5 fois par seconde (`race:track`). |
| TECH-07 | complet | `lib/realtime/events.ts`, `app/[lang]/rooms/actions.ts`, `lib/auth/validation.ts` | `lib/auth/validation.test.ts`, `lib/rooms/settings.test.ts`, `lib/rooms/filters.test.ts` | Toutes les server actions valident leurs entrées avec Zod (inscription, connexion, salles, exclusion; lancer une course ne prend aucune entrée, l'hôte vient du cookie). Tous les messages temps réel reçus aussi : `room:watch`, `race:sync`, `race:keys` (lot numéroté de 1 à 60 touches d'un caractère); un message invalide est ignoré. La config lue en base est revalidée. |
| TECH-08 | complet | — | — | Le seul coût est le serveur EC2, payé avec les crédits gratuits d'AWS. Aucun autre service payant. L'enseignant n'a rien à payer pour corriger. À revérifier si un service externe est ajouté (ex. stockage des photos de profil). |
| TECH-09 | complet | `.github/workflows/ci.yml`, `package.json` (script `typecheck`) | les tests unitaires `bun test` (TEST-01) | À chaque push et pull request : `bun install --frozen-lockfile`, lint, `bun run typecheck` (`next typegen` puis `tsc --noEmit`, car les types des routes sont générés dans `.next/`, absent du dépôt), migrations appliquées à un service Postgres 17 `typeracer_test`, puis `bun test`. Vérifié en local sur un clone propre avec une base vide, puis sur GitHub : le workflow passe sur `main` (89 tests, environ 30 s). Les tests e2e (Playwright) n'en font pas partie. |
| TECH-10 | complet | `.env.example` | — | Documente `DATABASE_URL`, `SESSION_SECRET` et `POSTGRES_PASSWORD` (production seulement). Aucun secret dans le dépôt : en production, ils sont dans `.env.production.local` sur le serveur. |

## DES — Identité visuelle et design

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| DES-01 | complet | `docs/DEMARCHE-CREATIVE.md` | — | Nom : NelumboType. Démarche décrite dans la section « Nom et logo ». |
| DES-02 | complet | `app/icon.png`, `app/components/site-header.tsx` | — | Croquis joints. Le même fichier `app/icon.png` (fond transparent) sert de favicon et de logo dans l'en-tête; le favicon par défaut de Next.js est supprimé. |
| DES-03 | complet | `docs/DEMARCHE-CREATIVE.md` | — | Moodboard de 5 références, palette de couleurs et typographie. |
| DES-04 | partiel | `app/globals.css`, `app/[lang]/login/auth-screen.tsx` | — | Seules les pages d'accueil et de connexion existent. La piste de course (une fleur par coureur qui pousse et fleurit à l'arrivée, `app/[lang]/rooms/[code]/race/race-track.tsx`) est faite; les autres pages restent à vérifier contre ce critère. |
| DES-05 | complet | `app/components/theme-toggle.tsx`, `app/[lang]/layout.tsx` | — | Bouton clair/sombre, préférence du système par défaut, script inline qui applique le thème avant le premier affichage (pas de flash). |
| DES-06 | partiel | `app/[lang]/rooms/[code]/race/race-view.tsx`, `app/components/site-header.tsx` | — | Les pages s'adaptent aux petits écrans (page de résultats vérifiée à 375 px : pas de défilement horizontal, le tableau défile dans son cadre). Sous 768 px, la zone de frappe est remplacée par un message qui recommande un clavier physique; la piste reste visible. Ce message n'a pas encore été vérifié pendant une vraie course sur mobile, ni la largeur de 360 px sur toutes les pages. |

## AUTH — Comptes et profil

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| AUTH-01 | partiel | `app/[lang]/login/actions.ts`, `lib/auth/session.ts` | — | Inscription et connexion par nom d'utilisateur et mot de passe faites. OAuth Discord et GitHub pas encore. |
| AUTH-02 | complet | `app/[lang]/rooms/[code]/join-room.tsx`, `app/[lang]/rooms/actions.ts`, `lib/rooms/rooms.ts` | `lib/auth/validation.test.ts`, `lib/auth/users.test.ts`, `lib/rooms/rooms.test.ts`, `e2e/guest-flow.e2e.ts` | Un visiteur sans session qui clique sur « Entrer » choisit un pseudo (3 à 20 caractères, lettres de toutes langues, chiffres, espaces, `. _ ' -`), validé par Zod côté serveur. L'invité est une ligne `users` avec `is_guest` et sans nom d'utilisateur ni mot de passe; sa session est le même cookie JWT signé que les comptes. Choix : chacun, invité ou compte, choisit son nom en entrant dans une salle (et l'hôte en la créant); le champ part du pseudo de l'invité ou du nom affiché du compte. Ce nom est stocké sur l'appartenance (`room_members.name`) et unique dans la salle sans tenir compte de la casse (index unique en base); s'il est pris, la personne en choisit un autre. Le nom d'utilisateur d'un compte reste libre dans une salle où ce compte n'est pas; le badge « invité » distingue l'invité du compte. Les noms d'utilisateur des comptes sont uniques en base (index unique sur `lower(username)`). Les lignes d'invités ne sont pas encore nettoyées. |
| AUTH-03 | partiel | `app/[lang]/rooms/actions.ts`, `lib/race/results.ts`, `db/schema.ts` | `lib/race/manager.test.ts` | Un invité ne peut pas créer de salle (refusé par l'action, et `/rooms/new` le renvoie à la connexion); il ne devient jamais hôte, même par transfert (SALLE-08). Pas d'historique : sa ligne dans `race_results` (pour réafficher le tableau complet) n'a pas de `user_id`, une contrainte en base l'impose. Pas de profil ni de photo pour lui. Reste à faire : l'avatar généré (pour l'instant, l'initiale sur un disque, comme pour tout le monde). |
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
| JOIN-02 | complet | `app/[lang]/rooms/page.tsx`, `lib/rooms/rooms.ts`, `lib/rooms/filters.ts` | `lib/rooms/filters.test.ts`, `lib/rooms/rooms.test.ts` | Liste des salles publiques ouvertes : coureurs/capacité, langue, type, difficulté, hôte, état ; mise à jour en direct sans recharger. Filtres par langue du texte et difficulté dans l'URL (`?lang=fr&complexity=hard`), validés avec Zod : une valeur inconnue est ignorée plutôt que refusée. Ce sont de simples liens, donc ils marchent sans JavaScript et la mise à jour en direct garde les filtres. |
| JOIN-03 | non fait | — | — | |

## CONF — Configuration de la course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| CONF-01 | partiel | `lib/rooms/settings.ts`, `lib/race/engine.ts` | `lib/rooms/settings.test.ts`, `lib/race/engine.test.ts` | Aucune limite ou 30 s à 10 min, choisi à la création et appliqué par le serveur : la course s'arrête à la limite et les coureurs pas arrivés sont classés « temps écoulé ». Pas encore modifiable entre les courses. |
| CONF-02 | partiel | `lib/rooms/settings.ts`, `lib/texts/generate.ts` | `lib/texts/random-text.test.ts` | Langue du texte FR/EN indépendante de l'interface ; le générateur la respecte à chaque course. Pas encore modifiable entre les courses. |
| CONF-03 | partiel | `lib/texts/generate.ts`, `lib/texts/random-text.ts`, `lib/texts/passage-text.ts` | `lib/texts/*.test.ts` | Cohérent : extraits de 600 passages Gutenberg en base ; aléatoire : listes de 10 000 mots par langue. Voir `docs/TEXTES.md`. `generateText` est appelé quand l'hôte lance la course; pas encore modifiable entre les courses. |
| CONF-04 | partiel | `lib/texts/random-text.ts`, `lib/texts/passage-text.ts` | `lib/texts/*.test.ts`, `lib/rooms/settings.test.ts` | Aléatoire : nombre exact de mots. Cohérent : phrases entières à ±15 % (choix documenté dans `docs/TEXTES.md`). Utilisé à chaque course; pas encore modifiable entre les courses. |
| CONF-05 | partiel | `lib/texts/complexity.ts` | `lib/texts/*.test.ts` | Critères mesurables documentés dans `docs/TEXTES.md` : rang de fréquence et longueur (aléatoire), score longueur moyenne + 5 × mots peu courants (cohérent). Utilisé à chaque course; pas encore modifiable entre les courses. |
| CONF-06 | partiel | `lib/texts/random-text.ts`, `lib/texts/passage-text.ts` | `lib/texts/*.test.ts` | Les quatre options agissent sur les deux types de texte (tableau dans `docs/TEXTES.md`) ; en cohérent, « chiffres » ne peut qu'exclure les passages qui en ont. Utilisé à chaque course; pas encore modifiable entre les courses. |
| CONF-07 | partiel | `lib/texts/word-pool.ts`, `lib/rooms/settings.ts` | `lib/texts/random-text.test.ts`, `lib/rooms/settings.test.ts` | Aléatoire seulement : chaque mot contient au moins une lettre « à inclure », les caractères exclus n'apparaissent jamais. Désactivé et vidé en mode cohérent (choix documenté). Une config sans aucun mot est refusée. Utilisé à chaque course; pas encore modifiable entre les courses. |
| CONF-08 | partiel | `lib/race/typing.ts`, `lib/rooms/settings.ts` | `lib/race/typing.test.ts` | Correction obligatoire : les lettres fausses restent en rouge et le texte n'avance plus tant qu'elles ne sont pas effacées (au plus 8 de suite, ensuite les touches sont ignorées). Libre : on avance et l'erreur est comptée. Choix : chaque touche fausse compte comme erreur, même corrigée ensuite. Pas encore modifiable entre les courses. |
| CONF-09 | partiel | `lib/rooms/settings.ts` | — | Activé/désactivé et enregistré ; les bonus ne sont pas encore codés. |
| CONF-10 | non fait | — | — | |
| CONF-11 | partiel | `lib/rooms/settings.ts`, `lib/rooms/rooms.ts` | — | Visibilité et capacité choisies à la création ; pas encore modifiables entre les courses. |
| CONF-12 | partiel | `lib/realtime/notify.ts`, `app/components/live-updates.tsx` | — | La page de salle (réglages, membres, hôte) se met à jour en direct pour tout le monde. La configuration ne peut pas encore être modifiée entre les courses, donc seul l'avis de changement existe pour l'instant. |

## COURSE — Déroulement d'une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| COURSE-01 | partiel | `lib/race/manager.ts`, `docs/ARCHITECTURE.md`, `db/schema.ts` | `lib/race/manager.test.ts`, `e2e/race.e2e.ts` | Machine à états documentée; c'est le serveur qui fait toutes les transitions : attente → décompte (l'hôte lance) → course (après 3 s) → résultats (tout le monde a fini ou abandonné, ou temps écoulé). Choix : « Nouvelle course » passe directement des résultats au décompte. Manque : l'hôte ne peut pas encore fermer la salle depuis les résultats (RÉSULTATS → FERMÉE). |
| COURSE-02 | complet | `lib/race/manager.ts`, `app/[lang]/rooms/[code]/race/start-race.tsx` | `lib/race/manager.test.ts`, `e2e/race.e2e.ts` | Seul l'hôte lance, vérifié sur le serveur sous verrou de ligne; au moins 2 coureurs, les spectateurs ne comptent pas. Le bouton est désactivé avec une explication sinon. Les bots n'existent pas encore, donc tous les coureurs sont humains; quand ils arriveront, il faudra vérifier « au moins 1 humain ». |
| COURSE-03 | complet | `lib/race/manager.ts`, `app/[lang]/rooms/[code]/race/race-view.tsx` | `lib/race/manager.test.ts`, `e2e/race.e2e.ts` | Le texte est généré quand l'hôte lance et envoyé seulement à partir du décompte. Le décompte 3-2-1 est synchronisé : le serveur envoie le temps restant (pas une heure absolue), donc l'horloge du navigateur n'a pas besoin d'être juste. Les touches avant la fin du décompte sont refusées par le serveur. |
| COURSE-04 | complet | `app/[lang]/rooms/[code]/race/typing-area.tsx`, `lib/race/typing.ts` | `lib/race/typing.test.ts`, `e2e/race.e2e.ts` | Chaque touche est montrée tout de suite (juste en vert, faux en rouge souligné, curseur), avec MPM, précision et temps restant en direct. Coller et glisser-déposer sont refusés (`beforeinput`, `paste`, `drop`). Les lettres accentuées par touche morte passent par `compositionend`. |
| COURSE-05 | complet | `app/[lang]/rooms/[code]/race/race-track.tsx`, `lib/race/manager.ts` | `e2e/race.e2e.ts` | Une fleur par coureur qui pousse avec sa progression et fleurit à l'arrivée, avec avatar, nom, MPM et statut. 5 mises à jour par seconde, et la progression affichée les rejoint image par image (pas de saut). Le joueur local est encadré. Spectateurs et visiteurs voient la piste sans zone de frappe. La fluidité à 30 coureurs n'est pas encore mesurée (PERF-03). |
| COURSE-06 | partiel | `lib/race/engine.ts`, `lib/race/manager.ts` | `lib/race/engine.test.ts`, `lib/race/manager.test.ts` | Le serveur fixe le début, la fin, la progression et le classement : il rejoue les touches du coureur avec le même réducteur que le navigateur (un saut est donc impossible), et refuse un lot trop rapide (seau de 25 touches/s, soit 300 MPM soutenus, rafale de 40). Le navigateur reprend alors l'état du serveur. Vérifié dans le navigateur : une rafale collée d'un coup est refusée. Manque : les bonus (pas encore codés). |
| COURSE-07 | complet | `app/[lang]/rooms/[code]/race/abandon-race.tsx`, `lib/race/manager.ts` | `e2e/race.e2e.ts`, `lib/race/manager.test.ts` | Bouton « Abandonner » avec confirmation (« Continuer la course » a le focus). Quitter la salle ou en être retiré pendant une course compte aussi comme un abandon. |
| COURSE-08 | partiel | `app/[lang]/rooms/[code]/race/use-race.ts`, `lib/realtime/presence.ts`, `lib/rooms/rooms.ts` | `lib/realtime/presence.test.ts` | Après un rechargement ou une reconnexion, la page redemande la course (`race:sync`) et le serveur rend au coureur sa frappe. Sans onglet ouvert pendant 30 s, la présence le retire de la salle, ce qui compte comme un abandon (vérifié dans le navigateur avec un membre sans onglet). Manque : un test de la reprise après rechargement. |
| COURSE-09 | complet | `lib/race/engine.ts`, `lib/race/manager.ts` | `lib/race/engine.test.ts`, `lib/race/manager.test.ts`, `e2e/race.e2e.ts` | La course se termine quand tous les coureurs ont fini ou abandonné, ou à la limite de temps; le serveur vérifie 5 fois par seconde et après chaque arrivée ou abandon. |
| COURSE-10 | complet | `lib/race/ranking.ts` | `lib/race/engine.test.ts`, `e2e/race.e2e.ts` | Arrivés par temps, puis temps écoulé par progression, puis abandons par progression au moment de l'abandon. À égalité, l'ordre d'arrivée dans la salle. |
| COURSE-11 | partiel | `app/[lang]/rooms/[code]/race/start-race.tsx`, `app/[lang]/rooms/[code]/page.tsx` | `lib/race/manager.test.ts`, `e2e/race.e2e.ts` | Sur les résultats, l'hôte a « Nouvelle course » avec les membres restés; les autres voient qu'ils attendent l'hôte et peuvent quitter. Manque : modifier la configuration entre les courses, et fermer la salle. |

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
| RES-01 | complet | `app/[lang]/rooms/[code]/race/race-results.tsx` | `e2e/race.e2e.ts` | Podium des 3 premiers (affiché 2-1-3, dans l'ordre du classement pour les lecteurs d'écran). |
| RES-02 | partiel | `app/[lang]/rooms/[code]/race/race-results.tsx`, `lib/race/results.ts` | `e2e/race.e2e.ts` | Tableau complet : rang, participant, MPM, MPM brut, précision, erreurs, temps, statut (terminé, temps écoulé, abandon). Manque la colonne des bonus reçus, qui viendra avec les bonus. |
| RES-03 | non fait | `db/schema.ts` | — | Les données sont déjà gardées (`wpm_series` échantillonné chaque seconde, `missed_keys` par caractère attendu), mais les graphiques ne sont pas faits. |
| RES-04 | non fait | — | — | |
| RES-05 | complet | `lib/race/results.ts`, `db/schema.ts` | `lib/race/manager.test.ts` | À la fin, la course (texte exact, config, heures) et le résultat de chaque participant sont écrits en une transaction, avec la série de MPM dans le temps et les touches ratées. Les invités ont une ligne sans `user_id` (AUTH-03). |

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
| I18N-03 | partiel | `lib/i18n/format.ts` | — | Les nombres passent par `Intl` selon la langue : pourcentages (« 98,5 % » / « 98.5% »), MPM, secondes, pluriels. Aucune date n'est encore affichée; l'historique devra utiliser `Intl.DateTimeFormat`. |

## TEST — Tests

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| TEST-01 | partiel | `lib/race/*.test.ts`, `lib/rooms/*.test.ts`, `lib/texts/*.test.ts` | idem, `lib/auth/*.test.ts`, `lib/realtime/presence.test.ts` | `bun test` : génération de textes, codes de salle, noms, réglages, présence (faux minuteurs), règles des salles sur la base `typeracer_test`. Course : formules de l'annexe A, réducteur de frappe (deux modes d'erreur), moteur (anti-triche, limite de temps, échantillons, classement) et gestionnaire (lancement, abandon, résultats enregistrés). Bots et bonus pas encore testés. |
| TEST-02 | partiel | `playwright.config.ts`, `e2e/race.e2e.ts`, `e2e/guest-flow.e2e.ts` | `e2e/*.e2e.ts` | `bun run test:e2e` : build de production et serveur personnalisé sur le port 3100, base `typeracer_test`; les comptes, invités et courses `e2e_` sont supprimés à la fin. Parcours couverts dans deux navigateurs : entrée d'un invité, exclusion, départ de l'hôte, et une course complète (décompte synchronisé, frappe avec une erreur corrigée, abandon avec confirmation, résultats sur les deux pages). Manquent les bots, bonus, historique et profil. |
| TEST-03 | complet | `e2e/guest-flow.e2e.ts` | `e2e/guest-flow.e2e.ts` | Les tests e2e créent leur compte par le formulaire d'inscription, puis se connectent par le formulaire de connexion avec nom d'utilisateur et mot de passe (un mauvais mot de passe est d'abord refusé). OAuth n'est jamais utilisé. |

## PERF — Performance

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
| --- | --- | --- | --- | --- |
| PERF-01 | non fait | — | — | Lighthouse pas encore mesuré. |
| PERF-02 | complet | `app/[lang]/rooms/[code]/race/typing-area.tsx`, `lib/race/manager.ts` | — | Le navigateur envoie ses touches par lots, au plus toutes les 150 ms (moins de 7 messages/s), et seulement s'il y en a. La progression reste en mémoire sur le serveur : aucune écriture en base pendant la course, une seule transaction à la fin. |
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
| SEC-01 | partiel | `lib/rooms/rooms.ts`, `lib/race/manager.ts`, `app/[lang]/rooms/actions.ts` | `lib/rooms/rooms.test.ts`, `lib/race/manager.test.ts` | Exclure et lancer une course sont vérifiés sur le serveur : l'hôte vient du cookie de session, jamais du message, et doit être l'hôte actuel d'une salle ouverte (testé avec un membre et un inconnu). Configurer, générer des liens et fermer n'existent pas encore. |
| SEC-02 | non fait | — | — | |
| SEC-03 | complet | `lib/auth/password.ts`, `app/[lang]/login/actions.ts` | — | Argon2id avec les paramètres minimaux de l'OWASP. Les erreurs de base de données sont journalisées sans les paramètres de la requête, donc jamais le mot de passe. |
