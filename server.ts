import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { 
  getProjects, 
  createProject, 
  getProjectData, 
  saveProjectData, 
  deleteProject,
  checkDatabaseStatus
} from './server/db.js';
import { 
  Scene, 
  ScriptBlock, 
  StoryboardFrame, 
  Sketch, 
  Collaborator, 
  WSMessage 
} from './src/types.js';

interface Room {
  scenes: Scene[];
  scriptBlocks: ScriptBlock[];
  storyboardFrames: StoryboardFrame[];
  sketches: Sketch[];
  collaborators: Map<string, Collaborator>;
  clients: Map<string, WebSocket>;
  saveTimeout: NodeJS.Timeout | null;
}

const activeRooms = new Map<string, Room>();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '50mb' }));

  // HTTP API Routes

  // Database Connection Diagnostics
  app.get('/api/db-status', async (req, res) => {
    try {
      const status = await checkDatabaseStatus();
      res.json({
        ok: status.status === 'connected',
        timestamp: new Date().toISOString(),
        ...status
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // List all projects
  app.get('/api/projects', async (req, res) => {
    try {
      const projects = await getProjects();
      res.json(projects);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create new project
  app.post('/api/projects', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
      }
      const id = crypto.randomUUID();
      await createProject(id, name);
      res.status(201).json({ id, name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete project
  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await deleteProject(id);
      activeRooms.delete(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Import project
  app.post('/api/projects/import', async (req, res) => {
    try {
      const { name, scenes, scriptBlocks, storyboardFrames, sketches } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
      }
      const id = crypto.randomUUID();
      await createProject(id, name);
      
      // Save data directly
      await saveProjectData(id, {
        scenes: scenes || [],
        scriptBlocks: scriptBlocks || [],
        storyboardFrames: storyboardFrames || [],
        sketches: sketches || []
      });

      res.status(201).json({ id, name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Export project raw data
  app.get('/api/projects/:id/export', async (req, res) => {
    try {
      const { id } = req.params;
      const projects = await getProjects();
      const proj = projects.find((p) => p.id === id);
      if (!proj) {
        return res.status(404).json({ error: 'Project not found' });
      }
      const data = await getProjectData(id);
      res.json({
        name: proj.name,
        ...data
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create standard HTTP server
  const server = createServer(app);

  // WebSocket Server setup on same port
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Helper to save room data to SQLite DB
  async function persistRoom(projectId: string, room: Room) {
    try {
      await saveProjectData(projectId, {
        scenes: room.scenes,
        scriptBlocks: room.scriptBlocks,
        storyboardFrames: room.storyboardFrames,
        sketches: room.sketches
      });
      console.log(`Persisted project ${projectId} data successfully.`);
    } catch (err) {
      console.error(`Failed to persist room ${projectId}:`, err);
    }
  }

  // Schedule database save
  function queueRoomSave(projectId: string, room: Room) {
    if (room.saveTimeout) {
      clearTimeout(room.saveTimeout);
    }
    room.saveTimeout = setTimeout(async () => {
      room.saveTimeout = null;
      await persistRoom(projectId, room);
    }, 3000); // Debounce saves by 3 seconds
  }

  // Helper to broadcast to a room
  function broadcastToRoom(projectId: string, senderId: string | null, message: WSMessage) {
    const room = activeRooms.get(projectId);
    if (!room) return;

    const payload = JSON.stringify(message);
    room.clients.forEach((client, clientId) => {
      if (clientId !== senderId && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // Handle WS connections
  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID();
    let joinedProjectId: string | null = null;

    ws.on('message', async (messageData: string) => {
      try {
        const msg = JSON.parse(messageData) as WSMessage;

        if (msg.type === 'join') {
          joinedProjectId = msg.projectId;
          const name = msg.name || `Writer ${Math.floor(100 + Math.random() * 900)}`;
          const userId = msg.userId;
          
          // Random collaborator color
          const colors = ['#E11D48', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2', '#EC4899'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];

          let room = activeRooms.get(joinedProjectId);
          if (!room) {
            // Load from SQLite database
            console.log(`Loading project ${joinedProjectId} from SQLite database...`);
            try {
              const data = await getProjectData(joinedProjectId);
              room = {
                scenes: data.scenes,
                scriptBlocks: data.scriptBlocks,
                storyboardFrames: data.storyboardFrames,
                sketches: data.sketches,
                collaborators: new Map(),
                clients: new Map(),
                saveTimeout: null
              };
              activeRooms.set(joinedProjectId, room);
            } catch (dbErr: any) {
              console.error(`Error loading project ${joinedProjectId}:`, dbErr);
              ws.send(JSON.stringify({
                type: 'error',
                message: dbErr.message || 'Project not found'
              }));
              return;
            }
          } else if (userId) {
            // Evict any existing connection for this same userId in the room
            let existingClientId: string | null = null;
            room.collaborators.forEach((collab, cid) => {
              if (collab.userId === userId) {
                existingClientId = cid;
              }
            });

            if (existingClientId) {
              console.log(`Evicting old connection ${existingClientId} for user ${name} (${userId})`);
              const oldWs = room.clients.get(existingClientId);
              if (oldWs && oldWs.readyState === WebSocket.OPEN) {
                try {
                  oldWs.close();
                } catch (e) {}
              }
              room.collaborators.delete(existingClientId);
              room.clients.delete(existingClientId);
            }
          }

          const collaborator: Collaborator = {
            id: clientId,
            userId,
            name,
            color: randomColor
          };

          room.collaborators.set(clientId, collaborator);
          room.clients.set(clientId, ws);

          // Send current client the entire project state
          ws.send(JSON.stringify({
            type: 'sync-full',
            data: {
              scenes: room.scenes,
              scriptBlocks: room.scriptBlocks,
              storyboardFrames: room.storyboardFrames,
              sketches: room.sketches
            }
          }));

          // Send updated presence list to room
          const collaborators = Array.from(room.collaborators.values());
          broadcastToRoom(joinedProjectId, null, {
            type: 'presence',
            collaborators
          });

          console.log(`Client ${name} (${clientId}) joined room ${joinedProjectId}`);
        }

        if (!joinedProjectId) return;
        const room = activeRooms.get(joinedProjectId);
        if (!room) return;

        // Process script updates
        if (msg.type === 'script-update') {
          room.scriptBlocks = msg.scriptBlocks;
          broadcastToRoom(joinedProjectId, clientId, msg);
          queueRoomSave(joinedProjectId, room);
        }

        // Process scene updates (ordering, headings, etc.)
        if (msg.type === 'scenes-update') {
          room.scenes = msg.scenes;
          broadcastToRoom(joinedProjectId, clientId, msg);
          queueRoomSave(joinedProjectId, room);
        }

        // Process storyboard updates
        if (msg.type === 'storyboard-update') {
          room.storyboardFrames = msg.storyboardFrames;
          broadcastToRoom(joinedProjectId, clientId, msg);
          queueRoomSave(joinedProjectId, room);
        }

        // Process sketch updates
        if (msg.type === 'sketches-update') {
          room.sketches = msg.sketches;
          broadcastToRoom(joinedProjectId, clientId, msg);
          queueRoomSave(joinedProjectId, room);
        }

        // Real-time drawing stroke streaming
        if (msg.type === 'draw-stroke') {
          // Append stroke to target canvas in room state immediately
          if (msg.target === 'storyboard') {
            const frame = room.storyboardFrames.find(f => f.id === msg.id);
            if (frame) {
              frame.strokes.push(msg.stroke);
            }
          } else if (msg.target === 'sketch') {
            const sk = room.sketches.find(s => s.id === msg.id);
            if (sk) {
              sk.strokes.push(msg.stroke);
              sk.updatedAt = Date.now();
            }
          }
          // Broadcast stroke to other room members
          broadcastToRoom(joinedProjectId, clientId, msg);
          queueRoomSave(joinedProjectId, room);
        }

        // Real-time canvas clearing
        if (msg.type === 'draw-clear') {
          if (msg.target === 'storyboard') {
            const frame = room.storyboardFrames.find(f => f.id === msg.id);
            if (frame) {
              frame.strokes = [];
            }
          } else if (msg.target === 'sketch') {
            const sk = room.sketches.find(s => s.id === msg.id);
            if (sk) {
              sk.strokes = [];
              sk.updatedAt = Date.now();
            }
          }
          broadcastToRoom(joinedProjectId, clientId, msg);
          queueRoomSave(joinedProjectId, room);
        }

      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', async () => {
      if (joinedProjectId) {
        const room = activeRooms.get(joinedProjectId);
        if (room) {
          const collab = room.collaborators.get(clientId);
          room.collaborators.delete(clientId);
          room.clients.delete(clientId);

          console.log(`Client ${collab?.name || clientId} disconnected from room ${joinedProjectId}`);

          if (room.collaborators.size === 0) {
            // Cancel any pending saves and run immediate final save
            if (room.saveTimeout) {
              clearTimeout(room.saveTimeout);
              room.saveTimeout = null;
            }
            await persistRoom(joinedProjectId, room);
            activeRooms.delete(joinedProjectId);
            console.log(`Room ${joinedProjectId} is empty, persisted and cleaned from memory.`);
          } else {
            // Broadcast remaining users list
            const collaborators = Array.from(room.collaborators.values());
            broadcastToRoom(joinedProjectId, null, {
              type: 'presence',
              collaborators
            });
          }
        }
      }
    });
  });

  // Integrate Vite for dev/build modes
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
