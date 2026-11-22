// Where Meridian Loop keeps what changes: one JSON document.
// - DATABASE_URL set (Neon, Supabase or any Postgres): one row in table meridian_state, shared by every server
//   instance, so it survives restarts and works on Vercel and Render.
// - Otherwise a JSON file (data/state.json locally, /tmp on Vercel), written atomically.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function fileBackend() {
  const file = process.env.MERIDIAN_STATE || (process.env.VERCEL ? '/tmp/meridian-state.json' : path.join(here, '..', 'data', 'state.json'));
  return {
    kind: 'file',
    async load() {
      let raw;
      try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
      try { return JSON.parse(raw); } catch (err) {
        console.error(`State file unreadable (${err.message}); starting fresh and keeping a copy.`);
        try { fs.copyFileSync(file, `${file}.broken-${Date.now()}`); } catch { /* nothing to keep */ }
        return null;
      }
    },
    async save(data) {
      const tmp = `${file}.${process.pid}.tmp`;
      try { fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, file); }
      catch (err) { console.error(`Could not save state (${err.message}); keeping it in memory.`); }
    },
    async stamp() { try { return fs.statSync(file).mtimeMs; } catch { return 0; } },
  };
}

function pgBackend(url) {
  let pool;
  const db = async () => {
    if (pool) return pool;
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
    await pool.query('create table if not exists meridian_state (id int primary key, version bigint not null, data jsonb not null, updated_at timestamptz not null default now())');
    return pool;
  };
  return {
    kind: 'postgres',
    async load() {
      const r = await (await db()).query('select data from meridian_state where id = 1');
      return r.rows[0]?.data ?? null;
    },
    async save(data) {
      await (await db()).query(
        `insert into meridian_state (id, version, data) values (1, 1, $1)
         on conflict (id) do update set data = excluded.data, version = meridian_state.version + 1, updated_at = now()`,
        [JSON.stringify(data)],
      );
    },
    async stamp() {
      const r = await (await db()).query('select version from meridian_state where id = 1');
      return Number(r.rows[0]?.version ?? 0);
    },
  };
}

export const backend = process.env.DATABASE_URL ? pgBackend(process.env.DATABASE_URL) : fileBackend();
