# BG3 Item Collection Assistant

A web application to help you track your Baldur's Gate 3 item collection progress. Add items you want to collect, see where to find them, and mark them as collected as you progress through the game.

## Features

- ✅ Add items with their locations
- 📋 View all items in a checklist format
- ✅ Mark items as collected
- 📊 Track progress with a visual progress bar
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

1. **Add Items**: Use the "Add New Item" form to add items you want to collect. Enter the item name and its location in the game.

2. **Track Progress**: View all your items in the checklist. Each item shows its name and location.

3. **Mark as Collected**: Check the checkbox next to an item when you've collected it. Collected items will be visually marked and crossed out.

4. **Remove Items**: Click the × button to remove an item from your list.

5. **Progress Tracking**: The progress bar at the top shows how many items you've collected out of the total.

All your data is automatically saved to your browser's local storage, so your checklist will persist between sessions.

## Technologies Used

- React 18
- TypeScript
- Vite
- CSS3

## License

MIT

