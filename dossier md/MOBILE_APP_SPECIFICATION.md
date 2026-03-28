# Naval Duel Mobile Spec

## But du document

Ce fichier sert a recreer le jeu pour:

- Android
- iOS

en gardant:

- le meme concept
- les memes regles
- idealement le meme backend Node.js + Socket.io

Il est pense pour une IA ou un developpeur qui veut construire une vraie app mobile propre, pas juste compresser l'interface web.

## Strategie recommandee

Le chemin le plus rapide et le plus propre est:

1. garder le backend Node.js existant
2. garder les events Socket.io
3. recreer seulement le client mobile

Avantage:

- la logique metier ne change pas
- le bot ne change pas
- le matchmaking ne change pas
- le mobile ne gere que l'UI, l'UX tactile et la connexion realtime

## Options techniques conseillees

### Option 1

- Flutter
- Dart
- socket.io compatible client ou WebSocket adapte

### Option 2

- React Native
- TypeScript
- socket.io-client

### Option 3

- Kotlin Android + Swift iOS
- meme contrat reseau que le backend existant

Pour aller vite avec une IA:

- Flutter ou React Native

## Regles de jeu a conserver

- 2 camps: `BLUE` et `RED`
- plateau `A-J` et `0-10`
- 3 bateaux par joueur
- generation automatique cote serveur
- 20 secondes max pour trouver un humain avant bot
- 3 secondes minimum d'affichage de la recherche
- 10 secondes par tour
- 3 tours rates consecutifs = defaite
- bot avec delai aleatoire et mode hunt
- KO quand toutes les cellules d'un bateau sont touchees
- victoire quand les 3 bateaux ennemis sont KO
- reactions emoji dans la barre duel

## Parcours utilisateur mobile

### Ecran 1: home

Contenu:

- titre / branding
- champ pseudo
- bouton commencer
- petit visuel duel

### Ecran 2: matchmaking

Contenu:

- animation de recherche
- pseudo
- feedback visuel clair

### Ecran 3: intro duel

Contenu:

- nom joueur
- nom ennemi
- `VS`
- animation tres courte

### Ecran 4: bataille

Contenu:

- barre duel
- chrono visible
- grand tableau central
- boutons emoji

### Ecran 5: fin

Contenu:

- blur du plateau
- message victoire / defaite
- bouton rejouer

## Contraintes UX mobile

L'app mobile doit etre:

- tactile
- lisible
- centree sur le tableau
- compacte
- utilisable en portrait

Ne pas faire:

- une page web desktop compressee
- trop de texte
- plusieurs panneaux inutiles

## Layout mobile conseille

Ordre:

1. duel header compact
2. timer proche du tableau
3. tableau principal
4. petite zone de controles

Le tableau doit rester l'element dominant.

## Interactions tactiles

Le joueur doit:

- taper une cellule pour tirer
- taper un emoji pour lancer une reaction

Pas besoin de:

- drag and drop
- saisie manuelle de coordonnees

## Reactions emoji mobile

Ce n'est pas un chat texte.

Le joueur clique:

- `⚔️`
- `💣`
- `😆`
- `😢`
- `🔥`
- `😎`

Technique recommandee cote reseau:

- envoyer des cles ASCII:
  - `sword`
  - `bomb`
  - `laugh`
  - `cry`
  - `fire`
  - `cool`

Puis mapper localement vers l'icone.

Effet attendu:

- l'emoji s'anime a cote du nom du joueur qui l'a envoye
- l'adversaire voit la meme animation
- le joueur peut changer l'emoji a tout moment

## Architecture recommandee

### Backend

Garder le backend actuel:

- [server/index.js](/D:/project2025/codex-demo/server/index.js)

ou le redecouper plus proprement plus tard, mais sans changer les regles.

### Client mobile

Le client mobile doit contenir:

- ecrans
- gestion d'etat
- client socket
- mapping des payloads
- animations UI

## Contrat reseau minimal

### Client -> serveur

- `joinQueue`
- `attack`
- `playAgain`
- `sendEmote`

### Serveur -> client

- `gameState`
- `serverMessage`
- `emoteBurst`

## Modele d'etat mobile minimal

Le client mobile doit connaitre:

- `gameId`
- `phase`
- `selfTeam`
- `activeTeam`
- `isMyTurn`
- `vsBot`
- `winner`
- `username`
- `opponentName`
- `ownBoard`
- `enemyBoard`
- `fleetSummary`
- `enemyFleetSummary`
- `lastSelfAttack`
- `turnSecondsLeft`
- `selfSkips`
- `enemySkips`
- `incomingEmoteBurst`

## Recommandations Flutter

Si Flutter est choisi:

- `go_router` ou navigation simple
- `provider`, `riverpod` ou `bloc`
- WebSocket / Socket client compatible
- widgets custom pour la grille
- animations avec `AnimatedSwitcher`, `ScaleTransition`, `FadeTransition`

## Recommandations React Native

Si React Native est choisi:

- TypeScript
- Zustand ou Redux Toolkit
- socket.io-client
- React Navigation
- Reanimated pour les petites animations

## Acceptance criteria mobile

L'app mobile est valide si:

1. le pseudo peut etre saisi
2. le matchmaking fonctionne
3. le bot fallback fonctionne
4. l'intro VS est visible
5. le tableau est jouable en touch
6. le timer de 10 secondes est visible
7. le serveur garde l'autorite
8. les emojis apparaissent chez soi et chez l'autre
9. la fin de partie est claire
10. l'app reste propre en portrait

## Prompt de recreation mobile

```text
Build a full Android/iOS mobile client for an existing realtime naval duel game.

Important: keep the backend authoritative and reuse the same Node.js + Socket.io server logic.

Game rules:
- 2 teams: BLUE and RED
- board rows A-J, columns 0-10
- 3 auto-generated ships per player
- ships are line + head shapes:
  - 3+1
  - 4+1
  - 5+1
- no manual ship placement
- 20-second matchmaking before bot fallback
- matchmaking/search screen must stay visible at least 3 seconds
- turns last 10 seconds
- 3 consecutive missed turns = defeat
- bot attacks after random delay and uses hunt mode after a hit
- player may re-attack an older targeted cell and lose the turn
- player may not immediately re-click the exact last targeted cell

Mobile UX:
- portrait-first
- centered main board
- compact duel header
- visible countdown near board
- one-tap attacks
- short VS intro
- blur + victory/defeat overlay at game end
- emoji reaction bar
- emoji reaction must appear next to the sender name on both devices for a few seconds

Networking:
- reuse Socket.io events:
  - joinQueue
  - attack
  - playAgain
  - sendEmote
  - gameState
  - serverMessage
  - emoteBurst
- send emoji keys as ASCII codes:
  - sword
  - bomb
  - laugh
  - cry
  - fire
  - cool

Deliver clean mobile architecture, production-readable code, and touch-first UI.
```
