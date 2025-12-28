# BG3 Item Collection Assistant

A web application to help you track your Baldur's Gate 3 item collection progress. Add items you want to collect, see where to find them, and mark them as collected as you progress through the game.

## Features

- 🔍 **Smart Search**: Automatically fetch item information from the BG3 Wiki as you type
- ✅ Add items with their locations (auto-filled from wiki)
- 📋 View all items in a checklist format
- ✅ Mark items as collected
- 📊 Track progress with a visual progress bar
- 🏷️ Display item rarity and descriptions from the wiki
- 💾 Automatic local storage persistence
- 🎨 Modern, dark-themed UI

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

### Building for Production

Build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

Preview the production build:

```bash
npm run preview
```

## Usage

1. **Add Items**: 
   - Start typing an item name in the search field
   - The app will automatically search the BG3 Wiki and show matching items
   - Select an item from the dropdown to auto-fill its location and details
   - Or click "enter manually" to add items not found in the wiki
   - The location field will be automatically filled from the wiki data

2. **Track Progress**: View all your items in the checklist. Each item shows its name, location, and rarity (if available from the wiki).

3. **Mark as Collected**: Check the checkbox next to an item when you've collected it. Collected items will be visually marked and crossed out.

4. **Remove Items**: Click the × button to remove an item from your list.

5. **Progress Tracking**: The progress bar at the top shows how many items you've collected out of the total.

All your data is automatically saved to your browser's local storage, so your checklist will persist between sessions.

## Technologies Used

- React 18
- TypeScript
- Vite
- CSS3
- BG3 Wiki Cargo API

## Data Source

This application uses the [BG3 Wiki](https://bg3.wiki) standard MediaWiki API to fetch item information. The app:
- Searches wiki pages using the public search API (no authentication required)
- Extracts item data from page content including:
  - Item names and descriptions
- Drop locations (`where_to_find`)
  - Item rarity
  - UUIDs

The app searches across all relevant wiki pages and extracts structured data from the page content. This approach works without requiring special permissions or authentication.

## License

MIT

