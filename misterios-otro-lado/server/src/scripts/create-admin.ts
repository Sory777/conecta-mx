// Uso: npm run create-admin -- <usuario_o_email>
// Promueve una cuenta EXISTENTE a administrador (regístrala primero desde el juego).
// Se ejecuta en el servidor: nunca existe un "admin por defecto" ni credenciales en el código.
import { loadConfig } from '../config/env';
import { Db } from '../db/database';
import { newId } from '../lib/ids';

const login = process.argv[2];
const role = process.argv[3] ?? 'admin';
if (!login || !['admin', 'moderator', 'player'].includes(role)) {
  console.error('Uso: npm run create-admin -- <usuario_o_email> [admin|moderator|player]');
  process.exit(1);
}
const config = loadConfig();
const db = new Db(config.DATABASE_PATH);
db.migrate();
const u = db.get<{ id: string; username: string }>('SELECT id, username FROM users WHERE email = ? OR username = ? COLLATE NOCASE', login.toLowerCase(), login);
if (!u) {
  console.error(`No existe la cuenta "${login}". Regístrala primero en el juego.`);
  process.exit(1);
}
db.run('UPDATE users SET role = ? WHERE id = ?', role, u.id);
db.run(
  "INSERT INTO audit_log(id, actor_id, action, target_type, target_id, details, created_at) VALUES (?, NULL, 'cli_set_role', 'user', ?, ?, ?)",
  newId(),
  u.id,
  JSON.stringify({ role }),
  Date.now(),
);
console.log(`✔ ${u.username} ahora tiene rol "${role}".`);
db.close();
