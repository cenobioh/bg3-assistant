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
      <div className="checklist-acts">
        {actSections.map((section) => (
          <div key={section.key} className="act-section">
            <h3 className="act-section-header">{section.label}</h3>
            <ul className="item-list">
              {section.items.map((item) => (
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
        ))}
      </div>
    </div>
  );
}

