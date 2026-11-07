# Génération des textes

Comment le texte d'une course est choisi selon la configuration de la salle (CONF-03 à CONF-07). Le code est dans `lib/texts/`, les données sont produites par `bun run texts:build` (`scripts/build-texts.ts`).

Le texte est généré au moment où le décompte commence, pour que personne ne le voie avant (COURSE-03). La génération utilise une graine (seed) : avec la même graine et la même configuration, le texte aléatoire est toujours le même, ce qui permet de le tester.

## Sources

| Données | Source | Licence | Fichier dans le dépôt |
| --- | --- | --- | --- |
| Fréquence des mots (FR, EN) | [FrequencyWords](https://github.com/hermitdave/FrequencyWords), Hermit Dave, sous-titres OpenSubtitles 2018 | CC BY-SA 4.0 | `lib/texts/words/fr.json`, `lib/texts/words/en.json` |
| Filtre des mots français | [Lexique 3.83](http://www.lexique.org), New et Pallier | CC BY-SA 4.0 | (sert seulement au build) |
| Filtre des mots anglais | Dictionnaire Webster's 2nd de macOS (`/usr/share/dict/web2`) | domaine public | (sert seulement au build) |
| Passages | 10 livres du domaine public sur [Project Gutenberg](https://www.gutenberg.org) | domaine public | `db/seed/passages.json`, chargé dans la table `texts` par `bun run db:seed` |

Livres utilisés : *Le tour du monde en quatre-vingts jours* et *Voyage au centre de la Terre* (Jules Verne), *Les Misérables, tome I* (Victor Hugo), *Les Trois Mousquetaires* (Alexandre Dumas), *Eugénie Grandet* (Balzac), *Pride and Prejudice* (Jane Austen), *The Adventures of Tom Sawyer* (Mark Twain), *The Adventures of Sherlock Holmes* (Arthur Conan Doyle), *Frankenstein* (Mary Shelley), *Moby Dick* (Herman Melville).

Les listes de mots dérivent de FrequencyWords, elles sont donc sous CC BY-SA 4.0 elles aussi.

## Listes de mots (texte aléatoire)

Chaque langue a une liste de 10 000 mots, du plus fréquent au moins fréquent. Le rang d'un mot est sa position dans la liste. Le script garde un mot de la liste de fréquence seulement si :

- il n'a que des lettres (avec les accents français) ;
- un dictionnaire le connaît : Lexique pour le français ; pour l'anglais, le Webster's (avec les terminaisons régulières -s, -ed, -ing...) ou bien le mot apparaît au moins deux fois en minuscules dans les livres ;
- ce n'est pas un nom propre : un mot que les livres écrivent presque toujours avec une majuscule au milieu d'une phrase est retiré ;
- il n'est pas dans la liste noire écrite à la main (`scripts/texts/blocklist.ts`) : jurons, argot, onomatopées, didascalies des sous-titres (« sighs »), prénoms, mots anglais dans les sous-titres français ;
- s'il a une ou deux lettres, il fait partie d'une courte liste de vrais mots (« a », « à », « y », « of », « je »...).

Les sous-titres contiennent beaucoup de bruit, donc quelques mots douteux peuvent encore rester plus loin dans les listes. On les ajoute à la liste noire quand on les trouve, puis on relance `bun run texts:build`.

## Passages (texte cohérent)

Le script enlève l'en-tête et la licence de Gutenberg, découpe chaque livre en paragraphes et remplace la typographie par des caractères qu'on tape directement au clavier : guillemets droits `"` au lieu de « » et “ ”, apostrophe droite, `...` pour les points de suspension, ` - ` pour les tirets, `oe` et `ae` pour les ligatures, pas d'espace avant la ponctuation. Un paragraphe avec d'autres caractères (notes, crochets) ou un titre de chapitre est sauté.

Les paragraphes qui se suivent sont regroupés en passages d'environ 220 mots (au plus 320), sans traverser un titre. On garde 60 passages par livre, répartis sur tout le livre, donc 300 passages par langue.

## Difficulté (CONF-05)

Les critères sont dans `lib/texts/complexity.ts`.

**Texte aléatoire** : la difficulté choisit dans quels mots on pige.

| Difficulté | Rang dans la liste | Longueur | Mots disponibles (FR / EN) |
| --- | --- | --- | --- |
| Facile | 1 à 1 000 | 2 à 6 lettres | 727 / 796 |
| Moyenne | 1 à 5 000 | 3 à 9 lettres | 4 519 / 4 657 |
| Difficile | 500 à 10 000 | 7 lettres et plus | 5 811 / 4 889 |

**Texte cohérent** : chaque extrait a un score

> score = longueur moyenne des mots (en lettres) + 5 × proportion de mots peu courants

Un mot est peu courant s'il n'est pas dans les 2 000 premiers mots de la liste de sa langue (les morceaux de 1 ou 2 lettres comme « l' » sont ignorés). Les seuils coupent le corpus de chaque langue à peu près en trois tiers :

| Langue | Facile | Moyenne | Difficile |
| --- | --- | --- | --- |
| Français | score < 6,1 | 6,1 à 6,75 | score > 6,75 |
| Anglais | score < 5,4 | 5,4 à 5,9 | score > 5,9 |

Les seuils du français sont plus hauts parce que les mots français sont plus longs en moyenne.

## Longueur (CONF-04)

- **Aléatoire** : exactement le nombre de mots demandé.
- **Cohérent** : on prend une suite de phrases entières dans un passage, avec un nombre de mots à 15 % près de la longueur demandée (au moins ±2 mots). On ne coupe jamais une phrase. Pour choisir, on lit 25 passages au hasard de la bonne langue et de la bonne difficulté, et on préfère les extraits dont le score correspond aussi à la difficulté. S'il n'y en a pas, on prend un extrait de la bonne longueur, et sinon l'extrait le plus proche.

## Options de caractères (CONF-06)

| Option | Texte aléatoire | Texte cohérent |
| --- | --- | --- |
| Ponctuation | Phrases de 5 à 12 mots qui finissent par `.`, `?` ou `!`, et une virgule, un `;` ou un `:` après environ 12 % des mots | Désactivée : la ponctuation est enlevée, sauf les apostrophes et les traits d'union dans les mots (« l'homme », « peut-être ») |
| Majuscules | Au début de chaque phrase, et sur environ 8 % des autres mots | Désactivées : tout le texte est en minuscules |
| Chiffres | Environ un mot sur dix devient un nombre de 1 à 4 chiffres | Les romans contiennent rarement des chiffres, donc l'option ne peut pas en ajouter. Désactivée, elle exclut les passages qui en ont |
| Accents (français seulement) | Désactivés : les mots avec accent sont retirés de la liste | Désactivés : les lettres perdent leur accent (é → e, ç → c) |

En anglais, l'option accents ne s'applique pas : les accents sont toujours enlevés.

## Caractères à inclure ou exclure (CONF-07)

Ces filtres s'appliquent **seulement au texte aléatoire**. En mode cohérent, ils sont désactivés dans le formulaire et vidés par le serveur, parce qu'on ne peut pas enlever une lettre d'un vrai texte sans le rendre illisible.

- **Avec ces lettres** : chaque mot contient au moins une de ces lettres. Ça permet de pratiquer des lettres en particulier. Seules les lettres comptent ici.
- **Sans ces caractères** : ces caractères n'apparaissent jamais, que ce soient des lettres, de la ponctuation ou des chiffres. Un caractère à la fois inclus et exclu est exclu.
- La comparaison ignore la casse : exclure `e` exclut aussi `E`.
- S'il reste moins de 30 mots dans la tranche de difficulté, on prend tous les mots de la liste qui passent les filtres. S'il ne reste aucun mot, la salle ne peut pas être créée (erreur « aucun mot ne correspond à ces filtres »).
