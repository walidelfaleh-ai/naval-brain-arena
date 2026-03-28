# Naval Duel Current Implementation Spec

## But du document

Ce fichier decrit exactement la version actuelle du projet:

- regles reelles
- comportement reel
- stack technique
- architecture
- details de runtime

Il sert a reproduire le jeu exactement comme il existe aujourd'hui.

## Stack actuelle

### Frontend

- Angular 19
- TypeScript
- SCSS
- PrimeNG
- PrimeIcons
- socket.io-client

### Backend

- Node.js
- Express
- Socket.io
- CORS

### Structure

```text
/client
/server
```

## Organisation du projet

### Frontend

Le client Angular se trouve dans:

- [client](/D:/project2025/codex-demo/client)

Les zones principales:

- [components](/D:/project2025/codex-demo/client/src/app/components)
- [models](/D:/project2025/codex-demo/client/src/app/models)
- [services](/D:/project2025/codex-demo/client/src/app/services)

### Backend

Le serveur Node se trouve dans:

- [server](/D:/project2025/codex-demo/server)

Le coeur de la logique est dans:

- [index.js](/D:/project2025/codex-demo/server/index.js)

## Regles actuelles exactes

### Plateau

- lignes `A-J`
- colonnes `0-10`
- 10 lignes
- 11 colonnes

### Matchmaking

- le joueur entre un pseudo
- il clique commencer
- il entre dans une file
- si un autre humain attend, un match humain vs humain est cree
- sinon apres `20` secondes un bot prend la place
- la phase de recherche dure au minimum `3` secondes avant affichage du combat

### Tours

- duree d'un tour: `10` secondes
- si le joueur n'agit pas a temps, il perd son tour
- apres `3` tours rates de suite, il perd la partie

### Bateaux

Le serveur cree automatiquement `3` bateaux par joueur:

- `patrol`: ligne `3` + tete = `4`
- `frigate`: ligne `4` + tete = `5`
- `destroyer`: ligne `5` + tete = `6`

### Contraintes de placement

- pas de chevauchement entre bateaux du meme joueur
- contact entre bateaux tres limite
- pas de coordonnee partagee entre `BLUE` et `RED`

### Regle de tir

- un tir frais sur bateau ennemi = touche
- un tir frais sur case vide = rate
- un tir sur une ancienne case deja attaquee = tir gaspille et tour perdu
- impossibilite de recliquer immediatement la toute derniere case visee

### Bot

- nom humain aleatoire
- delai aleatoire entre `0` et `10` secondes
- mode hunt apres une touche
- cible ensuite les cases voisines

### Fin de partie

Le gagnant est:

- celui qui KO les 3 bateaux ennemis
- ou celui qui profite de la defaite automatique adverse apres 3 absences
- ou celui qui reste quand l'autre se deconnecte

## Interface actuelle

### Accueil

- titre hero
- champ pseudo
- bouton commencer
- visuel central comique `Bateau Blue VS Bateau Rouge`

### Matchmaking

- spinner
- radar de recherche
- attente minimum visible

### Intro VS

- ecran intermediaire anime
- nom joueur gauche
- nom ennemi droite
- `VS` au centre

### Ecran de combat

Contient:

- barre duel en haut
- nom joueur / ennemi / VS
- badge KO compact
- chrono grand format
- un seul tableau central fusionne
- boutons emoji

### Fin de partie

- tableau floute
- overlay anime
- bouton rejouer

## Reactions emoji actuelles

Le jeu utilise des reactions, pas un chat texte.

### Flux actuel

- le joueur clique un bouton emoji
- le client envoie une cle ASCII stable:
  - `sword`
  - `bomb`
  - `laugh`
  - `cry`
  - `fire`
  - `cool`
- le client local affiche immediatement l'animation a cote du nom du joueur
- le serveur envoie `emoteBurst`
- l'autre client affiche l'animation a cote du nom du bon joueur

### Mapping visuel actuel

- `sword` -> `⚔️`
- `bomb` -> `💣`
- `laugh` -> `😆`
- `cry` -> `😢`
- `fire` -> `🔥`
- `cool` -> `😎`

## Evenements Socket actuels

### Client -> Serveur

- `joinQueue`
- `attack`
- `sendEmote`

### Serveur -> Client

- `gameState`
- `serverMessage`
- `emoteBurst`

## Etat frontend actuel

Le `GameState` actuel contient notamment:

- `gameId`
- `phase`
- `selfTeam`
- `activeTeam`
- `isMyTurn`
- `vsBot`
- `winner`
- `username`
- `opponentName`
- `connectionLabel`
- `statusMessage`
- `ownBoard`
- `enemyBoard`
- `fleetSummary`
- `enemyFleetSummary`
- `emotes`
- `incomingEmoteBurst`
- `lastSelfAttack`
- `turnSecondsLeft`
- `selfSkips`
- `enemySkips`

## Composants frontend actuels

### App root

- [app.component.ts](/D:/project2025/codex-demo/client/src/app/app.component.ts)
- [app.component.html](/D:/project2025/codex-demo/client/src/app/app.component.html)

Role:

- afficher accueil ou bataille
- afficher intro VS

### Lobby

- [lobby.component.ts](/D:/project2025/codex-demo/client/src/app/components/lobby/lobby.component.ts)
- [lobby.component.html](/D:/project2025/codex-demo/client/src/app/components/lobby/lobby.component.html)

Role:

- pseudo
- bouton commencer
- recherche

### Game Board

- [game-board.component.ts](/D:/project2025/codex-demo/client/src/app/components/game-board/game-board.component.ts)
- [game-board.component.html](/D:/project2025/codex-demo/client/src/app/components/game-board/game-board.component.html)

Role:

- tableau fusionne
- chrono
- KO
- VS bar
- overlay de fin
- emotes

## Services frontend actuels

### Socket service

- [socket.service.ts](/D:/project2025/codex-demo/client/src/app/services/socket.service.ts)

Role:

- ouvrir la connexion Socket.io vers `http://localhost:3000`

### Game service

- [game.service.ts](/D:/project2025/codex-demo/client/src/app/services/game.service.ts)

Role:

- stocker l'etat courant
- ecouter `gameState`
- ecouter `emoteBurst`
- emettre `joinQueue`
- emettre `attack`
- emettre `sendEmote`

## Backend actuel

### Stockage

Tout est en memoire.

Pas de:

- base de donnees
- compte utilisateur
- auth
- reprise apres reboot

Si le serveur redemarre:

- toutes les parties actives sont perdues

### Structures runtime principales

- `waitingPlayers`
- `playerWaitTimers`
- `games`
- `socketToGame`

### Fonctions cle

Dans [index.js](/D:/project2025/codex-demo/server/index.js):

- `handleJoinQueue`
- `createHumanVsHumanGame`
- `createBotGame`
- `createBaseGame`
- `queueBattleStart`
- `startBattle`
- `handleAttack`
- `resolveAttack`
- `handleTurnTimeout`
- `finishGame`
- `handleSendEmote`
- `broadcastGameState`
- `broadcastEmote`

## Lancement local actuel

### Serveur

Dans [server](/D:/project2025/codex-demo/server):

```bash
npm start
```

### Client

Dans [client](/D:/project2025/codex-demo/client):

```bash
npm start
```

## URL utile

Health check backend:

- [http://localhost:3000/health](http://localhost:3000/health)

## Ce qu'il faut conserver pour refaire cette version a l'identique

1. backend autoritaire
2. Angular comme client principal
3. bot de secours apres 20 secondes
4. attente visible minimum 3 secondes
5. tours de 10 secondes
6. 3 absences = defaite
7. 3 bateaux formes ligne + tete
8. plateau `A-J / 0-10`
9. interface avec un seul tableau principal
10. reactions emoji temporaires dans la barre VS
