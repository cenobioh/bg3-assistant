import { useState, useEffect } from 'react';
import { Item } from './types';
import { loadItems, saveItems } from './utils/storage';
import { AddItemForm } from './components/AddItemForm';
import { ItemChecklist } from './components/ItemChecklist';
import './App.css';

function App() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const handleAddItem = (itemData: Omit<Item, 'id' | 'collected'>) => {
    const newItem: Item = {
      ...itemData,
      id: crypto.randomUUID(),
      collected: false,
    };
    setItems([...items, newItem]);
  };

  const handleToggleItem = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, collected: !item.collected } : item
    ));
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚔️ BG3 Item Collection Assistant</h1>
        <p>Track your Baldur's Gate 3 item collection progress</p>
      </header>
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

