# GuitarTraining

Petits jeux dans le navigateur pour pratiquer la guitare : accords, tablatures et intervalles. On joue sur sa vraie guitare, et le jeu écoute ce qui sort de la carte son.

## Les jeux

- **Accordeur** (menu) : la note jouée, son écart en cents, et l'accord détecté avec les 12 notes entendues.
- **Chord Runner** : un accord est affiché sur l'obstacle qui arrive. Joue-le et le blob saute tout seul. 5 niveaux : accords ouverts, barrés, 7/maj7/m7, sus/add9/dim, power chords. Tous les accords du niveau sortent une fois, dans un ordre aléatoire, avant de recommencer, sans jamais deux fois le même accord d'affilée.
- **Tab Hero** : une tablature défile, chaque note est jugée sur la hauteur et le timing (Parfait, Bien, Raté). Tempo, métronome et latence réglables. La latence se calibre toute seule en fin de partie.
- **Intervalles** : « Tierce mineure ↑ de Sol ». Joue un Sol n'importe où sur le manche, puis la note à l'intervalle demandé depuis ce Sol. 4 niveaux, séries de 10 chronométrées. La réponse s'affiche avec son vrai nom (Si♭, pas La♯).

Dans chaque jeu, on choisit avec les touches 1 à 5 ou à la souris, et Q sert à revenir en arrière.

## Matériel

- Une guitare branchée sur une **carte son USB**, de préférence. Le micro de l'ordinateur marche aussi, mais il capte plus de bruit.
- Un navigateur récent (Firefox ou Chrome).
- Optionnel : un simulateur d'ampli. Il produit le son dans ton casque pendant que le jeu écoute le signal brut de la même entrée. Sur macOS, plusieurs applis peuvent lire la même entrée en même temps. Le jeu ne rejoue pas la guitare, il ne fait que des petits bips de jeu.

## Lancer le jeu

Node.js 20.19 ou plus (ou 22.12 et plus) est requis.

```bash
npm install
npm run dev
```

Ouvre l'adresse affichée (par défaut http://localhost:5173). En haut de la page, choisis ton entrée audio et le canal où est branchée la guitare, puis clique sur « Activer l'audio ». Vérifie avec l'accordeur que tes notes sont bien détectées.

Il faut passer par `npm run dev` : les navigateurs n'autorisent le micro que sur localhost ou en HTTPS.

## Ajouter une tablature

Dépose un fichier JSON dans `src/data/tabs/`. Il apparaît tout seul dans la liste de Tab Hero.

```json
{
  "title": "Mon exercice",
  "bpm": 90,
  "notes": [
    {"beat": 0, "string": 6, "fret": 5},
    {"beat": 0.5, "string": 6, "fret": 8}
  ]
}
```

- `string` : 1 = mi aigu … 6 = mi grave (accordage standard).
- `beat` : le temps où jouer la note, à partir de 0 et croissant.
- Une seule note à la fois (pas d'accords dans une tab), et pas deux fois la même note d'affilée.

Un fichier mal écrit s'affiche en rouge dans la liste, avec l'erreur, au lieu de faire planter le jeu.

## Tests

```bash
npm test
```

Les tests couvrent la reconnaissance d'accords (sur des spectres de guitare simulés), le lissage de l'affichage, les tablatures et leur notation, l'orthographe des intervalles, et le tirage des accords de Chord Runner.

## Technique

- [Vite](https://vite.dev) et [Phaser 3](https://phaser.io) en JavaScript, sans framework.
- Détection des notes : [pitchy](https://github.com/ianprime0509/pitchy) (algorithme de McLeod).
- Détection des accords : chromagramme calculé à partir des pics du spectre, comparé à des modèles d'accords qui tiennent compte des harmoniques. Écrite à la main, dans `src/audio/chords.js`.
- Police [Fredoka](https://fonts.google.com/specimen/Fredoka), embarquée avec `@fontsource/fredoka`. Les graphismes sont dessinés en code, sans fichiers image.
- Les réglages et les records sont enregistrés dans le `localStorage` du navigateur.

Limites connues :
- Une note seule peut être reconnue comme un power chord.
- Les renversements d'accords ne sont pas distingués.
- Tab Hero ne lit qu'une note à la fois.
