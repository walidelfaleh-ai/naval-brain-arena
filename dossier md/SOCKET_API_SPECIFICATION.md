# Naval Duel Socket API Spec

## But du document

Ce fichier decrit les evenements Socket utilises par la version actuelle du jeu.

Il sert a:

- reconnecter un autre client au meme backend
- refaire un frontend dans un autre framework
- comprendre les payloads envoyes et recus

## Transport

- protocole temps reel: Socket.io
- backend: Node.js + Socket.io
- URL locale actuelle: `http://localhost:3000`

## Principe general

Le serveur est autoritaire.

Le client:

- envoie des intentions
- recoit un `gameState`
- affiche ce que dit le serveur

Le client ne decide jamais:

- du gagnant
- des tirs valides
- du changement de tour
- du bot
- du matchmaking

## Evenements Client -> Serveur

### `joinQueue`

Utilise pour le matchmaking aleatoire.

Payload:

```json
{
  "username": "walid",
  "avatarId": "captain-ray",
  "uploadedAvatarDataUrl": null
}
```

Notes:

- `username` est obligatoire
- `avatarId` est optionnel si une image est envoyee
- `uploadedAvatarDataUrl` est une image `data:image/...;base64,...`

### `createPrivateMatch`

Utilise pour creer une salle ami avec code prive.

Payload:

```json
{
  "username": "walid",
  "avatarId": "captain-ray",
  "uploadedAvatarDataUrl": null
}
```

Effet:

- le serveur genere un code unique de `6` caracteres
- le joueur passe en attente dans une salle privee

### `joinPrivateMatch`

Utilise pour rejoindre une salle ami.

Payload:

```json
{
  "username": "arwa",
  "code": "7E5LA9",
  "avatarId": "iron-beard",
  "uploadedAvatarDataUrl": null
}
```

Effet:

- le serveur cherche la salle privee par code
- si elle existe, la partie privee est creee

### `attack`

Utilise pour tirer sur une case.

Payload:

```json
{
  "row": 4,
  "col": 7
}
```

Notes:

- `row` est l’index de ligne
- `col` est l’index de colonne
- la conversion en `A0`, `B7`, etc. est faite serveur

### `sendEmote`

Utilise pour envoyer une reaction emoji.

Payload:

```json
{
  "emote": "bomb"
}
```

Cles actuellement supportees:

- `sword`
- `bomb`
- `laugh`
- `cry`
- `fire`
- `cool`

### `leaveGame`

Utilise pour quitter:

- une partie en cours
- ou un matchmaking
- ou une salle privee

Payload:

```json
{}
```

## Evenements Serveur -> Client

### `gameState`

Evenement principal.

Le serveur envoie un objet complet d’etat.

Exemple simplifie:

```json
{
  "gameId": "game-ab12cd34",
  "phase": "battle",
  "matchMode": "private",
  "matchCode": "7E5LA9",
  "selfTeam": "BLUE",
  "activeTeam": "RED",
  "resolvingAttack": false,
  "isMyTurn": false,
  "vsBot": false,
  "winner": null,
  "username": "walid",
  "opponentName": "arwa",
  "selfAvatar": {
    "id": "captain-ray",
    "icon": "🧑‍✈️",
    "tint": "#38bdf8",
    "source": "preset"
  },
  "opponentAvatar": {
    "id": "upload-123456",
    "tint": "#94a3b8",
    "source": "upload",
    "imageDataUrl": "data:image/jpeg;base64,..."
  },
  "connectionLabel": "Matched",
  "statusMessage": "Your turn. Click one enemy cell within 10 seconds.",
  "ownBoard": {
    "rows": [],
    "ships": []
  },
  "enemyBoard": {
    "rows": [],
    "ships": []
  },
  "rowLabels": ["A","B","C","D","E","F","G","H","I","J"],
  "colLabels": ["0","1","2","3","4","5","6","7","8","9","10"],
  "fleetSummary": [],
  "enemyFleetSummary": [],
  "emotes": [],
  "lastSelfAttack": { "row": 4, "col": 7 },
  "turnSecondsLeft": 8,
  "selfSkips": 0,
  "enemySkips": 1
}
```

### `serverMessage`

Petit message de controle ou erreur.

Exemples:

- cellule deja jouee
- pas ton tour
- pas de partie active
- code ami invalide

Payload:

```json
"Wait for your turn."
```

### `emoteBurst`

Reaction temps reel immediate.

Payload:

```json
{
  "id": "emote-123456-abcd",
  "team": "BLUE",
  "username": "walid",
  "emote": "laugh",
  "createdAt": 1710000000000
}
```

Effet:

- le joueur local voit tout de suite la reaction
- l’adversaire voit la meme animation a cote du nom du joueur emetteur

## Phases de partie

Valeurs actuelles:

- `home`
- `matching`
- `battle`
- `gameover`

## Modes de match

Valeurs actuelles:

- `random`
- `private`
- `null`

## Structure des avatars

### Avatar preset

```json
{
  "id": "captain-ray",
  "icon": "🧑‍✈️",
  "tint": "#38bdf8",
  "source": "preset"
}
```

### Avatar importe

```json
{
  "id": "upload-abc123",
  "tint": "#94a3b8",
  "source": "upload",
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

## Structure des cellules cote client

Chaque cellule de grille sanitisee contient au minimum:

```json
{
  "row": 0,
  "col": 0,
  "label": "A0",
  "attacked": false,
  "result": "unknown",
  "hasShip": false,
  "shipId": null,
  "shipSegmentHit": false
}
```

`result` peut valoir:

- `unknown`
- `hit`
- `miss`

## Regles de timing exposees par l’API

- matchmaking bot fallback: `20s`
- affichage minimum de recherche: `3s`
- duree d’un tour: `10s`
- delai visuel avant resultat de tir: `2s`

## Ordre typique d’une partie aleatoire

1. client se connecte
2. serveur envoie `gameState` phase `home`
3. client envoie `joinQueue`
4. serveur envoie `gameState` phase `matching`
5. serveur trouve un humain ou cree un bot
6. serveur envoie `gameState` phase `matching`
7. serveur envoie `gameState` phase `battle`
8. client envoie `attack`
9. serveur envoie `gameState` avec `resolvingAttack=true`
10. apres 2 secondes, serveur envoie `gameState` avec resultat reel du tir
11. boucle jusqu’a `gameover`

## Ordre typique d’une partie ami

1. joueur A envoie `createPrivateMatch`
2. serveur renvoie `gameState` avec:
   - `phase: matching`
   - `matchMode: private`
   - `matchCode: XXXXXX`
3. joueur B envoie `joinPrivateMatch` avec le meme code
4. serveur cree la partie
5. les deux joueurs recoivent `gameState`
6. la partie passe ensuite en `battle`

## Conseils si tu recrees un autre client

- considere `gameState` comme la source unique d’affichage
- garde en local seulement les animations temporaires
- affiche les codes ami en uppercase
- accepte a la fois avatar preset et avatar upload
- gere `resolvingAttack` comme un verrou d’UI

## Fichiers backend lies

Le contrat actuel est implemente principalement dans:

- [index.js](/D:/project2025/codex-demo/server/index.js)
