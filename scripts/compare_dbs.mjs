import sqlite3 from 'sqlite3';

function inspectDb(p) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(p, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve({ error: err.message });
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
        if (err) return resolve({ error: err.message });
        const res = {};
        let done = 0;
        if (!tables || tables.length === 0) return resolve(res);
        tables.forEach(t => {
          db.get(`SELECT count(*) as count FROM "${t.name}"`, [], (err, row) => {
            res[t.name] = row ? row.count : err?.message;
            done++;
            if (done === tables.length) {
              db.close();
              resolve(res);
            }
          });
        });
      });
    });
  });
}

async function run() {
  console.log('Local DB:', await inspectDb('prisma/neoconta.db'));
  console.log('VPS DB:', await inspectDb('backups/vps_live_production_snapshot/prisma/neoconta.db'));
}
run();
