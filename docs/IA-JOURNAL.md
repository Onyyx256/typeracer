# Journal IA

Notes brutes, prises au fil du projet, pour rédiger `docs/IA.md` (situations où l'IA s'est trompée).

## 2026-11-07 — Serveur de test branché sur la base de développement

- **Outil / agent :** Claude Code (session principale), panneau navigateur intégré.
- **Ce que l'IA a fait :** pour tester l'entrée des invités, elle a lancé un serveur de production de test (port 3001) sur la base de développement principale. Au démarrage, ce serveur vérifie la présence des membres de toutes les salles : la salle JZK6AA (hôte Onyx, connecté à l'autre serveur de dev) a été jugée abandonnée après 30 s, Onyx en a été retiré et la salle fermée.
- **Comment je l'ai détecté :** l'IA a vérifié l'état de la salle dans la base après avoir arrêté le serveur de test.
- **Correction :** la salle a été rouverte (état `waiting`, Onyx remis comme hôte et coureur). Les tests suivants utilisent une base séparée `typeracer_test` (configuration `prod-3001-testdb` dans `.claude/launch.json`).
- **Leçon :** deux serveurs qui partagent une base partagent aussi la gestion de présence; un serveur de test doit avoir sa propre base.

## 2026-11-08 — Heure de fin gardée après un lot de touches refusé

- **Outil / agent :** Claude Code (session principale, zone de frappe de la course)
- **Ce que l'IA a fait :** dans `app/[lang]/rooms/[code]/race/typing-area.tsx`, l'heure de fin (`finishedAt`) était fixée quand le texte local était complet, mais jamais effacée. Quand le serveur refusait une rafale trop rapide et ramenait le texte à son état, le chrono local restait figé.
- **Comment je l'ai détecté :** essai dans le navigateur : le MPM local affichait 64 alors que la piste (calculée par le serveur) affichait 20, à la même position dans le texte.
- **Correction :** `finishedAt` est maintenant recalculé avec l'état de frappe dans `update()` (fixé si le texte est complet, effacé sinon), corrigé avant le commit de la zone de frappe.
- **Leçon :** quand un état local peut être corrigé par le serveur, tout ce qui en découle doit être recalculé avec lui, et il faut tester ce chemin de correction, pas seulement le cas normal.

## 2026-11-08 — Même erreur : serveur de test sur la base de développement

- **Outil / agent :** Claude Code (session principale), panneau navigateur intégré.
- **Ce que l'IA a fait :** pour vérifier la course dans le navigateur, elle a relancé la configuration `prod-3001` (base de développement) au lieu de `prod-3001-testdb`, alors que l'entrée précédente du journal décrivait déjà ce piège. 30 s après le démarrage, la salle SSX2T5 d'Onyx (ouverte sur l'autre serveur de dev) a été jugée abandonnée et fermée.
- **Comment je l'ai détecté :** l'IA a relu le journal en y ajoutant une entrée, puis a vérifié les salles fermées dans la base (fermeture à 19 h 03 min 38 s, 30 s après le démarrage du serveur de test).
- **Correction :** serveur de test arrêté. La salle reste fermée, à ma demande.
- **Leçon :** relire le journal avant de lancer un serveur; un serveur de test ne doit jamais démarrer sur la base de développement.

## 2026-11-08 — Formulaire de création envoyé avant le chargement du JavaScript

- **Outil / agent :** Claude Code (session principale), Playwright pour la vérification.
- **Ce que l'IA a fait :** dans `app/[lang]/rooms/new/create-room-form.tsx`, le formulaire ne passait que par `onSubmit`. Un clic sur « Create the room » avant l'hydratation faisait envoyer le formulaire par le navigateur, en GET avec tous les réglages dans l'URL, et aucune salle n'était créée. Première correction de l'IA : une action de formulaire React (qui rejoue les envois précoces), mais la réinitialisation automatique du formulaire décochait les boutons radio contrôlés après un refus.
- **Comment je l'ai détecté :** dans une fenêtre privée (cache vide, donc hydratation lente en dev), le bouton ne fonctionnait pas et l'URL contenait `?name=…&hostRole=…`. L'IA a reproduit le bug avec un script Playwright qui ralentit le JavaScript, et a repéré le défaut de sa première correction avec un second script avant le commit.
- **Correction :** le bouton reste désactivé tant que la page n'est pas hydratée (`useSyncExternalStore`), et le formulaire garde `onSubmit` (commit c26c63f).
- **Leçon :** tester un formulaire avec un JavaScript lent ou un cache vide, et vérifier le chemin d'erreur après chaque correction, pas seulement le cas qui marche.

## 2026-11-09 — Test e2e oublié après l'ajout d'une confirmation

- **Outil / agent :** Claude Code (session précédente; agent exact à compléter), Playwright.
- **Ce que l'IA a fait :** le commit d6e3683 a ajouté le dialogue « Delete the room? » au bouton « Leave the room » (dernier compte de la salle), sans mettre à jour `e2e/host-leaves.e2e.ts`. Le test cliquait toujours sur « Leave the room » et attendait une redirection qui ne venait plus : il échouait depuis.
- **Comment je l'ai détecté :** en lançant toute la suite e2e après le travail sur la page de course; l'IA a relancé le test sur le code sans ses changements pour confirmer que l'échec venait d'avant.
- **Correction :** le test annule le dialogue une fois, puis confirme (commit ce4008c).
- **Leçon :** relancer la suite e2e, pas seulement les tests unitaires, après avoir changé un parcours que les tests e2e cliquent.

## 2026-11-09 — Test e2e instable à cause d'un calcul de progression faux

- **Outil / agent :** Claude Code (session qui a écrit le test : à compléter), Playwright.
- **Ce que l'IA a fait :** dans `e2e/race-network.e2e.ts` (commit 2d21e00), le pourcentage attendu sur la piste était calculé jusqu'au dernier mot complet (`lastIndexOf(" ")`), alors que le moteur compte chaque caractère juste. Le test ne passait que si les deux valeurs arrondies tombaient pareil, selon le texte aléatoire.
- **Comment je l'ai détecté :** en vérifiant la fusion du mode entraînement dans `main`, le test a échoué (« 28 % » reçu, « 27 % » attendu) puis réussi au lancement suivant ; la piste montrait pourtant bien toutes les touches reçues.
- **Correction :** le test attend 120 caractères sur la longueur du texte, arrondis avec le même `Intl.NumberFormat` que la piste ; 4 passages de suite sans échec.
- **Leçon :** un test qui dépend d'un texte aléatoire doit être lancé plusieurs fois (`--repeat-each`) avant d'être commité.

## 2026-11-09 — Course qui ne se termine jamais après un bonus manqué

- **Outil / agent :** Claude Code (session principale des bonus de rattrapage), Playwright.
- **Ce que l'IA a fait :** quand un bonus change le texte d'un coureur, le serveur l'envoie une seule fois (`race:text`). Si le navigateur rate ce message, il garde l'ancien texte : il peut arriver au bout pendant que le serveur attend des mots ajoutés par la nuit, et la course ne finit jamais. Les tests e2e ne le voyaient pas, car aucun message ne s'y perdait.
- **Comment je l'ai détecté :** dans une vraie course sur localhost:3000 (salle W5GFHC), l'invité avait tout tapé en vert, mais la piste le montrait toujours « en course » et les résultats n'arrivaient pas. Ce serveur de dev tournait depuis 19 h 06, avant les bonus, avec un mélange d'anciennes et de nouvelles versions du code. Premier essai de correction de l'IA : redemander toute la course (`race:sync`), mais ça remettait la frappe à l'état du serveur et perdait des touches en route, ce qu'un test répété a montré.
- **Correction :** la piste donne la longueur du texte de chaque coureur ; si elle diffère pendant plus de 0,5 s, le navigateur redemande seulement son texte (`race:text-sync`). Test e2e qui jette les `race:text` de l'invité (commits dabfd6d, c578245, 4e3b1f1, 9fe5663).
- **Leçon :** un état envoyé une seule fois doit pouvoir être retrouvé ; tester aussi le cas où un message se perd.

## 2026-11-19 — Graphique du MPM en NaN après un abandon pendant le décompte

- **Outil / agent :** Claude Code (session du graphique de RES-03, commit 8391855, à confirmer) ; Playwright.
- **Ce que l'IA a fait :** `app/components/race/race-wpm-chart.tsx` divisait par le dernier temps de la course. Si on abandonne pendant le décompte de 3 s, tous les temps valent 0 : React reçoit NaN pour `x`, `cx`, `x1`, `x2` et `left`. Le test e2e de l'entraînement abandonnait déjà pendant un décompte, mais il tourne sur un build de production, où React n'affiche pas ces avertissements.
- **Comment je l'ai détecté :** en jouant à l'entraînement avec un bot Noob (une course finie, « Recommencer », abandon) : 5 erreurs React dans le serveur de dev.
- **Correction :** le graphique ne dessine rien si aucun temps n'a passé, et les résultats cachent sa section (ef6239c) ; le test e2e vérifie que le graphique est là après une vraie course et absent après un abandon pendant le décompte (4d56c86).
- **Leçon :** penser aux cas limites des divisions (durée nulle), et ne pas compter sur les tests e2e de production pour voir les avertissements de React.

## 2026-11-19 — Une personne exclue pouvait encore suivre une salle publique

- **Outil / agent :** Claude Code (audit de sécurité SEC-01 à SEC-03, demandé à l'IA).
- **Ce que l'IA a fait :** en écrivant l'exclusion (SALLE-07), elle a bloqué le retour dans la salle et retiré les onglets du canal, mais `canWatchRoom` (`lib/rooms/rooms.ts`) ne regardait pas `room_bans` : dans une salle publique, la personne exclue recevait de nouveau les mises à jour en direct au prochain `room:watch` ou `race:sync`. Il manquait aussi une limite aux connexions ratées, et le serveur Socket.IO ne vérifiait pas l'origine des connexions.
- **Comment je l'ai détecté :** audit de sécurité ligne à ligne contre les exigences SEC, en relisant chaque chemin qui donne accès à une salle.
- **Correction :** `canWatchRoom` refuse un utilisateur exclu, avec un test (7056329) ; limite des connexions ratées (d1721c1) ; origine vérifiée à la connexion Socket.IO (42551b5).
- **Leçon :** une règle d'accès doit être vérifiée sur tous les chemins (page, action, socket), pas seulement sur celui de la fonctionnalité qu'on écrit.

## 2026-11-20 — Mot de passe dans l'URL si on se connecte avant l'hydratation

- **Outil / agent :** Claude Code (écran de connexion, commits 633f751 et 6505f00).
- **Ce que l'IA a fait :** le formulaire de `app/[lang]/login/auth-screen.tsx` n'avait qu'un `onSubmit` JavaScript, sans `method`. Envoyé avant que React prenne la page (téléphone lent, gestionnaire de mots de passe), le navigateur faisait un GET vers `/en/login?username=…&password=…` : le mot de passe finissait dans l'historique et peut-être les journaux du serveur. Le même piège avait déjà été corrigé pour le formulaire de création de salle (c26c63f), mais pas ici.
- **Comment je l'ai détecté :** test en production avec JavaScript désactivé. Un premier essai de l'IA (`method="post"` seul) donnait une page blanche : Next répond à un POST sur une page en prérendu partiel sans la coquille HTML.
- **Correction :** bouton désactivé tant que la page n'est pas hydratée (hook `useHydrated` partagé), et `method="post"` en filet de sécurité (adc2e01, ecb1a75) ; test e2e sans JavaScript (1e2dfcf).
- **Leçon :** quand un bug est corrigé à un endroit, chercher le même motif dans tout le projet ; tester les formulaires avec JavaScript désactivé.

## 2026-11-20 — Bibliothèque crypto de 134 Ko chargée sur chaque page

- **Outil / agent :** Claude Code (codes de salle, commit 3dbb565 ; canaux temps réel, 89133cb).
- **Ce que l'IA a fait :** `lib/rooms/code.ts` importait `randomInt` de `node:crypto` à côté du schéma Zod du code. Ce fichier arrive au navigateur par `lib/realtime/events.ts` et `room-closed.tsx` (dans le layout), donc chaque page chargeait un remplacement de crypto de 450 Ko non compressé, presque entièrement inutilisé.
- **Comment je l'ai détecté :** Lighthouse en production (« unused JavaScript: 188 KiB »), puis en suivant les imports.
- **Correction :** `generateRoomCode` déplacé dans `lib/rooms/generate-code.ts`, marqué `server-only` (3e3b6c4) ; plus aucun morceau de crypto dans les fichiers JavaScript du build.
- **Leçon :** un fichier partagé entre client et serveur ne doit importer aucun module `node:` ; marquer `server-only` tout ce qui en dépend.
