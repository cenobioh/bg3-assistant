import { useState } from 'react';
import { Build } from '../types';

interface BuildTabsProps {
  builds: Build[];
  activeBuildId: string;
  onSelect: (buildId: string) => void;
  onAdd: () => void;
  onRename: (buildId: string, newName: string) => void;
  onDelete: (buildId: string) => void;
}

export function BuildTabs({
  builds,
  activeBuildId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: BuildTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleStartEdit = (build: Build) => {
    setEditingId(build.id);
    setEditName(build.name);
  };

  const handleSaveEdit = (buildId: string) => {
    if (editName.trim()) {
      onRename(buildId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, buildId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(buildId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="build-tabs">
      <div className="build-tabs-list">
        {builds.map((build) => (
          <div
            key={build.id}
            className={`build-tab ${build.id === activeBuildId ? 'active' : ''}`}
            onClick={() => onSelect(build.id)}
          >
            {editingId === build.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleSaveEdit(build.id)}
                onKeyDown={(e) => handleKeyDown(e, build.id)}
                onClick={(e) => e.stopPropagation()}
                className="build-tab-edit-input"
                autoFocus
              />
            ) : (
              <>
                <span
                  className="build-tab-name"
                  onDoubleClick={() => handleStartEdit(build)}
                  title="Double-click to edit"
                >
                  {build.name}
                </span>
                <div className="build-tab-actions">
                  <button
                    className="build-tab-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(build);
                    }}
                    aria-label="Edit build name"
                    title="Edit build name (or double-click)"
                  >
                    ✎
                  </button>
                  {builds.length > 1 && (
                    <button
                      className="build-tab-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(build.id);
                      }}
                      aria-label="Delete build"
                      title="Delete build"
                    >
                      ×
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <button className="build-tab-add" onClick={onAdd} title="Add new build">
        + New Build
      </button>
    </div>
  );
}

