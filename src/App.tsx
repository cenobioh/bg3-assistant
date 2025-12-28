import { useState, useEffect, useRef } from 'react';
import { Item, Build } from './types';
import { loadBuilds, saveBuilds } from './utils/storage';
import { determineActFromLocation } from './services/bg3WikiApi';
import { AddItemForm } from './components/AddItemForm';
import { ItemChecklist } from './components/ItemChecklist';
import { BuildTabs } from './components/BuildTabs';
import './App.css';

function App() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [activeBuildId, setActiveBuildId] = useState<string>('');
  const hasProcessedActs = useRef(false);
  
  // Undo/Redo history - using ref to avoid dependency issues
  const historyRef = useRef<{ history: Build[][]; index: number }>({ history: [], index: -1 });

  useEffect(() => {
    const loadedBuilds = loadBuilds();
    setBuilds(loadedBuilds);
    // Initialize history with initial state
    historyRef.current = { history: [loadedBuilds], index: 0 };
    if (loadedBuilds.length > 0 && !activeBuildId) {
      setActiveBuildId(loadedBuilds[0].id);
    }
  }, []);

  // Retroactively determine Act for existing items that don't have it
  // This runs once after builds are initially loaded
  useEffect(() => {
    if (builds.length === 0 || hasProcessedActs.current) return;

    // Check if any items need Act determination
    const itemsNeedingAct = builds.some(build =>
      build.items.some(item => 
        item.location && item.location !== 'Location not found' && !item.act
      )
    );

    if (!itemsNeedingAct) {
      hasProcessedActs.current = true;
      return;
    }

    // Process items that need Act determination
    const processItems = async () => {
      hasProcessedActs.current = true;
      const processedBuilds = await Promise.all(
        builds.map(async (build) => {
          const processedItems = await Promise.all(
            build.items.map(async (item) => {
              // If item already has an Act, keep it
              if (item.act || !item.location || item.location === 'Location not found') {
                return item;
              }

              // Determine Act from location
              console.log(`[Retroactive Act] Processing ${item.name} with location: ${item.location}`);
              const act = await determineActFromLocation(item.location);
              if (act) {
                console.log(`[Retroactive Act] ${item.name} -> Act ${act}`);
                return { ...item, act };
              }
              return item;
            })
          );
          return { ...build, items: processedItems };
        })
      );
      setBuilds(processedBuilds);
    };

    processItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builds.length]); // Only run when builds are first loaded

  useEffect(() => {
    if (builds.length > 0) {
      saveBuilds(builds);
    }
  }, [builds]);

  const activeBuild = builds.find(b => b.id === activeBuildId);
  const items = activeBuild?.items || [];

  // Helper function to save state to history before making changes
  const saveToHistory = (newBuilds: Build[]) => {
    const newHistory = historyRef.current.history.slice(0, historyRef.current.index + 1);
    newHistory.push(newBuilds);
    // Limit history to last 50 actions
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      historyRef.current.index = newHistory.length - 1;
    }
    historyRef.current = { history: newHistory, index: newHistory.length - 1 };
  };

  const handleUndo = () => {
    if (historyRef.current.index > 0) {
      const newIndex = historyRef.current.index - 1;
      const previousBuilds = historyRef.current.history[newIndex];
      setBuilds(previousBuilds);
      historyRef.current.index = newIndex;
      
      // Update active build ID if needed
      if (previousBuilds.length > 0) {
        const prevActiveBuild = previousBuilds.find(b => b.id === activeBuildId);
        if (!prevActiveBuild && previousBuilds[0]) {
          setActiveBuildId(previousBuilds[0].id);
        }
      }
    }
  };

  const handleRedo = () => {
    if (historyRef.current.index < historyRef.current.history.length - 1) {
      const newIndex = historyRef.current.index + 1;
      const nextBuilds = historyRef.current.history[newIndex];
      setBuilds(nextBuilds);
      historyRef.current.index = newIndex;
      
      // Update active build ID if needed
      if (nextBuilds.length > 0) {
        const nextActiveBuild = nextBuilds.find(b => b.id === activeBuildId);
        if (!nextActiveBuild && nextBuilds[0]) {
          setActiveBuildId(nextBuilds[0].id);
        }
      }
    }
  };

  // Handle CTRL+Z (undo) and CTRL+SHIFT+Z or CTRL+Y (redo)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Z (Windows/Linux) or Cmd+Z (Mac) for undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      // Check for Ctrl+Shift+Z or Ctrl+Y (Windows/Linux) or Cmd+Shift+Z (Mac) for redo
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps - we use refs for history

  const handleAddItem = (itemData: Omit<Item, 'id' | 'collected'>) => {
    if (!activeBuild) return;
    
    const newItem: Item = {
      ...itemData,
      id: crypto.randomUUID(),
      collected: false,
    };
    
    const newBuilds = builds.map(build =>
      build.id === activeBuildId
        ? { ...build, items: [...build.items, newItem] }
        : build
    );
    saveToHistory(newBuilds);
    setBuilds(newBuilds);
  };

  const handleToggleItem = (id: string) => {
    const newBuilds = builds.map(build =>
      build.id === activeBuildId
        ? {
            ...build,
            items: build.items.map(item =>
              item.id === id ? { ...item, collected: !item.collected } : item
            ),
          }
        : build
    );
    saveToHistory(newBuilds);
    setBuilds(newBuilds);
  };

  const handleRemoveItem = (id: string) => {
    const newBuilds = builds.map(build =>
      build.id === activeBuildId
        ? { ...build, items: build.items.filter(item => item.id !== id) }
        : build
    );
    saveToHistory(newBuilds);
    setBuilds(newBuilds);
  };

  const handleMarkActComplete = (act: number | undefined) => {
    const newBuilds = builds.map(build =>
      build.id === activeBuildId
        ? {
            ...build,
            items: build.items.map(item =>
              item.act === act ? { ...item, collected: true } : item
            ),
          }
        : build
    );
    saveToHistory(newBuilds);
    setBuilds(newBuilds);
  };

  const handleSelectBuild = (buildId: string) => {
    setActiveBuildId(buildId);
  };

  const handleAddBuild = () => {
    const newBuild: Build = {
      id: crypto.randomUUID(),
      name: `Run ${builds.length + 1}`,
      items: [],
      createdAt: Date.now(),
    };
    const newBuilds = [...builds, newBuild];
    saveToHistory(newBuilds);
    setBuilds(newBuilds);
    setActiveBuildId(newBuild.id);
  };

  const handleRenameBuild = (buildId: string, newName: string) => {
    const newBuilds = builds.map(build =>
      build.id === buildId ? { ...build, name: newName } : build
    );
    saveToHistory(newBuilds);
    setBuilds(newBuilds);
  };

  const handleDeleteBuild = (buildId: string) => {
    if (builds.length <= 1) return; // Don't delete the last build
    
    const newBuilds = builds.filter(build => build.id !== buildId);
    saveToHistory(newBuilds);
    setBuilds(newBuilds);
    
    // If we deleted the active build, switch to the first one
    if (buildId === activeBuildId && newBuilds.length > 0) {
      setActiveBuildId(newBuilds[0].id);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚔️ BG3 Item Collection Assistant</h1>
        <p>Track your Baldur's Gate 3 item collection progress</p>
        <div className="shortcuts-info">
          <span className="shortcut-item">
            <kbd>{typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac')) ? '⌘' : 'Ctrl'}</kbd> + <kbd>F</kbd> Focus search
          </span>
          <span className="shortcut-separator">•</span>
          <span className="shortcut-item">
            <kbd>{typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac')) ? '⌘' : 'Ctrl'}</kbd> + <kbd>Z</kbd> Undo
          </span>
          <span className="shortcut-separator">•</span>
          <span className="shortcut-item">
            <kbd>{typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac')) ? '⌘' : 'Ctrl'}</kbd> + <kbd>⇧</kbd> + <kbd>Z</kbd> Redo
          </span>
        </div>
      </header>
      {builds.length > 0 && (
        <BuildTabs
          builds={builds}
          activeBuildId={activeBuildId}
          onSelect={handleSelectBuild}
          onAdd={handleAddBuild}
          onRename={handleRenameBuild}
          onDelete={handleDeleteBuild}
        />
      )}
      <main className="app-main">
        <section className="add-section">
          <AddItemForm onAdd={handleAddItem} />
        </section>
        <section className="checklist-section">
          <ItemChecklist
            items={items}
            onToggle={handleToggleItem}
            onRemove={handleRemoveItem}
            onMarkActComplete={handleMarkActComplete}
          />
        </section>
      </main>
    </div>
  );
}

export default App;

