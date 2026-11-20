# Utilisation de l'IA

## 1. Agents et outils utilisés

L'outil principal est **Claude Code** (application de bureau, onglet Code), avec les modèles Claude Opus et Sonnet. Une session principale coordonne le travail et délègue des tâches ciblées à des sous-agents. Les travaux indépendants (corrections de bogues, documentation, tests) ont souvent été menés en parallèle dans des sessions séparées, chacune dans son propre *worktree* Git, puis fusionnés dans `main`.

**Sous-agents du projet** (`.claude/agents/`). Ils viennent du dépôt `VoltAgent/awesome-claude-code-subagents` (licence MIT) et ont été raccourcis et adaptés au projet :

| Agent | Rôle |
| --- | --- |
| `nextjs-typescript` | Pages, composants, actions serveur, schémas Zod, requêtes Drizzle |
| `websocket-engineer` | Serveur temps réel Socket.IO : salles, progression, reconnexion, bots |
| `test-automator` | Tests unitaires et tests e2e Playwright |
| `surgeon-reviewer` | Revue du diff avant chaque commit, limitée aux vrais problèmes |
| `a11y-perf-auditor` | Audit d'accessibilité (WCAG AA) et de performance (Lighthouse), en lecture seule |
| `deployment-engineer` | Intégration continue (GitHub Actions), déploiement sur le VPS, HTTPS |

**Skills du projet** (`.claude/skills/`), des procédures que l'agent suit étape par étape :

- `/feature` : construit une fonctionnalité à partir des identifiants d'exigences, en petites étapes (construction, tests, revue, commit) confiées aux sous-agents;
- `/commit` : petits commits d'un seul sujet, après lint et vérification des types;
- `/migration` : seule façon de changer le schéma (migration Drizzle versionnée, *seed* tenu à jour);
- `/exigences` : tient `docs/EXIGENCES.md` à jour sans marquer une exigence complète avant qu'elle le soit;
- `/ai-journal` : note chaque erreur de l'IA dans `docs/IA-JOURNAL.md`, qui a servi de source à ce document;
- `/livrables` : vérifie les livrables avant une remise.

**Outils utilisés par l'agent pour vérifier son travail :** le navigateur intégré de Claude Code (essais manuels, captures d'écran, console), Playwright (scripts de reproduction et tests e2e), Lighthouse (performance et accessibilité) et des requêtes SQL pour inspecter la base de données locale.

## 2. Fichiers d'instructions d'agent

Tous ces fichiers sont commités dans le dépôt.

- **`CLAUDE.md`** : contexte du projet et règles fixes. Il impose des commits petits et fréquents (l'historique est évalué), un seul sujet par commit, le lint et les types valides avant chaque commit, aucun `push` ni déploiement sans mon accord, et précise que les sous-agents ne commitent jamais eux-mêmes. Il reprend aussi les règles strictes du cours : TypeScript seulement, pas de `any` explicite (TECH-02), validation Zod de toute entrée serveur (TECH-07), et interdiction de générer ou de modifier le nom et le logo du site (DES-01, DES-02).
- **`AGENTS.md`** : rappelle que Next.js 16 diffère des versions que l'IA connaît et qu'il faut lire la documentation fournie dans `node_modules/next/dist/docs/` avant d'écrire du code Next.js. `CLAUDE.md` l'importe.
- **`.claude/agents/*.md`** : un fichier par sous-agent, avec ses outils, son modèle et une section « Project notes » propre au projet (Next.js 16, Bun, échelle d'un projet scolaire sans Redis ni service payant, serveur qui fait autorité sur la course, etc.).
- **`.claude/skills/*/SKILL.md`** : les procédures décrites plus haut. `exigences/requirements.md` résume l'énoncé avec les identifiants des exigences, pour que l'agent n'ait pas à relire le PDF.
- **`.claude/settings.json`** : réglages partagés de Claude Code pour le projet.

## 3. Trois situations où l'IA s'est trompée

### 3.1 Formulaires envoyés avant le chargement du JavaScript, jusqu'au mot de passe dans l'URL

**Erreur.** L'IA a écrit plusieurs formulaires qui ne fonctionnaient qu'avec un gestionnaire `onSubmit` en JavaScript, sans `method` ni `action`. Si on cliquait avant que React prenne la page (connexion lente, cache vide), le navigateur envoyait lui-même le formulaire en GET. Sur la création de salle, aucune salle n'était créée et tous les réglages se retrouvaient dans l'URL. Sur l'écran de connexion (`app/[lang]/login/auth-screen.tsx`), c'était plus grave : le navigateur allait vers `/en/login?username=…&password=…`, donc le mot de passe aboutissait dans l'historique et possiblement dans les journaux du serveur. Le premier bogue avait été corrigé, mais l'IA n'avait pas cherché le même motif ailleurs dans le projet.

**Détection.** Pour la création de salle : un essai dans une fenêtre privée, où le bouton ne faisait rien et l'URL contenait `?name=…&hostRole=…`; l'IA l'a ensuite reproduit avec un script Playwright qui ralentit le JavaScript. Pour la connexion : un essai en production avec JavaScript désactivé. Dans les deux cas, la première correction proposée par l'IA était fausse : une action de formulaire React décochait les boutons radio après un refus, et `method="post"` seul donnait une page blanche, parce que Next.js répond à un POST sur une page en prérendu partiel sans la coquille HTML.

**Correction.** Un hook partagé `useHydrated` garde le bouton d'envoi désactivé tant que la page n'est pas hydratée, et le formulaire de connexion a `method="post"` en filet de sécurité (commits c26c63f, adc2e01, ecb1a75). Un test e2e sans JavaScript empêche que le problème revienne (1e2dfcf).

### 3.2 Serveur de test branché sur la base de développement, deux fois

**Erreur.** Pour tester une fonctionnalité dans le navigateur, l'IA a lancé un second serveur (port 3001) sur la même base que mon serveur de développement. Au démarrage, le serveur vérifie la présence des membres de chaque salle : il a jugé abandonnée une salle où j'étais connecté sur l'autre serveur, m'en a retirée et l'a fermée après 30 secondes. Le lendemain, l'IA a refait exactement la même chose, alors que le journal décrivait déjà ce piège et qu'une configuration avec une base séparée existait.

**Détection.** Les deux fois, c'est l'IA qui a vérifié l'état des salles dans la base après avoir arrêté son serveur de test et qui a constaté la fermeture (la seconde fois, à 30 secondes exactement du démarrage du serveur de test).

**Correction.** La première salle a été rouverte à la main dans la base (état `waiting`, hôte remis en place). Une base séparée `typeracer_test` et une configuration de lancement dédiée (`prod-3001-testdb`) ont été créées pour les serveurs de test. La récidive montre qu'une consigne écrite dans un journal ne suffit pas : l'agent ne relit pas le journal de lui-même, et une erreur qui touche des données réelles doit être rendue impossible par la configuration, pas seulement documentée.

### 3.3 Exclusion d'un joueur vérifiée sur un seul chemin

**Erreur.** En écrivant l'exclusion d'un joueur par l'hôte (SALLE-07), l'IA a bloqué le retour dans la salle et fermé les connexions temps réel de la personne exclue, mais la fonction `canWatchRoom` (`lib/rooms/rooms.ts`), qui autorise à suivre une salle en direct, ne consultait pas la table `room_bans`. Dans une salle publique, la personne exclue recevait donc de nouveau toutes les mises à jour au prochain `room:watch` ou `race:sync`. Les tests écrits avec la fonctionnalité ne couvraient que le chemin qu'elle venait d'ajouter.

**Détection.** Lors d'un audit de sécurité que j'ai demandé à l'IA, ligne à ligne contre les exigences SEC-01 à SEC-03, en relisant chaque chemin qui donne accès à une salle (page, action serveur, événement Socket.IO). Le même audit a trouvé deux autres manques : aucune limite aux tentatives de connexion ratées, et aucune vérification de l'origine des connexions Socket.IO.

**Correction.** `canWatchRoom` refuse maintenant un utilisateur exclu, avec un test (7056329); les tentatives de connexion ratées sont limitées (d1721c1); l'origine est vérifiée à la connexion Socket.IO (42551b5).

## 4. Réflexion sur ma façon de travailler avec les agents

<!-- À rédiger -->
