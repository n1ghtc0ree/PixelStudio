# Pixel Studio

Pixel Studio is a lightweight, modern web-based pixel art editor built on HTML5 Canvas and powered by jQuery.

The application features a fully responsive interface designed for both desktop computers and mobile devices with touch screens. It serves as an excellent demonstration project for MakerTime or as a practical assignment for web development courses.

## Production URL

The application is deployed and publicly accessible at:
https://p1xelstudio.netlify.app/

## Key Features

- **Tool Suite:** Includes essential drawing tools: Pencil, Eraser, Bucket Fill, and Color Picker.
- **Layer Management System:** Supports creating, switching, duplicating, deleting, and toggling the visibility of layers to handle complex artwork structures.
- **Custom Palette:** Features an integrated color picker alongside a compact palette grid that automatically adjusts for mobile screens.
- **Dynamic Canvas Resizing:** Allows on-the-fly grid resizing from 4x4 up to 128x128 pixels.
- **Canvas Background Control:** Supports switching the workspace background between a classic pixel-art checkerboard, solid black, or solid white.
- **History States:** Offers a comprehensive undo/redo history buffer tracking up to 50 structural or pixel modifications.
- **Asset Export:** Enables downloading the final artwork as a .png file with transparency preserved.
- **Advanced Mobile & Touch Optimization:** On smaller viewports, sidebars transition to a full-screen overlays, while canvas interactions utilize pointer events for zero touch-delay and smooth multi-touch dragging.

## Tech Stack

1. **Structure & Semantics:** HTML5 Canvas element API for pixel matrix manipulation.
2. **Style Engine:** CSS3 layout grids, flexbox modules, and adaptive media queries, featuring CSS variables and a native dark theme.
3. **Logic Core:** jQuery (v3.7.1) for lightweight DOM manipulation, as well as robust mouse and pointer/touch event handling.
4. **Embedded SVG:** All UI icons and the favicon are embedded directly into the codebase to minimize HTTP requests and eliminate asset loading delays.

## Getting Started

The application is completely self-contained and runs locally in the browser environment.

1. Ensure the following three core files reside within the same directory:
   - `main.html`
   - `css.css`
   - `js.js`
2. Open the `main.html` file in any modern web browser to launch Pixel Studio.

## Keyboard Shortcuts (Desktop)

- `P` — Pencil Tool
- `E` — Eraser Tool
- `G` — Bucket Fill Tool
- `I` — Color Picker
- `Ctrl + Z` — Undo
- `Ctrl + Y` — Redo

## Configuration and Customization

- **Default Canvas Dimensions:** Configured via the `const editor` initialization object (`width: 64`, `height: 64`) located at the top of the `js.js` file. These values must match the corresponding `value` attributes within the input fields of `main.html`.
- **UI Custom Themes:** Interface colors are centralized within the `:root` pseudo-class block at the beginning of the `css.css` file. The primary branding accent can be modified by altering the `--primary` variable value.