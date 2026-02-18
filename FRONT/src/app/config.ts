// Détection automatique de l'environnement (Local ou Production)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const environment = {
  // En local on garde le port 3000
  // En ligne, tu devras mettre ici l'URL que Render va te donner (ex: https://mon-app.onrender.com/api)
  apiUrl: isLocal 
    ? 'http://localhost:3000/api' 
    : 'https://entrepotmanager.com/api'
};
