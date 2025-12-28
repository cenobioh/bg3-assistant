import { Item } from '../types';

interface ItemChecklistProps {
  items: Item[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ItemChecklist({ items, onToggle, onRemove }: ItemChecklistProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No items added yet. Add some items to get started!</p>
      </div>
    );
  }

  const collectedCount = items.filter(item => item.collected).length;
  const totalCount = items.length;

  // Sort items: non-collected first, collected at the bottom
  const sortedItems = [...items].sort((a, b) => {
    // If both are collected or both are not collected, maintain original order
    if (a.collected === b.collected) {
      return 0;
    }
    // Non-collected items come first (return -1), collected items come last (return 1)
    return a.collected ? 1 : -1;
  });

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
      <ul className="item-list">
        {sortedItems.map((item) => (
          <li key={item.id} className={`item-row ${item.collected ? 'collected' : ''}`}>
            <label className="item-checkbox">
              <input
                type="checkbox"
                checked={item.collected}
                onChange={() => onToggle(item.id)}
              />
              <span className="checkmark"></span>
              <div className="item-info">
                <div className="item-name-row">
                  <span className="item-name">{item.name}</span>
                  {item.rarity && (
                    <span className="item-badge rarity">{item.rarity}</span>
                  )}
                </div>
                <span className="item-location">{item.location}</span>
              </div>
            </label>
            <button
              className="btn-remove"
              onClick={() => onRemove(item.id)}
              aria-label="Remove item"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

