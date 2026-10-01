require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET;
const backendDirectory = path.dirname(require.resolve('./server.js'));

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe estar definido y tener al menos 32 caracteres.');
}

const databasePath = path.resolve(
  process.env.SQLITE_PATH || path.join(backendDirectory, 'data', 'cacaoapp.sqlite'),
);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    telefono TEXT,
    municipio TEXT,
    password_hash TEXT NOT NULL,
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fincas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rutas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    puntos INTEGER NOT NULL DEFAULT 0 CHECK (puntos >= 0),
    guardada TEXT NOT NULL DEFAULT 'servidor',
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registros_calidad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    finca_id INTEGER NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    humedad REAL NOT NULL CHECK (humedad >= 0),
    fermentacion INTEGER NOT NULL CHECK (fermentacion >= 0),
    temperatura REAL NOT NULL DEFAULT 0,
    observaciones TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL CHECK (
      estado IN ('bien_fermentado', 'parcial', 'sin_fermentar')
    ),
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '32kb' }));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requiredString(value, label, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label} es obligatorio.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${label} no puede superar ${maxLength} caracteres.`);
  }
  return trimmed;
}

function optionalString(value, label, maxLength = 200) {
  if (value == null || value === '') return null;
  return requiredString(value, label, maxLength);
}

function numberValue(value, label, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, `${label} debe ser un número entre ${min} y ${max}.`);
  }
  return number;
}

function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, 'El identificador no es válido.');
  }
  return id;
}

function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';
  if (!token) return next(new HttpError(401, 'Debes iniciar sesión.'));

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.userId = positiveId(payload.sub);
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    next(new HttpError(401, 'La sesión no es válida o ha expirado.'));
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function issueToken(user) {
  return jwt.sign({ sub: String(user.id) }, jwtSecret, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user.id, nombre: user.nombre, email: user.email };
}

function fincaResponse(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    lat: row.lat,
    lng: row.lng,
  };
}

function routeResponse(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    finca: row.finca,
    fincaId: row.finca_id,
    puntos: row.puntos,
    guardada: row.guardada,
  };
}

function qualityResponse(row) {
  return {
    id: row.id,
    finca: row.finca,
    fincaId: row.finca_id,
    fecha: row.fecha,
    humedad: row.humedad,
    fermentacion: row.fermentacion,
    temperatura: row.temperatura,
    observaciones: row.observaciones,
    estado: row.estado,
  };
}

const selectRoutes = db.prepare(`
  SELECT r.*, f.nombre AS finca
  FROM rutas r
  JOIN fincas f ON f.id = r.finca_id
  WHERE r.usuario_id = ?
  ORDER BY r.id DESC
`);
const selectQualityRecords = db.prepare(`
  SELECT q.*, f.nombre AS finca
  FROM registros_calidad q
  JOIN fincas f ON f.id = q.finca_id
  WHERE q.usuario_id = ?
  ORDER BY q.id DESC
`);

function requireOwnedFinca(userId, fincaId) {
  const finca = db
    .prepare('SELECT id, nombre FROM fincas WHERE id = ? AND usuario_id = ?')
    .get(fincaId, userId);
  if (!finca) throw new HttpError(400, 'La finca seleccionada no existe.');
  return finca;
}

function parseFinca(data, current = {}) {
  const source = { ...current, ...data };
  return {
    nombre: requiredString(source.nombre, 'El nombre', 120),
    lat: numberValue(source.lat, 'La latitud', { min: -90, max: 90 }),
    lng: numberValue(source.lng, 'La longitud', { min: -180, max: 180 }),
  };
}

function parseRoute(data, current = {}) {
  const source = { ...current, ...data };
  return {
    nombre: requiredString(source.nombre, 'El nombre', 120),
    fincaId: positiveId(source.fincaId),
    puntos: numberValue(source.puntos, 'Los puntos GPS', { min: 0, max: 1000000 }),
  };
}

const qualityStates = ['bien_fermentado', 'parcial', 'sin_fermentar'];

function parseQuality(data, current = {}) {
  const source = { ...current, ...data };
  const estado = requiredString(source.estado, 'El estado', 40);
  if (!qualityStates.includes(estado)) {
    throw new HttpError(400, 'El estado de fermentación no es válido.');
  }
  const fecha = requiredString(source.fecha, 'La fecha', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
    throw new HttpError(400, 'La fecha debe tener el formato YYYY-MM-DD.');
  }
  const observaciones = source.observaciones ?? '';
  if (typeof observaciones !== 'string' || observaciones.length > 2000) {
    throw new HttpError(400, 'Las observaciones no pueden superar 2000 caracteres.');
  }
  return {
    fincaId: positiveId(source.fincaId),
    fecha,
    humedad: numberValue(source.humedad, 'La humedad', { min: 0, max: 100 }),
    fermentacion: numberValue(source.fermentacion, 'Los días de fermentación', {
      min: 0,
      max: 365,
    }),
    temperatura: numberValue(source.temperatura, 'La temperatura', {
      min: -50,
      max: 150,
    }),
    observaciones: observaciones.trim(),
    estado,
  };
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const nombre = requiredString(req.body.nombre, 'El nombre', 120);
  const email = requiredString(req.body.email, 'El correo', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'El correo electrónico no es válido.');
  }
  const password = requiredString(req.body.password, 'La contraseña', 128);
  if (password.length < 6) {
    throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres.');
  }
  const telefono = optionalString(req.body.telefono, 'El teléfono', 40);
  const municipio = optionalString(req.body.municipio, 'El municipio', 120);
  const passwordHash = await bcrypt.hash(password, 12);

  const result = db.prepare(`
    INSERT INTO usuarios (nombre, email, telefono, municipio, password_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(nombre, email, telefono, municipio, passwordHash);
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ usuario: publicUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = requiredString(req.body.email, 'El correo', 254).toLowerCase();
  const password = requiredString(req.body.password, 'La contraseña', 128);
  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  res.json({ token: issueToken(user), usuario: publicUser(user) });
}));

app.use('/api/fincas', authenticate);
app.get('/api/fincas', (req, res) => {
  const rows = db.prepare('SELECT * FROM fincas WHERE usuario_id = ? ORDER BY id DESC')
    .all(req.userId);
  res.json(rows.map(fincaResponse));
});
app.get('/api/fincas/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM fincas WHERE id = ? AND usuario_id = ?')
    .get(positiveId(req.params.id), req.userId);
  if (!row) throw new HttpError(404, 'No se encontró la finca.');
  res.json(fincaResponse(row));
});
app.post('/api/fincas', (req, res) => {
  const finca = parseFinca(req.body);
  const result = db.prepare(`
    INSERT INTO fincas (usuario_id, nombre, lat, lng) VALUES (?, ?, ?, ?)
  `).run(req.userId, finca.nombre, finca.lat, finca.lng);
  const row = db.prepare('SELECT * FROM fincas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(fincaResponse(row));
});
app.patch('/api/fincas/:id', (req, res) => {
  const id = positiveId(req.params.id);
  const current = db.prepare('SELECT * FROM fincas WHERE id = ? AND usuario_id = ?')
    .get(id, req.userId);
  if (!current) throw new HttpError(404, 'No se encontró la finca.');
  const finca = parseFinca(req.body, current);
  db.prepare('UPDATE fincas SET nombre = ?, lat = ?, lng = ? WHERE id = ? AND usuario_id = ?')
    .run(finca.nombre, finca.lat, finca.lng, id, req.userId);
  res.json(fincaResponse(db.prepare('SELECT * FROM fincas WHERE id = ?').get(id)));
});
app.delete('/api/fincas/:id', (req, res) => {
  db.prepare('DELETE FROM fincas WHERE id = ? AND usuario_id = ?')
    .run(positiveId(req.params.id), req.userId);
  res.sendStatus(204);
});

app.use('/api/rutas', authenticate);
app.get('/api/rutas', (req, res) => {
  res.json(selectRoutes.all(req.userId).map(routeResponse));
});
app.get('/api/rutas/:id', (req, res) => {
  const row = selectRoutes.all(req.userId).find(
    (route) => route.id === positiveId(req.params.id),
  );
  if (!row) throw new HttpError(404, 'No se encontró la ruta.');
  res.json(routeResponse(row));
});
app.post('/api/rutas', (req, res) => {
  const route = parseRoute(req.body);
  requireOwnedFinca(req.userId, route.fincaId);
  const result = db.prepare(`
    INSERT INTO rutas (usuario_id, finca_id, nombre, puntos)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, route.fincaId, route.nombre, route.puntos);
  res.status(201).json(
    routeResponse(selectRoutes.all(req.userId).find((item) => item.id === result.lastInsertRowid)),
  );
});
app.patch('/api/rutas/:id', (req, res) => {
  const id = positiveId(req.params.id);
  const current = selectRoutes.all(req.userId).find((route) => route.id === id);
  if (!current) throw new HttpError(404, 'No se encontró la ruta.');
  const route = parseRoute(req.body, {
    nombre: current.nombre,
    fincaId: current.finca_id,
    puntos: current.puntos,
  });
  requireOwnedFinca(req.userId, route.fincaId);
  db.prepare(`
    UPDATE rutas SET nombre = ?, finca_id = ?, puntos = ?
    WHERE id = ? AND usuario_id = ?
  `).run(route.nombre, route.fincaId, route.puntos, id, req.userId);
  res.json(routeResponse(selectRoutes.all(req.userId).find((item) => item.id === id)));
});
app.delete('/api/rutas/:id', (req, res) => {
  const result = db.prepare('DELETE FROM rutas WHERE id = ? AND usuario_id = ?')
    .run(positiveId(req.params.id), req.userId);
  if (!result.changes) throw new HttpError(404, 'No se encontró la ruta.');
  res.sendStatus(204);
});

app.use('/api/calidad', authenticate);
app.get('/api/calidad', (req, res) => {
  res.json(selectQualityRecords.all(req.userId).map(qualityResponse));
});
app.get('/api/calidad/:id', (req, res) => {
  const row = selectQualityRecords.all(req.userId).find(
    (record) => record.id === positiveId(req.params.id),
  );
  if (!row) throw new HttpError(404, 'No se encontró el registro de calidad.');
  res.json(qualityResponse(row));
});
app.post('/api/calidad', (req, res) => {
  const record = parseQuality(req.body);
  requireOwnedFinca(req.userId, record.fincaId);
  const result = db.prepare(`
    INSERT INTO registros_calidad (
      usuario_id, finca_id, fecha, humedad, fermentacion, temperatura, observaciones, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.userId,
    record.fincaId,
    record.fecha,
    record.humedad,
    record.fermentacion,
    record.temperatura,
    record.observaciones,
    record.estado,
  );
  res.status(201).json(
    qualityResponse(
      selectQualityRecords.all(req.userId).find((item) => item.id === result.lastInsertRowid),
    ),
  );
});
app.patch('/api/calidad/:id', (req, res) => {
  const id = positiveId(req.params.id);
  const current = selectQualityRecords.all(req.userId).find((record) => record.id === id);
  if (!current) throw new HttpError(404, 'No se encontró el registro de calidad.');
  const record = parseQuality(req.body, {
    fincaId: current.finca_id,
    fecha: current.fecha,
    humedad: current.humedad,
    fermentacion: current.fermentacion,
    temperatura: current.temperatura,
    observaciones: current.observaciones,
    estado: current.estado,
  });
  requireOwnedFinca(req.userId, record.fincaId);
  db.prepare(`
    UPDATE registros_calidad
    SET finca_id = ?, fecha = ?, humedad = ?, fermentacion = ?,
        temperatura = ?, observaciones = ?, estado = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    record.fincaId,
    record.fecha,
    record.humedad,
    record.fermentacion,
    record.temperatura,
    record.observaciones,
    record.estado,
    id,
    req.userId,
  );
  res.json(
    qualityResponse(selectQualityRecords.all(req.userId).find((item) => item.id === id)),
  );
});
app.delete('/api/calidad/:id', (req, res) => {
  const result = db.prepare('DELETE FROM registros_calidad WHERE id = ? AND usuario_id = ?')
    .run(positiveId(req.params.id), req.userId);
  if (!result.changes) throw new HttpError(404, 'No se encontró el registro de calidad.');
  res.sendStatus(204);
});

app.use((req, res, next) => next(new HttpError(404, 'El endpoint solicitado no existe.')));
app.use((error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'El cuerpo JSON de la solicitud no es válido.' });
  }
  console.error('Error en la API:', error);
  res.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`CacaoApp API disponible en http://localhost:${port}/api`);
  console.log(`Base SQLite: ${databasePath}`);
});
