require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();

// =======================
// Middlewares
// =======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================
// Database (MySQL Pool)
// =======================
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestionentrepots',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log('Pool MySQL initialisé');

// Helper pour corriger les URLs Cloudinary mal formées (problème local vs prod)
function fixCloudinaryUrl(url) {
  if (!url) return null;
  // Si l'URL commence par /uploads/gestion-entrepots-uploads/, c'est un chemin hybride local/cloud incorrect
  // On le transforme en URL Cloudinary complète
  if (url.startsWith('/uploads/gestion-entrepots-uploads/')) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (cloudName) {
      // On retire "/uploads/" du début
      const path = url.replace('/uploads/', ''); 
      return `https://res.cloudinary.com/${cloudName}/image/upload/${path}`;
    }
  }
  return url;
}

// Création de la table 'trucks' si elle n'existe pas
(async () => {
  try {
    const connection = await db.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS trucks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entrepotId INT NOT NULL,
        immatriculation VARCHAR(255) NOT NULL,
        transporteur VARCHAR(255) NOT NULL,
        transfert VARCHAR(255) NULL,
        cooperative VARCHAR(255) NULL,
        statut VARCHAR(50) DEFAULT 'Enregistré',
        heureArrivee DATETIME DEFAULT CURRENT_TIMESTAMP,
        heureDepart DATETIME NULL,
        poids FLOAT NULL,
        metadata TEXT NULL,
        FOREIGN KEY (entrepotId) REFERENCES warehouses(id) ON DELETE CASCADE
      )
    `);
    
    // Patchs migrations
    try {
      await connection.query("ALTER TABLE trucks ADD COLUMN metadata TEXT NULL");
    } catch (e) {}

    try {
      await connection.query("ALTER TABLE trucks CHANGE plaque immatriculation VARCHAR(255) NOT NULL");
      await connection.query("ALTER TABLE trucks CHANGE chauffeur transporteur VARCHAR(255) NOT NULL");
    } catch (e) {}

    try {
      await connection.query("ALTER TABLE trucks ADD COLUMN transfert VARCHAR(255) NULL");
      await connection.query("ALTER TABLE trucks ADD COLUMN cooperative VARCHAR(255) NULL");
      // Migration: MOVE data from old column if exists
      try {
        await connection.query("UPDATE trucks SET cooperative = coperative WHERE cooperative IS NULL AND coperative IS NOT NULL");
        console.log("Migration des données de coperative vers cooperative effectuée.");
      } catch (e) {}
      console.log("Migration colonnes transfert/cooperative effectuée.");
    } catch (e) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS empotages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client VARCHAR(255) NULL,
        clientType VARCHAR(255) NULL,
        booking VARCHAR(255) NULL,
        conteneurs INT DEFAULT 0,
        volume FLOAT DEFAULT 0,
        dateStart DATETIME NULL,
        dateEnd DATETIME NULL,
        status VARCHAR(50) DEFAULT 'En attente',
        entrepotId INT DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Nouvelle table pour les details des conteneurs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS empotage_containers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empotageId INT NOT NULL,
        numeroConteneur VARCHAR(255) NULL,
        nombreSacs INT DEFAULT 0,
        volume FLOAT DEFAULT 0,
        poids FLOAT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (empotageId) REFERENCES empotages(id) ON DELETE CASCADE
      )
    `);

    // Patch Migration for Empotages (Fix schema mismatch)
    try {
       console.log("Starting Robust Migration Check...");

       // Helper to rename if exists
       const renameIfExists = async (table, oldCol, newCol, type) => {
          try {
             const [check] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE '${oldCol}'`);
             if (check.length > 0) {
                 console.log(`Renaming ${oldCol} to ${newCol} in ${table}...`);
                 await connection.query(`ALTER TABLE ${table} CHANGE ${oldCol} ${newCol} ${type}`);
             }
          } catch(e) { console.error(`Error renaming ${oldCol}:`, e.message); }
       };

       await renameIfExists('empotages', 'nomClient', 'client', 'VARCHAR(255) NULL');
       await renameIfExists('empotages', 'numeroBooking', 'booking', 'VARCHAR(255) NULL');
       await renameIfExists('empotages', 'nombreConteneurs', 'conteneurs', 'INT DEFAULT 0');
       await renameIfExists('empotages', 'volumeEmpote', 'volume', 'FLOAT DEFAULT 0');
       await renameIfExists('empotages', 'dateDebutEmpotage', 'dateStart', 'DATETIME NULL');
       await renameIfExists('empotages', 'dateFinEmpotage', 'dateEnd', 'DATETIME NULL');
       
       // Ensure new columns exist
       try { await connection.query("ALTER TABLE empotages ADD COLUMN clientType VARCHAR(255) NULL"); } catch(e){}
       try { await connection.query("ALTER TABLE empotages ADD COLUMN status VARCHAR(50) DEFAULT 'En attente'"); } catch(e){}
       try { await connection.query("ALTER TABLE empotages ADD COLUMN entrepotId INT DEFAULT NULL"); } catch(e){}
       
    } catch (e) {
      console.error("Erreur migration empotages:", e);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT NOT NULL,
        isRead BOOLEAN DEFAULT FALSE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        relatedId INT NULL,
        type VARCHAR(50) NULL
      )
    `);

    // Aggressive Migration: Fix ID 0 and enforce AUTO_INCREMENT
    try {
      console.log("Début de la migration de réparation des ID...");
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");

      // Vérifier l'état actuel pour le log
      const [showResult] = await connection.query("SHOW CREATE TABLE trucks");
      console.log("État actuel de la table trucks:", showResult[0]['Create Table']);

      // 1. Réparer l'ID 0 s'il existe (le déplacer vers le haut)
      await connection.query("UPDATE trucks SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM trucks) as t) WHERE id = 0");
      
      // 2. Tenter de forcer AUTO_INCREMENT de plusieurs manières
      try {
        await connection.query("ALTER TABLE trucks MODIFY id INT NOT NULL AUTO_INCREMENT");
        console.log("ALTER TABLE trucks MODIFY id INT NOT NULL AUTO_INCREMENT : SUCCESS");
      } catch (e1) {
        console.error("Échec ALTER simple:", e1.message);
        try {
          // Si déjà PK, on essaie sans spécifier PK
          await connection.query("ALTER TABLE trucks CHANGE id id INT NOT NULL AUTO_INCREMENT");
          console.log("ALTER TABLE trucks CHANGE id id ... : SUCCESS");
        } catch (e2) {
          console.error("Échec ALTER change:", e2.message);
        }
      }

      // 3. Forcer le démarrage de l'auto_increment
      await connection.query("ALTER TABLE trucks AUTO_INCREMENT = 1");

      // Répéter pour warehouses et users par précaution
      await connection.query("UPDATE warehouses SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM warehouses) as w) WHERE id = 0");
      try { await connection.query("ALTER TABLE warehouses MODIFY id INT NOT NULL AUTO_INCREMENT"); } catch(e){}
      
      await connection.query("UPDATE users SET id = (SELECT COALESCE(MAX(id), 0) + 1 FROM (SELECT id FROM users) as u) WHERE id = 0");
      try { await connection.query("ALTER TABLE users MODIFY id INT NOT NULL AUTO_INCREMENT"); } catch(e){}

      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      console.log("Migration DB terminée.");

      // Vérifier l'état final
      const [finalShow] = await connection.query("SHOW CREATE TABLE trucks");
      console.log("État final de la table trucks:", finalShow[0]['Create Table']);

    } catch (e) {
      console.error("ERREUR CRITIQUE MIGRATION:", e);
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    console.log("Synchronisation terminée.");

    // =========================================================
    // Seed Default Admin
    const [users] = await connection.query("SELECT count(*) as count FROM users");
    if (users[0].count === 0) {
      await connection.query(`
        INSERT INTO users (nom, username, password, role, status)
        VALUES ('Administrateur', 'admin', 'admin123', 'admin', 'Actif')
      `);
      console.log("Admin par défaut créé");
    }
    
    console.log("Table 'users' vérifiée/créée");
    connection.release();

  } catch (err) {
    console.error("Erreur initialisation tables:", err);
    // connection might not be defined if db.getConnection fails, but if it is, we need to release it.
    // However, since 'connection' is scoped inside try, we can't release it in catch easily unless we decl outside.
    // For init scripts, crashing is acceptable or we just log.
  }
})(); 

// ... (Routes) ...

// POST Truck
app.post('/api/trucks', async (req, res) => {
  // On extrait explicitement les champs colonnes et les champs à exclure des métadonnées
  const { entrepotId, immatriculation, transporteur, transfert, cooperative, statut, poids, heureArrivee, createdAt, ...extras } = req.body;

  if (!entrepotId || !immatriculation || !transporteur) {
    return res.status(400).json({ message: 'Champs obligatoires manquants (entrepotId, immatriculation, transporteur)' });
  }

  // VALIDATION: Check if entrepot exists
  try {
     const [warehouseCheck] = await db.query('SELECT id FROM warehouses WHERE id = ?', [entrepotId]);
     if (warehouseCheck.length === 0) {
        return res.status(400).json({ message: 'Entrepôt invalide ou inexistant' });
     }
  } catch(e) {
     console.error("Validation Error:", e);
     return res.status(500).json({ message: 'Erreur validation entrepôt', error: e.message });
  }

    // Tout le reste part dans metadata (ex: history, kor, th, products object...)
    // Par défaut, un nouveau camion est "non lu" par l'admin
    const metadataObj = { ...extras, unreadForAdmin: true };
    const metadata = JSON.stringify(metadataObj);

    try {
        const [result] = await db.query(
            `INSERT INTO trucks (entrepotId, immatriculation, transporteur, transfert, cooperative, statut, poids, metadata, heureArrivee)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                entrepotId,
                immatriculation,
                transporteur,
                transfert || null,
                cooperative || null,
                statut || 'Enregistré',
                poids || null,
                metadata
            ]
        );

        res.status(201).json({
            id: result.insertId,
            entrepotId,
            immatriculation,
            transporteur,
            transfert,
            cooperative,
            statut: statut || 'Enregistré',
            poids,
            heureArrivee: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            unreadForAdmin: true,
            ...extras
        });
  } catch (err) {
    console.error('Erreur POST /api/trucks', err);
    res.status(500).json({ message: 'Erreur création camion' });
  }
});

// GET Trucks
app.get('/api/trucks', async (req, res) => {
  const { entrepotId } = req.query;
  console.log('GET /api/trucks called with entrepotId:', entrepotId);
  try {
    let query = 'SELECT *, heureArrivee as createdAt FROM trucks';
    const params = [];
    if (entrepotId !== undefined && entrepotId !== null && entrepotId !== '' && entrepotId !== 'undefined') {
      query += ' WHERE entrepotId = ?';
      params.push(parseInt(entrepotId, 10)); // Force INT
    } else if (req.query.hasOwnProperty('entrepotId')) {
      // Si un entrepotId est spécifié mais invalide (chaine vide ou undefined string), on ne retourne rien
      return res.json([]);
    }
    query += ' ORDER BY id DESC';
    
    const [rows] = await db.query(query, params);
    
    // Parse metadata
    const parsedRows = rows.map(row => {
      let extras = {};
      try {
        if (row.metadata) extras = JSON.parse(row.metadata);
      } catch (e) {}
      const { metadata, ...rest } = row;
      // Merge: columns (rest) take precedence over metadata (extras)
      // This prevents bad metadata (like heureArrivee string) from overwriting actual DB timestamp
      return { ...extras, ...rest };
    });
    
    res.json(parsedRows);
  } catch (err) {
    console.error('Erreur GET /api/trucks', err);
    res.status(500).json({ message: 'Erreur récupération camions' });
  }
});

// PUT Truck
app.put('/api/trucks/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    immatriculation, 
    transporteur, 
    transfert,
    cooperative,
    statut, 
    poids, 
    heureDepart, 
    ...extras 
  } = req.body;

  try {
    // 1. Récupérer les métadonnées actuelles pour fusion
    const [rows] = await db.query('SELECT metadata FROM trucks WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Camion non trouvé' });
    }
    
    let currentMeta = {};
    try {
      if (rows[0].metadata) currentMeta = JSON.parse(rows[0].metadata);
    } catch (e) {}

    // 2. Fusionner les extras dans metadata
    // Si l'admin modifie (statut validé/refoulé), on notifie le gérant
    // Si le gérant modifie (analyses envoyées), on notifie l'admin
    if (statut && (statut === 'Validé' || statut === 'Refoulé' || statut === 'Annulé')) {
        extras.unreadForGerant = true;
    } else if (statut === 'En attente') {
        extras.unreadForAdmin = true;
    }

    const finalMeta = { ...currentMeta, ...extras };
    const metadataStr = JSON.stringify(finalMeta);

    // 3. Update SQL
    // Note: COALESCE permet de ne pas écraser si undefined, mais attention si on veut nullifier.
    // Ici on assume simple update. Si undefined, on garde l'ancienne valeur ou on laisse SQL gérer si on construit la requête dynamiquement.
    // Pour simplifier, on update tout ce qui est fourni.
    
    const fields = [];
    const values = [];

    if (immatriculation !== undefined) { fields.push('immatriculation=?'); values.push(immatriculation); }
    if (transporteur !== undefined) { fields.push('transporteur=?'); values.push(transporteur); }
    if (transfert !== undefined) { fields.push('transfert=?'); values.push(transfert); }
    if (cooperative !== undefined) { fields.push('cooperative=?'); values.push(cooperative); }
    if (statut !== undefined) { fields.push('statut=?'); values.push(statut); }
    if (poids !== undefined) { fields.push('poids=?'); values.push(poids); }
    if (heureDepart !== undefined) { fields.push('heureDepart=?'); values.push(heureDepart); }
    
    fields.push('metadata=?'); values.push(metadataStr);

    values.push(id);

    await db.query(`UPDATE trucks SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ id, message: 'Camion mis à jour' });
  } catch (err) {
    console.error('Erreur PUT /api/trucks', err);
    res.status(500).json({ message: 'Erreur mise à jour camion' });
  }
});

// DELETE Truck
app.delete('/api/trucks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM trucks WHERE id = ?', [id]);
    res.json({ message: 'Camion supprimé' });
  } catch (err) {
    console.error('Erreur DELETE /api/trucks', err);
    res.status(500).json({ message: 'Erreur suppression camion' });
  }
});

// =======================
// Users & Auth
// =======================

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Identifiant et mot de passe requis' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    const user = rows[0];
    // TODO: Hash passwords in production!
    if (user.password !== password) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    if (user.status !== 'Actif') {
      return res.status(403).json({ message: 'Compte inactif ou suspendu' });
    }

    // Return user info (excluding password)
    const { password: _, ...userInfo } = user;
    res.json(userInfo);

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET Users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.nom, u.username, u.password, u.role, u.entrepotId, u.status, u.createdAt, w.name as entrepotName
      FROM users u
      LEFT JOIN warehouses w ON u.entrepotId = w.id
      ORDER BY u.createdAt DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur récupération utilisateurs' });
  }
});

// GET User by ID (Validation Endpoint)
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[DEBUG] GET /api/users/${id} called`);
  try {
    const [rows] = await db.query('SELECT id, nom, username, role, entrepotId, status FROM users WHERE id = ?', [id]);
    console.log(`[DEBUG] DB Result for user ${id}:`, rows.length > 0 ? 'Found' : 'Not Found');
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (rows[0].status !== 'Actif') {
        return res.status(403).json({ message: 'Compte inactif' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST User
app.post('/api/users', async (req, res) => {
  const { nom, username, password, role, entrepotId, status } = req.body;
  
  if (!nom || !username || !password || !role) {
    return res.status(400).json({ message: 'Champs obligatoires manquants' });
  }

  try {
    // Check uniqueness
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Cet identifiant est déjà utilisé' });
    }

    const [result] = await db.query(
      'INSERT INTO users (nom, username, password, role, entrepotId, status) VALUES (?, ?, ?, ?, ?, ?)',
      [nom, username, password, role, entrepotId || null, status || 'Actif']
    );

    res.status(201).json({ id: result.insertId, message: 'Utilisateur créé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur création utilisateur' });
  }
});

// PUT User
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { nom, username, password, role, entrepotId, status } = req.body;

  try {
    // Build update query dynamically to handle optional password update
    let query = 'UPDATE users SET nom=?, username=?, role=?, entrepotId=?, status=?';
    const params = [nom, username, role, entrepotId || null, status];

    if (password && password.trim() !== '') {
      query += ', password=?';
      params.push(password);
    }

    query += ' WHERE id=?';
    params.push(id);

    await db.query(query, params);
    res.json({ message: 'Utilisateur mis à jour' });
  } catch (err) {
    console.error(err);
    // Handle unique constraint error
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Identifiant déjà utilisé' });
    }
    res.status(500).json({ message: 'Erreur mise à jour utilisateur' });
  }
});

// DELETE User
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur suppression utilisateur' });
  }
});

// =======================
// Gestion Globale des Erreurs (Multer & autres)
// =======================
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'L’image est trop lourde (max 10 Mo).' });
    }
  }
  
  if (err.message === 'Format non autorisé. Seuls JPG et PNG sont acceptés.') {
    return res.status(400).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: 'Une erreur interne est survenue.' });
});

// =======================
// Warehouses
// =======================

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gestion-entrepots-uploads',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Format non autorisé. Seuls JPG et PNG sont acceptés.'));
    }
  }
});

// GET All Warehouses
app.get('/api/warehouses', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM warehouses ORDER BY id DESC');
    console.log("GET /api/warehouses response:");
    
    // Correction des URLs à la volée
    const fixedRows = rows.map(r => {
        const fixedUrl = fixCloudinaryUrl(r.imageUrl);
        return { ...r, imageUrl: fixedUrl };
    });

    fixedRows.forEach(r => console.log(`ID: ${r.id}, Name: ${r.name}, Img: ${r.imageUrl}`));
    res.json(fixedRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération entrepôts' });
  }
});

// GET One Warehouse
app.get('/api/warehouses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM warehouses WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Entrepôt non trouvé' });
    }
    const warehouse = rows[0];
    warehouse.imageUrl = fixCloudinaryUrl(warehouse.imageUrl);
    res.json(warehouse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération entrepôt' });
  }
});

// POST Warehouse (with image)
app.post('/api/warehouses', upload.single('image'), async (req, res) => {
  const { name, location } = req.body;
  if (!name || !location) {
    return res.status(400).json({ message: 'Nom et localisation requis' });
  }

  let imageUrl = '';
  if (req.file) {
    // Avec Cloudinary, l'URL complète est dans req.file.path
    imageUrl = req.file.path;
  }

  try {
    const [result] = await db.query(
      'INSERT INTO warehouses (name, location, imageUrl) VALUES (?, ?, ?)',
      [name, location, imageUrl]
    );
    // On renvoie l'URL corrigée au frontend immédiatement
    const finalUrl = fixCloudinaryUrl(imageUrl);
    res.status(201).json({ id: result.insertId, name, location, imageUrl: finalUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur création entrepôt' });
  }
});

// PUT Warehouse
app.put('/api/warehouses/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, location } = req.body;

  try {
    const fields = [];
    const values = [];

    if (name) { fields.push('name=?'); values.push(name); }
    if (location) { fields.push('location=?'); values.push(location); }
    
    if (req.file) {
      // Avec Cloudinary, l'URL complète est dans req.file.path
      const imageUrl = req.file.path;
      fields.push('imageUrl=?'); values.push(imageUrl);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à modifier' });
    }

    values.push(id);
    await db.query(`UPDATE warehouses SET ${fields.join(', ')} WHERE id = ?`, values);
    
    res.json({ message: 'Entrepôt mis à jour' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur mise à jour entrepôt' });
  }
});

// DELETE Warehouse
app.delete('/api/warehouses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM warehouses WHERE id = ?', [id]);
    res.json({ message: 'Entrepôt supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur suppression entrepôt' });
  }
});

// (server will be started after routes are defined)

// -----------------------
// Empotages API (Revised Logic)
// -----------------------

// GET /api/empotages - list empotages (Bookings)
app.get('/api/empotages', async (req, res) => {
  const { q = '', status, entrepotId } = req.query;
  try {
    let query = 'SELECT * FROM empotages WHERE 1=1';
    const params = [];

    if (entrepotId) {
      query += ' AND entrepotId = ?';
      params.push(entrepotId);
    }

    if (status && String(status).trim() !== '') {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY id DESC';

    const [rows] = await db.query(query, params);

    // Filtrage recherche côté serveur si possible, mais ici on garde le filter JS pour compatibilité like
    const filtered = rows.filter(item => {
      if (!q || String(q).trim() === '') return true;
      const qq = String(q).toLowerCase();
      return (
        String(item.client || '').toLowerCase().includes(qq) ||
        String(item.booking || '').toLowerCase().includes(qq)
      );
    });

    res.json(filtered);
  } catch (err) {
    console.error('Erreur GET /api/empotages', err);
    res.status(500).json({ message: 'Erreur récupération empotages' });
  }
});

// GET /api/empotages/:id - Get Booking with Detail Containers
app.get('/api/empotages/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get header
    const [rows] = await db.query('SELECT * FROM empotages WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Non trouvé' });
    
    const empotage = rows[0];

    // 2. Get containers details
    const [containers] = await db.query('SELECT * FROM empotage_containers WHERE empotageId = ? ORDER BY id ASC', [id]);
    
    empotage.containers = containers; // Attach details

    res.json(empotage);
  } catch (err) {
    console.error('Erreur GET /api/empotages/:id', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/empotages/init - Create Booking + 1st Container
app.post('/api/empotages/init', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { client, booking, nombreSacs, volume, poids, numeroConteneur, entrepotId } = req.body;

    // 1. Create Booking Header
    const dateStart = new Date();
    const [resHeader] = await connection.query(
      `INSERT INTO empotages (client, booking, conteneurs, volume, dateStart, status, entrepotId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [client, booking, 1, volume || 0, dateStart, 'En attente', entrepotId]
    );
    const empotageId = resHeader.insertId;

    // 2. Create First Container
    await connection.query(
      `INSERT INTO empotage_containers (empotageId, numeroConteneur, nombreSacs, volume, poids)
       VALUES (?, ?, ?, ?, ?)`,
      [empotageId, numeroConteneur, nombreSacs || 0, volume || 0, poids || 0]
    );

    // 3. Notification
    try {
        const msg = `Nouvel empotage démarré : ${client} / ${booking}`;
        await connection.query('INSERT INTO notifications (message, relatedId, type) VALUES (?, ?, ?)', [msg, empotageId, 'empotage']);
    } catch(e) {}

    await connection.commit();

    // Return full object
    const [rows] = await connection.query('SELECT * FROM empotages WHERE id = ?', [empotageId]);
    const empotage = rows[0];
    const [containers] = await connection.query('SELECT * FROM empotage_containers WHERE empotageId = ?', [empotageId]);
    empotage.containers = containers;

    res.status(201).json(empotage);

  } catch (err) {
    await connection.rollback();
    console.error('Erreur POST /api/empotages/init', err);
    res.status(500).json({ message: 'Erreur création empotage', error: err.message });
  } finally {
    connection.release();
  }
});


// POST /api/empotages/:id/add-container - Add next container
app.post('/api/empotages/:id/add-container', async (req, res) => {
  const empotageId = req.params.id;
  const { numeroConteneur, nombreSacs, volume, poids } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check status
    const [rows] = await connection.query('SELECT status, conteneurs, volume FROM empotages WHERE id = ?', [empotageId]);
    if (rows.length === 0) throw new Error('Empotage non trouvé');
    if (rows[0].status === 'Terminé') throw new Error('Empotage déjà terminé');

    // Add Container
    await connection.query(
      `INSERT INTO empotage_containers (empotageId, numeroConteneur, nombreSacs, volume, poids)
       VALUES (?, ?, ?, ?, ?)`,
      [empotageId, numeroConteneur, nombreSacs || 0, volume || 0, poids || 0]
    );

    // Update Header (increment count, add volume)
    const newCount = (rows[0].conteneurs || 0) + 1;
    const newVolume = (rows[0].volume || 0) + (volume ? parseFloat(volume) : 0);

    await connection.query('UPDATE empotages SET conteneurs = ?, volume = ? WHERE id = ?', [newCount, newVolume, empotageId]);

    await connection.commit();
    res.json({ message: 'Conteneur ajouté', empotageId, newCount });

  } catch (err) {
    await connection.rollback();
    console.error('Erreur add-container', err);
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
});

// PUT /api/empotages/:id/finalize - Finish Booking
app.put('/api/empotages/:id/finalize', async (req, res) => {
  const { id } = req.params;
  try {
    const dateEnd = new Date();
    await db.query('UPDATE empotages SET status = ?, dateEnd = ? WHERE id = ?', ['Terminé', dateEnd, id]);
    res.json({ message: 'Empotage terminé', dateEnd });
  } catch (err) {
    console.error('Erreur finalize', err);
    res.status(500).json({ message: 'Erreur finalisation' });
  }
});


// DELETE /api/empotages/:id
app.delete('/api/empotages/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM empotages WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Empotage non trouvé' });
    }
    res.json({ message: 'Empotage supprimé avec succès' });
  } catch (err) {
    console.error('Erreur DELETE /api/empotages/:id', err);
    res.status(500).json({ message: 'Erreur suppression empotage', error: err.message });
  }
});

// PUT /api/empotage-containers/:id - Update Container Details
app.put('/api/empotage-containers/:id', async (req, res) => {
  const { id } = req.params;
  const { numeroConteneur, nombreSacs, volume, poids } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get container to find parent booking
    const [existing] = await connection.query('SELECT empotageId, volume FROM empotage_containers WHERE id = ?', [id]);
    if (existing.length === 0) {
        connection.release();
        return res.status(404).json({ message: 'Conteneur non trouvé' });
    }
    const empotageId = existing[0].empotageId;
    const oldVolume = existing[0].volume || 0;

    // 2. Update Container
    await connection.query(
      'UPDATE empotage_containers SET numeroConteneur = ?, nombreSacs = ?, volume = ?, poids = ? WHERE id = ?',
      [numeroConteneur, nombreSacs, volume, poids, id]
    );

    // 3. Recalculate total volume for this booking
    const [rows] = await connection.query('SELECT SUM(volume) as totalVol FROM empotage_containers WHERE empotageId = ?', [empotageId]);
    const totalVol = rows[0].totalVol || 0;
    
    await connection.query('UPDATE empotages SET volume = ? WHERE id = ?', [totalVol, empotageId]);

    await connection.commit();
    res.json({ message: 'Conteneur mis à jour', totalVolume: totalVol });

  } catch (err) {
    await connection.rollback();
    console.error('Erreur update container', err);
    res.status(500).json({ message: 'Erreur mise à jour conteneur' });
  } finally {
    connection.release();
  }
});

// GET /api/empotages/export - returns CSV of filtered items
app.get('/api/empotages/export', async (req, res) => {
  const { q = '', status } = req.query;
  try {
    let query = 'SELECT * FROM empotages WHERE 1=1';
    const params = [];
    if (status && String(status).trim() !== '') {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY id DESC';

    const [rows] = await db.query(query, params);
    
    // Filtre textuel
    const filtered = rows.filter(item => {
      if (!q || String(q).trim() === '') return true;
      const qq = String(q).toLowerCase();
      return (
        String(item.client || '').toLowerCase().includes(qq) ||
        String(item.booking || '').toLowerCase().includes(qq)
      );
    });

    const headers = ['Client','Booking','Conteneurs','Volume','Début','Fin','Statut'];
    const escape = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const csv = [headers.join(',')]
      .concat(filtered.map(r => [r.client, r.booking, r.conteneurs, r.volume, r.dateStart, r.dateEnd, r.status].map(escape).join(',')))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="empotages-export.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Erreur export CSV', err);
    res.status(500).json({ message: 'Erreur export' });
  }
});

// GET /api/empotages/:id/export - Export details of a specific booking
app.get('/api/empotages/:id/export', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM empotages WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).send('Booking non trouvé');
    const booking = rows[0];

    const [containers] = await db.query('SELECT * FROM empotage_containers WHERE empotageId = ? ORDER BY id ASC', [id]);

    const headers = ['N° Conteneur', 'Nombre de sacs', 'Poids (kg)', 'Volume (m³)', 'Date Ajout'];
    const escape = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };

    const csvRows = containers.map(c => [
      c.numeroConteneur,
      c.nombreSacs,
      c.poids,
      c.volume,
      c.createdAt
    ].map(escape).join(','));

    // Construct CSV with Header Info first
    const csvContent = [
      `Client: ${booking.client}`,
      `Booking: ${booking.booking}`,
      `Statut: ${booking.status}`,
      '', // empty line
      headers.join(','),
      ...csvRows
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="booking-${booking.booking}.csv"`);
    res.send(csvContent);

  } catch (err) {
    console.error('Erreur export détail CSV', err);
    res.status(500).json({ message: 'Erreur export détail' });
  }
});

// -----------------------
// Notifications API
// -----------------------
app.get('/api/notifications', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM notifications WHERE isRead = 0 ORDER BY createdAt DESC LIMIT 50');
    res.json(rows);
  } catch (err) {
    console.error('Erreur GET /api/notifications', err);
    res.status(500).json({ message: 'Erreur notifications' });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE notifications SET isRead = 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur PUT /api/notifications/:id/read', err);
    res.status(500).json({ message: 'Erreur update notification' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
