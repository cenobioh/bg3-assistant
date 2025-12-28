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
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim() || selectedItem || manualMode) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchItems(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setShowDropdown(results.length > 0);
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

  const handleSelectItem = async (item: WikiItem) => {
    setSelectedItem(item);
    setSearchQuery(item.name);
    setLocation(item.where_to_find || '');
    setShowDropdown(false);
    setManualMode(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (selectedItem) {
      setSelectedItem(null);
      setLocation('');
    }
    if (manualMode) {
      setManualMode(false);
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
    let itemLocation = location.trim();
    let itemData: Omit<Item, 'id' | 'collected'> = {
      name: itemName,
      location: itemLocation || 'Location not found',
    };

    // If we have a selected item, use its data
    if (selectedItem) {
      itemData = {
        name: selectedItem.name,
        location: selectedItem.where_to_find || 'Location not found',
        rarity: selectedItem.rarity,
        uuid: selectedItem.uuid,
        description: selectedItem.description,
      };
    } else if (!manualMode && !location.trim()) {
      // Try to fetch the item if not in manual mode
      const wikiItem = await getItemByName(itemName);
      if (wikiItem) {
        itemData = {
          name: wikiItem.name,
          location: wikiItem.where_to_find || 'Location not found',
          rarity: wikiItem.rarity,
          uuid: wikiItem.uuid,
          description: wikiItem.description,
        };
      }
    }

    if (itemData.name) {
      onAdd(itemData);
      setSearchQuery('');
      setLocation('');
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
            id="item-name"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
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
                    className="search-result-item"
                    onClick={() => handleSelectItem(item)}
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
      <div className="form-group">
        <label htmlFor="item-location">Location</label>
        <input
          id="item-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={
            selectedItem
              ? selectedItem.where_to_find || 'Location not found in wiki'
              : 'Location will be auto-filled from wiki'
          }
          required
          disabled={!!selectedItem?.where_to_find && !manualMode}
        />
        {selectedItem && !selectedItem.where_to_find && (
          <small className="form-hint">
            Location not found in wiki. Please enter manually.
          </small>
        )}
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
