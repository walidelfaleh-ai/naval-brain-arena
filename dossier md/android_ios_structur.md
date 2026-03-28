# Android iOS Structur

## But du document

Ce fichier sert de base complete pour recreer l'application mobile du jeu sur:

- Android
- iOS

Il rassemble:

- les regles du jeu
- les ecrans
- les interfaces possibles
- les boutons et actions
- les comportements reseau
- un prompt final pour generer rapidement l'application avec une IA

## Vision generale

L'application mobile est un jeu tactique temps reel inspire de Battleship.

Le joueur:

- choisit un pseudo
- choisit un avatar ou importe une photo
- lance une partie aleatoire
- ou cree / rejoint une partie avec un ami
- joue sur une grande grille tactile unique

Le backend reste autoritaire.

## Regles completes du jeu

### Equipes

Il y a 2 equipes:

- `BLUE`
- `RED`

### Plateau

Le plateau utilise:

- lignes `A` a `J`
- colonnes `0` a `10`

Soit:

- `10` lignes
- `11` colonnes

### Bateaux

Chaque joueur a `3` bateaux, places automatiquement par le serveur.

Le joueur ne place jamais ses bateaux lui-meme.

#### Formes

Bateau 1:

- ligne de `3`
- plus `1` tete
- total `4` cellules

Bateau 2:

- ligne de `4`
- plus `1` tete
- total `5` cellules

Bateau 3:

- ligne de `5`
- plus `1` tete
- total `6` cellules

#### Contraintes de placement

- les bateaux d'un meme joueur ne se chevauchent pas
- les bateaux se collent tres peu
- au maximum une seule cellule de contact est toleree selon la logique actuelle
- les bateaux `BLUE` et `RED` ne partagent jamais les memes coordonnees

### Matchmaking aleatoire

- le joueur clique sur `Jouer`
- le serveur cherche un humain
- si aucun joueur n'est trouve apres `20` secondes, un bot prend la place
- l'etape de recherche reste visible au minimum `3` secondes

### Match avec amis

- le joueur clique `Jouer avec amis`
- un code prive unique de `6` caracteres est genere
- il partage ce code a son ami
- l'ami clique `Rejoindre ami`
- l'ami saisit le code dans l'etape suivante
- les deux joueurs entrent alors dans la meme partie

### Tours

- un tour dure `10` secondes
- seul le joueur actif peut tirer
- si le joueur n'agit pas a temps, il perd son tour
- apres `3` tours rates consecutifs, il perd la partie

### Tir

Le joueur touche une case ennemie via l'ecran tactile.

Si la case contient un bateau ennemi:

- le tir est reussi
- un grand check vert s'affiche

Si la case est vide:

- le tir est rate
- un grand `X` rouge s'affiche

### Delai de resultat

Apres chaque tir:

- il y a `2` secondes de suspense
- pendant ces `2` secondes, le resultat n'apparait pas encore
- pendant ces `2` secondes, aucun autre joueur ne peut jouer

### Tirs recus

Quand l'ennemi tire sur ta zone:

- petite marque verte si ton bateau a ete touche
- petite marque rouge si le tir est rate sur ta zone

### Bateau coule

Quand un bateau est completement detruit:

- afficher un overlay temporaire
- flouter la grille
- afficher:
  - `Bateau 1 coule`
  - `Bateau 2 coule`
  - `Bateau 3 coule`

### Fin de partie

Le jeu se termine toujours avec:

- un gagnant
- un perdant

Conditions de victoire:

- detruire les `3` bateaux ennemis
- ou gagner car l'autre joueur a rate `3` tours consecutifs
- ou gagner si l'autre joueur quitte / se deconnecte

### Bot

Si aucun humain n'est trouve:

- un bot prend la place du second joueur
- il a un pseudo humain credible
- il joue apres un delai aleatoire entre `0` et `10` secondes
- s'il touche, il entre en mode chasse et vise les cases voisines

## Architecture mobile recommandee

### Strategie

Le plus simple est:

- garder le serveur Node.js + Socket.io existant
- recreer seulement le client mobile

### Pourquoi

- les regles sont deja centralisees
- le matchmaking existe deja
- le bot existe deja
- les tours existent deja
- la logique de victoire existe deja

### Recommandation technique

Option 1:

- Flutter
- Dart

Option 2:

- React Native
- TypeScript

Flutter est souvent le plus rapide pour obtenir une app propre visuellement.

## Ecrans mobiles a prevoir

## 1. Ecran d'accueil

### Objectif

Permettre:

- saisir le pseudo
- choisir l'avatar
- importer une photo
- choisir le mode de partie

### Elements UI

- logo / nom du jeu
- illustration comique `Blue VS Red`
- champ pseudo
- grille d'avatars
- bouton `Choisir une photo`
- bouton principal `Jouer`
- bouton `Jouer avec amis`
- bouton `Rejoindre ami`

### Boutons

`Jouer`

- lance matchmaking aleatoire

`Jouer avec amis`

- cree une salle privee

`Rejoindre ami`

- ouvre l'etape suivante pour entrer le code

## 2. Ecran rejoindre ami

### Objectif

Permettre a un joueur de saisir un code prive.

### Elements UI

- titre `Entre le code de ton ami`
- champ code de `6` caracteres
- bouton `Entrer dans la salle`
- bouton `Retour`

### Boutons

`Entrer dans la salle`

- valide le code et tente la connexion

`Retour`

- retourne a l'ecran d'accueil

## 3. Ecran de recherche / attente

### Cas aleatoire

Affichage:

- animation de recherche
- spinner / radar
- pseudo joueur
- texte de statut

### Cas ami

Affichage:

- animation d'attente
- code prive tres visible
- message `Partage ce code avec ton ami`

## 4. Ecran intro duel

### Objectif

Montrer une transition courte avant la bataille.

### Elements UI

- nom joueur 1
- nom joueur 2
- avatars
- `VS`

## 5. Ecran principal de bataille

### Structure

Zone 1:

- barre duel en haut

Zone 2:

- barre emotes + bouton quitter

Zone 3:

- chrono visible

Zone 4:

- grille principale unique

### Barre duel

Doit afficher:

- avatar joueur
- nom joueur
- equipe joueur
- absences joueur
- KO joueur
- `VS`
- avatar ennemi
- nom ennemi
- equipe ennemie
- absences ennemies
- KO ennemi

### Barre emotes

Boutons emoji:

- `⚔️`
- `💣`
- `😆`
- `😢`
- `🔥`
- `😎`

Bouton:

- `Quitter`

### Grille

Une seule grande grille tactile.

Elle doit montrer:

- les bateaux du joueur par fond colore tres leger
- les tirs reussis sur l'ennemi
- les tirs rates sur l'ennemi
- les tirs recus sur sa propre flotte

### Couleurs

- bateau du joueur bleu si `BLUE`
- bateau du joueur rouge si `RED`
- check vert pour tir reussi
- `X` rouge pour tir rate

## 6. Overlay bateau coule

### Objectif

Renforcer la sensation d'impact.

### Affichage

- flou du plateau
- message central
- texte du style:
  - `Bateau 1 coule`
  - `Bateau 2 coule`
  - `Bateau 3 coule`

## 7. Ecran de fin

### Objectif

Clore la partie clairement.

### Elements UI

- plateau floute
- grand message:
  - `Vous avez gagne`
  - `Vous avez perdu`
- bouton `Rejouer`
- bouton `Quitter`

## Interactions utilisateur

## Avatar

Le joueur doit pouvoir:

- choisir un avatar preset
- ou importer une photo

Le pseudo et l'avatar doivent etre gardes en memoire locale.

## Tactile

Le jeu doit privilegier:

- tap simple
- gros boutons
- grille bien espaciee

Pas besoin de:

- drag and drop
- saisie manuelle de coordonnees

## Etats d'interface importants

Le client mobile doit gerer:

- `home`
- `join-friend`
- `matching`
- `battle`
- `sunk-announcement`
- `gameover`

## Donnees a afficher depuis le serveur

Le client doit utiliser:

- `gameId`
- `phase`
- `matchMode`
- `matchCode`
- `selfTeam`
- `activeTeam`
- `resolvingAttack`
- `isMyTurn`
- `winner`
- `username`
- `opponentName`
- `selfAvatar`
- `opponentAvatar`
- `statusMessage`
- `ownBoard`
- `enemyBoard`
- `fleetSummary`
- `enemyFleetSummary`
- `turnSecondsLeft`
- `selfSkips`
- `enemySkips`
- `incomingEmoteBurst`

## Evenements reseau minimaux

Client -> serveur:

- `joinQueue`
- `createPrivateMatch`
- `joinPrivateMatch`
- `attack`
- `sendEmote`
- `leaveGame`

Serveur -> client:

- `gameState`
- `serverMessage`
- `emoteBurst`

## Comportements UX importants

- gros boutons clairs
- peu de texte inutile
- visuels lisibles en portrait
- etapes courtes
- feedback immediat au clic
- suspense visible avant resultat du tir

## Prompt final pour une IA

```text
Build a full Android/iOS mobile app for a realtime naval duel game.

Important:
- keep the existing Node.js + Socket.io backend logic
- backend must remain authoritative
- mobile app should be portrait-first and touch-first

Game rules:
- 2 teams: BLUE and RED
- board rows A-J, columns 0-10
- 3 ships per player, generated automatically server-side
- ship 1 = line 3 + head = 4 cells
- ship 2 = line 4 + head = 5 cells
- ship 3 = line 5 + head = 6 cells
- ships from BLUE and RED must never share the same coordinates
- player never places ships manually
- random matchmaking with bot fallback after 20 seconds
- search screen must stay visible at least 3 seconds
- players can also create a private friend room with a 6-character code
- friend can join by entering the same code
- each turn lasts 10 seconds
- 3 consecutive missed turns = defeat
- after a player taps a cell, wait 2 seconds before showing the shot result
- during this delay nobody else can play
- if attack hits enemy ship, show a big green check
- if attack misses, show a big red X
- when a ship is fully destroyed, show a blurred overlay message:
  - Bateau 1 coule
  - Bateau 2 coule
  - Bateau 3 coule
- game ends with either:
  - Vous avez gagne
  - Vous avez perdu

Bot rules:
- human-like random username
- random action delay from 0 to 10 seconds
- hunt mode after a hit, target adjacent cells until ship is sunk

Mobile screens:
- home screen with username, avatar selection, photo upload, play button, play with friends button, join friend button
- friend code entry screen
- matchmaking / waiting screen
- VS intro screen
- battle screen with:
  - duel top bar
  - player and enemy avatars
  - names
  - team colors
  - absences
  - KO counters
  - emoji buttons
  - quit button
  - large countdown near the board
  - one main grid
- sunk ship overlay
- game over overlay with replay and quit buttons

Realtime events:
- joinQueue
- createPrivateMatch
- joinPrivateMatch
- attack
- sendEmote
- leaveGame
- gameState
- serverMessage
- emoteBurst

Emoji reactions:
- sword
- bomb
- laugh
- cry
- fire
- cool
- clicking an emoji shows a temporary animation next to the sender name on both devices

Technical expectation:
- produce clean production-readable mobile code
- include navigation, socket connection layer, state management, and reusable UI components
- optimize for Android and iOS with responsive portrait layouts
```
