# Guide de Déploiement cPanel - Gestion Entrepôt

Suivez ces étapes attentivement pour déployer votre application (Frontend Angular + Backend Node.js) sur votre hébergement cPanel.

## Pré-requis Important
- Accès à votre cPanel.
- Base de données créée (c'est fait !).
- **Importation de la structure :** Ouvrez **phpMyAdmin** dans cPanel, sélectionnez votre base `c2748430c_gestionentrepots`, cliquez sur **Importer**, et choisissez le fichier `BACK/db_init.sql` (ou `BACK/db_schema_output.txt` si c'est plus complet, mais `db_init.sql` semble être le bon). Cela créera les tables nécessaires.
- **Très important :** Vérifiez dans cPanel > "MySQL Databases" que votre utilisateur `c2748430c` est bien ajouté à la base `c2748430c_gestionentrepots` avec **TOUS LES PRIVILÈGES (All Privileges)** cochés. Sans cela, le site ne pourra pas se connecter.

---

## Étape 1 : Préparer le Backend (Node.js)

1. **Vérifier les fichiers :**
   - J'ai mis à jour le fichier `BACK/.env` avec vos identifiants de base de données.
   - Assurez-vous que le fichier `BACK/package.json` est correct (vérifié).

2. **Compresser le dossier BACK :**
   - Allez dans le dossier `GESTION-ENTREPOT-main`.
   - Entrez dans le dossier `BACK`.
   - Sélectionnez tous les fichiers **SAUF** le dossier `node_modules` (et évitez d'inclure les fichiers de test inutiles si possible, mais ce n'est pas grave).
   - Créez une archive ZIP nommée `back.zip` contenant ces fichiers à la racine de l'archive.

3. **Configurer l'application Node.js sur cPanel :**
   - Connectez-vous à cPanel.
   - Cherchez "Setup Node.js App" (Configurer une application Node.js).
   - Cliquez sur **Create Application**.
   - **Node.js version :** Choisissez la version recommandée (18.x ou 20.x, compatible avec votre projet).
   - **Application mode :** `Production`.
   - **Application root :** `gestion-entrepot-back` (ou le nom de dossier de votre choix).
   - **Application URL :** Choisissez votre domaine.
     - **Astuce Pro :** Pour éviter les conflits avec le Frontend, l'idéal est de déployer le backend sur un sous-domaine comme `api.votre-domaine.com`. Si vous faites cela, créez d'abord le sous-domaine dans cPanel.
     - Si vous utilisez le même domaine `votre-domaine.com`, l'application Node.js prendra le dessus. Il faudra peut-être ruser ou utiliser un sous-dossier, mais Node.js sur cPanel aime avoir son propre sous-domaine.
   - **Application startup file :** `index.js`.
   - Cliquez sur **Create**.

4. **Uploader les fichiers :**
   - Une fois l'application créée, cPanel a créé le dossier `gestion-entrepot-back`.
   - Allez dans le **Gestionnaire de fichiers** (File Manager) de cPanel.
   - Ouvrez le dossier `gestion-entrepot-back`.
   - Supprimez les fichiers par défaut (app.js, public, etc.) s'il y en a.
   - Cliquez sur **Upload** et envoyez votre fichier `back.zip`.
   - Faites un clic droit sur `back.zip` -> **Extract**.

5. **Installer les dépendances :**
   - Retournez dans "Setup Node.js App".
   - Cliquez sur le bouton **Run NPM Install**. Cela va installer les modules nécessaires (cela peut prendre quelques minutes).
   - Une fois fini, cliquez sur **Restart**.

---

## Étape 2 : Préparer le Frontend (Angular)

1. **Construire l'application :**
   - **Note :** Si vous n'avez jamais fait `npm install` dans le dossier FRONT, faites-le d'abord.
   - Ouvrez un terminal dans VS Code (dans le dossier `FRONT`).
   - Exécutez la commande : `npm run build`.
   - Cela va créer un dossier `dist/gestion-entrepot/browser` (ou juste `dist/gestion-entrepot` selon votre version Angular).

2. **Compresser le build :**
   - Allez dans le dossier créé `dist/gestion-entrepot/browser`.
   - Sélectionnez tout le contenu (index.html, styles.css, dossiers assets, etc.).
   - Créez une archive ZIP nommée `front.zip`.

3. **Configurer le fichier .htaccess (Routing) :**
   - Dans cPanel > Gestionnaire de fichiers, allez dans `public_html` (ou le dossier de votre domaine principal).
   - Créez un nouveau fichier nommé `.htaccess` (s'il n'existe pas déjà).
   - Ajoutez le code suivant pour gérer le routing Angular :

   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

4. **Uploader le Frontend :**
   - Toujours dans `public_html`, cliquez sur **Upload**.
   - Envoyez `front.zip`.
   - Extrayez le contenu (`Extract`). Assurez-vous que le fichier `index.html` est bien directement dans `public_html`.

---

## Étape 3 : Vérifier la connexion API

**Scénario A : Backend sur un sous-domaine (Recommandé)**
- Vous avez mis Node.js sur `api.votre-domaine.com`.
- Vous devez modifier `FRONT/src/app/config.ts` :
  remplacez `'/api'` par `'https://api.votre-domaine.com'`.
- Reconstruisez (`npm run build`) et ré-uploadez le frontend.

**Scénario B : Backend et Frontend sur le même domaine**
- Si Node.js tourne sur un port (ex: 3000) mais que cPanel ne mappe pas `/api` dessus automatiquement.
- Vous devrez peut-être ajouter une règle de Proxy dans le `.htaccess` du Frontend :
  ```apache
  RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P,L]
  ```
  *(Remplacez 3000 par le port indiqué dans votre app Node.js sur cPanel).*

Pour commencer, essayez de déployer le backend sur un sous-domaine `api`, c'est le plus simple et le plus propre !

Bon déploiement !
