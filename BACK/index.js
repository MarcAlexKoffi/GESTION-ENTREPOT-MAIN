const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestionentrepots',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log('Pool MySQL initialisé');

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
        status VARCHAR(50) DEFAULT 'A venir',
        entrepotId INT DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Patch Migration for Empotages (Fix schema mismatch)
    try {
       // Check if we have the old schema (french column names)
       const [cols] = await connection.query("SHOW COLUMNS FROM empotages LIKE 'nomClient'");
       if (cols.length > 0) {
          console.log("Migration de la table empotages (renommage colonnes)...");
          await connection.query("ALTER TABLE empotages CHANGE nomClient client VARCHAR(255) NULL");
          await connection.query("ALTER TABLE empotages CHANGE numeroBooking booking VARCHAR(255) NULL");
          await connection.query("ALTER TABLE empotages CHANGE nombreConteneurs conteneurs INT DEFAULT 0");
          await connection.query("ALTER TABLE empotages CHANGE volumeEmpote volume FLOAT DEFAULT 0");
          await connection.query("ALTER TABLE empotages CHANGE dateDebutEmpotage dateStart DATETIME NULL");
          await connection.query("ALTER TABLE empotages CHANGE dateFinEmpotage dateEnd DATETIME NULL");
       }
       
       // Ensure new columns exist
       try { await connection.query("ALTER TABLE empotages ADD COLUMN clientType VARCHAR(255) NULL"); } catch(e){}
       try { await connection.query("ALTER TABLE empotages ADD COLUMN status VARCHAR(50) DEFAULT 'A venir'"); } catch(e){}
       try { await connection.query("ALTER TABLE empotages ADD COLUMN entrepotId INT DEFAULT NULL"); } catch(e){}
       
    } catch (e) {
      console.error("Erreur migration empotages:", e);
    }

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
      SELECT u.id, u.nom, u.username, u.role, u.entrepotId, u.status, u.createdAt, w.name as entrepotName
      FROM users u
      LEFT JOIN warehouses w ON u.entrepotId = w.id
      ORDER BY u.createdAt DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur récupération utilisateurs' });
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
      return res.status(400).json({ message: 'L’image est trop lourde (max 2 Mo).' });
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
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
    rows.forEach(r => console.log(`ID: ${r.id}, Name: ${r.name}`));
    res.json(rows);
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
    res.json(rows[0]);
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
    imageUrl = `/uploads/${req.file.filename}`;
  }

  try {
    const [result] = await db.query(
      'INSERT INTO warehouses (name, location, imageUrl) VALUES (?, ?, ?)',
      [name, location, imageUrl]
    );
    res.status(201).json({ id: result.insertId, name, location, imageUrl });
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
      const imageUrl = `/uploads/${req.file.filename}`;
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
// Empotages API
// -----------------------

// GET /api/empotages - list with optional filters: q, status
app.get('/api/empotages', async (req, res) => {
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

    // Filtrage recherche (simple implementation in JS to keep consistent with previous behavior)
    // Mais idéalement, faire un LIKE en SQL
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

// GET /api/empotages/:id
app.get('/api/empotages/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM empotages WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Non trouvé' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur GET /api/empotages/:id', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/empotages - create
app.post('/api/empotages', async (req, res) => {
  try {
    console.log('POST /api/empotages body:', req.body);
    const { client, clientType, booking, conteneurs, volume, dateStart, dateEnd, status, entrepotId } = req.body;
    
    // Insertion directe dans la table empotages
    const [result] = await db.query(
      `INSERT INTO empotages (client, clientType, booking, conteneurs, volume, dateStart, dateEnd, status, entrepotId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client, clientType, booking, conteneurs || 0, volume || 0, dateStart || null, dateEnd || null, status || 'A venir', entrepotId || null]
    );

    const [newRow] = await db.query('SELECT * FROM empotages WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (err) {
    console.error('Erreur POST /api/empotages', err);
    res.status(500).json({ message: 'Erreur création empotage', error: err.message });
  }
});

// PUT /api/empotages/:id - update status/metadata
app.put('/api/empotages/:id', async (req, res) => {
  const { id } = req.params;
  const { status, client, booking, conteneurs, volume, dateStart, dateEnd, clientType, entrepotId } = req.body;
  
  try {
     // Construction dynamique de l'update
     const fields = [];
     const values = [];

     if (client !== undefined) { fields.push('client = ?'); values.push(client); }
     if (clientType !== undefined) { fields.push('clientType = ?'); values.push(clientType); }
     if (booking !== undefined) { fields.push('booking = ?'); values.push(booking); }
     if (conteneurs !== undefined) { fields.push('conteneurs = ?'); values.push(conteneurs); }
     if (volume !== undefined) { fields.push('volume = ?'); values.push(volume); }
     if (dateStart !== undefined) { fields.push('dateStart = ?'); values.push(dateStart); }
     if (dateEnd !== undefined) { fields.push('dateEnd = ?'); values.push(dateEnd); }
     if (status !== undefined) { fields.push('status = ?'); values.push(status); }
     if (entrepotId !== undefined) { fields.push('entrepotId = ?'); values.push(entrepotId); }

     if (fields.length === 0) return res.json({ message: 'Rien à mettre à jour' });
     
     values.push(id);
     await db.query(`UPDATE empotages SET ${fields.join(', ')} WHERE id = ?`, values);
     
     const [updated] = await db.query('SELECT * FROM empotages WHERE id = ?', [id]);
     if (updated.length === 0) return res.status(404).json({ message: 'Non trouvé' });
     res.json(updated[0]);
  } catch (err) {
    console.error('Erreur PUT /api/empotages/:id', err);
    res.status(500).json({ message: 'Erreur mise à jour' });
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
