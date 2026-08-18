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
      await client.query(`
        CREATE TABLE IF NOT EXISTS seedlings (
          id VARCHAR(255) PRIMARY KEY,
          category TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
      console.log('PostgreSQL tables checked/created successfully');
      await ensureSonOfACobblerExists();
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
    db!.run(`
      CREATE TABLE IF NOT EXISTS seedlings (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    ensureSonOfACobblerExists();
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

export async function createProject(id: string, name: string, seedlingContent?: string, seedlingCategory?: string): Promise<void> {
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
  
  if (seedlingContent) {
    sketches.push({
      id: 'brainstorm-main',
      title: 'Story Overview',
      strokes: [],
      description: '',
      updatedAt: now,
      isBrainstorm: true,
      outline: '',
      logline: '',
      insertedSeedlings: [
        {
          id: `seed-${now}`,
          category: seedlingCategory || 'idea',
          content: seedlingContent,
          insertedAt: now
        }
      ]
    });
  }

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

function parseTextToScriptBlocks(text: string): ScriptBlock[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks: ScriptBlock[] = [];
  let sceneCount = 1;
  let currentSceneId = `scene-${sceneCount}`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = /^(INT|EXT|EST|INT\/EXT|I\/E)[\s\.]/i.test(line);

    if (isHeading) {
      currentSceneId = `scene-${sceneCount++}`;
      blocks.push({
        id: `block-${i + 1}`,
        type: 'scene-heading',
        text: line.toUpperCase(),
        sceneId: currentSceneId,
      });
    } else if (line === line.toUpperCase() && line.length < 35 && !line.endsWith('.')) {
      blocks.push({
        id: `block-${i + 1}`,
        type: 'character',
        text: line,
        sceneId: currentSceneId,
      });
    } else if (line.startsWith('(') && line.endsWith(')')) {
      blocks.push({
        id: `block-${i + 1}`,
        type: 'parenthetical',
        text: line,
        sceneId: currentSceneId,
      });
    } else if (i > 0 && blocks[blocks.length - 1]?.type === 'character') {
      blocks.push({
        id: `block-${i + 1}`,
        type: 'dialogue',
        text: line,
        sceneId: currentSceneId,
      });
    } else {
      blocks.push({
        id: `block-${i + 1}`,
        type: 'action',
        text: line,
        sceneId: currentSceneId,
      });
    }
  }
  return blocks.length > 0
    ? blocks
    : [
        { id: 'block-1', type: 'scene-heading', text: 'INT. BASEMENT WORKSHOP - DAY', sceneId: 'scene-1' },
        { id: 'block-2', type: 'action', text, sceneId: 'scene-1' },
      ];
}

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  let decrypted = raw;
  try {
    decrypted = decrypt(raw);
  } catch {
    decrypted = raw;
  }

  try {
    const parsed = JSON.parse(decrypted);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
  } catch {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
    } catch {
      if (Array.isArray(fallback) && decrypted && decrypted.trim().length > 0) {
        if (!decrypted.trim().startsWith('{') && !decrypted.trim().startsWith('[')) {
          return parseTextToScriptBlocks(decrypted) as unknown as T;
        }
      }
      return fallback;
    }
  }
}

async function ensureSonOfACobblerExists() {
  const projectId = 'proj-son-of-a-cobbler';
  const projectName = 'Son of a Cobbler';
  const now = Date.now();
  const encryptedName = encrypt(projectName);

  const scenes: Scene[] = [{ id: 'scene-1', title: 'Scene 1: The Basement Workshop', order: 0 }];

  const scriptBlocks: ScriptBlock[] = [
    { id: 'block-1', type: 'scene-heading', text: 'INT. BASEMENT WORKSHOP - DAY', sceneId: 'scene-1' },
    {
      id: 'block-2',
      type: 'action',
      text: 'Dust motes hover in thin beams of amber sunlight piercing the narrow high windows of the cobblestone cellar.',
      sceneId: 'scene-1',
    },
    { id: 'block-3', type: 'character', text: 'DANIEL (18)', sceneId: 'scene-1' },
    {
      id: 'block-4',
      type: 'action',
      text: 'hunches over a low workbench, his fingers stained dark with cobbler wax and leather dye.',
      sceneId: 'scene-1',
    },
    { id: 'block-5', type: 'character', text: 'OLD COBBLER', sceneId: 'scene-1' },
    { id: 'block-6', type: 'parenthetical', text: '(without looking up from his lasts)', sceneId: 'scene-1' },
    { id: 'block-7', type: 'dialogue', text: 'Pull the thread tight, Daniel. Loose stitches let the winter in.', sceneId: 'scene-1' },
    { id: 'block-8', type: 'character', text: 'DANIEL', sceneId: 'scene-1' },
    { id: 'block-9', type: 'dialogue', text: 'Winter is already in, Father.', sceneId: 'scene-1' },
    { id: 'block-10', type: 'action', text: 'The old man stops his hammer mid-air.', sceneId: 'scene-1' },
  ];

  const storyboardFrames: StoryboardFrame[] = [
    { id: 'frame-1', sceneId: 'scene-1', strokes: [], caption: 'Wide shot of dusty basement workshop.', order: 0 },
  ];

  const sketches: Sketch[] = [];

  try {
    if (pgPool) {
      const check = await pgPool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
      if (check.rows.length === 0) {
        await pgPool.query('INSERT INTO projects (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)', [
          projectId,
          encryptedName,
          now,
          now,
        ]);
        await pgPool.query(
          'INSERT INTO project_data (project_id, scenes, script_blocks, storyboard_frames, sketches) VALUES ($1, $2, $3, $4, $5)',
          [
            projectId,
            encrypt(JSON.stringify(scenes)),
            encrypt(JSON.stringify(scriptBlocks)),
            encrypt(JSON.stringify(storyboardFrames)),
            encrypt(JSON.stringify(sketches)),
          ]
        );
        console.log('Restored Son of a Cobbler project in Postgres');
      }
    } else if (db) {
      db.get('SELECT id FROM projects WHERE id = ?', [projectId], (err, row) => {
        if (!row) {
          db!.serialize(() => {
            db!.run('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
              projectId,
              encryptedName,
              now,
              now,
            ]);
            db!.run(
              'INSERT INTO project_data (project_id, scenes, script_blocks, storyboard_frames, sketches) VALUES (?, ?, ?, ?, ?)',
              [
                projectId,
                encrypt(JSON.stringify(scenes)),
                encrypt(JSON.stringify(scriptBlocks)),
                encrypt(JSON.stringify(storyboardFrames)),
                encrypt(JSON.stringify(sketches)),
              ]
            );
          });
          console.log('Restored Son of a Cobbler project in SQLite');
        }
      });
    }
  } catch (err) {
    console.error('Failed to ensure Son of a Cobbler project exists:', err);
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
    const scenes = safeParseJson<Scene[]>(row.scenes, []);
    const scriptBlocks = safeParseJson<ScriptBlock[]>(row.script_blocks, []);
    const storyboardFrames = safeParseJson<StoryboardFrame[]>(row.storyboard_frames, []);
    const sketches = safeParseJson<Sketch[]>(row.sketches, []);
    return { scenes, scriptBlocks, storyboardFrames, sketches };
  } else {
    return new Promise((resolve, reject) => {
      db!.get('SELECT * FROM project_data WHERE project_id = ?', [id], (err, row: any) => {
        if (err) {
          return reject(err);
        }
        if (!row) {
          return reject(new Error('Project not found'));
        }
        const scenes = safeParseJson<Scene[]>(row.scenes, []);
        const scriptBlocks = safeParseJson<ScriptBlock[]>(row.script_blocks, []);
        const storyboardFrames = safeParseJson<StoryboardFrame[]>(row.storyboard_frames, []);
        const sketches = safeParseJson<Sketch[]>(row.sketches, []);
        resolve({ scenes, scriptBlocks, storyboardFrames, sketches });
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

export async function renameProject(id: string, name: string): Promise<void> {
  const encryptedName = encrypt(name);
  const now = Date.now();
  if (pgPool) {
    await pgPool.query('UPDATE projects SET name = $1, updated_at = $2 WHERE id = $3', [encryptedName, now, id]);
  } else {
    return new Promise((resolve, reject) => {
      db!.run('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?', [encryptedName, now, id], (err) => {
        if (err) reject(err);
        else resolve();
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

export interface SeedlingRow {
  id: string;
  category: string;
  content: string;
  createdAt: number;
}

export async function getSeedlings(): Promise<SeedlingRow[]> {
  if (pgPool) {
    const result = await pgPool.query('SELECT * FROM seedlings ORDER BY created_at DESC');
    return result.rows.map((row) => ({
      id: row.id,
      category: row.category,
      content: decrypt(row.content),
      createdAt: Number(row.created_at),
    }));
  } else {
    return new Promise((resolve, reject) => {
      db!.all('SELECT * FROM seedlings ORDER BY created_at DESC', (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows.map((row) => ({
          id: row.id,
          category: row.category,
          content: decrypt(row.content),
          createdAt: row.created_at
        })));
      });
    });
  }
}

export async function createSeedling(id: string, category: string, content: string): Promise<void> {
  const encryptedContent = encrypt(content);
  const now = Date.now();
  if (pgPool) {
    await pgPool.query(
      'INSERT INTO seedlings (id, category, content, created_at) VALUES ($1, $2, $3, $4)',
      [id, category, encryptedContent, now]
    );
  } else {
    return new Promise((resolve, reject) => {
      db!.run(
        'INSERT INTO seedlings (id, category, content, created_at) VALUES (?, ?, ?, ?)',
        [id, category, encryptedContent, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

export async function deleteSeedling(id: string): Promise<void> {
  if (pgPool) {
    await pgPool.query('DELETE FROM seedlings WHERE id = $1', [id]);
  } else {
    return new Promise((resolve, reject) => {
      db!.run('DELETE FROM seedlings WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
