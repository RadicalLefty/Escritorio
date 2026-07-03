import sqlite3 from 'sqlite3';
import path from 'path';
import pg from 'pg';
import { encrypt, decrypt } from './crypto.js';
import { Scene, ScriptBlock, StoryboardFrame, Sketch } from '../src/types.js';

// Setup database clients dynamically based on environment
let pgPool: pg.Pool | null = null;
let db: sqlite3.Database | null = null;

if (process.env.DATABASE_URL) {
  console.log('Database URL detected. Initializing PostgreSQL pool for Neon...');
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Neon requires SSL connection
    },
  });

  pgPool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  // Initialize Postgres tables asynchronously
  initPgTables();
} else {
  console.log('No Database URL found. Initializing local SQLite database...');
  const dbPath = path.join(process.cwd(), 'storage.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to connect to SQLite database:', err);
    } else {
      console.log('Connected to SQLite database at:', dbPath);
      initSqliteTables();
    }
  });
}

async function initPgTables() {
  if (!pgPool) return;
  try {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id VARCHAR(255) PRIMARY KEY,
          name TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS project_data (
          project_id VARCHAR(255) PRIMARY KEY,
          scenes TEXT NOT NULL,
          script_blocks TEXT NOT NULL,
          storyboard_frames TEXT NOT NULL,
          sketches TEXT NOT NULL,
          CONSTRAINT fk_project FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      console.log('PostgreSQL tables checked/created successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to initialize PostgreSQL tables on Neon:', err);
  }
}

function initSqliteTables() {
  if (!db) return;
  db.serialize(() => {
    db!.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    db!.run(`
      CREATE TABLE IF NOT EXISTS project_data (
        project_id TEXT PRIMARY KEY,
        scenes TEXT NOT NULL,
        script_blocks TEXT NOT NULL,
        storyboard_frames TEXT NOT NULL,
        sketches TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
  });
}

export interface ProjectRow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export async function getProjects(): Promise<ProjectRow[]> {
  if (pgPool) {
    const result = await pgPool.query('SELECT * FROM projects ORDER BY updated_at DESC');
    return result.rows.map((row) => ({
      id: row.id,
      name: decrypt(row.name),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }));
  } else {
    return new Promise((resolve, reject) => {
      db!.all('SELECT * FROM projects ORDER BY updated_at DESC', (err, rows: any[]) => {
        if (err) {
          return reject(err);
        }
        const projects = rows.map((row) => ({
          id: row.id,
          name: decrypt(row.name),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        resolve(projects);
      });
    });
  }
}

export async function createProject(id: string, name: string): Promise<void> {
  const encryptedName = encrypt(name);
  const now = Date.now();
  
  // Initial structures
  const scenes: Scene[] = [{ id: 'scene-1', title: 'Scene 1: Introduction', order: 0 }];
  const scriptBlocks: ScriptBlock[] = [
    { id: 'block-1', type: 'scene-heading', text: 'INT. COWORKING OFFICE - DAY', sceneId: 'scene-1' },
    { id: 'block-2', type: 'action', text: 'Two writers hunch over a minimalist drafting app on an active server.', sceneId: 'scene-1' },
    { id: 'block-3', type: 'character', text: 'SARAH', sceneId: 'scene-1' },
    { id: 'block-4', type: 'dialogue', text: 'Did you see? The changes are syncing in real time.', sceneId: 'scene-1' }
  ];
  const storyboardFrames: StoryboardFrame[] = [
    { id: 'frame-1', sceneId: 'scene-1', strokes: [], caption: 'Over the shoulder shot of Sarah looking at the screen.', order: 0 }
  ];
  const sketches: Sketch[] = [];

  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO projects (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [id, encryptedName, now, now]
      );
      await client.query(
        'INSERT INTO project_data (project_id, scenes, script_blocks, storyboard_frames, sketches) VALUES ($1, $2, $3, $4, $5)',
        [
          id,
          encrypt(JSON.stringify(scenes)),
          encrypt(JSON.stringify(scriptBlocks)),
          encrypt(JSON.stringify(storyboardFrames)),
          encrypt(JSON.stringify(sketches))
        ]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    return new Promise((resolve, reject) => {
      db!.serialize(() => {
        db!.run('BEGIN TRANSACTION');

        db!.run(
          'INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [id, encryptedName, now, now],
          (err) => {
            if (err) {
              db!.run('ROLLBACK');
              return reject(err);
            }
          }
        );

        db!.run(
          'INSERT INTO project_data (project_id, scenes, script_blocks, storyboard_frames, sketches) VALUES (?, ?, ?, ?, ?)',
          [
            id,
            encrypt(JSON.stringify(scenes)),
            encrypt(JSON.stringify(scriptBlocks)),
            encrypt(JSON.stringify(storyboardFrames)),
            encrypt(JSON.stringify(sketches))
          ],
          (err) => {
            if (err) {
              db!.run('ROLLBACK');
              return reject(err);
            }
            db!.run('COMMIT');
            resolve();
          }
        );
      });
    });
  }
}

export async function getProjectData(id: string): Promise<{
  scenes: Scene[];
  scriptBlocks: ScriptBlock[];
  storyboardFrames: StoryboardFrame[];
  sketches: Sketch[];
}> {
  if (pgPool) {
    const result = await pgPool.query('SELECT * FROM project_data WHERE project_id = $1', [id]);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Project not found');
    }
    try {
      const scenes = JSON.parse(decrypt(row.scenes)) as Scene[];
      const scriptBlocks = JSON.parse(decrypt(row.script_blocks)) as ScriptBlock[];
      const storyboardFrames = JSON.parse(decrypt(row.storyboard_frames)) as StoryboardFrame[];
      const sketches = JSON.parse(decrypt(row.sketches)) as Sketch[];
      return { scenes, scriptBlocks, storyboardFrames, sketches };
    } catch (err) {
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      db!.get('SELECT * FROM project_data WHERE project_id = ?', [id], (err, row: any) => {
        if (err) {
          return reject(err);
        }
        if (!row) {
          return reject(new Error('Project not found'));
        }
        try {
          const scenes = JSON.parse(decrypt(row.scenes)) as Scene[];
          const scriptBlocks = JSON.parse(decrypt(row.script_blocks)) as ScriptBlock[];
          const storyboardFrames = JSON.parse(decrypt(row.storyboard_frames)) as StoryboardFrame[];
          const sketches = JSON.parse(decrypt(row.sketches)) as Sketch[];
          resolve({ scenes, scriptBlocks, storyboardFrames, sketches });
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

export async function saveProjectData(
  id: string,
  data: {
    scenes: Scene[];
    scriptBlocks: ScriptBlock[];
    storyboardFrames: StoryboardFrame[];
    sketches: Sketch[];
  }
): Promise<void> {
  const now = Date.now();
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE projects SET updated_at = $1 WHERE id = $2',
        [now, id]
      );
      await client.query(
        'UPDATE project_data SET scenes = $1, script_blocks = $2, storyboard_frames = $3, sketches = $4 WHERE project_id = $5',
        [
          encrypt(JSON.stringify(data.scenes)),
          encrypt(JSON.stringify(data.scriptBlocks)),
          encrypt(JSON.stringify(data.storyboardFrames)),
          encrypt(JSON.stringify(data.sketches)),
          id,
        ]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    return new Promise((resolve, reject) => {
      db!.serialize(() => {
        db!.run('BEGIN TRANSACTION');

        db!.run(
          'UPDATE projects SET updated_at = ? WHERE id = ?',
          [now, id],
          (err) => {
            if (err) {
              db!.run('ROLLBACK');
              return reject(err);
            }
          }
        );

        db!.run(
          'UPDATE project_data SET scenes = ?, script_blocks = ?, storyboard_frames = ?, sketches = ? WHERE project_id = ?',
          [
            encrypt(JSON.stringify(data.scenes)),
            encrypt(JSON.stringify(data.scriptBlocks)),
            encrypt(JSON.stringify(data.storyboardFrames)),
            encrypt(JSON.stringify(data.sketches)),
            id,
          ],
          (err) => {
            if (err) {
              db!.run('ROLLBACK');
              return reject(err);
            }
            db!.run('COMMIT');
            resolve();
          }
        );
      });
    });
  }
}

export async function deleteProject(id: string): Promise<void> {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM projects WHERE id = $1', [id]);
      await client.query('DELETE FROM project_data WHERE project_id = $1', [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    return new Promise((resolve, reject) => {
      db!.serialize(() => {
        db!.run('BEGIN TRANSACTION');
        db!.run('DELETE FROM projects WHERE id = ?', [id], (err) => {
          if (err) {
            db!.run('ROLLBACK');
            return reject(err);
          }
        });
        db!.run('DELETE FROM project_data WHERE project_id = ?', [id], (err) => {
          if (err) {
            db!.run('ROLLBACK');
            return reject(err);
          }
          db!.run('COMMIT');
          resolve();
        });
      });
    });
  }
}

export async function checkDatabaseStatus(): Promise<{ type: 'postgres' | 'sqlite'; status: string; details?: string; error?: string }> {
  if (pgPool) {
    try {
      const client = await pgPool.connect();
      try {
        await client.query('SELECT 1');
        return { 
          type: 'postgres', 
          status: 'connected', 
          details: 'Successfully connected to PostgreSQL (Neon) and executed test query' 
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      return { 
        type: 'postgres', 
        status: 'error', 
        error: err.message,
        details: 'Failed to connect to PostgreSQL (Neon). Please check if your DATABASE_URL environment variable is correct and Neon allows connections.'
      };
    }
  } else {
    if (db) {
      return { 
        type: 'sqlite', 
        status: 'connected', 
        details: 'Operating on local SQLite storage (development fallback)' 
      };
    } else {
      return { 
        type: 'sqlite', 
        status: 'error', 
        error: 'SQLite database is not initialized',
        details: 'Local SQLite database failed to initialize.'
      };
    }
  }
}

