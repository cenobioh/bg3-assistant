import { useState, useEffect, useRef } from 'react';
import { Item } from '../types';
import { searchItems, getItemByName, WikiItem } from '../services/bg3WikiApi';

interface AddItemFormProps {
  onAdd: (item: Omit<Item, 'id' | 'collected'>) => void;
}

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WikiItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WikiItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim() || selectedItem || manualMode) {
      setSearchResults([]);
      setIsSearching(false);
      setHighlightedIndex(-1);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchItems(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setShowDropdown(results.length > 0);
      setHighlightedIndex(-1); // Reset highlight when results change
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedItem, manualMode]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectItem = async (item: WikiItem, autoAdd: boolean = false) => {
    setSelectedItem(item);
    setSearchQuery(item.name);
    setShowDropdown(false);
    setManualMode(false);
    setHighlightedIndex(-1);
    
    // If autoAdd is true, automatically add the item to the list
    if (autoAdd) {
      const itemData: Omit<Item, 'id' | 'collected'> = {
        name: item.name,
        location: item.where_to_find || 'Location not found',
        rarity: item.rarity,
        uuid: item.uuid,
        description: item.description,
        act: item.act,
      };
      onAdd(itemData);
      // Reset form after adding
      setSearchQuery('');
      setSelectedItem(null);
      setSearchResults([]);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (selectedItem) {
      setSelectedItem(null);
    }
    if (manualMode) {
      setManualMode(false);
    }
    setHighlightedIndex(-1); // Reset highlight when typing
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) {
      // If dropdown is not shown, allow default behavior
      if (e.key === 'Enter') {
        // Enter will submit the form, which is fine
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < searchResults.length - 1 ? prev + 1 : 0;
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : searchResults.length - 1;
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleSelectItem(searchResults[highlightedIndex], true); // Auto-add on Enter
        } else if (searchResults.length > 0) {
          // If nothing is highlighted, select and add the first item
          handleSelectItem(searchResults[0], true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleManualEntry = () => {
    setManualMode(true);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;

    let itemName = searchQuery.trim();
    let itemData: Omit<Item, 'id' | 'collected'> = {
      name: itemName,
      location: 'Location not found',
    };

    // If we have a selected item, use its data
    if (selectedItem) {
      itemData = {
        name: selectedItem.name,
        location: selectedItem.where_to_find || 'Location not found',
        rarity: selectedItem.rarity,
        uuid: selectedItem.uuid,
        description: selectedItem.description,
        act: selectedItem.act,
      };
    } else if (!manualMode) {
      // Try to fetch the item if not in manual mode
      const wikiItem = await getItemByName(itemName);
      if (wikiItem) {
        itemData = {
          name: wikiItem.name,
          location: wikiItem.where_to_find || 'Location not found',
          rarity: wikiItem.rarity,
          uuid: wikiItem.uuid,
          description: wikiItem.description,
          act: wikiItem.act,
        };
      }
    }

    if (itemData.name) {
      onAdd(itemData);
      setSearchQuery('');
      setSelectedItem(null);
      setManualMode(false);
      setSearchResults([]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-item-form">
      <div className="form-group">
        <label htmlFor="item-name">Item Name</label>
        <div className="search-container" ref={dropdownRef}>
          <input
            ref={inputRef}
            id="item-name"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            placeholder="Search for an item..."
            required
            autoComplete="off"
          />
          {isSearching && (
            <div className="search-loading">Searching...</div>
          )}
          {showDropdown && searchResults.length > 0 && !manualMode && (
            <div className="search-dropdown">
              <div className="dropdown-header">
                <span>Select an item or</span>
                <button
                  type="button"
                  className="btn-link"
                  onClick={handleManualEntry}
                >
                  enter manually
                </button>
              </div>
              <ul className="search-results">
                {searchResults.map((item, index) => (
                  <li
                    key={index}
                    className={`search-result-item ${index === highlightedIndex ? 'highlighted' : ''}`}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="result-name">{item.name}</div>
                    {item.rarity && (
                      <div className="result-rarity">{item.rarity}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {selectedItem && (
        <div className="item-preview">
          {selectedItem.rarity && (
            <span className="item-badge rarity">{selectedItem.rarity}</span>
          )}
          {selectedItem.description && (
            <p className="item-description">{selectedItem.description}</p>
          )}
        </div>
      )}
      <button type="submit" className="btn-primary">
        Add Item
      </button>
    </form>
  );
}
