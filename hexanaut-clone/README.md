# Hexanaut

A browser-based territory capture game inspired by [Hexanaut.io](https://hexanaut.io).

Expand your zone on a hexagonal grid by leaving your territory, drawing a trail, and looping back to capture everything inside. Don't cross your own trail!

## How to Play

1. Open `index.html` in a browser, or run a local server:
   ```bash
   npx serve .
   ```
2. Enter your name and click **Play**
3. Move with **WASD** / **Arrow keys**, or steer with the **mouse**
4. Leave your colored zone to draw a trail
5. Return to your territory to capture enclosed hexes
6. Capture the entire map to win

## Controls

| Input | Action |
|-------|--------|
| W / ↑ | Move up-left |
| D / → | Move right |
| S / ↓ | Move down-right |
| A / ← | Move left |
| Mouse | Steer toward cursor |

Your name is saved in the browser for next time.

## Tech

- Vanilla HTML5 Canvas + ES modules
- No build step or dependencies required
