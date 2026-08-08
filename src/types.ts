export type ScriptElementType =
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'camera'
  | 'transition';

export interface ScriptBlock {
  id: string;
  type: ScriptElementType;
  text: string;
  sceneId: string; // Belongs to a specific scene
}

export interface Scene {
  id: string;
  title: string;
  order: number;
  isAct?: boolean;
  actId?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  isEraser?: boolean;
}

export interface StoryboardFrame {
  id: string;
  sceneId: string;
  strokes: DrawingStroke[];
  caption: string;
  order: number;
  linkedBlockIds?: string[];
}

export interface BrainstormCharacter {
  id: string;
  name: string;
  role: string;
  traits: string;
  backstory: string;
  intent?: string;      // Wants / Conscious desire
  need?: string;        // Inner Need / Unconscious lack
  obstacle?: string;    // What stands in their way
  appearance?: string;  // Visual description
  archetype?: string;   // Character archetype
}

export interface BrainstormLocation {
  id: string;
  name: string;
  description: string;
  timeOfDay: string;
  sensorySight?: string;     // What the audience sees
  sensorySound?: string;     // Ambient noises / atmosphere
  sensorySmell?: string;     // Scent markers
  narrativePurpose?: string; // Why this location exists in the story
}

export interface BrainstormAct {
  id: string;
  title: string;
  description: string;
  turningPoints?: string;   // Major climax, pinch points, or reversals
}

export interface Sketch {
  id: string;
  title: string;
  strokes: DrawingStroke[];
  description: string;
  updatedAt: number;
  // Optional Brainstorm fields to reuse the sketches database column
  isBrainstorm?: boolean;
  outline?: string;
  logline?: string;
  theme?: string;
  genre?: string;
  targetAudience?: string;
  actsCount?: number;
  actsList?: BrainstormAct[];
  act1Notes?: string;
  act2Notes?: string;
  act3Notes?: string;
  act4Notes?: string;
  charactersList?: BrainstormCharacter[];
  locationsList?: BrainstormLocation[];

  // Optional Podcast fields
  isPodcast?: boolean;
  podcastNotes?: string;
  podcastTranscript?: string;
  podcastRecap?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Collaborator {
  id: string;
  userId?: string;
  name: string;
  color: string;
  activeSceneId?: string;
}

export type WSMessage =
  | { type: 'join'; projectId: string; name: string; userId?: string }
  | { type: 'presence'; collaborators: Collaborator[] }
  | { type: 'sync-full'; data: { scenes: Scene[]; scriptBlocks: ScriptBlock[]; storyboardFrames: StoryboardFrame[]; sketches: Sketch[] } }
  | { type: 'script-update'; scriptBlocks: ScriptBlock[] }
  | { type: 'scenes-update'; scenes: Scene[] }
  | { type: 'storyboard-update'; storyboardFrames: StoryboardFrame[] }
  | { type: 'sketches-update'; sketches: Sketch[] }
  | { type: 'draw-stroke'; target: 'storyboard' | 'sketch'; id: string; stroke: DrawingStroke }
  | { type: 'draw-clear'; target: 'storyboard' | 'sketch'; id: string }
  | { type: 'error'; message: string };
