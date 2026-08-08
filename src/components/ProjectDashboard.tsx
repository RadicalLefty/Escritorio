import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, FileText, Clock, Edit2, X, Check, Sprout, Tag, Play, Shuffle } from 'lucide-react';
import { Project } from '../types';

interface ProjectDashboardProps {
  onSelectProject: (id: string, name: string) => void;
}

interface Seedling {
  id: string;
  category: string;
  content: string;
  createdAt: number;
}

export default function ProjectDashboard({ onSelectProject }: ProjectDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [seedlings, setSeedlings] = useState<Seedling[]>([]);
  
  const [newProjectName, setNewProjectName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Seedling inputs
  const [newSeedlingCategory, setNewSeedlingCategory] = useState('character');
  const [newSeedlingContent, setNewSeedlingContent] = useState('');
  const [seedlingSort, setSeedlingSort] = useState('all');

  // Fetch projects from DB
  const fetchData = async () => {
    try {
      const [projRes, seedRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/seedlings')
      ]);
      if (projRes.ok) {
        const pData = await projRes.json();
        setProjects(pData);
      }
      if (seedRes.ok) {
        const sData = await seedRes.json();
        setSeedlings(sData);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getAvailableProjectName = (baseName: string) => {
    let name = baseName;
    let count = 2;
    while (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      name = `${baseName} ${count}`;
      count++;
    }
    return name;
  };

  const handleCreateProject = async (name: string, seedlingContent?: string) => {
    if (!name.trim()) return;
    setCreateError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, seedlingContent }),
      });
      if (res.ok) {
        const data = await res.json();
        onSelectProject(data.id, data.name);
        setNewProjectName('');
        setShowNewMenu(false);
      } else {
        const errData = await res.json();
        setCreateError(errData.error || 'Failed to create script.');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      setCreateError('Failed to create script due to a network error.');
    }
  };

  const handleCreateFromSeedling = (seedling: Seedling) => {
    const defaultName = getAvailableProjectName('New Script');
    handleCreateProject(defaultName, seedling.content);
  };

  const handleCreateRandomFromSeedling = () => {
    if (seedlings.length === 0) return;
    const randomIndex = Math.floor(Math.random() * seedlings.length);
    handleCreateFromSeedling(seedlings[randomIndex]);
  };

  const handleCreateSeedling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeedlingContent.trim()) return;
    try {
      const res = await fetch('/api/seedlings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newSeedlingCategory, content: newSeedlingContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setSeedlings([data, ...seedlings]);
        setNewSeedlingContent('');
      }
    } catch (err) {
      console.error('Failed to create seedling:', err);
    }
  };

  const handleDeleteSeedling = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/seedlings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSeedlings(seedlings.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete seedling:', err);
    }
  };

  const handleRenameProject = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!renamingName.trim()) return;
    setRenameError(null);
    
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renamingName }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(projects.map(p => p.id === id ? { ...p, name: data.name, updatedAt: Date.now() } : p));
        setRenamingId(null);
        setRenamingName('');
      } else {
        const errData = await res.json();
        setRenameError(errData.error || 'Failed to rename script.');
      }
    } catch (err) {
      console.error('Failed to rename project:', err);
      setRenameError('Failed to rename script.');
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? This will permanently remove all script files, storyboards, and sketch data.')) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProjects(projects.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          if (!content.name) {
            setImportError('Invalid format: Project name is required.');
            return;
          }
          const res = await fetch('/api/projects/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(content),
          });
          if (res.ok) {
            const data = await res.json();
            onSelectProject(data.id, data.name);
          } else {
            const errData = await res.json();
            setImportError(errData.error || 'Failed to import project.');
          }
        } catch (err) {
          setImportError('Invalid JSON file format.');
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setImportError('Failed to read file.');
    }
  };

  const filteredSeedlings = seedlingSort === 'all' 
    ? seedlings 
    : seedlings.filter(s => s.category === seedlingSort);

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#2D2D2A] flex flex-col justify-between" id="dashboard-container">
      {/* Upper Area */}
      <main className="max-w-7xl w-full mx-auto px-6 py-12 flex-grow flex flex-col">
        {/* Title & Concept */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#E5E5E1]/50 text-[#718096] px-3 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase font-bold mb-2">
              <span>SECURE LOCAL WRITING SUITE</span>
            </div>
            <h1 className="text-3xl font-sans font-light tracking-tight text-[#1A1A1A] sm:text-4xl">
              CoScript Studio
            </h1>
          </div>
          
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white rounded-md px-6 py-3 text-sm font-medium transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
            
            {showNewMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-[#E5E5E1] p-4 z-50">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleCreateProject(newProjectName); }}
                  className="mb-4 pb-4 border-b border-[#E5E5E1]"
                >
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#718096] mb-2">Start Blank Script</label>
                  <input
                    type="text"
                    required
                    placeholder="Untitled Screenplay..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E5E5E1] text-[#2D2D2A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-colors mb-2"
                  />
                  {createError && (
                    <div className="mb-2 text-xs text-red-600 font-medium">
                      {createError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-[#FAFAFA] hover:bg-[#F1F1F1] border border-[#E5E5E1] text-[#1A1A1A] rounded py-2 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Create Blank
                  </button>
                </form>
                
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#718096] mb-2">Import Backup</label>
                  <label className="flex items-center justify-center w-full bg-[#FAFAFA] hover:bg-[#F1F1F1] border border-[#E5E5E1] border-dashed text-[#1A1A1A] rounded py-3 text-xs font-semibold transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 mr-2 text-[#718096]" />
                    Select .json File
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => { handleImportProject(e); setShowNewMenu(false); }}
                      className="hidden"
                    />
                  </label>
                  {importError && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">
                      {importError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start flex-grow">
          
          {/* Seedlings Column */}
          <div className="bg-white rounded-xl border border-[#E5E5E1] shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-[#E5E5E1] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-[#1A1A1A]">
                  <Sprout className="w-5 h-5 text-emerald-600" />
                  Idea Seedlings
                </h2>
                <p className="text-[11px] text-[#718096] mt-1">Jot down characters, locations, or plots to inspire your next script.</p>
              </div>
              <button 
                onClick={handleCreateRandomFromSeedling}
                disabled={seedlings.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F1F1F1] hover:bg-[#E5E5E1] text-[#2D2D2A] text-xs font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="Start a new script from a random seedling"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Random Idea
              </button>
            </div>
            
            <div className="p-4 bg-[#FAFAFA] border-b border-[#E5E5E1]">
              <form onSubmit={handleCreateSeedling} className="flex flex-col sm:flex-row gap-3">
                <select
                  value={newSeedlingCategory}
                  onChange={(e) => setNewSeedlingCategory(e.target.value)}
                  className="bg-white border border-[#E5E5E1] text-[#2D2D2A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A1A] w-full sm:w-1/3"
                >
                  <option value="character">Character</option>
                  <option value="location">Location</option>
                  <option value="situation">Situation</option>
                  <option value="world">World Building</option>
                  <option value="dialogue">Dialogue</option>
                  <option value="other">Other</option>
                </select>
                <div className="flex-grow flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="E.g., A detective who is afraid of the dark..."
                    value={newSeedlingContent}
                    onChange={(e) => setNewSeedlingContent(e.target.value)}
                    className="flex-grow bg-white border border-[#E5E5E1] text-[#2D2D2A] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A1A]"
                  />
                  <button
                    type="submit"
                    className="bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white rounded px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-b border-[#E5E5E1] bg-white flex gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#A0AEC0] self-center mr-2">Filter:</span>
              {['all', 'character', 'location', 'situation', 'world', 'dialogue', 'other'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSeedlingSort(cat)}
                  className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase transition-colors whitespace-nowrap cursor-pointer ${
                    seedlingSort === cat ? 'bg-[#2D2D2A] text-white' : 'bg-[#F1F1F1] text-[#718096] hover:bg-[#E5E5E1]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-3">
              {filteredSeedlings.length === 0 ? (
                <div className="text-center py-12 text-[#A0AEC0]">
                  <Sprout className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-light">No seedlings planted yet.</p>
                </div>
              ) : (
                filteredSeedlings.map(seedling => (
                  <div key={seedling.id} className="group p-4 rounded-lg bg-white border border-[#E5E5E1] shadow-xs hover:border-[#CBD5E0] transition-all relative">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Tag className="w-3 h-3 text-[#A0AEC0]" />
                          <span className="text-[10px] uppercase font-bold tracking-widest text-[#718096]">
                            {seedling.category}
                          </span>
                        </div>
                        <p className="text-sm text-[#1A1A1A] leading-relaxed break-words">{seedling.content}</p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCreateFromSeedling(seedling)}
                          className="flex items-center gap-1 bg-[#1A1A1A] text-white px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-[#2D2D2A] transition-colors cursor-pointer"
                          title="Start new script from this idea"
                        >
                          <Play className="w-3 h-3" />
                          Start
                        </button>
                        <button
                          onClick={(e) => handleDeleteSeedling(seedling.id, e)}
                          className="p-1 text-[#A0AEC0] hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete seedling"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Existing Projects List */}
          <div className="bg-white rounded-xl border border-[#E5E5E1] shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-[#E5E5E1]">
              <h2 className="text-sm font-bold text-[#1A1A1A] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Active Workspaces
                </span>
                <span className="text-xs font-mono text-[#A0AEC0] font-normal bg-[#F1F1F1] px-2 py-0.5 rounded-full">{projects.length} files</span>
              </h2>
            </div>

            <div className="flex-grow overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#4A5568] border-t-transparent"></div>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 text-[#A0AEC0]">
                  <FileText className="w-10 h-10 mx-auto mb-3 stroke-1" />
                  <p className="text-sm font-light">No script projects found.</p>
                  <p className="text-xs font-light mt-1 text-[#A0AEC0]">Create one or start from a seedling.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        if (renamingId !== proj.id) {
                          onSelectProject(proj.id, proj.name);
                        }
                      }}
                      className="group flex items-center justify-between p-4 rounded-lg bg-[#FAFAFA] hover:bg-white border border-[#E5E5E1] cursor-pointer transition-all duration-200 shadow-xs hover:shadow-sm"
                    >
                      {renamingId === proj.id ? (
                        <div className="w-full" onClick={(e) => e.stopPropagation()}>
                          <form onSubmit={(e) => handleRenameProject(proj.id, e)} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={renamingName}
                              onChange={(e) => setRenamingName(e.target.value)}
                              className="flex-grow bg-white border border-[#1A1A1A] text-[#2D2D2A] rounded px-3 py-1.5 text-sm focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="p-1.5 bg-[#1A1A1A] text-white rounded hover:bg-[#2D2D2A] transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRenamingId(null); setRenameError(null); }}
                              className="p-1.5 hover:bg-[#F1F1F1] text-[#718096] hover:text-[#2D2D2A] rounded border border-transparent hover:border-[#E5E5E1] transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </form>
                          {renameError && (
                            <p className="mt-1.5 text-xs text-red-600 font-medium">{renameError}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded border border-[#E5E5E1] text-[#2D2D2A] shadow-xs">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-[#1A1A1A] group-hover:text-black">
                                {proj.name}
                              </h3>
                              <p className="text-[11px] text-[#718096] flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>Last edited {new Date(proj.updatedAt).toLocaleDateString()}</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingId(proj.id);
                                setRenamingName(proj.name);
                                setRenameError(null);
                              }}
                              title="Rename Project"
                              className="p-1.5 hover:bg-[#F1F1F1] text-[#718096] hover:text-[#2D2D2A] rounded border border-transparent hover:border-[#E5E5E1] transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteProject(proj.id, e)}
                              title="Permanently Delete"
                              className="p-1.5 hover:bg-[#F1F1F1] text-[#718096] hover:text-red-600 rounded border border-transparent hover:border-[#E5E5E1] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Area */}
      <footer className="w-full border-t border-[#E5E5E1] bg-[#FAFAFA] py-6 text-center shrink-0">
        <p className="text-xs text-[#A0AEC0] font-light tracking-wide font-sans">
          Zero external AI. Encrypted SQLite storage. Local data protection & team ownership.
        </p>
      </footer>
    </div>
  );
}
