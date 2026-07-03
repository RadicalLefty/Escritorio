import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  Grid, 
  Palette, 
  Download, 
  FileDown, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Trash2, 
  Share2, 
  RefreshCw, 
  User, 
  Sparkles,
  Maximize2,
  Minimize2,
  LayoutList,
  Check,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderInput,
  BookOpen,
  Compass,
  MapPin,
  Layers,
  Eye,
  Printer,
  Copy,
  Edit3,
  Info
} from 'lucide-react';
import { 
  Scene, 
  ScriptBlock, 
  StoryboardFrame, 
  Sketch, 
  Collaborator, 
  ScriptElementType, 
  DrawingStroke, 
  WSMessage,
  BrainstormCharacter,
  BrainstormLocation,
  BrainstormAct
} from '../types';
import CollaborativeCanvas from './CollaborativeCanvas';
import { exportScreenplayToPDF } from '../utils/pdfExport';

interface BlockInputProps {
  id: string;
  type: ScriptElementType;
  text: string;
  placeholder: string;
  className: string;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  isActive: boolean;
  existingCharacters?: string[];
  characters?: any[];
  locations?: any[];
}

const BlockInput: React.FC<BlockInputProps> = ({
  id,
  type,
  text,
  placeholder,
  className,
  onChange,
  onKeyDown,
  onFocus,
  isActive,
  existingCharacters = [],
  characters = [],
  locations = []
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const scrollActiveIntoView = () => {
    if (!isActive) return;
    const textarea = textareaRef.current;
    const viewport = document.getElementById('script-viewport');
    if (textarea && viewport) {
      const rect = textarea.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      
      // Keep at least 140px buffer from the bottom to clear the floating selection/action bars
      const bottomBuffer = 140;
      const tooLow = rect.bottom > (viewportRect.bottom - bottomBuffer);
      const tooHigh = rect.top < (viewportRect.top + 40);
      
      if (tooLow) {
        const scrollAmount = rect.bottom - viewportRect.bottom + bottomBuffer;
        viewport.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      } else if (tooHigh) {
        const scrollAmount = rect.top - viewportRect.top - 40;
        viewport.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    adjustHeight();
    if (isActive) {
      const timer = setTimeout(scrollActiveIntoView, 50);
      return () => clearTimeout(timer);
    }
  }, [text, type, isActive]);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      if (document.activeElement !== textareaRef.current) {
        textareaRef.current.focus();
      }
      const timer = setTimeout(scrollActiveIntoView, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Combined character list
  const combinedCharacters = useMemo(() => {
    const bibleNames = (characters || []).map(c => c.name.trim().toUpperCase());
    return Array.from(new Set([...existingCharacters, ...bibleNames]));
  }, [existingCharacters, characters]);

  // Compute character suggestion suffix
  let suggestionSuffix = '';
  if (type === 'character' && text.trim().length > 0) {
    const upperText = text.toUpperCase();
    const match = combinedCharacters.find(
      char => char.startsWith(upperText) && char.length > upperText.length
    );
    if (match) {
      suggestionSuffix = match.slice(upperText.length);
    }
  }

  // Create unified autocomplete choices from story planner context
  const allContextItems = useMemo(() => {
    const list: any[] = [];
    
    characters.forEach(c => {
      list.push({
        id: `char-${c.id}`,
        type: 'character',
        label: c.name,
        subLabel: c.role ? `${c.role} • ${c.traits || 'No traits listed'}` : 'Character',
        insertText: c.name
      });
    });

    locations.forEach(l => {
      list.push({
        id: `loc-${l.id}`,
        type: 'location',
        label: l.name,
        subLabel: l.timeOfDay ? `${l.timeOfDay} • ${l.description || 'No description'}` : l.description || 'Location',
        insertText: l.name
      });
    });

    return list;
  }, [characters, locations]);

  const filteredItems = useMemo(() => {
    if (!showPopup) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return allContextItems.slice(0, 12);
    return allContextItems
      .filter(item => 
        item.label.toLowerCase().includes(query) || 
        item.subLabel.toLowerCase().includes(query)
      )
      .slice(0, 12);
  }, [showPopup, searchQuery, allContextItems]);

  const handleSelectOption = (item: any) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const textBeforeAt = text.slice(0, cursorIndex);
    const textAfterCursor = text.slice(textarea.selectionStart);

    let insertVal = item.insertText;
    if (item.type === 'character' || item.type === 'location') {
      insertVal = insertVal.toUpperCase();
    }

    const newText = textBeforeAt + insertVal + textAfterCursor;
    onChange(newText);
    setShowPopup(false);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newCursorPos = cursorIndex + insertVal.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        adjustHeight();
      }
    }, 10);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    adjustHeight();

    const textarea = textareaRef.current;
    if (!textarea) return;
    const selStart = textarea.selectionStart;
    const textBeforeCursor = val.slice(0, selStart);

    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const textSinceAt = textBeforeCursor.slice(atIndex + 1);
      if (!textSinceAt.includes(' ')) {
        setShowPopup(true);
        setSearchQuery(textSinceAt);
        setCursorIndex(atIndex);
        setSelectedIndex(0);
        return;
      }
    }

    setShowPopup(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPopup && filteredItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectOption(filteredItems[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowPopup(false);
        return;
      }
    }

    if (suggestionSuffix && e.key === 'Enter') {
      e.preventDefault();
      const completedText = text + suggestionSuffix;
      e.currentTarget.value = completedText;
      e.currentTarget.selectionStart = completedText.length;
      e.currentTarget.selectionEnd = completedText.length;
      onChange(completedText);
      setTimeout(() => {
        adjustHeight();
      }, 0);
      onKeyDown(e);
      return;
    }

    onKeyDown(e);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowPopup(false);
    }, 200);
  };

  return (
    <div className="relative w-full">
      {suggestionSuffix && (
        <div 
          className={`${className} absolute inset-0 pointer-events-none select-none text-stone-400 font-mono text-[13px] overflow-hidden whitespace-pre-wrap flex items-center bg-transparent border-0 p-0 m-0 w-full z-0`}
          style={{ minHeight: '1.5em' }}
        >
          {/* Invisible padding mapping exactly to the typed characters */}
          <span className="text-transparent uppercase">{text}</span>
          {/* Autocomplete prediction suffix */}
          <span className="text-stone-400 uppercase font-mono">{suggestionSuffix}</span>
          <span className="text-stone-300 text-[9px] font-sans ml-2 tracking-normal italic normal-case shrink-0">
            [enter to confirm]
          </span>
        </div>
      )}
      <textarea
        id={`textarea-${id}`}
        ref={textareaRef}
        value={text}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        rows={1}
        className={`${className} overflow-hidden resize-none bg-transparent border-0 outline-none focus:outline-none focus:ring-0 p-0 m-0 w-full block font-mono text-[13px] relative z-10`}
        style={{ minHeight: '1.5em' }}
      />

      {/* Autocomplete Popup */}
      {showPopup && filteredItems.length > 0 && (
        <div className="absolute z-50 left-0 mt-1 max-h-60 w-80 overflow-y-auto rounded-lg border border-[#E5E5E1] bg-white p-1.5 shadow-lg font-sans text-xs animate-fade-in select-none">
          <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#718096] border-b border-[#F1F1F1] mb-1 flex items-center justify-between">
            <span>Story Context Bible</span>
            <span className="text-[8px] text-[#A0AEC0] normal-case tracking-normal">⇅ to navigate • ↵ to insert</span>
          </div>
          {filteredItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent text area from losing focus/blurring prematurely
                handleSelectOption(item);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded text-left transition-all cursor-pointer ${
                idx === selectedIndex 
                  ? 'bg-[#1A1A1A] text-white' 
                  : 'text-[#2D2D2A] hover:bg-[#FAFAFA]'
              }`}
            >
              <div className={`p-1 rounded shrink-0 ${idx === selectedIndex ? 'bg-white/20 text-white' : 'bg-stone-100 text-[#718096]'}`}>
                {item.type === 'character' && <User className="w-3.5 h-3.5" />}
                {item.type === 'location' && <MapPin className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0 flex-grow">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold truncate">{item.label}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-wider px-1 py-0.2 rounded shrink-0 ${
                    idx === selectedIndex 
                      ? 'bg-white/15 text-stone-300' 
                      : 'bg-[#FAFAFA] border border-[#E5E5E1] text-[#718096]'
                  }`}>
                    {item.type}
                  </span>
                </div>
                {item.subLabel && (
                  <p className={`text-[10px] truncate ${idx === selectedIndex ? 'text-stone-300 font-light' : 'text-[#718096] font-light'}`}>
                    {item.subLabel}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


const ACT_SUGGESTIONS: Record<number, { title: string; description: string; turningPoints: string }[]> = {
  1: [
    {
      title: "Act I: Complete Narrative Arc",
      description: "In a single-act play or short film, introduce the protagonist's status quo, the inciting incident, escalating obstacles, and the final climax all within a compressed, single continuous arc. Pacing must be swift and highly focused.",
      turningPoints: "The Climax: A single defining choice or confrontation that resolves the main dramatic question."
    }
  ],
  2: [
    {
      title: "Act I: The Setup & Inciting Incident",
      description: "Establish the protagonist's ordinary world and the core conflict. Introduce the catalyst that forces them to take action. They embark on their primary journey, setting up the central conflict that spans the entire story.",
      turningPoints: "The Turning Point: A point of no return where the protagonist commits fully to a new path."
    },
    {
      title: "Act II: The Escalation & Climax",
      description: "The stakes rise as obstacles become increasingly personal. The action builds continuously toward a final, massive confrontation or realization that resolves the main storyline.",
      turningPoints: "The Climax: The ultimate crisis where the protagonist faces their main conflict and resolves it."
    }
  ],
  3: [
    {
      title: "Act I: Setup & Catalyst",
      description: "Establish the protagonist's ordinary world, flaws, and desires. Introduce the inciting incident that disrupts their status quo, leading to a crucial decision that crosses the threshold into the second act.",
      turningPoints: "Plot Point 1: A major shift that launches the protagonist out of their comfort zone and into adventure."
    },
    {
      title: "Act II: Rising Action & Midpoint",
      description: "The protagonist faces escalating trials, finds allies, and confronts obstacles in an unfamiliar world. A pivotal midpoint shift changes their perspective, leading to an 'All is Lost' crisis at the end of this act.",
      turningPoints: "The Midpoint Shift & Plot Point 2: The dark night of the soul where stakes reach their absolute highest."
    },
    {
      title: "Act III: Climax & Resolution",
      description: "Armed with new insight, the protagonist rallies for a final battle or makes a ultimate sacrifice. The central question is resolved, establishing a new status quo.",
      turningPoints: "The Climax & Final Resolution: The ultimate confrontation and aftermath showing the new world order."
    }
  ],
  4: [
    {
      title: "Act I: Introduction & Trigger",
      description: "Introduce the main characters, the rules of their environment, and their primary motivation. A sudden disruption (inciting incident) triggers an urgent need for action, setting off the first major trial.",
      turningPoints: "Inciting Event: The sudden spark that shatters the protagonist's normal existence."
    },
    {
      title: "Act II: Early Trials & Complications",
      description: "The protagonist enters a new state of action. They experience initial success but encounter rising friction as the antagonist or environment pushes back, culminating in a major turning point.",
      turningPoints: "The Gatekeeper: A significant obstacle that forces the protagonist to change their initial strategy."
    },
    {
      title: "Act III: The Descent & Dark Crisis",
      description: "The conflict intensifies dramatically. The protagonist's relationships are tested, secret vulnerabilities are exposed, and they experience a profound failure or loss that leaves them at their lowest point.",
      turningPoints: "All Is Lost / Major Reversal: A devastating setback that makes victory seem completely impossible."
    },
    {
      title: "Act IV: The Ascent & Climax",
      description: "Rebuilding from the ashes, the protagonist makes a decisive, final plan. They execute a high-stakes confrontation that resolves the central conflict once and for all, followed by a brief denouement.",
      turningPoints: "The Grand Climax: The ultimate trial where the protagonist either triumphs or faces tragic defeat."
    }
  ],
  5: [
    {
      title: "Act I: Exposition & Impulse",
      description: "Establish the detailed state of the world, key characters, and the underlying tension. An external impulse breaks the peace and forces the protagonist to consider taking action.",
      turningPoints: "The Impulse Beat: The catalyst that puts the narrative elements into motion."
    },
    {
      title: "Act II: Commitment & Ascent",
      description: "The protagonist actively pursues their goal. They encounter initial success, formulate alliances, and build confidence as they navigate through early complications.",
      turningPoints: "First Reversal: A surprising complication that raises the initial stakes and tests commitment."
    },
    {
      title: "Act III: The Midpoint Climax (Reversal)",
      description: "The narrative reaches a major peak. A massive confrontation, revelation, or twist completely changes the direction of the plot, turning a rising fortune into a falling fortune.",
      turningPoints: "The Midpoint Turning Point: A dramatic shift that forces all characters to reassess their positions."
    },
    {
      title: "Act IV: Falling Action & Dark Night",
      description: "The fallout from the midpoint disaster. Panic and complications spread. The protagonist suffers severe consequences, leading to an extreme low point where hope is almost entirely lost.",
      turningPoints: "The Abyss: A profound crisis that forces the protagonist to confront their deepest internal flaw."
    },
    {
      title: "Act V: Catastrophe or Resolution",
      description: "The final, decisive confrontation. In tragedies, this is the catastrophe; in comedies or dramas, it is the triumphant resolution. The ultimate fates of all main characters are sealed, and harmony is restored or shattered.",
      turningPoints: "The Climax & Denouement: The absolute peaks of tension followed by final closure for the entire world."
    }
  ]
};

const isSuggestionText = (text: string): boolean => {
  if (!text || text.trim() === '') return true;
  
  const allSuggestionsText = Object.values(ACT_SUGGESTIONS).flatMap(suggestions => 
    suggestions.flatMap(s => [
      s.title,
      s.description,
      s.turningPoints,
      'Describe what must unfold in this act here...',
      'The turning point or major climactic event of this act...',
      'Act I: The Setup',
      'Act II: The Confrontation',
      'Act III: The Resolution',
      'Act I: Setup & Catalyst',
      'Act II: Rising Action & Midpoint',
      'Act III: Climax & Resolution',
      'Act I: Setup & Catalyst (0% — 25%)',
      'Act II: Rising Action & Midpoint (25% — 75%)',
      'Act III: Climax & Resolution (75% — 100%)',
      'Act I: Setup & Catalyst (0% - 25%)',
      'Act II: Rising Action & Midpoint (25% - 75%)',
      'Act III: Climax & Resolution (75% - 100%)',
      'Act I: Setup & Catalyst (0% — 25%)',
      'Act II: Rising Action & Midpoint (25% — 75%)',
      'Act III: Climax & Resolution (75% — 100%)',
      'Act I: The Setup (0% — 25%)',
      'Act II: The Confrontation (25% — 75%)',
      'Act III: The Climax & Resolution (75% — 100%)',
      'Detail the ordinary world, characters introduced, trigger, and Plot Point 1 here...',
      'Detail rising obstacles, midpoints, trials, and the All is Lost moment here...',
      'Detail the climax, final battle/decision, resolution, and the new status quo here...',
      'Describe the decisive inciting event, midpoint shock, plot twist, or tragic reversal that forces the action to escalate immediately.',
      'Establish the ordinary world.',
      'Escalating conflict and midpoint.',
      'Climax and resolution.',
      'Plot Point 1',
      'All is Lost / Plot Point 2',
      'The Climax',
      'Act III: The Climax & Resolution',
      'Plot Point 1: Commitment to the journey.',
      'Plot Point 2: Shift from defensive to offensive.',
      'The Climax: Ultimate truth revealed.'
    ])
  );
  
  const trimmed = text.trim();
  return allSuggestionsText.some(s => s.trim().toLowerCase() === trimmed.toLowerCase());
};

interface EditorWorkspaceProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

export default function EditorWorkspace({ projectId, projectName, onBack }: EditorWorkspaceProps) {
  // Connection states
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [userName, setUserName] = useState('');
  const [showNameModal, setShowNameModal] = useState(true);

  // Project state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [storyboardFrames, setStoryboardFrames] = useState<StoryboardFrame[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);

  // Workspace configuration
  const [activeSceneId, setActiveSceneId] = useState<string>('scene-1');
  const [viewMode, setViewMode] = useState<'script' | 'storyboard' | 'brainstorm'>('script');
  const [brainstormTab, setBrainstormTab] = useState<'recap' | 'premise' | 'acts' | 'characters' | 'locations'>('recap');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isFullScriptView, setIsFullScriptView] = useState(false); // Focus scene vs full screenplay
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [activeSketchId, setActiveSketchId] = useState<string | null>(null);
  const [showShareNotification, setShowShareNotification] = useState(false);
  const [showShareExportDropdown, setShowShareExportDropdown] = useState(false);

  // Storyboard companion sidebar linking states
  const [showStoryboardSidebar, setShowStoryboardSidebar] = useState(true);
  const [showSceneNavigator, setShowSceneNavigator] = useState(true);
  const [collapsedActs, setCollapsedActs] = useState<Record<string, boolean>>({});
  const [isHoveredSceneNavigator, setIsHoveredSceneNavigator] = useState(false);
  const [isHoveredStoryboardSidebar, setIsHoveredStoryboardSidebar] = useState(false);
  const [hoveredStoryboardFrameId, setHoveredStoryboardFrameId] = useState<string | null>(null);
  const [selectedStoryboardFrameId, setSelectedStoryboardFrameId] = useState<string | null>(null);
  const [editingStoryboardFrameId, setEditingStoryboardFrameId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    frameId: string;
  } | null>(null);

  // References
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>('');
  const shareExportDropdownRef = useRef<HTMLDivElement>(null);
  const isUnmountingRef = useRef(false);
  const scriptScrollPositionsRef = useRef<Record<string, number>>({});
  const storyboardScrollPositionsRef = useRef<Record<string, number>>({});
  const brainstormScrollPositionsRef = useRef<Record<string, number>>({});

  // Filter script blocks to those belonging to the active scene, sorted by scene order in full script view
  const filteredBlocks = useMemo(() => {
    if (isFullScriptView) {
      const sceneOrderMap = new Map<string, number>();
      scenes.forEach(s => {
        sceneOrderMap.set(s.id, s.order);
      });
      return [...scriptBlocks].sort((a, b) => {
        const orderA = sceneOrderMap.get(a.sceneId) ?? 0;
        const orderB = sceneOrderMap.get(b.sceneId) ?? 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return scriptBlocks.indexOf(a) - scriptBlocks.indexOf(b);
      });
    } else {
      return scriptBlocks.filter(b => b.sceneId === activeSceneId);
    }
  }, [isFullScriptView, scriptBlocks, scenes, activeSceneId]);

  // Get all unique character names in the screenplay to use for suggestions
  const existingCharacters = useMemo(() => {
    return Array.from(new Set(
      scriptBlocks
        .filter(b => b.type === 'character' && b.text.trim())
        .map(b => b.text.trim().toUpperCase())
    ));
  }, [scriptBlocks]);

  // Prompt or retrieve collaborator name
  useEffect(() => {
    const savedName = localStorage.getItem('coscript_username');
    if (savedName) {
      setUserName(savedName);
      setShowNameModal(false);
    } else {
      const generatedName = `Writer ${Math.floor(100 + Math.random() * 900)}`;
      setUserName(generatedName);
    }
  }, []);

  // Handle click outside to close the share/export dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareExportDropdownRef.current && !shareExportDropdownRef.current.contains(event.target as Node)) {
        setShowShareExportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Establish WebSocket connection
  const connectWebSocket = (usernameToUse: string) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setConnectionStatus('connecting');
    setInitialSyncDone(false);
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus('connected');
      
      // Get or generate persistent userId
      let savedUid = localStorage.getItem('coscript_user_id');
      if (!savedUid) {
        savedUid = `user-${crypto.randomUUID()}`;
        localStorage.setItem('coscript_user_id', savedUid);
      }

      // Send join event
      const joinMsg: WSMessage = {
        type: 'join',
        projectId,
        name: usernameToUse,
        userId: savedUid
      };
      socket.send(JSON.stringify(joinMsg));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;

        switch (msg.type) {
          case 'presence':
            setCollaborators(msg.collaborators);
            break;

          case 'error':
            setError(msg.message);
            break;

          case 'sync-full':
            setScenes(msg.data.scenes);
            setScriptBlocks(msg.data.scriptBlocks);
            setStoryboardFrames(msg.data.storyboardFrames);
            setSketches(msg.data.sketches);
            setInitialSyncDone(true);
            
            // Set default active values if empty
            if (msg.data.scenes.length > 0 && !msg.data.scenes.some(s => s.id === activeSceneId)) {
              const firstRealScene = msg.data.scenes.find(s => !s.isAct);
              if (firstRealScene) {
                setActiveSceneId(firstRealScene.id);
              }
            }
            if (msg.data.sketches.length > 0 && !activeSketchId) {
              setActiveSketchId(msg.data.sketches[0].id);
            }
            break;

          case 'script-update':
            setScriptBlocks(msg.scriptBlocks);
            break;

          case 'scenes-update':
            setScenes(msg.scenes);
            break;

          case 'storyboard-update':
            setStoryboardFrames(msg.storyboardFrames);
            break;

          case 'sketches-update':
            setSketches(msg.sketches);
            break;

          case 'draw-stroke':
            if (msg.target === 'storyboard') {
              setStoryboardFrames(prev => prev.map(f => {
                if (f.id === msg.id) {
                  // Guard against duplicates
                  if (f.strokes.some(s => s.id === msg.stroke.id)) return f;
                  return { ...f, strokes: [...f.strokes, msg.stroke] };
                }
                return f;
              }));
            } else if (msg.target === 'sketch') {
              setSketches(prev => prev.map(s => {
                if (s.id === msg.id) {
                  if (s.strokes.some(st => st.id === msg.stroke.id)) return s;
                  return { ...s, strokes: [...s.strokes, msg.stroke] };
                }
                return s;
              }));
            }
            break;

          case 'draw-clear':
            if (msg.target === 'storyboard') {
              setStoryboardFrames(prev => prev.map(f => f.id === msg.id ? { ...f, strokes: [] } : f));
            } else if (msg.target === 'sketch') {
              setSketches(prev => prev.map(s => s.id === msg.id ? { ...s, strokes: [] } : s));
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error processing received WS message:', err);
      }
    };

    socket.onclose = () => {
      setConnectionStatus('disconnected');
      if (isUnmountingRef.current) return;
      
      // Auto-reconnect with backing-off exponential timers
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isUnmountingRef.current) return;
        connectWebSocket(usernameToUse);
      }, 4000);
    };

    socket.onerror = () => {
      setConnectionStatus('disconnected');
    };
  };

  useEffect(() => {
    isUnmountingRef.current = false;
    if (!showNameModal && userName) {
      connectWebSocket(userName);
    }
    return () => {
      isUnmountingRef.current = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [projectId, showNameModal]);

  // Effect to save/restore scroll positions of the active scene when switching scenes or view modes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === 'script' && !isFullScriptView) {
        const viewport = document.getElementById('script-viewport');
        if (viewport) {
          const savedPos = scriptScrollPositionsRef.current[activeSceneId] || 0;
          viewport.scrollTop = savedPos;
        }
      } else if (viewMode === 'storyboard') {
        const viewport = document.getElementById('storyboard-viewport');
        if (viewport) {
          const savedPos = storyboardScrollPositionsRef.current[activeSceneId] || 0;
          viewport.scrollTop = savedPos;
        }
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (viewMode === 'script' && !isFullScriptView) {
        const viewport = document.getElementById('script-viewport');
        if (viewport) {
          scriptScrollPositionsRef.current[activeSceneId] = viewport.scrollTop;
        }
      } else if (viewMode === 'storyboard') {
        const viewport = document.getElementById('storyboard-viewport');
        if (viewport) {
          storyboardScrollPositionsRef.current[activeSceneId] = viewport.scrollTop;
        }
      }
    };
  }, [activeSceneId, viewMode, isFullScriptView]);

  // Effect to save/restore scroll positions of individual brainstorm tabs
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === 'brainstorm') {
        const viewport = document.getElementById('brainstorm-viewport');
        if (viewport) {
          const savedPos = brainstormScrollPositionsRef.current[brainstormTab] || 0;
          viewport.scrollTop = savedPos;
        }
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (viewMode === 'brainstorm') {
        const viewport = document.getElementById('brainstorm-viewport');
        if (viewport) {
          brainstormScrollPositionsRef.current[brainstormTab] = viewport.scrollTop;
        }
      }
    };
  }, [brainstormTab, viewMode]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    localStorage.setItem('coscript_username', userName.trim());
    setShowNameModal(false);
  };

  // Helper to send messages to WS Server
  const emitMessage = (msg: WSMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  // Scene Operations (with automatic presence sync)
  const handleAddScene = (actId?: string) => {
    const nextOrder = scenes.length > 0 ? Math.max(...scenes.map(s => s.order)) + 1 : 0;
    const newSceneId = `scene-${crypto.randomUUID()}`;
    const realSceneCount = scenes.filter(s => !s.isAct).length;
    const newScene: Scene = {
      id: newSceneId,
      title: `Scene ${realSceneCount + 1}: New Scene`,
      order: nextOrder,
      actId
    };

    const updatedScenes = [...scenes, newScene].sort((a, b) => a.order - b.order);
    setScenes(updatedScenes);
    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
    setActiveSceneId(newSceneId);

    // Create a default placeholder action block for the new scene
    const newBlock: ScriptBlock = {
      id: `block-${crypto.randomUUID()}`,
      type: 'scene-heading',
      text: 'INT. NEW LOCATION - DAY',
      sceneId: newSceneId
    };
    const updatedBlocks = [...scriptBlocks, newBlock];
    setScriptBlocks(updatedBlocks);
    emitMessage({ type: 'script-update', scriptBlocks: updatedBlocks });
  };

  const handleAddAct = () => {
    const nextOrder = scenes.length > 0 ? Math.max(...scenes.map(s => s.order)) + 1 : 0;
    const newActId = `act-${crypto.randomUUID()}`;
    const actCount = scenes.filter(s => s.isAct).length;
    const newAct: Scene = {
      id: newActId,
      title: `Act ${actCount + 1}: New Act`,
      order: nextOrder,
      isAct: true
    };

    const updatedScenes = [...scenes, newAct].sort((a, b) => a.order - b.order);
    setScenes(updatedScenes);
    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
  };

  const handleRenameScene = (id: string, newTitle: string) => {
    const updatedScenes = scenes.map(s => s.id === id ? { ...s, title: newTitle } : s);
    setScenes(updatedScenes);
    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
  };

  const handleDeleteScene = (id: string) => {
    if (scenes.filter(s => !s.isAct).length <= 1) {
      return;
    }

    const updatedScenes = scenes.filter(s => s.id !== id);
    const updatedBlocks = scriptBlocks.filter(b => b.sceneId !== id);
    const updatedFrames = storyboardFrames.filter(f => f.sceneId !== id);

    setScenes(updatedScenes);
    setScriptBlocks(updatedBlocks);
    setStoryboardFrames(updatedFrames);

    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
    emitMessage({ type: 'script-update', scriptBlocks: updatedBlocks });
    emitMessage({ type: 'storyboard-update', storyboardFrames: updatedFrames });

    if (activeSceneId === id) {
      const realScenes = updatedScenes.filter(s => !s.isAct);
      if (realScenes.length > 0) {
        setActiveSceneId(realScenes[0].id);
      }
    }
  };

  const handleDeleteAct = (actId: string) => {
    const updatedScenes = scenes
      .filter(s => s.id !== actId)
      .map(s => s.actId === actId ? { ...s, actId: undefined } : s);

    setScenes(updatedScenes);
    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
  };

  const handleSetSceneAct = (sceneId: string, actId: string | undefined) => {
    const updatedScenes = scenes.map(s => s.id === sceneId ? { ...s, actId } : s);
    setScenes(updatedScenes);
    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
  };

  const handleMoveSceneInAct = (sceneId: string, direction: 'up' | 'down') => {
    const sceneIndex = scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;
    
    const targetScene = scenes[sceneIndex];
    const siblings = scenes
      .filter(s => !s.isAct && s.actId === targetScene.actId)
      .sort((a, b) => a.order - b.order);
      
    const siblingIndex = siblings.findIndex(s => s.id === sceneId);
    if (siblingIndex === -1) return;
    
    if (direction === 'up' && siblingIndex === 0) return;
    if (direction === 'down' && siblingIndex === siblings.length - 1) return;
    
    const swapSibling = siblings[direction === 'up' ? siblingIndex - 1 : siblingIndex + 1];
    
    const updatedScenes = scenes.map(s => {
      if (s.id === targetScene.id) {
        return { ...s, order: swapSibling.order };
      }
      if (s.id === swapSibling.id) {
        return { ...s, order: targetScene.order };
      }
      return s;
    }).sort((a, b) => a.order - b.order);
    
    setScenes(updatedScenes);
    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
  };

  const handleMoveAct = (actId: string, direction: 'up' | 'down') => {
    const acts = scenes.filter(s => s.isAct).sort((a, b) => a.order - b.order);
    const actIndex = acts.findIndex(s => s.id === actId);
    if (actIndex === -1) return;
    
    if (direction === 'up' && actIndex === 0) return;
    if (direction === 'down' && actIndex === acts.length - 1) return;
    
    const targetAct = acts[actIndex];
    const swapAct = acts[direction === 'up' ? actIndex - 1 : actIndex + 1];
    
    const updatedScenes = scenes.map(s => {
      if (s.id === targetAct.id) {
        return { ...s, order: swapAct.order };
      }
      if (s.id === swapAct.id) {
        return { ...s, order: targetAct.order };
      }
      return s;
    }).sort((a, b) => a.order - b.order);
    
    setScenes(updatedScenes);
    emitMessage({ type: 'scenes-update', scenes: updatedScenes });
  };

  const handleMoveScene = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === scenes.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reorderedScenes = [...scenes];
    
    const temp = reorderedScenes[index].order;
    reorderedScenes[index].order = reorderedScenes[targetIndex].order;
    reorderedScenes[targetIndex].order = temp;

    const sorted = reorderedScenes.sort((a, b) => a.order - b.order);
    setScenes(sorted);
    emitMessage({ type: 'scenes-update', scenes: sorted });
  };

  // Script Block Operations (Collaborative Writing with custom keys)
  const blockStyles = {
    'scene-heading': {
      class: 'block-scene-heading text-left font-bold uppercase tracking-wider my-4 outline-none min-h-[1.5em] text-[#111111]',
      placeholder: 'INT. COWORKING OFFICE - DAY'
    },
    'action': {
      class: 'block-action text-left text-[#1A1A1A] leading-relaxed my-3 outline-none min-h-[1.5em]',
      placeholder: 'The team sits at the wooden table. Typing furiously.'
    },
    'character': {
      class: 'block-character text-left pl-[35%] w-full font-bold uppercase text-[#111111] mt-5 mb-1 outline-none min-h-[1.5em] tracking-wide',
      placeholder: 'CHARACTER NAME'
    },
    'parenthetical': {
      class: 'block-parenthetical text-left pl-[30%] pr-[25%] text-[#4A5568] text-[12px] italic my-1 outline-none min-h-[1.5em]',
      placeholder: '(softly)'
    },
    'dialogue': {
      class: 'block-dialogue text-left pl-[22%] pr-[18%] text-[#222222] leading-relaxed my-1.5 outline-none min-h-[1.5em]',
      placeholder: 'Type the dialogue here...'
    },
    'camera': {
      class: 'block-camera text-left font-bold tracking-tight text-[#4A5568] my-3 outline-none min-h-[1.5em] uppercase',
      placeholder: 'CLOSE ON SCREEN'
    },
    'transition': {
      class: 'block-transition text-right font-bold tracking-wider text-[#111111] my-4 outline-none min-h-[1.5em] uppercase',
      placeholder: 'FADE OUT.'
    }
  };

  const handleUpdateBlockText = (blockId: string, text: string) => {
    const updated = scriptBlocks.map(b => b.id === blockId ? { ...b, text } : b);
    setScriptBlocks(updated);
    emitMessage({ type: 'script-update', scriptBlocks: updated });
  };

  const handleBlockTypeChange = (blockId: string, newType: ScriptElementType) => {
    const updated = scriptBlocks.map(b => {
      if (b.id === blockId) {
        const shouldUpper = ['scene-heading', 'character', 'camera', 'transition'].includes(newType);
        return { 
          ...b, 
          type: newType,
          text: shouldUpper ? b.text.toUpperCase() : b.text
        };
      }
      return b;
    });
    setScriptBlocks(updated);
    emitMessage({ type: 'script-update', scriptBlocks: updated });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (scriptBlocks.length <= 1) return;
    const updated = scriptBlocks.filter(b => b.id !== blockId);
    setScriptBlocks(updated);
    emitMessage({ type: 'script-update', scriptBlocks: updated });

    // Clean up storyboard frame links
    const updatedFrames = storyboardFrames.map(f => {
      if (f.linkedBlockIds?.includes(blockId)) {
        return { ...f, linkedBlockIds: f.linkedBlockIds.filter(id => id !== blockId) };
      }
      return f;
    });
    setStoryboardFrames(updatedFrames);
    emitMessage({ type: 'storyboard-update', storyboardFrames: updatedFrames });
  };

  const handleInsertBlockAfter = (currentBlockId: string, type: ScriptElementType = 'action', text: string = '') => {
    const currentIndex = scriptBlocks.findIndex(b => b.id === currentBlockId);
    if (currentIndex === -1) return;

    const currentBlock = scriptBlocks[currentIndex];
    const newId = `block-${crypto.randomUUID()}`;
    const newBlock: ScriptBlock = {
      id: newId,
      type,
      text,
      sceneId: currentBlock.sceneId
    };

    const updated = [
      ...scriptBlocks.slice(0, currentIndex + 1),
      newBlock,
      ...scriptBlocks.slice(currentIndex + 1)
    ];

    setScriptBlocks(updated);
    setActiveBlockId(newId);
    emitMessage({ type: 'script-update', scriptBlocks: updated });
  };

  const handleUpdateAndInsertBlockAfter = (
    currentBlockId: string,
    updatedText: string,
    nextType: ScriptElementType = 'action',
    nextText: string = ''
  ) => {
    const currentIndex = scriptBlocks.findIndex(b => b.id === currentBlockId);
    if (currentIndex === -1) return;

    const currentBlock = scriptBlocks[currentIndex];
    const newId = `block-${crypto.randomUUID()}`;
    const newBlock: ScriptBlock = {
      id: newId,
      type: nextType,
      text: nextText,
      sceneId: currentBlock.sceneId
    };

    const updated = scriptBlocks.map((b, idx) => {
      if (idx === currentIndex) {
        return { ...b, text: updatedText };
      }
      return b;
    });

    const finalBlocks = [
      ...updated.slice(0, currentIndex + 1),
      newBlock,
      ...updated.slice(currentIndex + 1)
    ];

    setScriptBlocks(finalBlocks);
    setActiveBlockId(newId);
    emitMessage({ type: 'script-update', scriptBlocks: finalBlocks });
  };

  const handleMergeWithPrevious = (currentBlockId: string) => {
    const currentFilteredIndex = filteredBlocks.findIndex(b => b.id === currentBlockId);
    if (currentFilteredIndex <= 0) return;

    const prevBlock = filteredBlocks[currentFilteredIndex - 1];
    const currentBlock = filteredBlocks[currentFilteredIndex];
    const mergedText = prevBlock.text + currentBlock.text;

    const updatedBlocks = scriptBlocks.map(b => {
      if (b.id === prevBlock.id) {
        return { ...b, text: mergedText };
      }
      return b;
    }).filter(b => b.id !== currentBlock.id);

    setScriptBlocks(updatedBlocks);
    setActiveBlockId(prevBlock.id);
    
    setTimeout(() => {
      const prevEl = document.getElementById(`textarea-${prevBlock.id}`) as HTMLTextAreaElement;
      if (prevEl) {
        prevEl.focus();
        prevEl.setSelectionRange(prevBlock.text.length, prevBlock.text.length);
      }
    }, 10);

    emitMessage({ type: 'script-update', scriptBlocks: updatedBlocks });

    // Clean up storyboard frame links
    const updatedFrames = storyboardFrames.map(f => {
      if (f.linkedBlockIds?.includes(currentBlock.id)) {
        return { ...f, linkedBlockIds: f.linkedBlockIds.filter(id => id !== currentBlock.id) };
      }
      return f;
    });
    setStoryboardFrames(updatedFrames);
    emitMessage({ type: 'storyboard-update', storyboardFrames: updatedFrames });
  };

  const handleDeleteEmptyBlock = (currentBlockId: string) => {
    const currentFilteredIndex = filteredBlocks.findIndex(b => b.id === currentBlockId);
    if (currentFilteredIndex === -1) return;

    const prevBlock = currentFilteredIndex > 0 ? filteredBlocks[currentFilteredIndex - 1] : null;

    const updatedBlocks = scriptBlocks.filter(b => b.id !== currentBlockId);
    setScriptBlocks(updatedBlocks);

    if (prevBlock) {
      setActiveBlockId(prevBlock.id);
      setTimeout(() => {
        const prevEl = document.getElementById(`textarea-${prevBlock.id}`) as HTMLTextAreaElement;
        if (prevEl) {
          prevEl.focus();
          prevEl.setSelectionRange(prevBlock.text.length, prevBlock.text.length);
        }
      }, 10);
    } else {
      setActiveBlockId(null);
    }

    emitMessage({ type: 'script-update', scriptBlocks: updatedBlocks });

    // Clean up storyboard frame links
    const updatedFrames = storyboardFrames.map(f => {
      if (f.linkedBlockIds?.includes(currentBlockId)) {
        return { ...f, linkedBlockIds: f.linkedBlockIds.filter(id => id !== currentBlockId) };
      }
      return f;
    });
    setStoryboardFrames(updatedFrames);
    emitMessage({ type: 'storyboard-update', storyboardFrames: updatedFrames });
  };

  const handleNavigateUpDown = (currentBlockId: string, direction: 'up' | 'down') => {
    const currentFilteredIndex = filteredBlocks.findIndex(b => b.id === currentBlockId);
    if (currentFilteredIndex === -1) return;

    if (direction === 'up') {
      if (currentFilteredIndex > 0) {
        const prevBlock = filteredBlocks[currentFilteredIndex - 1];
        setActiveBlockId(prevBlock.id);
        setTimeout(() => {
          const el = document.getElementById(`textarea-${prevBlock.id}`) as HTMLTextAreaElement;
          if (el) {
            el.focus();
            el.setSelectionRange(prevBlock.text.length, prevBlock.text.length);
          }
        }, 10);
      }
    } else if (direction === 'down') {
      if (currentFilteredIndex < filteredBlocks.length - 1) {
        const nextBlock = filteredBlocks[currentFilteredIndex + 1];
        setActiveBlockId(nextBlock.id);
        setTimeout(() => {
          const el = document.getElementById(`textarea-${nextBlock.id}`) as HTMLTextAreaElement;
          if (el) {
            el.focus();
            el.setSelectionRange(0, 0);
          }
        }, 10);
      }
    }
  };

  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    block: ScriptBlock,
    index: number
  ) => {
    const textarea = e.currentTarget;
    const { selectionStart, value } = textarea;

    if (e.key === 'Tab') {
      e.preventDefault();
      const currentType = block.type;
      const types: ScriptElementType[] = ['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'camera', 'transition'];
      const currentIndex = types.indexOf(currentType);
      
      let nextType: ScriptElementType;
      if (e.shiftKey) {
        nextType = types[(currentIndex - 1 + types.length) % types.length];
      } else {
        nextType = types[(currentIndex + 1) % types.length];
      }

      handleBlockTypeChange(block.id, nextType);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      
      let nextType: ScriptElementType = 'action';
      if (block.type === 'character') nextType = 'dialogue';
      else if (block.type === 'parenthetical') nextType = 'dialogue';
      else if (block.type === 'dialogue') nextType = 'character';
      else if (block.type === 'scene-heading') nextType = 'action';

      const currentText = value.slice(0, selectionStart);
      const nextText = value.slice(selectionStart);

      handleUpdateAndInsertBlockAfter(block.id, currentText, nextType, nextText);
      return;
    }

    if (e.key === 'Backspace') {
      if (value === '') {
        e.preventDefault();
        handleDeleteEmptyBlock(block.id);
        return;
      }
      if (selectionStart === 0) {
        e.preventDefault();
        handleMergeWithPrevious(block.id);
        return;
      }
    }

    if (e.key === 'ArrowUp') {
      if (selectionStart === 0) {
        e.preventDefault();
        handleNavigateUpDown(block.id, 'up');
      }
    }

    if (e.key === 'ArrowDown') {
      if (selectionStart === value.length) {
        e.preventDefault();
        handleNavigateUpDown(block.id, 'down');
      }
    }
  };

  // Auto-initialize a default scene heading script block when a scene has no blocks
  useEffect(() => {
    if (initialSyncDone && activeSceneId && filteredBlocks.length === 0 && connectionStatus === 'connected') {
      const newId = `block-${crypto.randomUUID()}`;
      const newBlock: ScriptBlock = {
        id: newId,
        type: 'scene-heading',
        text: 'INT. COWORKING OFFICE - DAY',
        sceneId: activeSceneId
      };
      const updated = [...scriptBlocks, newBlock];
      setScriptBlocks(updated);
      emitMessage({ type: 'script-update', scriptBlocks: updated });
    }
  }, [initialSyncDone, activeSceneId, filteredBlocks.length, connectionStatus]);

  // Storyboard Frame Operations
  const handleAddStoryboardFrame = () => {
    const nextOrder = storyboardFrames.length > 0 ? Math.max(...storyboardFrames.map(f => f.order)) + 1 : 0;
    const newFrame: StoryboardFrame = {
      id: `frame-${crypto.randomUUID()}`,
      sceneId: activeSceneId,
      strokes: [],
      caption: 'Add caption description...',
      order: nextOrder
    };

    const updated = [...storyboardFrames, newFrame];
    setStoryboardFrames(updated);
    emitMessage({ type: 'storyboard-update', storyboardFrames: updated });
  };

  const handleUpdateFrameCaption = (frameId: string, text: string) => {
    const updated = storyboardFrames.map(f => f.id === frameId ? { ...f, caption: text } : f);
    setStoryboardFrames(updated);
    emitMessage({ type: 'storyboard-update', storyboardFrames: updated });
  };

  const handleStrokeAdded = (target: 'storyboard' | 'sketch', id: string, stroke: DrawingStroke) => {
    // 1. Update local state immediately (Optimistic response)
    if (target === 'storyboard') {
      setStoryboardFrames(prev => prev.map(f => f.id === id ? { ...f, strokes: [...f.strokes, stroke] } : f));
    } else {
      setSketches(prev => prev.map(s => s.id === id ? { ...s, strokes: [...s.strokes, stroke], updatedAt: Date.now() } : s));
    }

    // 2. Stream stroke to other coworkers via WS Server
    emitMessage({
      type: 'draw-stroke',
      target,
      id,
      stroke
    });
  };

  const handleClearCanvas = (target: 'storyboard' | 'sketch', id: string) => {
    // 1. Update locally
    if (target === 'storyboard') {
      setStoryboardFrames(prev => prev.map(f => f.id === id ? { ...f, strokes: [] } : f));
    } else {
      setSketches(prev => prev.map(s => s.id === id ? { ...s, strokes: [], updatedAt: Date.now() } : s));
    }

    // 2. Broadcast clear event
    emitMessage({
      type: 'draw-clear',
      target,
      id
    });
  };

  const handleDeleteStoryboardFrame = (frameId: string) => {
    const updated = storyboardFrames.filter(f => f.id !== frameId);
    setStoryboardFrames(updated);
    emitMessage({ type: 'storyboard-update', storyboardFrames: updated });
  };

  const handleLinkTextToStoryboard = (frameId: string, blockIds: string[]) => {
    const updated = storyboardFrames.map(f => {
      if (f.id === frameId) {
        const existing = f.linkedBlockIds || [];
        const merged = Array.from(new Set([...existing, ...blockIds]));
        return { ...f, linkedBlockIds: merged };
      }
      return f;
    });
    setStoryboardFrames(updated);
    emitMessage({ type: 'storyboard-update', storyboardFrames: updated });
  };

  const getSelectedBlockIds = (): string[] => {
    if (selectedBlockIds.length > 0) {
      return selectedBlockIds;
    }
    return activeBlockId ? [activeBlockId] : [];
  };

  const handleAddSelectedTextToFrame = (frameId: string) => {
    const selectedIds = getSelectedBlockIds();
    if (selectedIds.length === 0) return;
    handleLinkTextToStoryboard(frameId, selectedIds);
    setSelectedBlockIds([]);
    setContextMenu(null);
  };

  const handleStartEditingLinkedText = (frameId: string) => {
    setEditingStoryboardFrameId(frameId);
    setContextMenu(null);
    const frame = storyboardFrames.find(f => f.id === frameId);
    const validBlockIds = (frame?.linkedBlockIds || []).filter(id => scriptBlocks.some(b => b.id === id));
    if (validBlockIds.length > 0) {
      const firstBlockId = validBlockIds[0];
      setTimeout(() => {
        document.getElementById(`textarea-${firstBlockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const handleStoryboardContextMenu = (e: React.MouseEvent, frameId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      frameId
    });
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  // Sketches Operations (Creative sketching board)
  const handleAddSketch = () => {
    const newId = `sketch-${crypto.randomUUID()}`;
    const newSketch: Sketch = {
      id: newId,
      title: `Sketch ${sketches.length + 1}: Concept Board`,
      strokes: [],
      description: 'Describe your visual concept, stage set or characters.',
      updatedAt: Date.now()
    };

    const updated = [newSketch, ...sketches];
    setSketches(updated);
    emitMessage({ type: 'sketches-update', sketches: updated });
    setActiveSketchId(newId);
  };

  const handleUpdateSketchDetails = (sketchId: string, updates: Partial<Sketch>) => {
    const updated = sketches.map(s => s.id === sketchId ? { ...s, ...updates, updatedAt: Date.now() } : s);
    setSketches(updated);
    emitMessage({ type: 'sketches-update', sketches: updated });
  };

  const handleDeleteSketch = (sketchId: string) => {
    const updated = sketches.filter(s => s.id !== sketchId);
    setSketches(updated);
    emitMessage({ type: 'sketches-update', sketches: updated });
    if (activeSketchId === sketchId) {
      setActiveSketchId(updated[0]?.id || null);
    }
  };

  // Backup JSON export capability
  const handleExportJSON = () => {
    const backupData = {
      name: projectName,
      scenes,
      scriptBlocks,
      storyboardFrames,
      sketches
    };
    
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const safeTitle = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadAnchor.setAttribute('download', `${safeTitle}_workspace_backup.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // PDF Export screenplay trigger
  const handleExportPDF = () => {
    exportScreenplayToPDF(projectName, scenes, scriptBlocks);
  };

  // Copy share workspace connection link
  const handleShareWorkspace = () => {
    const shareUrl = `${window.location.origin}/?project=${projectId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShowShareNotification(true);
      setTimeout(() => setShowShareNotification(false), 3000);
    });
  };

  // --- DRAG AND DROP & BRAINSTORM HELPERS ---
  const handleReorderStoryboardFrames = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;

    const currentSceneFrames = storyboardFrames
      .filter(f => f.sceneId === activeSceneId)
      .sort((a, b) => a.order - b.order);

    const draggedIndex = currentSceneFrames.findIndex(f => f.id === draggedId);
    const targetIndex = currentSceneFrames.findIndex(f => f.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const updatedFrames = [...currentSceneFrames];
    const [draggedFrame] = updatedFrames.splice(draggedIndex, 1);
    updatedFrames.splice(targetIndex, 0, draggedFrame);

    const orderMap = new Map<string, number>();
    updatedFrames.forEach((frame, idx) => {
      orderMap.set(frame.id, idx);
    });

    const newStoryboardFrames = storyboardFrames.map(f => {
      if (orderMap.has(f.id)) {
        return { ...f, order: orderMap.get(f.id)! };
      }
      return f;
    });

    setStoryboardFrames(newStoryboardFrames);
    emitMessage({ type: 'storyboard-update', storyboardFrames: newStoryboardFrames });
  };

  const handleReorderActs = (draggedActId: string, targetActId: string) => {
    if (draggedActId === targetActId) return;

    const sortedActs = scenes.filter(s => s.isAct).sort((a, b) => a.order - b.order);
    const draggedIndex = sortedActs.findIndex(s => s.id === draggedActId);
    const targetIndex = sortedActs.findIndex(s => s.id === targetActId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const updatedActs = [...sortedActs];
    const [draggedAct] = updatedActs.splice(draggedIndex, 1);
    updatedActs.splice(targetIndex, 0, draggedAct);

    const orderMap = new Map<string, number>();
    updatedActs.forEach((act, idx) => {
      orderMap.set(act.id, idx * 100);
    });

    const newScenes = scenes.map(s => {
      if (s.isAct && orderMap.has(s.id)) {
        return { ...s, order: orderMap.get(s.id)! };
      }
      return s;
    }).sort((a, b) => a.order - b.order);

    setScenes(newScenes);
    emitMessage({ type: 'scenes-update', scenes: newScenes });
  };

  const handleReorderScenes = (draggedSceneId: string, targetSceneId: string) => {
    if (draggedSceneId === targetSceneId) return;

    const draggedScene = scenes.find(s => s.id === draggedSceneId);
    const targetScene = scenes.find(s => s.id === targetSceneId);
    if (!draggedScene || !targetScene || draggedScene.isAct || targetScene.isAct) return;

    const targetActId = targetScene.actId;

    const siblingScenes = scenes
      .filter(s => !s.isAct && s.actId === targetActId && s.id !== draggedSceneId)
      .sort((a, b) => a.order - b.order);

    const targetIndex = siblingScenes.findIndex(s => s.id === targetSceneId);
    if (targetIndex === -1) return;

    const updatedSiblings = [...siblingScenes];
    updatedSiblings.splice(targetIndex, 0, { ...draggedScene, actId: targetActId });

    const orderMap = new Map<string, number>();
    updatedSiblings.forEach((scene, idx) => {
      orderMap.set(scene.id, idx);
    });

    const newScenes = scenes.map(s => {
      if (s.id === draggedSceneId) {
        return { ...s, actId: targetActId, order: orderMap.get(draggedSceneId)! };
      }
      if (!s.isAct && s.actId === targetActId && orderMap.has(s.id)) {
        return { ...s, order: orderMap.get(s.id)! };
      }
      return s;
    }).sort((a, b) => a.order - b.order);

    setScenes(newScenes);
    emitMessage({ type: 'scenes-update', scenes: newScenes });
  };

  const handleMoveSceneToActHeader = (sceneId: string, actId: string | undefined) => {
    const targetScene = scenes.find(s => s.id === sceneId);
    if (!targetScene || targetScene.isAct) return;

    const actScenes = scenes.filter(s => !s.isAct && s.actId === actId);
    const nextOrder = actScenes.length > 0 ? Math.max(...actScenes.map(s => s.order)) + 1 : 0;

    const newScenes = scenes.map(s => {
      if (s.id === sceneId) {
        return { ...s, actId, order: nextOrder };
      }
      return s;
    }).sort((a, b) => a.order - b.order);

    setScenes(newScenes);
    emitMessage({ type: 'scenes-update', scenes: newScenes });
  };

  // Find or initialize the brainstorm object from sketches
  const brainstormData = useMemo(() => {
    let bs = sketches.find(s => s.isBrainstorm);
    
    const defaultActs = ACT_SUGGESTIONS[3].map((s, idx) => ({
      id: `act-${idx + 1}`,
      title: s.title,
      description: s.description,
      turningPoints: s.turningPoints
    }));

    if (!bs) {
      return {
        id: 'brainstorm-main',
        title: 'Story Overview',
        isBrainstorm: true,
        strokes: [],
        description: '',
        updatedAt: Date.now(),
        outline: '',
        logline: '',
        theme: '',
        genre: '',
        targetAudience: '',
        actsCount: 3,
        actsList: defaultActs,
        charactersList: [],
        locationsList: []
      } as Sketch;
    }

    // Return the existing one but ensure arrays and defaults are fully initialized
    return {
      ...bs,
      outline: bs.outline || '',
      logline: bs.logline || '',
      theme: bs.theme || '',
      genre: bs.genre || '',
      targetAudience: bs.targetAudience || '',
      actsCount: bs.actsCount || 3,
      actsList: bs.actsList || defaultActs,
      charactersList: bs.charactersList || [],
      locationsList: bs.locationsList || []
    } as Sketch;
  }, [sketches]);

  const handleUpdateBrainstorm = (updates: Partial<Sketch>) => {
    const bsIndex = sketches.findIndex(s => s.isBrainstorm);
    let updatedSketches = [...sketches];
    if (bsIndex === -1) {
      const defaultActs = ACT_SUGGESTIONS[3].map((s, idx) => ({
        id: `act-${idx + 1}`,
        title: s.title,
        description: s.description,
        turningPoints: s.turningPoints
      }));
      const newBs: Sketch = {
        id: 'brainstorm-main',
        title: 'Story Overview',
        isBrainstorm: true,
        strokes: [],
        description: '',
        updatedAt: Date.now(),
        outline: '',
        logline: '',
        theme: '',
        genre: '',
        targetAudience: '',
        actsCount: 3,
        actsList: defaultActs,
        charactersList: [],
        locationsList: [],
        ...updates
      };
      updatedSketches = [newBs, ...sketches];
    } else {
      updatedSketches = sketches.map(s => s.isBrainstorm ? { ...s, ...updates, updatedAt: Date.now() } : s);
    }
    setSketches(updatedSketches);
    emitMessage({ type: 'sketches-update', sketches: updatedSketches });
  };

  const handleUpdateCharacter = (id: string, updatedFields: Partial<BrainstormCharacter>) => {
    const newList = (brainstormData.charactersList || []).map(c => 
      c.id === id ? { ...c, ...updatedFields } : c
    );
    handleUpdateBrainstorm({ charactersList: newList });
  };

  const handleUpdateLocation = (id: string, updatedFields: Partial<BrainstormLocation>) => {
    const newList = (brainstormData.locationsList || []).map(l => 
      l.id === id ? { ...l, ...updatedFields } : l
    );
    handleUpdateBrainstorm({ locationsList: newList });
  };

  const handleSelectActsCount = (num: number) => {
    let list = [...(brainstormData.actsList || [])];
    
    // Ensure list has at least `num` items
    if (num > list.length) {
      for (let i = list.length; i < num; i++) {
        const actIndex = i + 1;
        list.push({
          id: 'act-' + actIndex + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          title: '',
          description: '',
          turningPoints: ''
        });
      }
    }

    const suggestions = ACT_SUGGESTIONS[num] || [];
    
    const updatedList = list.map((act, idx) => {
      if (idx < num) {
        const sug = suggestions[idx];
        if (sug) {
          const titleVal = act.title || '';
          const descVal = act.description || '';
          const tpVal = act.turningPoints || '';

          const nextTitle = isSuggestionText(titleVal) ? sug.title : titleVal;
          const nextDesc = isSuggestionText(descVal) ? sug.description : descVal;
          const nextTp = isSuggestionText(tpVal) ? sug.turningPoints : tpVal;

          return {
            ...act,
            title: nextTitle,
            description: nextDesc,
            turningPoints: nextTp
          };
        }
      }
      return act;
    });

    handleUpdateBrainstorm({ actsCount: num, actsList: updatedList });
  };

  const activeScene = scenes.find(s => s.id === activeSceneId);
  const activeSketch = sketches.find(s => s.id === activeSketchId);

  const acts = useMemo(() => {
    return scenes.filter(s => s.isAct).sort((a, b) => a.order - b.order);
  }, [scenes]);

  const unassignedScenes = useMemo(() => {
    return scenes.filter(s => !s.isAct && !s.actId).sort((a, b) => a.order - b.order);
  }, [scenes]);

  const scenesByAct = useMemo(() => {
    const map: Record<string, Scene[]> = {};
    acts.forEach(act => {
      map[act.id] = scenes.filter(s => !s.isAct && s.actId === act.id).sort((a, b) => a.order - b.order);
    });
    return map;
  }, [scenes, acts]);

  const sceneGlobalIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    const allRegular = scenes.filter(s => !s.isAct).sort((a, b) => a.order - b.order);
    allRegular.forEach((s, idx) => {
      map[s.id] = idx + 1;
    });
    return map;
  }, [scenes]);

  const handleActClick = (actId: string) => {
    const actScenes = scenesByAct[actId] || [];
    if (actScenes.length > 0) {
      const firstScene = actScenes[0];
      setActiveSceneId(firstScene.id);
      if (isFullScriptView && viewMode === 'script') {
        setTimeout(() => {
          const firstBlock = document.querySelector(`[data-scene-id="${firstScene.id}"]`);
          const viewport = document.getElementById('script-viewport');
          if (firstBlock && viewport) {
            viewport.scrollTo({
              top: (firstBlock as HTMLElement).offsetTop - 120,
              behavior: 'smooth'
            });
          }
        }, 50);
      } else {
        setIsFullScriptView(false);
      }
    }
  };

  const handleUnassignedHeaderClick = () => {
    if (unassignedScenes.length > 0) {
      const firstScene = unassignedScenes[0];
      setActiveSceneId(firstScene.id);
      if (isFullScriptView && viewMode === 'script') {
        setTimeout(() => {
          const firstBlock = document.querySelector(`[data-scene-id="${firstScene.id}"]`);
          const viewport = document.getElementById('script-viewport');
          if (firstBlock && viewport) {
            viewport.scrollTo({
              top: (firstBlock as HTMLElement).offsetTop - 120,
              behavior: 'smooth'
            });
          }
        }, 50);
      } else {
        setIsFullScriptView(false);
      }
    }
  };

  const renderSceneItem = (scene: Scene, currentActId: string | undefined) => {
    const globalNumber = sceneGlobalIndexMap[scene.id] || 1;
    const padNumber = globalNumber.toString().padStart(2, '0');
    const isSelected = activeSceneId === scene.id && !isFullScriptView;
    
    const siblings = scenes
      .filter(s => !s.isAct && s.actId === currentActId)
      .sort((a, b) => a.order - b.order);
    const siblingIndex = siblings.findIndex(s => s.id === scene.id);

    return (
      <div
        key={scene.id}
        onClick={() => {
          setActiveSceneId(scene.id);
          if (isFullScriptView && viewMode === 'script') {
            setTimeout(() => {
              const firstBlock = document.querySelector(`[data-scene-id="${scene.id}"]`);
              const viewport = document.getElementById('script-viewport');
              if (firstBlock && viewport) {
                viewport.scrollTo({
                  top: (firstBlock as HTMLElement).offsetTop - 120,
                  behavior: 'smooth'
                });
              }
            }, 50);
          } else {
            setIsFullScriptView(false);
          }
        }}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', scene.id);
          e.dataTransfer.setData('drag-type', 'scene');
          setDraggedId(scene.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDragOverId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedId && draggedId !== scene.id) {
            setDragOverId(scene.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverId === scene.id) {
            setDragOverId(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
          const type = e.dataTransfer.getData('drag-type');
          if (type === 'scene' && sourceId && sourceId !== scene.id) {
            handleReorderScenes(sourceId, scene.id);
          }
          setDraggedId(null);
          setDragOverId(null);
        }}
        className={`group/scene relative flex flex-col p-2.5 rounded cursor-pointer transition-all border ${
          isSelected 
            ? 'bg-white border-[#E5E5E1] text-[#1A1A1A] font-semibold shadow-xs' 
            : 'hover:bg-white/50 border-transparent text-[#718096]'
        } ${dragOverId === scene.id ? 'border-dashed border-indigo-500 bg-indigo-50/50' : ''}`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 flex-grow min-w-0">
            <span className="text-[10px] text-[#A0AEC0] font-mono shrink-0">{padNumber}</span>
            <input
              type="text"
              value={scene.title}
              onChange={(e) => handleRenameScene(scene.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent font-sans text-xs font-semibold uppercase tracking-wide focus:outline-none focus:bg-[#FAFAFA] border border-transparent rounded px-1 py-0.5 w-full text-[#2D2D2A]"
            />
          </div>

          <div className="opacity-0 group-hover/scene:opacity-100 transition-opacity shrink-0 ml-1">
            <select
              value={scene.actId || ''}
              onChange={(e) => {
                e.stopPropagation();
                handleSetSceneAct(scene.id, e.target.value || undefined);
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] bg-white hover:bg-gray-50 border border-[#E5E5E1] text-[#718096] rounded px-1 py-0.5 cursor-pointer focus:outline-none max-w-[80px]"
              title="Move Scene to Act"
            >
              <option value="">No Act</option>
              {acts.map(act => (
                <option key={act.id} value={act.id}>
                  {act.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="opacity-0 group-hover/scene:opacity-100 flex items-center justify-between mt-1 pt-1 border-t border-[#E5E5E1]/40 transition-opacity">
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleMoveSceneInAct(scene.id, 'up'); }}
              disabled={siblingIndex === 0}
              className="p-0.5 hover:bg-[#FAFAFA] text-[#718096] hover:text-[#1A1A1A] rounded disabled:opacity-30 cursor-pointer"
              title="Move Scene Up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleMoveSceneInAct(scene.id, 'down'); }}
              disabled={siblingIndex === siblings.length - 1}
              className="p-0.5 hover:bg-[#FAFAFA] text-[#718096] hover:text-[#1A1A1A] rounded disabled:opacity-30 cursor-pointer"
              title="Move Scene Down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteScene(scene.id); }}
            className="p-0.5 hover:bg-[#FAFAFA] text-[#718096] hover:text-red-600 rounded cursor-pointer"
            title="Delete Scene"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-[#F7F7F5] flex flex-col text-[#2D2D2A]" id="editor-workspace">
      
      {/* Name Input Modal if not connected */}
      {showNameModal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-sm w-full p-6 border border-[#E5E5E1] shadow-md">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A] mb-2">Join Workspace</h2>
            <p className="text-xs text-[#718096] mb-4 font-light">Enter your name so other writers in this workspace can recognize you in real time.</p>
            <form onSubmit={handleSaveName} className="space-y-4">
              <input
                type="text"
                required
                maxLength={20}
                placeholder="Sarah Conner..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-4 py-2 text-sm focus:outline-none focus:border-[#1A1A1A] transition-colors"
              />
              <button
                type="submit"
                className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white rounded py-2 text-sm font-medium transition-colors cursor-pointer"
              >
                Join Collaborative Board
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {error && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-sm w-full p-6 border border-[#E5E5E1] shadow-md text-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-2">Project Not Found</h2>
            <p className="text-xs text-[#718096] mb-5 font-light leading-relaxed">
              This screenplay project may have been deleted, or the shared workspace link is invalid.
            </p>
            <button
              onClick={onBack}
              className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white rounded py-2.5 text-sm font-medium transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Workspace Header */}
      <header className="relative bg-white border-b border-[#E5E5E1] h-14 shrink-0 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-[#FAFAFA] text-[#718096] hover:text-[#1A1A1A] rounded border border-transparent hover:border-[#E5E5E1] transition-colors cursor-pointer"
            title="Go back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="h-4 w-[1px] bg-[#E5E5E1]" />
          
          <div>
            <span className="text-[9px] uppercase font-mono tracking-widest text-[#A0AEC0] font-bold">SCREENPLAY WORKSPACE</span>
            <h2 className="text-sm font-bold text-[#1A1A1A] leading-none truncate max-w-[180px] sm:max-w-xs">{projectName}</h2>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center bg-[#F1F1F1] rounded p-0.5 border border-[#E5E5E1]">
          <button
            onClick={() => setViewMode('script')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${viewMode === 'script' ? 'bg-white text-[#1A1A1A] border border-[#E5E5E1] shadow-xs' : 'text-[#718096] hover:text-[#1A1A1A]'}`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Script</span>
          </button>
          <button
            onClick={() => setViewMode('storyboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${viewMode === 'storyboard' ? 'bg-white text-[#1A1A1A] border border-[#E5E5E1] shadow-xs' : 'text-[#718096] hover:text-[#1A1A1A]'}`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Storyboard</span>
          </button>
          <button
            onClick={() => setViewMode('brainstorm')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${viewMode === 'brainstorm' ? 'bg-white text-[#1A1A1A] border border-[#E5E5E1] shadow-xs' : 'text-[#718096] hover:text-[#1A1A1A]'}`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Brainstorm</span>
          </button>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-1.5">
          {/* Combined Connection & Collaborators Presence Capsule */}
          <div 
            className="flex items-center gap-2 bg-[#FAFAFA] text-[#718096] border border-[#E5E5E1] pl-2.5 pr-2.5 py-1.5 rounded-md shadow-xs select-none"
            title={connectionStatus === 'connected' ? `Connected to workspace • ${collaborators.length + 1} online` : 'Attempting reconnection'}
          >
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-tight">
              <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-[#27C93F] animate-pulse' : 'bg-[#FFBD2E] animate-spin'}`} />
              <span className="text-stone-700 uppercase">{connectionStatus}</span>
            </div>

            {/* Separator */}
            {collaborators.length > 0 && (
              <div className="w-[1px] h-3 bg-[#E5E5E1]" />
            )}

            {/* Online Collaborators Avatars */}
            {collaborators.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#A0AEC0] hidden lg:inline mr-0.5">Online:</span>
                <div className="flex items-center -space-x-1 overflow-hidden">
                  {collaborators.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white shadow-xs select-none"
                      style={{ backgroundColor: c.color }}
                      title={`${c.name}`}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                  {collaborators.length > 5 && (
                    <div
                      className="w-4 h-4 rounded-full border border-white bg-[#E5E5E1] flex items-center justify-center text-[8px] font-bold text-stone-600 shadow-xs select-none"
                      title={`${collaborators.length - 5} more online`}
                    >
                      +{collaborators.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dropdown for Share & Export options */}
          <div className="relative" ref={shareExportDropdownRef}>
            <button
              onClick={() => setShowShareExportDropdown(!showShareExportDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white text-xs font-semibold rounded transition-all shadow-xs cursor-pointer"
              title="Share or Export options"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share & Export</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showShareExportDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showShareExportDropdown && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-[#E5E5E1] rounded-lg shadow-lg py-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    handleShareWorkspace();
                    setShowShareExportDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#FAFAFA] text-left text-[#1A1A1A] font-medium transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#718096]" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800">Copy Invite Link</span>
                    <span className="text-[10px] text-[#A0AEC0] font-light">Collaborate live with others</span>
                  </div>
                </button>

                <div className="h-[1px] bg-[#E5E5E1] my-1" />

                <button
                  onClick={() => {
                    handleExportPDF();
                    setShowShareExportDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#FAFAFA] text-left text-[#1A1A1A] font-medium transition-colors cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-[#718096]" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800">Print Screenplay PDF</span>
                    <span className="text-[10px] text-[#A0AEC0] font-light">Export readable screenplay script</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleExportJSON();
                    setShowShareExportDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#FAFAFA] text-left text-[#1A1A1A] font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#718096]" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800">Backup JSON Data</span>
                    <span className="text-[10px] text-[#A0AEC0] font-light">Save layout and sketches offline</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Share Toast */}
      {showShareNotification && (
        <div className="fixed top-16 right-4 z-40 bg-[#1A1A1A] text-white text-xs px-3.5 py-2.5 rounded shadow-lg flex items-center gap-2 border border-[#E5E5E1] transition-all duration-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Invite link copied! Send it to coworkers to write together.</span>
        </div>
      )}

      {/* Workspace Body Split */}
      <div className="flex-grow flex overflow-hidden relative">
        
        {/* Left Side: Scenes panel (For Script and Storyboard view) */}
        {viewMode !== 'brainstorm' && showSceneNavigator && (
          <div 
            className="relative flex shrink-0 z-20"
            onMouseEnter={() => setIsHoveredSceneNavigator(true)}
            onMouseLeave={() => setIsHoveredSceneNavigator(false)}
          >
            <aside className="w-64 border-r border-[#E5E5E1] bg-[#FAFAFA] flex flex-col shrink-0 select-none">
            <div className="p-3 border-b border-[#E5E5E1] bg-white flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#718096]">Scene Navigator</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAddScene(undefined)}
                  className="flex-grow flex items-center justify-center gap-1 py-1 px-2 text-[11px] bg-white hover:bg-[#FAFAFA] text-[#2D2D2A] hover:text-[#1A1A1A] rounded border border-[#E5E5E1] shadow-2xs font-semibold transition-all cursor-pointer"
                  title="Create a new Scene"
                >
                  <Plus className="w-3.5 h-3.5 text-[#718096]" />
                  <span>Scene</span>
                </button>
                <button
                  onClick={handleAddAct}
                  className="flex-grow flex items-center justify-center gap-1 py-1 px-2 text-[11px] bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white rounded border border-transparent shadow-sm font-semibold transition-all cursor-pointer"
                  title="Create a new Act folder"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-white/90" />
                  <span>Act Folder</span>
                </button>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-3" id="scene-list-panel">
              {/* 1. UNASSIGNED SCENES */}
              {unassignedScenes.length > 0 && (
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverId('unassigned-header');
                  }}
                  onDragLeave={() => {
                    if (dragOverId === 'unassigned-header') {
                      setDragOverId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
                    const type = e.dataTransfer.getData('drag-type');
                    if (type === 'scene' && sourceId) {
                      handleMoveSceneToActHeader(sourceId, undefined);
                    }
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className={`space-y-1 p-1 rounded transition-all ${
                    dragOverId === 'unassigned-header' 
                      ? 'border-2 border-dashed border-indigo-500 bg-indigo-50/40' 
                      : 'border-transparent'
                  }`}
                >
                  {acts.length > 0 && (
                    <div 
                      onClick={handleUnassignedHeaderClick}
                      className="px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#A0AEC0] hover:text-[#1A1A1A] hover:bg-[#E5E5E1]/20 rounded cursor-pointer transition-colors"
                      title="Click to view first unassigned scene"
                    >
                      <span>Unassigned Scenes</span>
                      <span className="bg-[#E5E5E1] text-[#718096] rounded-full px-1.5 py-0.2 font-mono text-[9px]">{unassignedScenes.length}</span>
                    </div>
                  )}
                  {unassignedScenes.map((scene) => renderSceneItem(scene, undefined))}
                </div>
              )}

              {/* 2. ACT FOLDERS */}
              {acts.map((act) => {
                const actScenes = scenesByAct[act.id] || [];
                const isCollapsed = !!collapsedActs[act.id];
                const actIndex = acts.findIndex(a => a.id === act.id);
                
                return (
                  <div key={act.id} className="space-y-1 border-b border-[#E5E5E1]/40 pb-2">
                    {/* Act Folder Header */}
                    <div 
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', act.id);
                        e.dataTransfer.setData('drag-type', 'act');
                        setDraggedId(act.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedId && draggedId !== act.id) {
                          setDragOverId(act.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverId === act.id) {
                          setDragOverId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
                        const type = e.dataTransfer.getData('drag-type');
                        if (type === 'act' && sourceId && sourceId !== act.id) {
                          handleReorderActs(sourceId, act.id);
                        } else if (type === 'scene' && sourceId) {
                          handleMoveSceneToActHeader(sourceId, act.id);
                        }
                        setDraggedId(null);
                        setDragOverId(null);
                      }}
                      onClick={() => handleActClick(act.id)}
                      className={`group relative flex items-center justify-between p-2 rounded bg-[#EFEFEA] hover:bg-[#E7E7E0] border transition-all gap-1 cursor-pointer ${
                        dragOverId === act.id 
                          ? 'border-2 border-dashed border-indigo-500 bg-indigo-50/50 shadow-xs' 
                          : 'border-[#E1E1DC]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-grow min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedActs(prev => ({ ...prev, [act.id]: !prev[act.id] }));
                          }}
                          className="text-[#718096] hover:text-[#1A1A1A] transition-colors shrink-0"
                        >
                          {isCollapsed ? (
                            <Folder className="w-4 h-4 text-amber-600" />
                          ) : (
                            <FolderOpen className="w-4 h-4 text-amber-500" />
                          )}
                        </button>
                        <input
                          type="text"
                          value={act.title}
                          onChange={(e) => handleRenameScene(act.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent font-sans text-xs font-bold uppercase tracking-wider focus:outline-none focus:bg-[#FAFAFA] border border-transparent rounded px-1 py-0.5 w-full text-[#1A1A1A]"
                        />
                      </div>

                      {/* Controls on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddScene(act.id); }}
                          className="p-0.5 hover:bg-white/60 text-[#718096] hover:text-[#1A1A1A] rounded"
                          title="Add Scene to this Act"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveAct(act.id, 'up'); }}
                          disabled={actIndex === 0}
                          className="p-0.5 hover:bg-white/60 text-[#718096] hover:text-[#1A1A1A] rounded disabled:opacity-30"
                          title="Move Act Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveAct(act.id, 'down'); }}
                          disabled={actIndex === acts.length - 1}
                          className="p-0.5 hover:bg-white/60 text-[#718096] hover:text-[#1A1A1A] rounded disabled:opacity-30"
                          title="Move Act Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteAct(act.id); }}
                          className="p-0.5 hover:bg-white/60 text-[#718096] hover:text-red-600 rounded"
                          title="Delete Act Folder (Scenes are kept)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Act Scenes (Indented list) */}
                    {!isCollapsed && (
                      <div className="pl-4 border-l border-[#E5E5E1] ml-4 space-y-1 mt-1">
                        {actScenes.length === 0 ? (
                          <div className="text-[10px] text-[#A0AEC0] italic py-1 px-2.5">
                            Empty Act folder.
                          </div>
                        ) : (
                          actScenes.map((scene) => renderSceneItem(scene, act.id))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 3. EMPTY STATE */}
              {scenes.length === 0 && (
                <div className="text-center text-[#A0AEC0] text-xs py-8 px-4 font-sans">
                  No scenes or acts found.
                </div>
              )}
            </div>

            {/* Bottom: Focus Entire screenplay option */}
            {viewMode === 'script' && (
              <div className="p-4 bg-[#F1F1F1] border-t border-[#E5E5E1]">
                <button
                  onClick={() => setIsFullScriptView(!isFullScriptView)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 border rounded text-xs font-bold uppercase tracking-tight cursor-pointer transition-all ${isFullScriptView ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' : 'bg-white border-[#E5E5E1] hover:bg-[#FAFAFA] text-[#2D2D2A]'}`}
                >
                  {isFullScriptView ? 'Show Focused Scene' : 'Show Full screenplay'}
                </button>
              </div>
            )}
            </aside>
            {/* Splitter Hover collapse button */}
            <button
              onClick={() => setShowSceneNavigator(false)}
              className={`absolute top-1/2 -right-3 -translate-y-1/2 w-5 h-12 flex items-center justify-center rounded-r-lg shadow-sm cursor-pointer transition-all z-20 group ${
                isHoveredSceneNavigator 
                  ? 'bg-[#1A1A1A] border border-[#1A1A1A] text-white scale-y-110 translate-x-0.5 shadow-md' 
                  : 'bg-white border border-[#E5E5E1] text-[#718096] hover:bg-[#FAFAFA]'
              }`}
              title="Collapse Scene Navigator"
            >
              <ChevronLeft className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {/* Closed Left Side expand handle */}
        {viewMode !== 'brainstorm' && !showSceneNavigator && (
          <button
            onClick={() => setShowSceneNavigator(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-12 flex items-center justify-center bg-white border-y border-r border-[#E5E5E1] rounded-r-lg shadow-xs hover:bg-[#1A1A1A] hover:border-[#1A1A1A] hover:text-white hover:scale-y-110 hover:translate-x-0.5 hover:shadow-md text-[#718096] cursor-pointer transition-all z-30 group"
            title="Expand Scene Navigator"
          >
            <ChevronRight className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Center Canvas Main Body Area */}
        <main className="flex-grow flex flex-col bg-[#F7F7F5] overflow-hidden relative">
          

          {/* Stationary Elements Formatting Bar (Clean Minimalism) */}
          {viewMode === 'script' && (
            <div className="bg-white border-b border-[#E5E5E1] px-6 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-4 select-none z-10 shadow-xs">
              <div className="flex items-center gap-1 flex-wrap">
                {(['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'camera', 'transition'] as ScriptElementType[]).map((type) => {
                  const activeBlock = scriptBlocks.find(b => b.id === activeBlockId);
                  const isTypeActive = activeBlock?.type === type;
                  return (
                    <button
                      key={type}
                      disabled={!activeBlock}
                      onClick={() => activeBlock && handleBlockTypeChange(activeBlock.id, type)}
                      className={`px-3 py-1.5 rounded text-[11px] font-semibold tracking-tight transition-all cursor-pointer border ${
                        !activeBlock 
                          ? 'text-[#CBD5E0] border-transparent cursor-not-allowed opacity-50' 
                          : isTypeActive 
                            ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white font-bold shadow-xs' 
                            : 'bg-white border-[#E5E5E1] text-[#718096] hover:bg-[#FAFAFA] hover:text-[#1A1A1A]'
                      }`}
                    >
                      {type.replace('-', ' ').toUpperCase()}
                    </button>
                  );
                })}
              </div>

              
            </div>
          )}

          {/* 1. VIEW MODE: SCRIPT EDITOR */}
          {viewMode === 'script' && (
            <div className="flex-grow overflow-y-auto p-8 sm:p-12 pb-48 sm:pb-64 flex flex-col items-center relative" id="script-viewport">
                
                {/* Editing storyboard link mode bar */}
                {editingStoryboardFrameId && (
                  <div className="bg-emerald-500 text-white rounded px-4 py-2.5 shadow-sm text-xs flex items-center justify-between w-full max-w-2xl mb-4 animate-fade-in font-sans select-none z-10 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                      <span>
                        Editing linked lines for <strong>Shot #{storyboardFrames.filter(f => f.sceneId === activeSceneId).findIndex(f => f.id === editingStoryboardFrameId) + 1}</strong>.
                        Click "+ Link" or "✓ Linked" next to any line to toggle association.
                      </span>
                    </div>
                    <button
                      onClick={() => setEditingStoryboardFrameId(null)}
                      className="bg-white text-emerald-600 hover:bg-emerald-50 px-2.5 py-1 rounded font-bold uppercase tracking-tight text-[10px] transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                )}

                <div className="bg-white max-w-2xl w-full min-h-[500px] lg:min-h-[calc(100vh-240px)] shadow-sm rounded border border-[#E5E5E1] p-6 sm:p-10 md:p-16 pb-12 sm:pb-20 md:pb-24 font-mono text-[13px] leading-relaxed relative flex flex-col transition-all duration-200 shrink-0">
                  {connectionStatus !== 'connected' && (
                    <div className="absolute top-3 left-3 right-3 bg-amber-50 border border-amber-200 rounded px-4 py-2.5 text-center text-amber-800 text-xs font-sans flex items-center justify-center gap-2 select-none z-10">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                      <span><strong>Disconnected</strong> — Reconnecting... Any local edits will sync once connection is restored.</span>
                    </div>
                  )}

                  <p className="text-center text-[#A0AEC0] text-[10px] uppercase tracking-widest font-sans mb-8">
                    {projectName} — {isFullScriptView ? 'FULL PLAY' : (activeScene?.title || '')}
                  </p>

                  {/* List block elements */}
                  <div className="flex-grow flex flex-col space-y-2 outline-none min-h-[400px]">
                    {filteredBlocks.map((block, index) => {
                      const style = blockStyles[block.type] || blockStyles['action'];
                      
                      // Highlight/Opacity logic based on storyboard frame selection
                      const isSelectedFrameActive = selectedStoryboardFrameId !== null;
                      const selectedFrame = storyboardFrames.find(f => f.id === selectedStoryboardFrameId);
                      const validSelectedLinkedBlockIds = (selectedFrame?.linkedBlockIds || []).filter(id => scriptBlocks.some(b => b.id === id));
                      const isBlockLinkedToSelected = validSelectedLinkedBlockIds.includes(block.id);
                      const hasSelectedLinks = validSelectedLinkedBlockIds.length > 0;

                      const isHoveredFrameActive = hoveredStoryboardFrameId !== null;
                      const hoveredFrame = storyboardFrames.find(f => f.id === hoveredStoryboardFrameId);
                      const validHoveredLinkedBlockIds = (hoveredFrame?.linkedBlockIds || []).filter(id => scriptBlocks.some(b => b.id === id));
                      const isBlockLinkedToHovered = validHoveredLinkedBlockIds.includes(block.id);
                      const hasHoveredLinks = validHoveredLinkedBlockIds.length > 0;

                      let highlightClass = '';
                      let opacityClass = 'transition-all duration-300';

                      if (isHoveredFrameActive) {
                        if (isBlockLinkedToHovered) {
                          highlightClass = 'border-l-2 border-amber-500 pl-2 text-[#b45309] font-semibold';
                        } else if (hasHoveredLinks) {
                          opacityClass = 'opacity-20 pointer-events-none scale-[0.98]';
                        }
                      } else if (isSelectedFrameActive) {
                        if (isBlockLinkedToSelected) {
                          highlightClass = 'border-l-2 border-stone-600 pl-2 text-black font-semibold';
                        } else if (hasSelectedLinks) {
                          opacityClass = 'opacity-40';
                        }
                      }

                      const isBlockExplicitlySelected = selectedBlockIds.includes(block.id);
                      const selectedBgClass = isBlockExplicitlySelected 
                        ? 'bg-amber-50/70 border-l-2 border-amber-400 -mx-4 px-4 py-1.5 rounded shadow-2xs' 
                        : '';

                      return (
                        <div key={block.id} id={`block-${block.id}`} data-scene-id={block.sceneId} className={`${opacityClass} ${selectedBgClass} relative w-full group/block flex items-start gap-2`}>
                          {/* Multi-selection Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBlockIds(prev => 
                                prev.includes(block.id) 
                                  ? prev.filter(id => id !== block.id) 
                                  : [...prev, block.id]
                              );
                            }}
                            className={`absolute -left-10 top-1.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer z-20 ${
                              isBlockExplicitlySelected
                                ? 'bg-amber-500 border-amber-500 text-white shadow-xs opacity-100'
                                : 'bg-white border-[#CBD5E0] hover:border-amber-500 hover:bg-amber-50/50 opacity-0 group-hover/block:opacity-100'
                            }`}
                            title="Select line"
                          >
                            {isBlockExplicitlySelected ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-stone-300 opacity-0 group-hover/block:opacity-100" />
                            )}
                          </button>

                          {editingStoryboardFrameId && (
                            <button
                              onClick={() => {
                                const frame = storyboardFrames.find(f => f.id === editingStoryboardFrameId);
                                if (!frame) return;
                                const existing = frame.linkedBlockIds || [];
                                const updatedLinks = existing.includes(block.id)
                                  ? existing.filter(id => id !== block.id)
                                  : [...existing, block.id];
                                
                                const updatedFrames = storyboardFrames.map(f => f.id === editingStoryboardFrameId ? { ...f, linkedBlockIds: updatedLinks } : f);
                                setStoryboardFrames(updatedFrames);
                                emitMessage({ type: 'storyboard-update', storyboardFrames: updatedFrames });
                              }}
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-colors cursor-pointer mt-1 select-none ${
                                (storyboardFrames.find(f => f.id === editingStoryboardFrameId)?.linkedBlockIds || []).includes(block.id)
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-stone-100 hover:bg-stone-200 text-[#718096]'
                              }`}
                            >
                              {(storyboardFrames.find(f => f.id === editingStoryboardFrameId)?.linkedBlockIds || []).includes(block.id)
                                ? '✓ Linked'
                                : '+ Link'
                              }
                            </button>
                          )}
                          <div className="flex-grow">
                            <BlockInput
                              id={block.id}
                              type={block.type}
                              text={block.text}
                              placeholder={style.placeholder}
                              className={`${style.class} ${highlightClass}`}
                              onChange={(text) => handleUpdateBlockText(block.id, text)}
                              onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                              onFocus={() => setActiveBlockId(block.id)}
                              isActive={activeBlockId === block.id}
                              existingCharacters={existingCharacters}
                              characters={brainstormData.charactersList || []}
                              locations={brainstormData.locationsList || []}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 sm:mt-12 md:mt-16 text-center text-[10px] text-[#A0AEC0] font-sans select-none border-t border-[#E5E5E1] pt-4 shrink-0">
                    Press <kbd className="bg-[#FAFAFA] px-1 py-0.5 rounded border border-[#E5E5E1]">TAB</kbd> to cycle formats. Press <kbd className="bg-[#FAFAFA] px-1 py-0.5 rounded border border-[#E5E5E1]">ENTER</kbd> for next element.
                  </div>
                </div>

                {/* Floating selection actions bar */}
                {selectedBlockIds.length > 0 && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-white px-5 py-3 rounded-xl shadow-xl z-40 flex items-center gap-4 animate-fade-in text-xs font-sans border border-stone-800 select-none">
                    <span className="font-semibold text-stone-300">
                      <strong className="text-white text-sm mr-1">{selectedBlockIds.length}</strong>
                      {selectedBlockIds.length === 1 ? 'line' : 'lines'} selected
                    </span>
                    <div className="h-4 w-px bg-stone-700" />
                    
                    {storyboardFrames.filter(f => f.sceneId === activeSceneId).length > 0 ? (
                      <div className="relative group/link-dropdown">
                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded flex items-center gap-1.5 transition-colors cursor-pointer">
                          <span>Link to Panel...</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-full mb-2 right-0 bg-white border border-[#E5E5E1] rounded shadow-lg hidden group-hover/link-dropdown:block min-w-[200px] text-[#1A1A1A] py-1 max-h-[200px] overflow-y-auto">
                          {storyboardFrames
                            .filter(f => f.sceneId === activeSceneId)
                            .map((frame, idx) => (
                              <button
                                key={frame.id}
                                onClick={() => {
                                  handleLinkTextToStoryboard(frame.id, selectedBlockIds);
                                  setSelectedBlockIds([]);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#FAFAFA] text-xs font-medium truncate flex items-center gap-2 cursor-pointer border-b border-[#F1F1F1] last:border-0"
                              >
                                <span className="bg-stone-100 text-[#718096] font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="truncate">{frame.caption || `Shot #${idx + 1}`}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-stone-400 italic text-[11px]">Add a storyboard panel to link these lines</span>
                    )}

                    <button
                      onClick={() => {
                        const allBlockIds = filteredBlocks.map(b => b.id);
                        const allSelected = allBlockIds.every(id => selectedBlockIds.includes(id));
                        if (allSelected) {
                          setSelectedBlockIds([]);
                        } else {
                          setSelectedBlockIds(allBlockIds);
                        }
                      }}
                      className="bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white py-1.5 px-3 rounded font-semibold transition-colors cursor-pointer"
                    >
                      {filteredBlocks.map(b => b.id).every(id => selectedBlockIds.includes(id)) ? 'Deselect All' : 'Select All'}
                    </button>

                    <button
                      onClick={() => setSelectedBlockIds([])}
                      className="text-stone-400 hover:text-white transition-colors cursor-pointer text-[11px] font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
          )}

          {/* 2. VIEW MODE: STORYBOARD WORKSPACE */}
          {viewMode === 'storyboard' && (
            <div className="flex-grow overflow-y-auto p-6" id="storyboard-viewport">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between bg-white border border-[#E5E5E1] p-4 rounded shadow-xs">
                  <div>
                    <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">Storyboard Sketches</h3>
                    <p className="text-xs text-[#718096] font-light">Draw sequential movie panels corresponding to the active scene in real time.</p>
                  </div>
                  <button
                    onClick={handleAddStoryboardFrame}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white text-xs font-semibold rounded shadow-xs transition-all cursor-pointer"
                    id="btn-add-frame"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Panel Shot</span>
                  </button>
                </div>

                {/* Grid panel display */}
                {storyboardFrames.filter(f => f.sceneId === activeSceneId).length === 0 ? (
                  <div className="bg-white border border-[#E5E5E1] rounded p-16 text-center text-[#A0AEC0]">
                    <Grid className="w-12 h-12 mx-auto stroke-1 mb-4" />
                    <p className="text-sm font-light">No storyboard panels created for this scene yet.</p>
                    <p className="text-xs font-light text-[#A0AEC0] mt-1">Start drafting visual story layouts by pressing the "Add Panel Shot" button.</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    {storyboardFrames
                      .filter(f => f.sceneId === activeSceneId)
                      .sort((a, b) => a.order - b.order)
                      .map((frame, frameIndex) => (
                        <div 
                          key={frame.id} 
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData('text/plain', frame.id);
                            e.dataTransfer.setData('drag-type', 'storyboard-frame');
                            setDraggedId(frame.id);
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDragOverId(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedId && draggedId !== frame.id) {
                              setDragOverId(frame.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverId === frame.id) {
                              setDragOverId(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
                            const type = e.dataTransfer.getData('drag-type');
                            if (type === 'storyboard-frame' && sourceId && sourceId !== frame.id) {
                              handleReorderStoryboardFrames(sourceId, frame.id);
                            }
                            setDraggedId(null);
                            setDragOverId(null);
                          }}
                          className={`flex flex-col bg-white border rounded overflow-hidden shadow-xs transition-all duration-200 ${
                            dragOverId === frame.id 
                              ? 'border-2 border-dashed border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500 scale-[1.01]' 
                              : 'border-[#E5E5E1]'
                          }`}
                        >
                          {/* Board Canvas */}
                          <CollaborativeCanvas
                            id={frame.id}
                            strokes={frame.strokes}
                            onStrokeAdded={(stroke) => handleStrokeAdded('storyboard', frame.id, stroke)}
                            onClear={() => handleClearCanvas('storyboard', frame.id)}
                            className="h-[320px] border-0"
                          />

                          {/* Board details footer */}
                          <div className="p-4 border-t border-[#E5E5E1] bg-[#FAFAFA] flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs text-[#718096] font-bold uppercase tracking-wider">
                              <span>PANEL SHOT #{frameIndex + 1}</span>
                              <button
                                onClick={() => handleDeleteStoryboardFrame(frame.id)}
                                className="p-1 hover:bg-[#FAFAFA] text-[#718096] hover:text-red-500 rounded border border-transparent hover:border-[#E5E5E1] transition-all cursor-pointer"
                                title="Delete panel shot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <textarea
                              value={frame.caption}
                              onChange={(e) => handleUpdateFrameCaption(frame.id, e.target.value)}
                              placeholder="Type storyboard description, camera angles, or director notes..."
                              rows={2}
                              className="w-full bg-transparent border border-transparent focus:bg-white focus:border-[#E5E5E1] font-sans text-xs rounded px-2 py-1.5 text-[#2D2D2A]"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. VIEW MODE: CREATIVE BRAINSTORMING */}
          {viewMode === 'brainstorm' && (
            <div className="flex-grow flex overflow-hidden relative bg-[#F7F7F5]">
              {/* Left Side: Brainstorm Sidebar Nav (Consistent with Script scene navigator sidebar) */}
              <aside className="w-64 border-r border-[#E5E5E1] bg-[#FAFAFA] flex flex-col shrink-0 select-none">
                <div className="p-4 border-b border-[#E5E5E1] bg-white flex flex-col gap-1 shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#718096]">Brainstorming</span>
                  <span className="text-[9px] text-[#A0AEC0] uppercase tracking-wider font-mono">Story Development</span>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-1">
                  <button
                    onClick={() => setBrainstormTab('recap')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold cursor-pointer transition-all text-left ${
                      brainstormTab === 'recap' 
                        ? 'bg-white border border-[#E5E5E1] text-[#1A1A1A] font-bold shadow-2xs' 
                        : 'hover:bg-white/50 text-[#718096] hover:text-[#1A1A1A]'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-amber-500 font-bold" />
                    <span>Overview</span>
                  </button>

                  <button
                    onClick={() => setBrainstormTab('premise')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold cursor-pointer transition-all text-left ${
                      brainstormTab === 'premise' 
                        ? 'bg-white border border-[#E5E5E1] text-[#1A1A1A] font-bold shadow-2xs' 
                        : 'hover:bg-white/50 text-[#718096] hover:text-[#1A1A1A]'
                    }`}
                  >
                    <Compass className="w-4 h-4 text-amber-500 font-bold" />
                    <span>Premise & Core</span>
                  </button>

                  <button
                    onClick={() => setBrainstormTab('acts')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold cursor-pointer transition-all text-left ${
                      brainstormTab === 'acts' 
                        ? 'bg-white border border-[#E5E5E1] text-[#1A1A1A] font-bold shadow-2xs' 
                        : 'hover:bg-white/50 text-[#718096] hover:text-[#1A1A1A]'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-amber-500 font-bold" />
                    <span className="flex-grow">Acts Arc</span>
                    <span className="bg-[#E5E5E1]/60 text-[#718096] rounded px-1.5 py-0.5 text-[9px] font-mono font-bold">{brainstormData.actsCount || 3}</span>
                  </button>

                  <button
                    onClick={() => setBrainstormTab('characters')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold cursor-pointer transition-all text-left ${
                      brainstormTab === 'characters' 
                        ? 'bg-white border border-[#E5E5E1] text-[#1A1A1A] font-bold shadow-2xs' 
                        : 'hover:bg-white/50 text-[#718096] hover:text-[#1A1A1A]'
                    }`}
                  >
                    <Users className="w-4 h-4 text-amber-500 font-bold" />
                    <span className="flex-grow">Characters</span>
                    <span className="bg-[#E5E5E1]/60 text-[#718096] rounded px-1.5 py-0.5 text-[9px] font-mono font-bold">{(brainstormData.charactersList || []).length}</span>
                  </button>

                  <button
                    onClick={() => setBrainstormTab('locations')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold cursor-pointer transition-all text-left ${
                      brainstormTab === 'locations' 
                        ? 'bg-white border border-[#E5E5E1] text-[#1A1A1A] font-bold shadow-2xs' 
                        : 'hover:bg-white/50 text-[#718096] hover:text-[#1A1A1A]'
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-amber-500" />
                    <span className="flex-grow">Scenic Sets</span>
                    <span className="bg-[#E5E5E1]/60 text-[#718096] rounded px-1.5 py-0.5 text-[9px] font-mono font-bold">{(brainstormData.locationsList || []).length}</span>
                  </button>
                </div>
              </aside>

              {/* Right Side Work Area */}
              <div className="flex-grow flex flex-col overflow-hidden bg-[#F7F7F5]">
                {/* Clean top header for the current tab */}
                <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E5E5E1] shrink-0 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                      {brainstormTab === 'recap' && <BookOpen className="w-4 h-4 text-amber-500" />}
                      {brainstormTab === 'premise' && <Compass className="w-4 h-4 text-amber-500" />}
                      {brainstormTab === 'acts' && <Layers className="w-4 h-4 text-amber-500" />}
                      {brainstormTab === 'characters' && <Users className="w-4 h-4 text-amber-500" />}
                      {brainstormTab === 'locations' && <MapPin className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-[#1A1A1A] tracking-tight">
                        {brainstormTab === 'recap' && 'STORY OVERVIEW'}
                        {brainstormTab === 'premise' && 'PREMISE & CORE'}
                        {brainstormTab === 'acts' && 'ACTS ARC'}
                        {brainstormTab === 'characters' && 'CHARACTERS'}
                        {brainstormTab === 'locations' && 'SCENIC SETS'}
                      </h2>
                      <p className="text-[10px] text-[#718096] font-mono uppercase tracking-wider">
                        {brainstormTab === 'recap' && 'Comprehensive Story Outline & Integrated Development Details'}
                        {brainstormTab === 'premise' && 'Core story pitch, themes, target audience & logline'}
                        {brainstormTab === 'acts' && 'Structured dramatic progression and turning points'}
                        {brainstormTab === 'characters' && 'Protagonists, Antagonists, wants, needs & character arcs'}
                        {brainstormTab === 'locations' && 'Environmental profiles, sensory details & locations'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-tab Content Work Area */}
                <div className="flex-grow overflow-y-auto p-6 relative" id="brainstorm-viewport">
                {/* 1. BIBLE RECAP OVERVIEW TAB */}
                {brainstormTab === 'recap' && (
                  <div className="max-w-5xl mx-auto space-y-6">
                    {/* Action Toolbox Header */}
                    <div className="flex items-center justify-between bg-white border border-[#E5E5E1] rounded-lg px-4 py-3 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#718096]">Integrated Story Recap (Live Sync)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const actsTxt = (brainstormData.actsList || [])
                              .slice(0, brainstormData.actsCount || 3)
                              .map((act, idx) => `### ${act.title || `Act ${idx + 1}`}\n- **Summary:** ${act.description || 'N/A'}\n- **Turning Point:** ${act.turningPoints || 'N/A'}`)
                              .join('\n\n');

                            const charsTxt = (brainstormData.charactersList || [])
                              .map(c => `### ${c.name} (${c.role} / ${c.archetype || 'No Archetype'})\n- **Traits:** ${c.traits || 'N/A'}\n- **Want (Intent):** ${c.intent || 'N/A'}\n- **Need:** ${c.need || 'N/A'}\n- **Obstacle:** ${c.obstacle || 'N/A'}\n- **Appearance:** ${c.appearance || 'N/A'}\n- **Backstory:** ${c.backstory || 'N/A'}`)
                              .join('\n\n');

                            const locsTxt = (brainstormData.locationsList || [])
                              .map(l => `### ${l.name} (${l.timeOfDay || 'N/A'})\n- **Description:** ${l.description || 'N/A'}\n- **Sensory Sights:** ${l.sensorySight || 'N/A'}\n- **Sensory Sounds:** ${l.sensorySound || 'N/A'}\n- **Sensory Smells:** ${l.sensorySmell || 'N/A'}\n- **Purpose:** ${l.narrativePurpose || 'N/A'}`)
                              .join('\n\n');

                            const text = `# STORY OVERVIEW: ${brainstormData.title || 'Untitled Screenplay'}\n\n## Core Premise\n- **Logline:** ${brainstormData.logline || 'N/A'}\n- **Genre:** ${brainstormData.genre || 'N/A'}\n- **Theme:** ${brainstormData.theme || 'N/A'}\n- **Target Audience:** ${brainstormData.targetAudience || 'N/A'}\n\n## Narrative Outline\n${brainstormData.outline || 'N/A'}\n\n## Acts Structure (${brainstormData.actsCount || 3} Acts)\n${actsTxt}\n\n## Characters\n${charsTxt}\n\n## Scenic Locations\n${locsTxt}`;

                            navigator.clipboard.writeText(text);
                            // Sleek non-alert state update
                            const notif = document.getElementById('bible-copy-badge');
                            if (notif) {
                              notif.classList.remove('opacity-0');
                              setTimeout(() => notif.classList.add('opacity-0'), 2000);
                            }
                          }}
                          className="px-3 py-1.5 bg-white border border-[#E5E5E1] hover:bg-[#FAFAFA] rounded text-[10px] font-extrabold uppercase tracking-widest text-[#2D2D2A] flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#718096]" />
                          <span>Copy Overview (Markdown)</span>
                        </button>
                        <span id="bible-copy-badge" className="text-[10px] text-emerald-600 font-bold uppercase transition-opacity duration-300 opacity-0 px-1 font-mono">
                          Copied!
                        </span>
                      </div>
                    </div>

                    {/* Parchment Book Layout Container */}
                    <div className="bg-[#FCFCFA] border border-[#E5E5E1] rounded-xl p-8 md:p-12 shadow-md text-left relative overflow-hidden">
                      {/* Artistic Binder line */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500/20 via-amber-600/30 to-amber-500/20" />
                      
                      {/* Document Header */}
                      <div className="text-center border-b border-[#E5E5E1] pb-6 mb-8 space-y-2">
                        <div className="text-[9px] font-mono font-bold tracking-widest text-amber-600 uppercase">THE CREATIVE DIRECTIVE OVERVIEW</div>
                        <h1 className="font-serif text-3xl font-extrabold text-[#1A1A1A] tracking-tight">{brainstormData.title || 'UNTITLED STORY'}</h1>
                        <p className="text-xs text-[#718096] italic font-sans max-w-lg mx-auto">Compiled automatically from your structured development outline.</p>
                      </div>

                      {/* Logline Box */}
                      <div className="mb-8 p-5 bg-[#FAF9F5] border-l-4 border-amber-500/40 rounded-r-lg">
                        <h3 className="text-[9px] uppercase font-mono font-bold tracking-wider text-amber-700 mb-1.5">LOGLINE / SYNOPSIS</h3>
                        <p className="font-serif text-sm leading-relaxed italic text-[#2D2D2A]">
                          "{brainstormData.logline || 'Define a compelling, one-sentence logline in the "Premise & Core" tab to grab reader attention immediately.'}"
                        </p>
                      </div>

                      {/* Pitch Parameters Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-[#E5E5E1] pb-6 mb-8 text-xs">
                        <div className="space-y-1 bg-white border border-[#E5E5E1]/60 p-3 rounded-md">
                          <span className="text-[8px] font-mono font-bold text-[#718096] uppercase tracking-wider block">PRIMARY GENRE</span>
                          <span className="font-semibold text-[#1A1A1A] block">{brainstormData.genre || 'Not set'}</span>
                        </div>
                        <div className="space-y-1 bg-white border border-[#E5E5E1]/60 p-3 rounded-md">
                          <span className="text-[8px] font-mono font-bold text-[#718096] uppercase tracking-wider block">CORE STORY THEME</span>
                          <span className="font-semibold text-[#1A1A1A] block">{brainstormData.theme || 'Not set'}</span>
                        </div>
                        <div className="space-y-1 bg-white border border-[#E5E5E1]/60 p-3 rounded-md">
                          <span className="text-[8px] font-mono font-bold text-[#718096] uppercase tracking-wider block">TARGET AUDIENCE</span>
                          <span className="font-semibold text-[#1A1A1A] block">{brainstormData.targetAudience || 'Not set'}</span>
                        </div>
                      </div>

                      {/* General Outline */}
                      <div className="space-y-3 border-b border-[#E5E5E1] pb-8 mb-8">
                        <h2 className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Compass className="w-4 h-4" />
                          <span>Creative Outline & Premise details</span>
                        </h2>
                        <div className="text-xs text-[#2D2D2A] leading-relaxed whitespace-pre-wrap font-sans bg-[#FAF9F5] border border-[#E5E5E1]/50 p-4 rounded-lg">
                          {brainstormData.outline || 'Outline details empty. Enter notes in "Premise" tab.'}
                        </div>
                      </div>

                      {/* Dynamic Acts Summary */}
                      <div className="space-y-5 border-b border-[#E5E5E1] pb-8 mb-8">
                        <h2 className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4" />
                          <span>Narrative Structure ({brainstormData.actsCount || 3} Acts)</span>
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(brainstormData.actsList || [])
                            .slice(0, brainstormData.actsCount || 3)
                            .map((act, index) => (
                              <div key={act.id || index} className="bg-white border border-[#E5E5E1] rounded-lg p-4 shadow-3xs space-y-3">
                                <div className="flex items-center justify-between border-b border-[#E5E5E1]/60 pb-2">
                                  <span className="text-xs font-extrabold text-[#1A1A1A]">{act.title || `Act ${index + 1}`}</span>
                                  <span className="text-[8px] font-mono font-bold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded uppercase">
                                    Beat {index + 1}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[8px] font-mono font-bold text-[#718096] uppercase tracking-wider block">ACT OUTLINE</span>
                                  <p className="text-xs text-[#2D2D2A] leading-relaxed">{act.description || 'No description provided.'}</p>
                                </div>
                                {act.turningPoints && (
                                  <div className="bg-amber-50/50 border border-amber-100 p-2.5 rounded text-xs">
                                    <span className="text-[8px] font-mono font-bold text-amber-700 uppercase tracking-wider block mb-0.5">MAJOR REVERSAL / TURNING POINT</span>
                                    <p className="font-serif italic text-amber-900 text-[11px] leading-relaxed">{act.turningPoints}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Characters Summary list */}
                      <div className="space-y-5 border-b border-[#E5E5E1] pb-8 mb-8">
                        <h2 className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          <span>Characters</span>
                        </h2>

                        {(brainstormData.charactersList || []).length === 0 ? (
                          <p className="text-xs text-[#718096] italic bg-[#FAFAFA] p-4 rounded border border-dashed border-[#E5E5E1] text-center">
                            No characters developed yet in the Characters tab.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(brainstormData.charactersList || []).map((char) => (
                              <div key={char.id} className="bg-white border border-[#E5E5E1] rounded-lg p-4 shadow-3xs space-y-3">
                                <div className="flex items-center gap-2 border-b border-[#E5E5E1]/60 pb-2.5">
                                  <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-700 font-mono font-bold text-xs flex items-center justify-center border border-amber-200">
                                    {char.name ? char.name.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-extrabold text-[#1A1A1A]">{char.name}</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[9px] font-mono font-bold bg-[#E5E5E1]/40 text-[#2D2D2A] px-1 rounded uppercase">{char.role}</span>
                                      {char.archetype && (
                                        <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-600 px-1 rounded uppercase border border-amber-200">{char.archetype}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-[8px] font-mono font-bold text-[#718096] uppercase block">Wants (Intent)</span>
                                    <p className="text-xs text-[#2D2D2A] mt-0.5 leading-tight">{char.intent || 'Not defined'}</p>
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-mono font-bold text-[#718096] uppercase block">Needs (Internal Lack)</span>
                                    <p className="text-xs text-[#2D2D2A] mt-0.5 leading-tight">{char.need || 'Not defined'}</p>
                                  </div>
                                </div>

                                {char.obstacle && (
                                  <div>
                                    <span className="text-[8px] font-mono font-bold text-[#718096] uppercase block">Core Obstacle</span>
                                    <p className="text-xs text-[#2D2D2A] mt-0.5 leading-tight italic">{char.obstacle}</p>
                                  </div>
                                )}

                                {char.backstory && (
                                  <div className="pt-2 border-t border-[#E5E5E1]/40">
                                    <span className="text-[8px] font-mono font-bold text-[#718096] uppercase block">History & Backstory Outline</span>
                                    <p className="text-[11px] text-[#718096] leading-relaxed mt-0.5">{char.backstory}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Locations Summary list */}
                      <div className="space-y-5">
                        <h2 className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          <span>Scenic Sets & World-Building</span>
                        </h2>

                        {(brainstormData.locationsList || []).length === 0 ? (
                          <p className="text-xs text-[#718096] italic bg-[#FAFAFA] p-4 rounded border border-dashed border-[#E5E5E1] text-center">
                            No scenic locations added yet in the Scenic Sets tab.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(brainstormData.locationsList || []).map((loc) => (
                              <div key={loc.id} className="bg-white border border-[#E5E5E1] rounded-lg p-4 shadow-3xs space-y-3">
                                <div className="flex items-center justify-between border-b border-[#E5E5E1]/60 pb-2.5">
                                  <h4 className="text-xs font-extrabold text-[#1A1A1A] font-mono">{loc.name}</h4>
                                  <span className="text-[9px] font-mono font-bold bg-[#E5E5E1]/40 text-[#2D2D2A] px-1.5 rounded">{loc.timeOfDay}</span>
                                </div>

                                <div className="space-y-2 text-xs">
                                  <div>
                                    <span className="text-[8px] font-mono font-bold text-[#718096] uppercase block">Vibes & Description</span>
                                    <p className="text-xs text-[#2D2D2A] mt-0.5 leading-relaxed">{loc.description || 'Not described'}</p>
                                  </div>

                                  <div className="bg-[#FAFAFA] p-2 rounded border border-[#E5E5E1]/40 space-y-1.5 text-[11px]">
                                    <span className="text-[8px] font-mono font-bold text-amber-700 uppercase block">Sensory Highlights</span>
                                    {loc.sensorySight && <div className="text-xs text-[#718096]"><strong className="text-[#2D2D2A] font-mono text-[9px] uppercase">SIGHT:</strong> {loc.sensorySight}</div>}
                                    {loc.sensorySound && <div className="text-xs text-[#718096]"><strong className="text-[#2D2D2A] font-mono text-[9px] uppercase">SOUND:</strong> {loc.sensorySound}</div>}
                                    {loc.sensorySmell && <div className="text-xs text-[#718096]"><strong className="text-[#2D2D2A] font-mono text-[9px] uppercase">SMELL/FEEL:</strong> {loc.sensorySmell}</div>}
                                  </div>

                                  {loc.narrativePurpose && (
                                    <div className="pt-2 border-t border-[#E5E5E1]/40">
                                      <span className="text-[8px] font-mono font-bold text-[#718096] uppercase block">Narrative Role</span>
                                      <p className="text-xs text-[#718096] leading-relaxed italic mt-0.5">{loc.narrativePurpose}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* 2. CORE PREMISE & LOGLINE TAB */}
                {brainstormTab === 'premise' && (
                  <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Forms column */}
                    <div className="md:col-span-2 space-y-6">
                      <div className="bg-white rounded-lg border border-[#E5E5E1] p-6 shadow-2xs space-y-5 text-left">
                        <div className="flex items-center gap-2 border-b border-[#E5E5E1]/60 pb-3">
                          <Edit3 className="w-4 h-4 text-amber-500" />
                          <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#1A1A1A]">Core Story parameters</h3>
                        </div>

                        {/* Title field */}
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#718096]">Screenplay / Book Title</label>
                          <input
                            type="text"
                            value={brainstormData.title || ''}
                            onChange={(e) => handleUpdateBrainstorm({ title: e.target.value })}
                            placeholder="e.g., Cybernetic Horizon, The Last Archive..."
                            className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-sm font-semibold rounded-md p-2.5 text-[#1A1A1A] transition-colors"
                          />
                        </div>

                        {/* Logline Pitch */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#718096]">Logline (The Elevator Pitch)</label>
                            <span className="text-[9px] text-[#A0AEC0] font-mono">1-2 sentences maximum</span>
                          </div>
                          <textarea
                            value={brainstormData.logline || ''}
                            onChange={(e) => handleUpdateBrainstorm({ logline: e.target.value })}
                            placeholder="When a disgraced memory archeologist uncovers a locked cyber-vault containing details of a pre-war extinction event, they must traverse a corrupt corporate megacity before the cleanup division formats their central nervous system."
                            rows={3}
                            className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-xs leading-relaxed rounded-md p-3 text-[#2D2D2A] transition-colors"
                          />
                        </div>

                        {/* Story Parameters row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#718096]">Genre</label>
                            <input
                              type="text"
                              value={brainstormData.genre || ''}
                              onChange={(e) => handleUpdateBrainstorm({ genre: e.target.value })}
                              placeholder="e.g., Neo-Noir Sci-Fi"
                              className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-xs rounded-md p-2 text-[#2D2D2A] transition-colors"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#718096]">Core Theme</label>
                            <input
                              type="text"
                              value={brainstormData.theme || ''}
                              onChange={(e) => handleUpdateBrainstorm({ theme: e.target.value })}
                              placeholder="e.g., Identity, Morality"
                              className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-xs rounded-md p-2 text-[#2D2D2A] transition-colors"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#718096]">Target Audience</label>
                            <input
                              type="text"
                              value={brainstormData.targetAudience || ''}
                              onChange={(e) => handleUpdateBrainstorm({ targetAudience: e.target.value })}
                              placeholder="e.g., Adult Cinephiles"
                              className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-xs rounded-md p-2 text-[#2D2D2A] transition-colors"
                            />
                          </div>
                        </div>

                      </div>

                      {/* Creative Premise Outline Textarea */}
                      <div className="bg-white rounded-lg border border-[#E5E5E1] p-6 shadow-2xs space-y-4 text-left">
                        <div className="flex items-center gap-2 border-b border-[#E5E5E1]/60 pb-3">
                          <FileText className="w-4 h-4 text-amber-500" />
                          <div>
                            <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#1A1A1A]">Master Narrative Outline</h3>
                            <p className="text-[10px] text-[#718096] mt-0.5 font-light">Flesh out the overall lore, major conflicts, and starting setup here.</p>
                          </div>
                        </div>

                        <textarea
                          value={brainstormData.outline || ''}
                          onChange={(e) => handleUpdateBrainstorm({ outline: e.target.value })}
                          placeholder="Introduce the backstory of this world, the central dilemma, the societal parameters, and general lore beats that tie your screenplay acts together..."
                          rows={12}
                          className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-xs leading-relaxed rounded-md p-3 text-[#2D2D2A] transition-colors font-sans"
                        />
                      </div>
                    </div>

                    {/* Right Guidelines Column */}
                    <div className="space-y-6 text-left">
                      <div className="bg-[#FAF9F5] rounded-lg border border-amber-200/60 p-5 space-y-4">
                        <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-amber-800 flex items-center gap-1.5">
                          <Info className="w-4 h-4" />
                          <span>The Perfect Premise Guide</span>
                        </h4>
                        
                        <div className="space-y-3 text-xs leading-relaxed text-amber-900/95 font-sans">
                          <p>
                            A strong story starts with sharp limits. Answer these four basic questions to test if your idea is production-ready:
                          </p>
                          <ul className="list-disc pl-4 space-y-2">
                            <li>
                              <strong>Who is the protagonist?</strong> What is their baseline vulnerability or ordinary situation?
                            </li>
                            <li>
                              <strong>What is the catalyst?</strong> What forces them out of their comfort zone?
                            </li>
                            <li>
                              <strong>What are the stakes?</strong> Why can’t they just walk away? What happens if they fail?
                            </li>
                            <li>
                              <strong>What is the theme?</strong> What deep human condition truth is being explored under the surface plot?
                            </li>
                          </ul>
                          <p className="text-[10px] text-amber-700 font-medium pt-1">
                            Tip: A memorable logline connects the protagonist's main flaw, a sudden crisis, an active outer objective, and the ultimate threat in 35 words or less.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. DYNAMIC ACTS STRUCTURE TAB */}
                {brainstormTab === 'acts' && (
                  <div className="max-w-4xl mx-auto space-y-6 text-left">
                    {/* Acts configuration row */}
                    <div className="bg-white border border-[#E5E5E1] rounded-lg p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#1A1A1A]">Configure Outline Structure</h3>
                        <p className="text-[10px] text-[#718096]">Choose your story acts progression pattern. Standard screenplays default to a Three-Act framework.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#2D2D2A]">Number of Acts:</span>
                        <div className="flex bg-[#F4F4F1] p-1 rounded-lg border border-[#E5E5E1]">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              onClick={() => handleSelectActsCount(num)}
                              className={`w-8 h-8 rounded-md text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                (brainstormData.actsCount || 3) === num
                                  ? 'bg-white text-[#1A1A1A] border border-[#E5E5E1] shadow-2xs'
                                  : 'text-[#718096] hover:text-[#1A1A1A]'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Act Edit list */}
                    <div className="space-y-6">
                      {(brainstormData.actsList || [])
                        .slice(0, brainstormData.actsCount || 3)
                        .map((act, idx) => (
                          <div key={act.id || idx} className="bg-white rounded-lg border border-[#E5E5E1] p-6 shadow-2xs space-y-4 relative group">
                            {/* Act Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E5E1]/60 pb-3 gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                  ACT {idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={act.title}
                                  onChange={(e) => {
                                    const newList = (brainstormData.actsList || []).map((a, i) => 
                                      i === idx ? { ...a, title: e.target.value } : a
                                    );
                                    handleUpdateBrainstorm({ actsList: newList });
                                  }}
                                  className="font-sans text-xs font-extrabold text-[#1A1A1A] bg-transparent border-b border-transparent hover:border-[#E5E5E1] focus:border-[#1A1A1A] focus:outline-none py-0.5 min-w-[220px]"
                                  placeholder="Act Title / Progression Slug..."
                                />
                              </div>
                              <span className="text-[10px] text-[#A0AEC0] font-mono">
                                Pace Indicator: approx. {Math.round(100 / (brainstormData.actsCount || 3) * idx)}% — {Math.round(100 / (brainstormData.actsCount || 3) * (idx + 1))}%
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Act Description */}
                              <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Act Arc summary & Beats</label>
                                <textarea
                                  value={act.description}
                                  onChange={(e) => {
                                    const newList = (brainstormData.actsList || []).map((a, i) => 
                                      i === idx ? { ...a, description: e.target.value } : a
                                    );
                                    handleUpdateBrainstorm({ actsList: newList });
                                  }}
                                  placeholder="What characters are present? What must the hero attempt, fail, and uncover to push the plot into the next phase? Outline the specific scenes/developments here..."
                                  rows={4}
                                  className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-xs leading-relaxed rounded p-2.5 text-[#2D2D2A] transition-colors"
                                />
                              </div>

                              {/* Act Turning point */}
                              <div className="space-y-1.5">
                                <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-amber-700">Major turning point / Climax beat</label>
                                <textarea
                                  value={act.turningPoints || ''}
                                  onChange={(e) => {
                                    const newList = (brainstormData.actsList || []).map((a, i) => 
                                      i === idx ? { ...a, turningPoints: e.target.value } : a
                                    );
                                    handleUpdateBrainstorm({ actsList: newList });
                                  }}
                                  placeholder="Describe the decisive inciting event, midpoint shock, plot twist, or tragic reversal that forces the action to escalate immediately."
                                  rows={4}
                                  className="w-full bg-[#FAF9F5] border border-amber-200/60 hover:border-amber-400/80 focus:bg-white focus:outline-none focus:border-amber-500 text-xs leading-relaxed rounded p-2.5 text-amber-900 transition-colors"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 4. CHARACTERS TAB */}
                {brainstormTab === 'characters' && (
                  <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 text-left h-[620px]">
                    {/* Character Directory Sidebar */}
                    <div className="w-full md:w-64 bg-white border border-[#E5E5E1] rounded-lg shadow-2xs flex flex-col shrink-0 overflow-hidden">
                      <div className="p-4 border-b border-[#E5E5E1] flex items-center justify-between bg-[#FAFAFA]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#718096]">Character Directory</span>
                        <button
                          onClick={() => {
                            const currentList = [...(brainstormData.charactersList || [])];
                            const newChar: BrainstormCharacter = {
                              id: 'char-' + Date.now(),
                              name: 'New Character',
                              role: 'Protagonist',
                              traits: '',
                              backstory: '',
                              intent: '',
                              need: '',
                              obstacle: '',
                              appearance: '',
                              archetype: 'The Hero'
                            };
                            const newList = [...currentList, newChar];
                            handleUpdateBrainstorm({ charactersList: newList });
                            setSelectedCharacterId(newChar.id);
                          }}
                          className="p-1 hover:bg-amber-50 text-amber-600 hover:text-amber-700 border border-transparent hover:border-amber-200 rounded transition-all cursor-pointer"
                          title="Add Character Profile"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-grow overflow-y-auto p-2 space-y-1">
                        {(brainstormData.charactersList || []).length === 0 ? (
                          <div className="text-center py-16 text-[#A0AEC0] text-xs font-light">
                            No profiles. Click the "+" icon to begin the character bible.
                          </div>
                        ) : (
                          (brainstormData.charactersList || []).map((char) => {
                            const isCharActive = selectedCharacterId === char.id || (!selectedCharacterId && (brainstormData.charactersList || [])[0]?.id === char.id);
                            if (isCharActive && !selectedCharacterId) {
                              // Sync state in render safely
                              setTimeout(() => setSelectedCharacterId(char.id), 0);
                            }
                            return (
                              <div
                                key={char.id}
                                onClick={() => setSelectedCharacterId(char.id)}
                                className={`group relative flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                                  isCharActive 
                                    ? 'bg-amber-500/10 border-amber-300 text-[#1A1A1A] font-bold' 
                                    : 'hover:bg-[#FAFAFA] border-transparent text-[#718096]'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-5 h-5 rounded-full font-mono text-[9px] font-bold flex items-center justify-center border shrink-0 ${
                                    isCharActive ? 'bg-amber-500 text-white border-amber-400' : 'bg-[#E5E5E1]/60 text-[#718096] border-[#E5E5E1]'
                                  }`}>
                                    {char.name ? char.name.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <div className="truncate text-xs">
                                    <span className="block truncate font-semibold">{char.name || 'Unnamed character'}</span>
                                    <span className="block text-[8px] font-mono text-[#A0AEC0] uppercase tracking-wider mt-0.5">{char.role}</span>
                                  </div>
                                </div>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newList = (brainstormData.charactersList || []).filter(c => c.id !== char.id);
                                    handleUpdateBrainstorm({ charactersList: newList });
                                    if (selectedCharacterId === char.id) {
                                      setSelectedCharacterId(newList[0]?.id || null);
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white text-[#718096] hover:text-red-500 rounded border border-transparent hover:border-[#E5E5E1] transition-all cursor-pointer"
                                  title="Delete Cast Member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Character Form Editor Area */}
                    <div className="flex-grow bg-white border border-[#E5E5E1] rounded-lg shadow-2xs flex flex-col overflow-hidden">
                      {selectedCharacterId ? (
                        (() => {
                          const char = (brainstormData.charactersList || []).find(c => c.id === selectedCharacterId);
                          if (!char) return (
                            <div className="flex-grow flex items-center justify-center text-[#A0AEC0] text-xs">
                              Character profile missing.
                            </div>
                          );
                          return (
                            <div className="flex-grow flex flex-col h-full overflow-hidden">
                              {/* Editor Header */}
                              <div className="px-6 py-4 border-b border-[#E5E5E1] bg-[#FAFAFA] flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-amber-500" />
                                  <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">Active Character Profile Sheet</span>
                                </div>
                                <span className="text-[10px] text-amber-600 font-mono font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase">
                                  {char.archetype || 'Archetype undefined'}
                                </span>
                              </div>

                              {/* Form scroll contents */}
                              <div className="flex-grow overflow-y-auto p-6 space-y-5">
                                {/* Row 1: Name and Archetype */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Full Character Name</label>
                                    <input
                                      type="text"
                                      value={char.name}
                                      onChange={(e) => handleUpdateCharacter(char.id, { name: e.target.value })}
                                      placeholder="e.g., Detective Miller, Cynthia Vane..."
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] font-bold focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Role Class</label>
                                    <select
                                      value={char.role}
                                      onChange={(e) => handleUpdateCharacter(char.id, { role: e.target.value })}
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] cursor-pointer"
                                    >
                                      <option value="Protagonist">Protagonist (Hero)</option>
                                      <option value="Antagonist">Antagonist (Adversary)</option>
                                      <option value="Mentor">Mentor (Teacher/Guide)</option>
                                      <option value="Ally">Ally / Foil (Companionship)</option>
                                      <option value="Shadow">The Shadow (Inner Dark / Rival)</option>
                                      <option value="Trickster">The Trickster (Chaos Agent)</option>
                                      <option value="Supporting">Supporting Character / Catalyst</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Row 2: Archetype tag and Traits */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Literary Archetype / Motivation Type</label>
                                    <input
                                      type="text"
                                      value={char.archetype || ''}
                                      onChange={(e) => handleUpdateCharacter(char.id, { archetype: e.target.value })}
                                      placeholder="e.g., The Reluctant Guardian, The Corrupted Visionary..."
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Key Traits & Fatal Flaw (Hamartia)</label>
                                    <input
                                      type="text"
                                      value={char.traits}
                                      onChange={(e) => handleUpdateCharacter(char.id, { traits: e.target.value })}
                                      placeholder="Cynical, obsessively focused. Blind spot: deep paranoia."
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>
                                </div>

                                {/* Row 3: Dramatic wants vs. needs (The core engine of character growth) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1 bg-[#FAFAFA] p-3 rounded border border-[#E5E5E1]/60">
                                    <div className="flex justify-between items-center mb-0.5">
                                      <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-amber-700">The Outer Want (Conscious Goal)</label>
                                      <span className="text-[8px] text-[#A0AEC0] font-mono">DRIVES PLOT ACTION</span>
                                    </div>
                                    <textarea
                                      value={char.intent || ''}
                                      onChange={(e) => handleUpdateCharacter(char.id, { intent: e.target.value })}
                                      placeholder="What concrete physical objective is this character actively chasing? (e.g. Cynthia wants to steal the prototype serum to cure her sister.)"
                                      rows={2}
                                      className="w-full bg-white border border-[#E5E5E1] rounded p-2 text-xs text-[#2D2D2A] focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>

                                  <div className="space-y-1 bg-[#FAFAFA] p-3 rounded border border-[#E5E5E1]/60">
                                    <div className="flex justify-between items-center mb-0.5">
                                      <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-amber-700">The Inner Need (Unconscious Lack)</label>
                                      <span className="text-[8px] text-[#A0AEC0] font-mono">DRIVES CHARACTER ARC</span>
                                    </div>
                                    <textarea
                                      value={char.need || ''}
                                      onChange={(e) => handleUpdateCharacter(char.id, { need: e.target.value })}
                                      placeholder="What internal lesson or shift must they realize to grow? (e.g. Cynthia needs to learn to accept loss and trust others instead of operating in total isolation.)"
                                      rows={2}
                                      className="w-full bg-white border border-[#E5E5E1] rounded p-2 text-xs text-[#2D2D2A] focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>
                                </div>

                                {/* Row 4: Core Obstacle and Appearance */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Core Obstacle & Rivalry</label>
                                    <input
                                      type="text"
                                      value={char.obstacle || ''}
                                      onChange={(e) => handleUpdateCharacter(char.id, { obstacle: e.target.value })}
                                      placeholder="Who or what acts as the primary barrier stopping their Want?"
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Physical Profile & Visual Style</label>
                                    <input
                                      type="text"
                                      value={char.appearance || ''}
                                      onChange={(e) => handleUpdateCharacter(char.id, { appearance: e.target.value })}
                                      placeholder="Age, posture, unique scars, heavy synthetic trench coat..."
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>
                                </div>

                                {/* Row 5: Detailed backstory */}
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Detailed Biography & Narrative Background</label>
                                  <textarea
                                    value={char.backstory}
                                    onChange={(e) => handleUpdateCharacter(char.id, { backstory: e.target.value })}
                                    placeholder="Enter the backstory highlights, crucial relationships, formative childhood traumas, or plot-twist alignment reveals here..."
                                    rows={5}
                                    className="w-full bg-[#FAFAFA] border border-[#E5E5E1] hover:border-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] text-xs leading-relaxed rounded p-2.5 text-[#2D2D2A] transition-colors"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex-grow flex flex-col items-center justify-center text-[#A0AEC0] p-12">
                          <Users className="w-12 h-12 stroke-1 mb-4 text-[#C0C7CE]" />
                          <p className="text-xs font-semibold text-[#718096]">No Character Active</p>
                          <p className="text-[11px] text-[#A0AEC0] mt-1 max-w-xs text-center">Select an existing character from the sidebar directory, or click "+" to craft a new screenplay character profile.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. SCENIC SETS & WORLD BUILDING TAB */}
                {brainstormTab === 'locations' && (
                  <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 text-left h-[620px]">
                    {/* Location Sidebar Directory */}
                    <div className="w-full md:w-64 bg-white border border-[#E5E5E1] rounded-lg shadow-2xs flex flex-col shrink-0 overflow-hidden">
                      <div className="p-4 border-b border-[#E5E5E1] flex items-center justify-between bg-[#FAFAFA]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#718096]">Scenic Locations</span>
                        <button
                          onClick={() => {
                            const currentList = [...(brainstormData.locationsList || [])];
                            const newLoc: BrainstormLocation = {
                              id: 'loc-' + Date.now(),
                              name: 'INT. NEW LOCATION - DAY',
                              description: '',
                              timeOfDay: 'Day',
                              sensorySight: '',
                              sensorySound: '',
                              sensorySmell: '',
                              narrativePurpose: ''
                            };
                            const newList = [...currentList, newLoc];
                            handleUpdateBrainstorm({ locationsList: newList });
                            setSelectedLocationId(newLoc.id);
                          }}
                          className="p-1 hover:bg-amber-50 text-amber-600 hover:text-amber-700 border border-transparent hover:border-amber-200 rounded transition-all cursor-pointer"
                          title="Add Scenic Location"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-grow overflow-y-auto p-2 space-y-1">
                        {(brainstormData.locationsList || []).length === 0 ? (
                          <div className="text-center py-16 text-[#A0AEC0] text-xs font-light">
                            No locations cataloged. Click "+" to build.
                          </div>
                        ) : (
                          (brainstormData.locationsList || []).map((loc) => {
                            const isLocActive = selectedLocationId === loc.id || (!selectedLocationId && (brainstormData.locationsList || [])[0]?.id === loc.id);
                            if (isLocActive && !selectedLocationId) {
                              setTimeout(() => setSelectedLocationId(loc.id), 0);
                            }
                            return (
                              <div
                                key={loc.id}
                                onClick={() => setSelectedLocationId(loc.id)}
                                className={`group relative flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                                  isLocActive 
                                    ? 'bg-amber-500/10 border-amber-300 text-[#1A1A1A] font-bold' 
                                    : 'hover:bg-[#FAFAFA] border-transparent text-[#718096]'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-1 rounded bg-[#E5E5E1]/40 text-[#2D2D2A] shrink-0 font-mono text-[8px] font-bold">
                                    SET
                                  </div>
                                  <div className="truncate text-xs">
                                    <span className="block truncate font-mono text-[10px] font-bold">{loc.name || 'INT. UNNAMED - DAY'}</span>
                                    <span className="block text-[8px] font-mono text-[#A0AEC0] uppercase tracking-wider mt-0.5">{loc.timeOfDay}</span>
                                  </div>
                                </div>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newList = (brainstormData.locationsList || []).filter(l => l.id !== loc.id);
                                    handleUpdateBrainstorm({ locationsList: newList });
                                    if (selectedLocationId === loc.id) {
                                      setSelectedLocationId(newList[0]?.id || null);
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white text-[#718096] hover:text-red-500 rounded border border-transparent hover:border-[#E5E5E1] transition-all cursor-pointer"
                                  title="Delete Location"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Location Form Editor Panel */}
                    <div className="flex-grow bg-white border border-[#E5E5E1] rounded-lg shadow-2xs flex flex-col overflow-hidden">
                      {selectedLocationId ? (
                        (() => {
                          const loc = (brainstormData.locationsList || []).find(l => l.id === selectedLocationId);
                          if (!loc) return (
                            <div className="flex-grow flex items-center justify-center text-[#A0AEC0] text-xs">
                              Scenic Set information missing.
                            </div>
                          );
                          return (
                            <div className="flex-grow flex flex-col h-full overflow-hidden">
                              {/* Editor Header */}
                              <div className="px-6 py-4 border-b border-[#E5E5E1] bg-[#FAFAFA] flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-amber-500" />
                                  <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">Scenic Set Design Profile</span>
                                </div>
                                <span className="text-[10px] text-amber-600 font-mono font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase">
                                  {loc.timeOfDay || 'Atmosphere unassigned'}
                                </span>
                              </div>

                              {/* Form scroll content */}
                              <div className="flex-grow overflow-y-auto p-6 space-y-5">
                                {/* Row 1: Scene Heading (Slug) and Time of Day */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Screenplay Heading Slug</label>
                                    <input
                                      type="text"
                                      value={loc.name}
                                      onChange={(e) => handleUpdateLocation(loc.id, { name: e.target.value })}
                                      placeholder="e.g., INT. TECH ARCHIVES - NIGHT"
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] font-bold font-mono focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Aesthetic Atmosphere / Time</label>
                                    <select
                                      value={loc.timeOfDay}
                                      onChange={(e) => handleUpdateLocation(loc.id, { timeOfDay: e.target.value })}
                                      className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A] cursor-pointer font-sans"
                                    >
                                      <option value="Day">Day (Standard Lighting)</option>
                                      <option value="Night">Night (Heavy Shadows/High Contrast)</option>
                                      <option value="Dawn">Dawn (Cold mornings/Soft blues)</option>
                                      <option value="Dusk">Dusk (Long shadows/Golden hues)</option>
                                      <option value="Twilight">Twilight (Deep purples/Atmospheric)</option>
                                      <option value="Surreal">Cosmic / Dreamlike (Vivid/Abstract)</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Row 2: Vibes and General description */}
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Core Set Description & Vibe direction</label>
                                  <textarea
                                    value={loc.description}
                                    onChange={(e) => handleUpdateLocation(loc.id, { description: e.target.value })}
                                    placeholder="A colossal, multi-story digital library lined with thousands of server nodes glowing soft cyan. Dust settles in the lazy laser lines of security barriers. Floorboards are warped and rotten."
                                    rows={3}
                                    className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded p-2.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                  />
                                </div>

                                {/* Row 3: Sensory Details Grid (Excellent Writer Guidance!) */}
                                <div className="space-y-2 bg-[#FAFAFA] p-4 rounded border border-[#E5E5E1]/60">
                                  <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-amber-700 block border-b border-[#E5E5E1]/40 pb-1.5 mb-2">Cinematic Sensory Matrix</span>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-[8px] uppercase font-mono font-bold tracking-wider text-[#718096]">Sight & Lighting focal points</label>
                                      <textarea
                                        value={loc.sensorySight || ''}
                                        onChange={(e) => handleUpdateLocation(loc.id, { sensorySight: e.target.value })}
                                        placeholder="Flickering monitors, security lasers casting vertical lines..."
                                        rows={3}
                                        className="w-full bg-white border border-[#E5E5E1] rounded p-2 text-[11px] text-[#2D2D2A] focus:outline-none focus:border-[#1A1A1A] leading-relaxed"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[8px] uppercase font-mono font-bold tracking-wider text-[#718096]">Ambient noises & Sounds</label>
                                      <textarea
                                        value={loc.sensorySound || ''}
                                        onChange={(e) => handleUpdateLocation(loc.id, { sensorySound: e.target.value })}
                                        placeholder="The high-frequency whine of servers, rhythmic water leaks..."
                                        rows={3}
                                        className="w-full bg-white border border-[#E5E5E1] rounded p-2 text-[11px] text-[#2D2D2A] focus:outline-none focus:border-[#1A1A1A] leading-relaxed"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[8px] uppercase font-mono font-bold tracking-wider text-[#718096]">Scent markers & Air quality</label>
                                      <textarea
                                        value={loc.sensorySmell || ''}
                                        onChange={(e) => handleUpdateLocation(loc.id, { sensorySmell: e.target.value })}
                                        placeholder="Dry ozone scent, burnt insulation wiring, damp stone floors..."
                                        rows={3}
                                        className="w-full bg-white border border-[#E5E5E1] rounded p-2 text-[11px] text-[#2D2D2A] focus:outline-none focus:border-[#1A1A1A] leading-relaxed"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Row 4: Narrative Purpose */}
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#718096]">Scenic Narrative Role (Why are we here?)</label>
                                  <input
                                    type="text"
                                    value={loc.narrativePurpose || ''}
                                    onChange={(e) => handleUpdateLocation(loc.id, { narrativePurpose: e.target.value })}
                                    placeholder="The site of Cynthia's deep betrayal. It acts as a cold, sterile sanctuary before the action rises."
                                    className="w-full bg-[#FAFAFA] border border-[#E5E5E1] rounded px-2.5 py-1.5 text-xs text-[#2D2D2A] focus:bg-white focus:outline-none focus:border-[#1A1A1A]"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex-grow flex flex-col items-center justify-center text-[#A0AEC0] p-12">
                          <MapPin className="w-12 h-12 stroke-1 mb-4 text-[#C0C7CE]" />
                          <p className="text-xs font-semibold text-[#718096]">No Location Active</p>
                          <p className="text-[11px] text-[#A0AEC0] mt-1 max-w-xs text-center">Select an existing set from the sidebar directory, or click "+" to build a scenic set profile layout.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        </main>

        {/* Right Sidebar: Storyboard Companion Sidebar (Symmetrical & Sibling of main) */}
        {viewMode === 'script' && showStoryboardSidebar && (
          <div 
            className="relative flex shrink-0 z-20 h-full border-l border-[#E5E5E1]"
            onMouseEnter={() => setIsHoveredStoryboardSidebar(true)}
            onMouseLeave={() => setIsHoveredStoryboardSidebar(false)}
          >
            {/* Splitter Hover collapse button */}
            <button
              onClick={() => setShowStoryboardSidebar(false)}
              className={`absolute top-1/2 -left-3 -translate-y-1/2 w-5 h-12 flex items-center justify-center rounded-l-lg shadow-sm cursor-pointer transition-all z-20 group ${
                isHoveredStoryboardSidebar 
                  ? 'bg-[#1A1A1A] border border-[#1A1A1A] text-white scale-y-110 -translate-x-0.5 shadow-md' 
                  : 'bg-white border border-[#E5E5E1] text-[#718096] hover:bg-[#FAFAFA]'
              }`}
              title="Collapse Storyboard Companion"
            >
              <ChevronRight className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </button>
            <aside className="w-[340px] bg-[#FAFAFA] flex flex-col shrink-0 overflow-y-auto p-4 space-y-4 shadow-xs select-none">
            <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-3 mb-1">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">Storyboard Companion</h3>
                <p className="text-[10px] text-[#718096] font-light mt-0.5">Linked scene visual references</p>
              </div>
              <button
                onClick={handleAddStoryboardFrame}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#E5E5E1] hover:bg-[#FAFAFA] text-[#2D2D2A] text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer shadow-xs"
                title="Add Storyboard Panel"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Panel</span>
              </button>
            </div>

            {storyboardFrames.filter(f => f.sceneId === activeSceneId).length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center py-24 text-center text-[#A0AEC0] px-4">
                <Grid className="w-8 h-8 mb-2.5 stroke-1 text-[#CBD5E0]" />
                <p className="text-xs font-medium">No storyboards in this scene yet.</p>
                <p className="text-[10px] font-light mt-1">Add panels to link drawings with script elements.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {storyboardFrames
                  .filter(f => f.sceneId === activeSceneId)
                  .sort((a, b) => a.order - b.order)
                  .map((frame, frameIndex) => {
                    const isHovered = hoveredStoryboardFrameId === frame.id;
                    const isSelected = selectedStoryboardFrameId === frame.id;
                    const isEditing = editingStoryboardFrameId === frame.id;
                    const validLinkedBlockIds = (frame.linkedBlockIds || []).filter(id => scriptBlocks.some(b => b.id === id));
                    const linkedCount = validLinkedBlockIds.length;

                    return (
                      <div
                        key={frame.id}
                        onMouseEnter={() => setHoveredStoryboardFrameId(frame.id)}
                        onMouseLeave={() => setHoveredStoryboardFrameId(null)}
                        onContextMenu={(e) => {
                          handleStoryboardContextMenu(e, frame.id);
                        }}
                        onClick={() => {
                          setSelectedStoryboardFrameId(selectedStoryboardFrameId === frame.id ? null : frame.id);
                        }}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', frame.id);
                          e.dataTransfer.setData('drag-type', 'storyboard-frame');
                          setDraggedId(frame.id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedId && draggedId !== frame.id) {
                            setDragOverId(frame.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverId === frame.id) {
                            setDragOverId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
                          const type = e.dataTransfer.getData('drag-type');
                          if (type === 'storyboard-frame' && sourceId && sourceId !== frame.id) {
                            handleReorderStoryboardFrames(sourceId, frame.id);
                          }
                          setDraggedId(null);
                          setDragOverId(null);
                        }}
                        className={`bg-white rounded border transition-all duration-300 p-3.5 relative flex flex-col cursor-pointer ${
                          isSelected 
                            ? 'border-[#1A1A1A] ring-1 ring-[#1A1A1A] shadow-md' 
                            : isHovered 
                              ? 'border-[#718096] shadow-sm' 
                              : 'border-[#E5E5E1]'
                        } ${
                          dragOverId === frame.id 
                            ? 'border-2 border-dashed border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500' 
                            : ''
                        }`}
                      >
                        <div className="absolute left-3 top-3 bg-[#1A1A1A] text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded z-10">
                          SHOT {frameIndex + 1}
                        </div>

                        <div className="w-full aspect-video bg-white border border-[#E5E5E1] rounded overflow-hidden relative mb-2.5 mt-2 shadow-xs">
                          <CollaborativeCanvas
                            id={frame.id}
                            strokes={frame.strokes}
                            readOnly={true}
                          />
                        </div>

                        <input
                          type="text"
                          value={frame.caption}
                          onChange={(e) => handleUpdateFrameCaption(frame.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Describe shot framing..."
                          className="w-full text-xs bg-transparent border-b border-transparent hover:border-[#E5E5E1] focus:border-[#1A1A1A] focus:outline-none py-1 text-[#2D2D2A] font-sans font-medium"
                        />

                        <div className="mt-2.5 pt-2 border-t border-[#F1F1F1] flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1 text-[#718096]">
                            <FileText className="w-3 h-3" />
                            <span>
                              {linkedCount === 0 
                                ? 'No text elements linked' 
                                : `${linkedCount} element${linkedCount > 1 ? 's' : ''} linked`
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isEditing ? (
                              <span className="text-emerald-600 font-bold animate-pulse text-[9px]">EDITING LINK</span>
                            ) : (
                              <span className="text-[#A0AEC0] hover:text-[#1A1A1A] text-[9px] font-semibold border border-[#E5E5E1] px-1.5 py-0.5 rounded bg-white">
                                Right-Click Menu
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            </aside>
          </div>
        )}

        {/* Closed Storyboard Companion expand handle */}
        {viewMode === 'script' && !showStoryboardSidebar && (
          <button
            onClick={() => setShowStoryboardSidebar(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-12 flex items-center justify-center bg-white border-y border-l border-[#E5E5E1] rounded-l-lg shadow-xs hover:bg-[#1A1A1A] hover:border-[#1A1A1A] hover:text-white hover:scale-y-110 hover:-translate-x-0.5 hover:shadow-md text-[#718096] cursor-pointer transition-all z-30 group"
            title="Expand Storyboard Companion"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Context Menu for Storyboard Companion */}
      {contextMenu?.visible && (
        <div 
          className="fixed bg-white border border-[#E5E5E1] rounded shadow-md z-50 py-1.5 min-w-[180px] select-none text-xs text-[#2D2D2A]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] uppercase font-mono font-bold tracking-widest text-[#718096] border-b border-[#F1F1F1] mb-1">
            Panel Actions
          </div>
          <button
            onClick={() => {
              setSelectedStoryboardFrameId(contextMenu.frameId);
              setViewMode('storyboard');
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-[#FAFAFA] transition-colors flex items-center gap-2 cursor-pointer font-bold text-[#1A1A1A] border-b border-[#F1F1F1]"
          >
            <Palette className="w-3.5 h-3.5 text-stone-700" />
            <span>Edit Panel</span>
          </button>
          <button
            onClick={() => {
              handleAddSelectedTextToFrame(contextMenu.frameId);
            }}
            disabled={getSelectedBlockIds().length === 0}
            className="w-full text-left px-3 py-2 hover:bg-[#FAFAFA] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Link Selected Text</span>
          </button>
          <button
            onClick={() => {
              handleStartEditingLinkedText(contextMenu.frameId);
            }}
            className="w-full text-left px-3 py-2 hover:bg-[#FAFAFA] transition-colors flex items-center gap-2 cursor-pointer font-semibold"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Edit Linked Text</span>
          </button>
          <button
            onClick={() => {
              // Clear linked blocks
              const updated = storyboardFrames.map(f => f.id === contextMenu.frameId ? { ...f, linkedBlockIds: [] } : f);
              setStoryboardFrames(updated);
              emitMessage({ type: 'storyboard-update', storyboardFrames: updated });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-[#FAFAFA] transition-colors flex items-center gap-2 text-[#718096] cursor-pointer font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Unlink All Text</span>
          </button>
          <div className="border-t border-[#F1F1F1] my-1" />
          <button
            onClick={() => {
              handleDeleteStoryboardFrame(contextMenu.frameId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 cursor-pointer font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Panel</span>
          </button>
        </div>
      )}
    </div>
  );
}
