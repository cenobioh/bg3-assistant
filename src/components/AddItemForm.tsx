import { useState } from 'react';
import { Item } from '../types';

interface AddItemFormProps {
  onAdd: (item: Omit<Item, 'id' | 'collected'>) => void;
}

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && location.trim()) {
      onAdd({ name: name.trim(), location: location.trim() });
      setName('');
      setLocation('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-item-form">
      <div className="form-group">
        <label htmlFor="item-name">Item Name</label>
        <input
          id="item-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Sword of Justice"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="item-location">Location</label>
        <input
          id="item-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., Act 1 - Druid Grove"
          required
        />
      </div>
      <button type="submit" className="btn-primary">Add Item</button>
    </form>
  );
}

