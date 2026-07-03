import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, Download, FileText, ArrowLeft, Clock } from 'lucide-react';
import { Project } from '../types';

interface ProjectDashboardProps {
  onSelectProject: (id: string, name: string) => void;
}

export default function ProjectDashboard({ onSelectProject }: ProjectDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch projects from DB
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName }),
      });

      if (res.ok) {
        const data = await res.json();
        onSelectProject(data.id, data.name);
        setNewProjectName('');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
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

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#2D2D2A] flex flex-col justify-between" id="dashboard-container">
      {/* Upper Area */}
      <main className="max-w-4xl w-full mx-auto px-6 py-16 flex-grow">
        {/* Title & Concept */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#E5E5E1]/50 text-[#718096] px-3 py-1 rounded-full text-[10px] font-mono mb-4 tracking-wider uppercase font-bold">
            <span>SECURE LOCAL WRITING SUITE</span>
          </div>
          <h1 className="text-4xl font-sans font-light tracking-tight text-[#1A1A1A] sm:text-5xl">
            CoScript Studio
          </h1>
          <p className="mt-4 text-[#718096] font-sans max-w-lg mx-auto font-light leading-relaxed">
            A minimalist, real-time workspace for professional script writing, collaborative storyboarding, and character sketchboarding.
          </p>
        </div>

        <div className="grid md:grid-cols-12 gap-8 items-start">
          {/* Create Project Form & Import Box */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-white rounded border border-[#E5E5E1] p-6 shadow-sm" id="create-project-card">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#718096] mb-4">Start New Script</h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label htmlFor="proj-name" className="sr-only">Project Title</label>
                  <input
                    id="proj-name"
                    type="text"
                    required
                    placeholder="Untitled Screenplay..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E5E5E1] text-[#2D2D2A] rounded px-4 py-2.5 text-sm focus:outline-none focus:border-[#1A1A1A] focus:bg-white transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  id="btn-create"
                  className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] hover:bg-[#2D2D2A] text-white rounded py-2.5 text-sm font-medium transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create Project
                </button>
              </form>
            </div>

            <div className="bg-white rounded border border-[#E5E5E1] p-6 shadow-sm" id="import-project-card">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#718096] mb-3">Import Backups</h2>
              <p className="text-xs text-[#718096] mb-4 font-light">Restore your story offline from a previously exported `.json` file.</p>
              
              <label
                htmlFor="import-file"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#E5E5E1] border-dashed rounded cursor-pointer bg-[#FAFAFA] hover:bg-[#F1F1F1] transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-6 h-6 text-[#A0AEC0] mb-2" />
                  <p className="text-xs font-medium text-[#2D2D2A]">Select exported JSON</p>
                  <p className="text-[10px] text-[#A0AEC0] mt-1">.json format</p>
                </div>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImportProject}
                  className="hidden"
                />
              </label>
              {importError && (
                <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2.5">
                  {importError}
                </div>
              )}
            </div>
          </div>

          {/* Existing Projects List */}
          <div className="md:col-span-7">
            <div className="bg-white rounded border border-[#E5E5E1] p-6 shadow-sm min-h-[300px]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#718096] mb-6 flex items-center justify-between">
                <span>Active Workspaces</span>
                <span className="text-xs font-mono text-[#A0AEC0] font-normal">{projects.length} files</span>
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#4A5568] border-t-transparent"></div>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 text-[#A0AEC0]">
                  <FileText className="w-10 h-10 mx-auto mb-3 stroke-1" />
                  <p className="text-sm font-light">No script projects found.</p>
                  <p className="text-xs font-light mt-1 text-[#A0AEC0]">Create one above to begin collaborative storyboarding.</p>
                </div>
              ) : (
                <div className="space-y-3" id="project-list">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => onSelectProject(proj.id, proj.name)}
                      id={`project-item-${proj.id}`}
                      className="group flex items-center justify-between p-4 rounded bg-[#FAFAFA] hover:bg-white border border-[#E5E5E1] cursor-pointer transition-all duration-200 shadow-xs"
                    >
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
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          id={`delete-project-${proj.id}`}
                          title="Permanently Delete"
                          className="p-1.5 hover:bg-[#F1F1F1] text-[#718096] hover:text-red-600 rounded border border-transparent hover:border-[#E5E5E1] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Area */}
      <footer className="w-full border-t border-[#E5E5E1] bg-[#FAFAFA] py-6 text-center">
        <p className="text-xs text-[#A0AEC0] font-light tracking-wide font-sans">
          Zero external AI. Encrypted SQLite storage. Local data protection & team ownership.
        </p>
      </footer>
    </div>
  );
}
