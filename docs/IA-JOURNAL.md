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
