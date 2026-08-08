import React, { useState, useEffect } from 'react';
import ProjectDashboard from './components/ProjectDashboard';
import EditorWorkspace from './components/EditorWorkspace';

export default function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('Collaborative Screenplay');

  useEffect(() => {
    // Check if the user is joining via a collaborative invite link
    const urlParams = new URLSearchParams(window.location.search);
    const sharedProjectId = urlParams.get('project');

    if (sharedProjectId) {
      setSelectedProjectId(sharedProjectId);
      
      // Fetch projects list to resolve the actual project title
      fetch('/api/projects')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch projects');
        })
        .then((projects) => {
          const matchedProj = projects.find((p: any) => p.id === sharedProjectId);
          if (matchedProj) {
            setSelectedProjectName(matchedProj.name);
          }
        })
        .catch((err) => {
          console.error('Error auto-resolving shared workspace name:', err);
        });
    }
  }, []);

  const handleSelectProject = (id: string, name: string) => {
    setSelectedProjectId(id);
    setSelectedProjectName(name);
    // Push project to URL history for clean sharing
    const newUrl = `${window.location.origin}/?project=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleBackToDashboard = () => {
    setSelectedProjectId(null);
    // Reset URL to clean base path
    const cleanUrl = window.location.origin + '/';
    window.history.pushState({ path: cleanUrl }, '', cleanUrl);
  };

  return (
    <div className={`w-full ${selectedProjectId ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {selectedProjectId ? (
        <EditorWorkspace
          projectId={selectedProjectId}
          projectName={selectedProjectName}
          onBack={handleBackToDashboard}
          onProjectNameChange={setSelectedProjectName}
        />
      ) : (
        <ProjectDashboard onSelectProject={handleSelectProject} />
      )}
    </div>
  );
}
