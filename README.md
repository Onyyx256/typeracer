# NelumboType

Course de dactylographie multijoueur en temps réel. On crée une salle (ou on en rejoint une avec un code, un lien d'invitation ou la liste des salles publiques), on ajuste le texte et les bots, puis tout le monde tape le même texte en même temps en suivant la progression des autres sur la piste.

Site en production : <https://nelumbotype.online>

Projet de session du cours Web V.

![Home page](image.png)
![Join page](image-1.png)
![Race example](image-2.png)

## Fonctionnalités

- **Salles** publiques, accessibles par code ou privées (lien d'invitation à usage unique), de 2 à 30 participants, avec des spectateurs. L'hôte peut exclure quelqu'un, et l'hôte passe à un autre joueur s'il quitte.
- **Course rapide** : rejoint la salle publique la plus près d'être pleine.
- **Configuration de la course**, visible par toute la salle en temps réel : limite de temps, langue du texte (français ou anglais), texte cohérent (extraits de livres) ou mots aléatoires, longueur, complexité, ponctuation, chiffres, majuscules, accents, caractères à inclure ou exclure, mode d'erreur, bonus de rattrapage.
- **Bots** de cinq niveaux (Noob à Impossible), avec une vitesse qui varie et des erreurs à corriger.
- **Course en direct** : décompte synchronisé, retour immédiat sur chaque caractère, MPM et précision en direct, piste animée avec la position de chaque coureur. Le serveur fait autorité sur le temps, la progression et le classement. Après un rechargement ou une coupure, on reprend là où on était si on revient dans les 30 secondes.
- **Bonus de rattrapage** : aux points de contrôle (25 %, 50 %, 75 %), le joueur en retard reçoit un bonus qui l'aide ou qui ralentit le meneur.
- **Résultats** : podium, tableau complet, graphique du MPM de tous les coureurs pendant la course, touches les plus ratées, indicateur de record personnel.
- **Mode entraînement** pour taper seul, sans salle.
- **Comptes** : connexion GitHub ou Discord, ou nom d'utilisateur et mot de passe. Les invités choisissent un pseudo et peuvent rejoindre une salle sans compte.
- **Profil et statistiques** : photo de profil, nom affiché, couleurs de la fleur, meilleur MPM, moyennes, victoires, graphique du MPM dans le temps et historique paginé des courses.
- **Français et anglais** pour toute l'interface, **thème clair et sombre**, mise en page adaptée dès 360 px de large.

<!-- Capture : salle d'attente avec la configuration -->

<!-- Capture : course en cours avec la piste -->

<!-- Capture : page de résultats -->

<!-- Capture : page de statistiques -->

## Technologies

| Rôle | Outil |
| --- | --- |
| Application | [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript en mode strict |
| Style | Tailwind CSS 4 |
| Base de données | PostgreSQL 17, [Drizzle ORM](https://orm.drizzle.team) et ses migrations versionnées |
| Temps réel | [Socket.IO](https://socket.io), sur le même serveur HTTP que Next.js (`server.ts`) |
| Validation | [Zod](https://zod.dev), pour toutes les entrées côté serveur |
| Authentification | Cookie de session signé ([jose](https://github.com/panva/jose)), mots de passe hachés avec Argon2id |
| Images | [sharp](https://sharp.pixelplumbing.com) pour redimensionner les photos de profil |
| Tests | `bun test` (unitaires), [Playwright](https://playwright.dev) (bout en bout) |
| Outils | [Bun](https://bun.sh) (paquets, scripts, tests), ESLint, GitHub Actions |
| Hébergement | VPS avec Caddy (HTTPS) et systemd, base de données dans Docker |

## Installation locale

### Prérequis

- [Bun](https://bun.sh) 1.4 ou plus récent
- [Node.js](https://nodejs.org) 22.6 ou plus récent (le serveur de développement tourne sur Node)
- [Docker](https://www.docker.com) avec Docker Compose, pour PostgreSQL

### Étapes

1. Installer les dépendances :

   ```bash
   bun install
   ```

2. Créer le fichier d'environnement, puis remplir au moins `SESSION_SECRET` (voir [Variables d'environnement](#variables-denvironnement)) :

   ```bash
   cp .env.example .env.local
   ```

3. Démarrer PostgreSQL (le conteneur `db` de `docker-compose.yml`, sur le port 5432) :

   ```bash
   bun run db:up
   ```

4. Appliquer les migrations :

   ```bash
   bun run db:migrate
   ```

5. Charger les textes et les comptes de démonstration :

   ```bash
   bun run db:seed:demo
   ```

   `bun run db:seed` charge seulement le corpus de textes, sans les comptes de démonstration.

6. Lancer le serveur de développement :

   ```bash
   bun run dev
   ```

   Le site est sur <http://localhost:3000>.

### Compte de démonstration

`bun run db:seed:demo` crée trois comptes avec deux mois de courses, pour que les statistiques et l'historique aient quelque chose à montrer :

| Nom d'utilisateur | Mot de passe |
| --- | --- |
| `demo_lotus` | `nelumbo-demo` |
| `demo_iris` | `nelumbo-demo` |
| `demo_fern` | `nelumbo-demo` |

Ces comptes existent seulement en local : leur mot de passe est public, donc ils ne sont jamais créés sur le serveur de production. Relancer la commande remplace leurs courses.

## Variables d'environnement

Elles sont toutes documentées dans [`.env.example`](.env.example). En local, elles vont dans `.env.local`.

| Variable | Requise | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | Oui | Adresse de la base PostgreSQL. La valeur de `.env.example` correspond au conteneur de `docker-compose.yml`. |
| `SESSION_SECRET` | Oui | Signe le cookie de session. Au moins 32 caractères, par exemple `openssl rand -base64 48`. |
| `APP_URL` | En production | Adresse publique du site, pour construire les URL de retour OAuth. En local, l'adresse utilisée par le navigateur est prise par défaut. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Non | Application OAuth GitHub. URL de retour : `<APP_URL>/api/auth/github/callback`. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Non | Application OAuth Discord. URL de retour : `<APP_URL>/api/auth/discord/callback`. |
| `POSTGRES_PASSWORD` | En production | Mot de passe de la base lancée par `docker-compose.prod.yml`. |
| `CODE_MISS_LIMIT` | Non | Codes de salle inconnus permis par minute et par adresse IP (10 par défaut). |
| `GUEST_LIMIT` | Non | Comptes invités permis par 10 minutes et par adresse IP (20 par défaut). |

Sans les identifiants d'un fournisseur OAuth, la page de connexion indique que cette connexion n'est pas disponible, et le reste du site fonctionne normalement.

## Tests

Les tests écrivent dans une base séparée, `typeracer_test`, pour ne pas toucher aux données de développement. Ils refusent de démarrer si le nom de la base ne se termine pas par `_test`. Pour la créer et la préparer une première fois :

```bash
docker compose exec db createdb -U typeracer typeracer_test
```

```bash
DATABASE_URL=postgres://typeracer:typeracer@localhost:5432/typeracer_test bun run db:migrate
```

```bash
DATABASE_URL=postgres://typeracer:typeracer@localhost:5432/typeracer_test bun run db:seed
```

Une autre base de test peut être choisie avec `TEST_DATABASE_URL`.

### Tests unitaires

```bash
bun test
```

### Tests de bout en bout

La première fois, installer le navigateur de Playwright :

```bash
bunx playwright install chromium
```

Puis :

```bash
bun run test:e2e
```

Playwright compile l'application et la lance en mode production sur le port 3100, avec la base de test, donc un serveur de développement sur le port 3000 peut rester ouvert. Les tests se connectent avec un nom d'utilisateur et un mot de passe (pas OAuth), et les comptes qu'ils créent sont supprimés à la fin. Le rapport HTML est dans `playwright-report/`.

### Lint et vérification des types

```bash
bun run lint
```

```bash
bun run typecheck
```

L'intégration continue (`.github/workflows/ci.yml`) lance le lint, la vérification des types et les tests unitaires à chaque push.

## Commandes

| Commande | Rôle |
| --- | --- |
| `bun run dev` | Serveur de développement (Next.js et Socket.IO) |
| `bun run build` | Compilation pour la production |
| `bun run start` | Lance la version compilée |
| `bun run db:up` | Démarre PostgreSQL dans Docker |
| `bun run db:generate` | Génère une migration à partir de `db/schema.ts` |
| `bun run db:migrate` | Applique les migrations |
| `bun run db:seed` | Charge le corpus de textes |
| `bun run db:seed:demo` | Corpus de textes et comptes de démonstration |
| `bun run db:studio` | Ouvre Drizzle Studio pour explorer la base |
| `bun run texts:build` | Reconstruit les listes de mots et les extraits de livres (voir `docs/TEXTES.md`) |

## Structure du projet

```text
app/[lang]/     pages, par langue (/fr, /en)
app/api/        routes API (OAuth, avatars)
app/components/ composants partagés
lib/            logique : course, bots, salles, temps réel, authentification, statistiques, textes, i18n
db/             schéma Drizzle, migrations et seed
e2e/            tests Playwright
scripts/        construction du corpus de textes
deploy/         déploiement sur le VPS (Caddy, systemd, script)
server.ts       serveur HTTP qui réunit Next.js et Socket.IO
docs/           documentation du projet
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : modèle de données, machine à états d'une course, flux temps réel, décisions d'architecture (temps réel, bots, bonus)
- [`docs/EXIGENCES.md`](docs/EXIGENCES.md) : matrice de traçabilité des exigences
- [`docs/DEMARCHE-CREATIVE.md`](docs/DEMARCHE-CREATIVE.md) : nom, logo et direction artistique
- [`docs/TEXTES.md`](docs/TEXTES.md) : sources du corpus et critères de complexité
