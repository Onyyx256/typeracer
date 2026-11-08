# Journal IA

Notes brutes, prises au fil du projet, pour rédiger `docs/IA.md` (situations où l'IA s'est trompée).

## 2026-11-07 — Serveur de test branché sur la base de développement

- **Outil / agent :** Claude Code (session principale), panneau navigateur intégré.
- **Ce que l'IA a fait :** pour tester l'entrée des invités, elle a lancé un serveur de production de test (port 3001) sur la base de développement principale. Au démarrage, ce serveur vérifie la présence des membres de toutes les salles : la salle JZK6AA (hôte Onyx, connecté à l'autre serveur de dev) a été jugée abandonnée après 30 s, Onyx en a été retiré et la salle fermée.
- **Comment je l'ai détecté :** l'IA a vérifié l'état de la salle dans la base après avoir arrêté le serveur de test.
- **Correction :** la salle a été rouverte (état `waiting`, Onyx remis comme hôte et coureur). Les tests suivants utilisent une base séparée `typeracer_test` (configuration `prod-3001-testdb` dans `.claude/launch.json`).
- **Leçon :** deux serveurs qui partagent une base partagent aussi la gestion de présence; un serveur de test doit avoir sa propre base.
