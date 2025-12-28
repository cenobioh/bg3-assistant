import { useState, useEffect } from 'react';
import { Item, Build } from './types';
import { loadBuilds, saveBuilds } from './utils/storage';
import { AddItemForm } from './components/AddItemForm';
import { ItemChecklist } from './components/ItemChecklist';
import { BuildTabs } from './components/BuildTabs';
import './App.css';

function App() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [activeBuildId, setActiveBuildId] = useState<string>('');

  useEffect(() => {
    const loadedBuilds = loadBuilds();
    setBuilds(loadedBuilds);
    if (loadedBuilds.length > 0 && !activeBuildId) {
      setActiveBuildId(loadedBuilds[0].id);
    }
  }, []);

  useEffect(() => {
    if (builds.length > 0) {
      saveBuilds(builds);
    }
  }, [builds]);

  const activeBuild = builds.find(b => b.id === activeBuildId);
  const items = activeBuild?.items || [];

  const handleAddItem = (itemData: Omit<Item, 'id' | 'collected'>) => {
    if (!activeBuild) return;
    
    const newItem: Item = {
      ...itemData,
      id: crypto.randomUUID(),
      collected: false,
    };
    
    setBuilds(builds.map(build =>
      build.id === activeBuildId
        ? { ...build, items: [...build.items, newItem] }
        : build
    ));
  };

  const handleToggleItem = (id: string) => {
    setBuilds(builds.map(build =>
      build.id === activeBuildId
        ? {
            ...build,
            items: build.items.map(item =>
              item.id === id ? { ...item, collected: !item.collected } : item
            ),
          }
        : build
    ));
  };

  const handleRemoveItem = (id: string) => {
    setBuilds(builds.map(build =>
      build.id === activeBuildId
        ? { ...build, items: build.items.filter(item => item.id !== id) }
        : build
    ));
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
    setBuilds([...builds, newBuild]);
    setActiveBuildId(newBuild.id);
  };

  const handleRenameBuild = (buildId: string, newName: string) => {
    setBuilds(builds.map(build =>
      build.id === buildId ? { ...build, name: newName } : build
    ));
  };

  const handleDeleteBuild = (buildId: string) => {
    if (builds.length <= 1) return; // Don't delete the last build
    
    const newBuilds = builds.filter(build => build.id !== buildId);
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
          />
        </section>
      </main>
    </div>
  );
}

export default App;

