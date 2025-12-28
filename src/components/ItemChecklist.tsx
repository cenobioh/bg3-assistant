import { useState } from 'react';
import { Item } from '../types';

interface ItemChecklistProps {
  items: Item[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onMarkActComplete: (act: number | undefined) => void;
}

/**
 * Normalize rarity string to CSS class name
 */
function normalizeRarityClass(rarity: string): string {
  return rarity.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function ItemChecklist({ items, onToggle, onRemove, onMarkActComplete }: ItemChecklistProps) {
  // Track which acts are expanded (default to all expanded)
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set(['act1', 'act2', 'act3', 'unknown']));

  const toggleAct = (actKey: string) => {
    setExpandedActs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actKey)) {
        newSet.delete(actKey);
      } else {
        newSet.add(actKey);
      }
      return newSet;
    });
  };

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No items added yet. Add some items to get started!</p>
      </div>
    );
  }

  const collectedCount = items.filter(item => item.collected).length;
  const totalCount = items.length;

  // Group items by Act
  const itemsByAct: { [key: string]: Item[] } = {
    'act1': [],
    'act2': [],
    'act3': [],
    'unknown': [],
  };

  items.forEach(item => {
    if (item.act === 1) {
      itemsByAct.act1.push(item);
    } else if (item.act === 2) {
      itemsByAct.act2.push(item);
    } else if (item.act === 3) {
      itemsByAct.act3.push(item);
    } else {
      itemsByAct.unknown.push(item);
    }
  });

  // Sort items within each Act: non-collected first, collected at the bottom
  const sortItemsByCollected = (items: Item[]): Item[] => {
    return [...items].sort((a, b) => {
      if (a.collected === b.collected) {
        return 0;
      }
      return a.collected ? 1 : -1;
    });
  };

  const actSections = [
    { key: 'act1', label: 'Act 1', items: sortItemsByCollected(itemsByAct.act1) },
    { key: 'act2', label: 'Act 2', items: sortItemsByCollected(itemsByAct.act2) },
    { key: 'act3', label: 'Act 3', items: sortItemsByCollected(itemsByAct.act3) },
    { key: 'unknown', label: 'Unknown Act', items: sortItemsByCollected(itemsByAct.unknown) },
  ].filter(section => section.items.length > 0); // Only show sections with items

  // Calculate per-act progress
  const getActProgress = (actItems: Item[]) => {
    const actCollected = actItems.filter(item => item.collected).length;
    const actTotal = actItems.length;
    return actTotal > 0 ? Math.round((actCollected / actTotal) * 100) : 0;
  };

  return (
    <div className="checklist-container">
      <div className="checklist-header">
        <h2>Item Checklist</h2>
        <div className="progress">
          {collectedCount} / {totalCount} collected
        </div>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${totalCount > 0 ? (collectedCount / totalCount) * 100 : 0}%` }}
        />
      </div>
      {actSections.length > 1 && (
        <div className="act-progress-cards">
          {actSections.map((section) => {
            const progress = getActProgress(section.items);
            const actNumber = section.key === 'act1' ? 1 : section.key === 'act2' ? 2 : section.key === 'act3' ? 3 : undefined;
            const allCollected = section.items.length > 0 && section.items.every(item => item.collected);
            return (
              <div key={section.key} className="act-progress-card">
                <div className="act-progress-label">{section.label}</div>
                <div className="act-progress-value">{progress}%</div>
                <div className="act-progress-count">
                  {section.items.filter(i => i.collected).length} / {section.items.length}
                </div>
                {!allCollected && (
                  <button
                    className="act-complete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkActComplete(actNumber);
                    }}
                    aria-label={`Mark all ${section.label} items as completed`}
                    title="Mark all items in this Act as completed"
                  >
                    ✓ Complete All
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="checklist-acts">
        {actSections.map((section) => {
          const isExpanded = expandedActs.has(section.key);
          return (
            <div key={section.key} className="act-section">
              <h3 
                className={`act-section-header ${isExpanded ? 'expanded' : 'collapsed'}`}
                onClick={() => toggleAct(section.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAct(section.key);
                  }
                }}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.label} items`}
              >
                <span className="act-header-content">
                  <span className="act-chevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                  {section.label}
                </span>
                <span className="act-progress-inline">
                  {getActProgress(section.items)}%
                </span>
              </h3>
              {isExpanded && (
                <ul className="item-list">
                  {section.items.map((item) => (
                    <li key={item.id} className={`item-row ${item.collected ? 'collected' : ''}`}>
                      <label className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={item.collected}
                          onChange={() => onToggle(item.id)}
                          aria-label={`${item.collected ? 'Unmark' : 'Mark'} ${item.name} as ${item.collected ? 'not collected' : 'collected'}`}
                        />
                        <span className="checkmark"></span>
                        <div className="item-info">
                          <div className="item-name-row">
                            <span className="item-name">{item.name}</span>
                            {item.rarity && (
                              <span 
                                className={`item-badge rarity rarity-${normalizeRarityClass(item.rarity)}`}
                                aria-label={`Rarity: ${item.rarity}`}
                              >
                                {item.rarity}
                              </span>
                            )}
                          </div>
                          <span className="item-location">{item.location}</span>
                        </div>
                      </label>
                      <button
                        className="btn-remove"
                        onClick={() => onRemove(item.id)}
                        aria-label={`Remove ${item.name} from checklist`}
                        title="Remove item"
                      >
                        🗑️
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

