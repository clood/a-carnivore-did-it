# Le coupable est… carnivore – PWA hors ligne

## Contenu
- Application installable sur Android/iOS depuis le navigateur.
- Fonctionnement hors ligne après le premier chargement.
- Vérification silencieuse de `version.json` au lancement quand un réseau est disponible.
- Tirage sans répétition par dossier via `localStorage`.
- Chronomètre, paliers colorés, sélection et vérification des coupables.
- Sauvegarde automatique de l'affaire, du temps, de l'écran et des suspects sélectionnés.
- Confirmation avant de quitter une affaire ; Retour ferme l'aide ou revient à l'affaire depuis la vérification et les résultats.
- Chronomètre avec pause et reprise ; mise en pause automatique lorsque l'application passe en arrière-plan. Après rechargement, il reste en pause.
- Interface et aide en français (par défaut) et en anglais, disponibles hors ligne ; langue choisie mémorisée sur l'appareil.
- Données générées depuis `carnivore_contenu.xlsx`.

## Reprise d'une partie
La dernière affaire est restaurée automatiquement au lancement. Après confirmation de sortie, l'accueil propose également « Reprendre l'affaire en cours ». Ouvrir une nouvelle affaire remplace cette sauvegarde. Elle reste locale au navigateur et disparaît si ses données sont effacées.

Le geste Retour est intercepté dans l'historique du navigateur pendant une affaire. Une sortie confirmée revient à l'accueil en conservant la partie. Le navigateur ou le système peut toujours fermer l'application : la sauvegarde permet alors de la reprendre.

## Traductions
Les textes de l'interface et de l'aide se trouvent dans `locales/fr.json` et `locales/en.json`. Les clés doivent être identiques ; les paramètres utilisent `{count}`, `{number}`, etc. `helpHtml` contient uniquement du HTML statique de confiance. Les illustrations des cartes physiques restent inchangées.

Le bouton drapeau à gauche de l'aide ouvre le choix de langue, sans libellé visible. Les noms des langues restent accessibles aux lecteurs d'écran et au survol.

Pour ajouter une langue, créer son dictionnaire avec les mêmes clés, ajouter son code dans `LANGUAGES` dans `app.js`, son image `assets/flag-CODE.svg` et un bouton `data-language="CODE"` dans le sélecteur de `index.html`. Ajouter le dictionnaire et l'image à `ASSETS` dans `sw.js`. Incrémenter ensuite les versions pour diffuser la mise à jour.

## Tests
Sans dépendance supplémentaire, avec Node.js 18 ou ultérieur :

```bash
node --test tests/app.test.cjs
```

## Lancer localement
Un Service Worker exige HTTP(S), pas l'ouverture directe de `index.html`.

```bash
python3 -m http.server 8080
```
Puis ouvrir `http://localhost:8080/` si le dossier se trouve dans le répertoire servi.

## Déployer
Copier le contenu du dossier sur un hébergement HTTPS statique, par exemple GitHub Pages, Azure Static Web Apps ou un serveur web interne.

## Mise à jour
1. Modifier les fichiers.
2. Incrémenter la version dans `version.json`.
3. Changer le nom `CACHE` dans `sw.js`, par exemple `carnivore-v1.0.1`.
4. Redéployer. Au lancement avec réseau, l'application détecte la version et recharge silencieusement.

## Données sources
Les données sont issues de scan et de données de réponse de l'éditeur. 
/!\ L'éditeur a publié un errata sur les premières éditions.
Seules les 25 premières affaires ont été scannées, il peut y avoir des erreurs, les affaires sont accessibles et modifiables sur

[sheet a_carnivore_did_it](https://docs.google.com/spreadsheets/d/12a2PZKdxw25PNHDg6NR68y-tUDkBhznA/edit?usp=drivesdk&ouid=101878875319326491532&rtpof=true&sd=true)


## Droit d'utilisation
Les illustrations et marques restent la propriété de leurs ayants droit. Vérifier les autorisations avant toute diffusion publique.
