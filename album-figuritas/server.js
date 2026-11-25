const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Función nativa para encriptar contraseñas (SHA-256)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('Error al conectar SQLite:', err.message);
  else console.log('Conectado a la base de datos SQLite.');
});

db.serialize(() => {
  // Tabla usuarios con contraseña encriptada
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    usuario_id INTEGER DEFAULT NULL,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS figuritas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER,
    nombre TEXT NOT NULL,
    imagen TEXT NOT NULL,
    pegada INTEGER DEFAULT 0,
    FOREIGN KEY(album_id) REFERENCES albums(id)
  )`);

  // Cargar ejemplos públicos si la base está vacía
  db.get('SELECT COUNT(*) AS count FROM albums', (err, row) => {
    if (row && row.count === 0) {
      db.run("INSERT INTO albums (nombre, descripcion, usuario_id) VALUES ('Ferrari Clásicos', 'Modelos históricos de Maranello', NULL)", function () {
        const ferrariId = this.lastID;
        const stmt = db.prepare("INSERT INTO figuritas (album_id, nombre, imagen, pegada) VALUES (?, ?, ?, ?)");
        stmt.run(ferrariId, 'Ferrari F40', 'https://upload.wikimedia.org/wikipedia/commons/1/10/Ferrari_F40_7.jpg?utm_source=es.wikipedia.org&utm_campaign=index&utm_content=original', 1);
        stmt.run(ferrariId, 'Ferrari Testarossa', 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=400', 0);
        stmt.run(ferrariId, 'Ferrari Enzo', 'https://images.unsplash.com/photo-1503376713356-ab7090754965?w=400', 0);
        stmt.finalize();
      });

      db.run("INSERT INTO albums (nombre, descripcion, usuario_id) VALUES ('Porsche Motorsport', 'Iconos alemanes de pista y calle', NULL)", function () {
        const porscheId = this.lastID;
        const stmt = db.prepare("INSERT INTO figuritas (album_id, nombre, imagen, pegada) VALUES (?, ?, ?, ?)");
        stmt.run(porscheId, 'Porsche 911 GT3', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400', 1);
        stmt.run(porscheId, 'Porsche Taycan', 'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?w=400', 0);
        stmt.finalize();
      });
    }
  });
});

// RUTAS DE LA API

// Login / Registro automático con contraseña
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim() || !password || !password.trim()) {
    return res.status(400).json({ error: 'Completá usuario y contraseña' });
  }

  const cleanName = username.trim();
  const hashed = hashPassword(password.trim());

  db.get('SELECT * FROM usuarios WHERE username = ?', [cleanName], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    // Si el usuario ya existe, validar contraseña
    if (row) {
      if (row.password !== hashed) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
      return res.json({ id: row.id, username: row.username });
    }

    // Si no existe, registrarlo automáticamente
    db.run('INSERT INTO usuarios (username, password) VALUES (?, ?)', [cleanName, hashed], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, username: cleanName });
    });
  });
});

app.get('/api/albums', (req, res) => {
  const usuarioId = req.query.usuario_id;
  let query = 'SELECT * FROM albums WHERE usuario_id IS NULL';
  let params = [];

  if (usuarioId) {
    query = 'SELECT * FROM albums WHERE usuario_id IS NULL OR usuario_id = ?';
    params = [usuarioId];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/albums', (req, res) => {
  const { nombre, descripcion, usuario_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const userId = usuario_id || null;

  db.run('INSERT INTO albums (nombre, descripcion, usuario_id) VALUES (?, ?, ?)', [nombre, descripcion, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, nombre, descripcion, usuario_id: userId });
  });
});

app.get('/api/albums/:id/figuritas', (req, res) => {
  db.all('SELECT * FROM figuritas WHERE album_id = ?', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/albums/:id/figuritas', (req, res) => {
  const { nombre, imagen } = req.body;
  const imgUrl = imagen || 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400';

  db.run(
    'INSERT INTO figuritas (album_id, nombre, imagen, pegada) VALUES (?, ?, ?, 0)',
    [req.params.id, nombre, imgUrl],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, album_id: req.params.id, nombre, imagen: imgUrl, pegada: 0 });
    }
  );
});

app.put('/api/figuritas/:id/toggle', (req, res) => {
  db.run('UPDATE figuritas SET pegada = CASE WHEN pegada = 1 THEN 0 ELSE 1 END WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});