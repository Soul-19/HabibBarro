# Mon site CV

Site statique : accueil (CV et lettre en PDF), projets avec fichiers, QR code, et une page d'administration.

## Mise en ligne (une seule fois, environ 15 minutes)

1. Créez un compte sur github.com si vous n'en avez pas.
2. Créez un dépôt **public** (bouton « New repository »). Nom conseillé : `votre-pseudo.github.io`, le site sera alors à l'adresse `https://votre-pseudo.github.io/`.
3. Dans le dépôt : « Add file », « Upload files », puis glissez **tout le contenu** de ce dossier (y compris les dossiers `assets`, `data`, `files` et le fichier `.nojekyll`). Validez avec « Commit changes ».
4. Settings, Pages : source « Deploy from a branch », branche `main`, dossier `/ (root)`. Attendez 1 à 2 minutes.
5. Ouvrez l'adresse du site. Elle est stable, donc le QR code ne changera jamais.

## Créer votre jeton d'administration

1. GitHub, Settings, Developer settings, Personal access tokens, **Fine-grained tokens**, « Generate new token ».
2. Repository access : « Only select repositories », choisissez votre dépôt.
3. Permissions, Repository permissions : **Contents : Read and write**.
4. Durée : la plus longue proposée. Copiez le jeton (il ne s'affiche qu'une fois).

## Modifier le site

Ouvrez `https://votre-adresse/admin.html`, saisissez votre nom d'utilisateur, le nom du dépôt et le jeton.

- **CV et lettre** : remplacez les PDF.
- **Projets** : ajoutez, modifiez, supprimez, réordonnez, joignez des fichiers.
- **Profil** : nom, présentation, compétences, contacts.

Chaque modification apparaît sur le site public en une minute environ. Le jeton reste dans votre navigateur ; déconnectez-vous sur un ordinateur partagé.

## QR code

Ouvrez `qr.html` sur le site en ligne, puis téléchargez le PNG (écran, document) ou le SVG (impression de qualité). Il encode l'adresse de la page d'où vous l'ouvrez.

## Limites à connaître

- Fichiers : 25 Mo maximum chacun. Les dépôts GitHub restent confortables sous 1 Go au total.
- Le dépôt doit être public pour l'hébergement gratuit : tout ce que vous téléversez est lisible par tous.
- Les trois projets d'exemple et les PDF `files/cv.pdf` et `files/lettre.pdf` sont des modèles à remplacer.
