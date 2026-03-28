# Android With Ionic

## Vue d'ensemble

Cette application mobile est une version Android du jeu `Naval Brain Arena`, développée avec `Ionic + Angular + Capacitor`, et connectée au même backend temps réel `Node.js + Socket.io` que la version web.

Le but a ete de conserver :

- la meme logique serveur
- les memes regles de jeu
- le meme matchmaking
- les memes evenements Socket.io
- une interface mobile adaptee au smartphone Android

Le dossier mobile du projet est :

- [androind](/D:/project2025/codex-demo/androind)

Le backend utilise par l'application est :

- [server](/D:/project2025/codex-demo/server)

## Stack technique

### Mobile

- `Ionic`
- `Angular`
- `Capacitor`
- `Socket.io-client`
- `Android Studio / Gradle` pour les builds Android

### Backend reutilise

- `Node.js`
- `Express`
- `Socket.io`

### Hebergement serveur

- `Render`
- URL publique actuelle :
  - [https://naval-brain-arena-server.onrender.com](https://naval-brain-arena-server.onrender.com)

## Structure mobile

Les fichiers principaux de l'application Android sont :

- [home.page.html](/D:/project2025/codex-demo/androind/src/app/home/home.page.html)
- [home.page.ts](/D:/project2025/codex-demo/androind/src/app/home/home.page.ts)
- [home.page.scss](/D:/project2025/codex-demo/androind/src/app/home/home.page.scss)
- [game.service.ts](/D:/project2025/codex-demo/androind/src/app/services/game.service.ts)
- [socket.service.ts](/D:/project2025/codex-demo/androind/src/app/services/socket.service.ts)
- [AndroidManifest.xml](/D:/project2025/codex-demo/androind/android/app/src/main/AndroidManifest.xml)
- [MainActivity.java](/D:/project2025/codex-demo/androind/android/app/src/main/java/com/navalbrainarena/mobile/MainActivity.java)
- [capacitor.config.ts](/D:/project2025/codex-demo/androind/capacitor.config.ts)

## Fonctionnalites implementees

### Ecran d'accueil

L'utilisateur peut :

- saisir son pseudo
- voir un visuel d'accueil inspire de la version web
- ouvrir un ecran dedie pour choisir un avatar
- telecharger une photo perso comme avatar dans cet ecran dedie
- lancer une partie aleatoire
- creer une partie privee avec un ami
- rejoindre une partie privee avec un code

Le pseudo et l'avatar sont memorises localement sur l'appareil.

L'accueil mobile a ete simplifie pour ressembler davantage a un vrai jeu :

- suppression du texte inutile de presentation
- suppression du bloc `Ready` et de son message par defaut
- affichage des erreurs reseau seulement si necessaire
- bouton separe `Avatar` juste apres la saisie du pseudo
- choix avatar/photo deplace dans une page d'interface secondaire

### Matchmaking

Deux modes sont supportes :

- `Jouer` : matchmaking aleatoire
- `Jouer avec amis` : creation d'une salle privee avec code
- `Rejoindre ami` : entree dans la salle via le code

### Partie temps reel

La version mobile gere :

- affichage de la grille
- tir sur les cases ennemies
- affichage des touches et des rates
- affichage des tirs recus
- compteur de temps du tour
- compteur d'absences
- compteur de bateaux KO
- annonce de bateau coule
- ecran final victoire / defaite
- reactions emoji

### Avatars

Deux modes d'avatar sont disponibles :

- avatar preset
- photo perso upload

Les avatars choisis sont visibles des deux cotes de la partie car ils sont transmis au serveur.

## Regles de jeu actuellement actives

Les regles serveur actuellement utilisees par l'app mobile sont les memes que sur la version web.

### Plateau

- lignes : `A -> K`
- colonnes : `0 -> 8`
- soit un plateau de `11 x 9`

### Bateaux

Chaque joueur possede `3` bateaux.

Les bateaux sont places automatiquement par le serveur.

Chaque bateau a :

- une ligne principale
- une tete adjacente

Formes actuelles :

- bateau 1 : ligne 3 + 1 tete = `4` cellules
- bateau 2 : ligne 4 + 1 tete = `5` cellules
- bateau 3 : ligne 5 + 1 tete = `6` cellules

Contraintes de placement :

- les bateaux d'un meme joueur ne doivent pas se superposer
- les bateaux du joueur et ceux de l'ennemi ne doivent pas occuper les memes cases
- les bateaux ne doivent pas etre colles de maniere excessive

### Tours

- un joueur a `10 secondes` pour jouer
- s'il ne tire pas, le tour passe
- apres `3 absences consecutives`, le joueur perd

### Fin de partie

La partie se termine :

- si les `3` bateaux d'un joueur sont KO
- ou si un joueur atteint `3` absences consecutives
- ou si un joueur quitte / se deconnecte

Il y a toujours :

- un gagnant
- un perdant

### Tirs

- une case deja jouee ne peut plus etre retiree
- un tir touche affiche un marqueur de hit
- un tir rate affiche un marqueur de miss
- les tirs recus sont visibles sur la grille locale

### Delai de resultat

Apres un clic de tir :

- le serveur attend avant de reveler le resultat
- un court delai d'impact rend le tir plus lisible

### Bot

Si aucun joueur n'est trouve en mode aleatoire :

- fallback bot apres attente
- le bot joue cote serveur
- comportement de chasse apres hit deja ajoute

## Evolution Android specifique

### Adaptations mobile deja faites

- interface compacte smartphone
- reduction de la taille des cellules
- reduction des marges
- overlays centres
- portrait force
- plein ecran Android
- connexion automatique au serveur Render

### Nettoyage de la version publique Android

La version Android publique a ete simplifiee :

- suppression du champ de saisie `Serveur Socket`
- suppression du badge debug `Platform: android`
- suppression du header Ionic haut
- ajout d'un visuel hero d'accueil inspire de la version web Angular
- URL Render integree directement dans le client mobile

L'URL encodee dans l'app est :

- `https://naval-brain-arena-server.onrender.com`

## Reseau et connectivite

### Probleme traite

Pendant le developpement Android local, plusieurs problemes ont ete corriges :

- `health check failed to fetch`
- `socket timeout`
- cleartext HTTP Android
- compatibilite Socket.io Android

### Correctifs mis en place

- `CapacitorHttp` pour le health check natif
- config cleartext dans Capacitor et Android
- fallback socket plus compatible Android
- orientation et plein ecran natifs

### Hebergement Render

Le serveur a ete prepare pour Render avec :

- support de `process.env.PORT`
- fichier [render.yaml](/D:/project2025/codex-demo/render.yaml)

Le repo GitHub utilise :

- [https://github.com/walidelfaleh-ai/naval-brain-arena](https://github.com/walidelfaleh-ai/naval-brain-arena)

## APK

Un APK debug a ete genere pour test manuel Android.

Emplacement actuel :

- [naval-brain-arena-debug.apk](/D:/project2025/codex-demo/apk/naval-brain-arena-debug.apk)

Ce fichier est utile pour :

- test local
- validation fonctionnelle
- distribution manuelle

## Etat actuel de publication Play Store

### Deja pret

- application Android fonctionnelle
- backend en ligne
- APK debug testable
- code pousse sur GitHub
- base technique propre pour une version release

### Pas encore finalise pour le Store

Pour une vraie publication Google Play, il reste a faire :

- creation d'un `keystore`
- configuration `signingConfig`
- generation d'une version `release`
- generation d'un `AAB`
- icones et assets store si necessaire
- versioning final

## Ce qu'on peut encore ameliorer avant la version officielle

- UX mobile encore plus compacte
- animations de tir
- meilleur ecran de victoire / defaite
- optimisation visuelle de la grille
- sons / vibration
- meilleure gestion du reveil Render gratuit
- icones et splash plus premium
- ecran d'erreur reseau plus propre

## Resume

La version Android actuelle est une vraie adaptation mobile du jeu :

- base `Ionic + Angular + Capacitor`
- meme backend Node.js / Socket.io
- hebergement Render
- mode aleatoire et mode amis
- avatars, emoji, KO, absences, overlays, grille interactive
- version publique deja branchee sur le serveur distant

Elle est deja utilisable pour test reel.

La prochaine grande etape, si souhaite, est :

- stabilisation finale
- puis generation d'une version `Play Store release`
