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
- **Correction :** serveur de test arrêté. La salle reste fermée, à la demande de l'utilisatrice.
- **Leçon :** relire le journal avant de lancer un serveur; un serveur de test ne doit jamais démarrer sur la base de développement.
