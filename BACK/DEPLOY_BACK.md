# Déploiement du backend Node.js sur cPanel (Application Manager)

Prérequis : accès cPanel (avec Node.js App Manager), accès SSH si disponible.

1) Préparer l'archive / dossier
- Assurez-vous que le dossier `BACK` contient `package.json` et `index.js`.
- Ne commitez pas vos vraies variables d'environnement : utilisez `.env` localement et reportez les valeurs dans cPanel.

2) Variables d'environnement
- Dans cPanel → **Setup Node.js App** → créez ou éditez l'application.
- Définissez `App Root` : le chemin vers le dossier `BACK` (où est `package.json`).
- `Startup File` : `index.js`.
- Ajoutez les variables d'environnement (`ALLOWED_ORIGINS`, `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `CLOUDINARY_*`, `NODE_ENV=production`).

3) Installer les dépendances
- Depuis l'UI de cPanel (Setup Node.js App) cliquez sur `NPM INSTALL` ou via cPanel Terminal/SSH :
```bash
cd path/to/app/root
npm install --production
```

4) Démarrer l'application
- Dans l'UI, cliquez `Start App`. cPanel indiquera l'`Application URL` et le port/proxy.

5) Logs et debugging
- Consultez `Error Log` / `Access Log` dans l'Application Manager.
- Test rapide :
```bash
curl -i https://votre-domaine.com/api/health
```

6) DNS / Routage
- Si vous voulez un sous-domaine `api.votredomaine.com`, créez le sous-domaine dans cPanel et pointez son `Document Root` vers l'App Node (ou utilisez le champ `Application URL` fourni).

7) Base de données distante
- Si la DB est hébergée ailleurs, ajoutez l'IP du serveur cPanel dans la whitelist de la DB.

8) Sécurité
- Activez SSL via cPanel (Let's Encrypt) pour le domaine et le sous-domaine.
- Vérifiez `ALLOWED_ORIGINS` et forcez HTTPS côté client et serveur si nécessaire.

9) Restart automatique
- cPanel redémarrera l'app si vous la stoppez/démarrez via l'UI. Pour redémarrages automatiques plus avancés, utilisez un gestionnaire externe si disponible.
