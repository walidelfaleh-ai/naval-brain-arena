# Naval Duel Master Spec

## But du document

Ce fichier décrit le jeu de A a Z:

- principe
- regles
- etapes de partie
- logique serveur
- droits et contraintes
- UX attendue
- prompt final pour recreer vite le jeu avec une autre IA ou un autre langage

Il doit permettre de repartir de zero sans dependre du code Angular/Node actuel.

## Vision produit

Le jeu est un duel tactique multijoueur en temps reel inspire de Battleship.

Deux joueurs s'affrontent:

- `BLUE`
- `RED`

Chaque joueur possede une flotte cachee generee automatiquement par le moteur du jeu.

Le joueur ne place pas ses bateaux. Il entre juste son pseudo, lance la recherche, puis clique sur les cellules pour attaquer.

## Plateau

Le repere est:

- lignes `A` a `J`
- colonnes `0` a `10`

Soit:

- `10` lignes
- `11` colonnes

Exemples de coordonnees:

- `A0`
- `C7`
- `J10`

## Roles et responsabilites

### Ce que fait le serveur

Le serveur est la source de verite.

Il gere:

- matchmaking
- creation de partie
- bot de secours
- generation automatique des bateaux
- validation des tirs
- chronometre des tours
- changement de tour
- KO
- victoire / defaite
- diffusion de l'etat
- reactions emoji temps reel

### Ce que fait le client

Le client:

- affiche l'etat recu
- laisse le joueur cliquer
- lance des actions simples
- montre les animations locales

Le client ne doit jamais etre la source de verite pour:

- les regles
- les tirs valides
- la victoire
- les timers officiels

## Demarrage d'une partie

### Phase 1: accueil

Le joueur:

1. ouvre l'application
2. saisit son pseudo
3. clique sur `Commencer`

### Phase 2: matchmaking

Le systeme cherche un autre joueur.

Regles:

- si un autre joueur est disponible, une partie est preparee
- si aucun joueur n'est trouve apres `20` secondes, un bot prend la place du second joueur
- meme si un joueur est trouve instantanement, l'etape de recherche doit rester visible au minimum `3` secondes avant le passage au combat

### Phase 3: intro duel

Avant d'afficher le plateau:

- montrer une courte animation `JOUEUR 1 VS JOUEUR 2`

### Phase 4: bataille

Le plateau de combat apparait.

### Phase 5: fin de partie

Le plateau est floute et un overlay anime affiche:

- `Vous avez gagne`
- ou `Vous avez perdu`

## Regles des tours

Chaque tour dure `10` secondes.

Regles:

- seul le joueur actif peut tirer
- si le joueur ne tire pas a temps, il perd son tour
- le tour passe automatiquement a l'autre joueur
- si un joueur rate `3` tours consecutifs par inaction, il perd automatiquement la partie

La partie se termine toujours avec:

- un gagnant
- un perdant

## Regles de tir

Le joueur clique une cellule.

### Si la cellule ennemie contient un bateau

- c'est une touche
- la cellule doit etre marquee comme reussie
- le bateau subit un degat

### Si la cellule ennemie est vide

- c'est un rate
- la cellule doit etre marquee comme echec

### Regle de memoire

Le joueur a le droit de recliquer une ancienne cellule deja visee.

Effet:

- le tir est gaspille
- aucun nouveau degat n'est applique
- le tour est perdu

### Exception importante

Le joueur ne peut pas recliquer immediatement la toute derniere cellule qu'il vient de viser.

## Flotte

Chaque joueur a `3` bateaux.

Les bateaux sont places automatiquement par le moteur de jeu.

Le joueur ne les place jamais manuellement.

## Forme des bateaux

Chaque bateau a:

- une ligne principale
- une tete ajoutee sur une cellule proche

### Bateau 1

- ligne de `3`
- plus `1` cellule tete
- total `4` cellules

### Bateau 2

- ligne de `4`
- plus `1` cellule tete
- total `5` cellules

### Bateau 3

- ligne de `5`
- plus `1` cellule tete
- total `6` cellules

### Regle de tete

La tete:

- doit etre adjacente a la ligne
- doit etre placee aleatoirement
- doit etre perpendiculaire a la ligne
- ne doit pas etre sur une cellule deja occupee par la ligne

## Regles de placement des bateaux

Le moteur doit respecter:

1. un bateau ne peut pas chevaucher un autre bateau du meme joueur
2. les bateaux ne doivent presque jamais se coller
3. au maximum une seule cellule de contact est toleree par bateau selon la logique actuelle
4. les bateaux `BLUE` et `RED` ne peuvent pas partager la meme coordonnee

Cette derniere regle est obligatoire pour conserver une lecture claire sur le plateau fusionne.

## KO et victoire

Un bateau est `KO` quand toutes ses cellules sont touchees.

La partie est gagnee si:

- les `3` bateaux ennemis sont KO

La partie est perdue si:

- les `3` bateaux du joueur sont KO
- ou le joueur saute `3` tours consecutifs
- ou le joueur se deconnecte

## Bot

Le bot est gere serveur.

### Regles du bot

- il prend la place d'un joueur si personne n'est trouve apres `20` secondes
- il doit avoir un nom humain credible
- il doit jouer avec un delai aleatoire entre `0` et `10` secondes
- s'il touche un bateau, il doit devenir plus intelligent et viser les cases adjacentes
- s'il coule le bateau, il peut vider sa memoire de chasse

## Interface attendue

## Ecran d'accueil

Doit contenir:

- logo / titre
- champ pseudo
- bouton commencer
- visuel simple du duel `Bateau Blue VS Bateau Rouge`

Ne pas afficher:

- gros pavés de texte
- apercu technique inutile
- cartes explicatives inutiles

## Ecran de matchmaking

Doit montrer:

- animation de recherche
- pseudo du joueur
- etape d'attente claire

## Ecran de combat

Doit montrer:

- barre duel en haut
- nom joueur gauche / nom ennemi droite / `VS` au centre
- chrono tres visible proche du tableau
- un seul grand tableau de jeu au centre
- indicateurs KO compacts
- boutons d'emojis

## Rendu du tableau

Le meme tableau doit permettre de voir:

- les bateaux du joueur
- les tirs effectues sur l'ennemi
- les tirs recus de l'ennemi

## Reactions emoji

Ce n'est pas un vrai chat texte.

Le joueur clique un emoji.

Effet attendu:

- une animation temporaire apparait a cote de son nom
- la meme animation apparait aussi chez l'autre joueur a cote du nom correspondant
- le joueur peut changer librement d'emoji a tout moment
- ce n'est pas lie au tour

## Evenements reseau minimaux

### Client vers serveur

- `joinQueue`
- `attack`
- `playAgain`
- `sendEmote`

### Serveur vers client

- `gameState`
- `serverMessage`
- `emoteBurst`

## Phases de jeu

- `home`
- `matching`
- `battle`
- `gameover`

## Modele de donnees minimal

### Player

- id
- username
- team
- isBot

### Cell

- row
- col
- attacked
- shipId

### Ship

- id
- name
- lineSize
- totalSize
- positions
- head
- hits
- sunk

### Game

- id
- phase
- players
- boards
- activeTeam
- turnStartTime
- turnExpireTime
- lastAttackByTeam
- missedTurnsByTeam
- winner
- bot hunt memory
- emotes history

## Acceptance criteria

Le jeu est considere correct si:

1. un joueur peut entrer un pseudo et commencer
2. deux humains peuvent etre apparies
3. un bot est lance apres `20` secondes
4. la recherche reste visible minimum `3` secondes
5. le tour dure `10` secondes
6. `3` absences consecutives donnent une defaite
7. les bateaux sont auto-generes
8. les bateaux ont une ligne + une tete
9. `BLUE` et `RED` ne partagent pas les memes coordonnees
10. le plateau central est jouable a la souris
11. la partie finit toujours avec gagnant et perdant
12. les reactions emoji apparaissent localement et chez l'adversaire

## Prompt de recreation rapide

Utilise ce prompt si tu veux refaire rapidement le jeu avec une autre IA:

```text
Build a complete online multiplayer naval duel game inspired by Battleship.

Core rules:
- 2 teams: BLUE and RED
- board coordinates: rows A-J, columns 0-10
- 1 human starts matchmaking with a username
- if no opponent is found after 20 seconds, spawn a bot with a human-like username
- matchmaking/search screen must remain visible at least 3 seconds before battle starts
- each turn lasts 10 seconds
- if a player does not act, the turn is lost automatically
- if a player skips 3 consecutive turns, that player loses
- game always ends with one winner and one loser

Ships:
- players do not place ships manually
- server auto-generates 3 ships per player
- ship 1: line of 3 + 1 extra head cell = 4 cells total
- ship 2: line of 4 + 1 extra head cell = 5 cells total
- ship 3: line of 5 + 1 extra head cell = 6 cells total
- head must be adjacent and perpendicular to the line
- ships of the same side cannot overlap
- ships should almost never touch
- ships from BLUE and RED must never occupy the same coordinates

Attack rules:
- click enemy coordinate to attack
- hit if enemy ship is there
- miss if empty
- player may click an older already attacked cell again, but loses the turn
- player may not click the exact last clicked cell again immediately

Bot:
- bot attacks after a random delay between 0 and 10 seconds
- bot uses hunt mode after a successful hit and targets adjacent cells until the ship is sunk

UI:
- home screen with username input and start button
- matchmaking animation
- short VS intro animation before battle
- one main merged board centered on screen
- top duel bar with player name, enemy name, VS in the middle, compact KO counters
- large countdown near the board
- game-over overlay with blur and animated “Vous avez gagne” / “Vous avez perdu”
- emoji reaction bar; clicking an emoji shows a temporary animation next to the sender name and also on the opponent screen next to the sender name

Architecture:
- backend must be authoritative
- client only renders state and sends actions
- use realtime sockets / websockets
- expose game phases: home, matching, battle, gameover

Deliver full source code and keep the code structured and production-readable.
```
