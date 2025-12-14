/**
 * ============================================================================
 * DUKE NUKEM 1 MAP VIEWER - MAIN APPLICATION CONTROLLER
 * ============================================================================
 * 
 * This is the primary orchestration file that coordinates all components
 * of the Duke Nukem 1 asset viewer application. It handles:
 * 
 * - User interactions (clicks, mouse movement, zoom, pan)
 * - File loading and processing
 * - Rendering coordination between canvas and data views
 * - UI state management and updates
 * - Dynamic content switching between different file types
 * 
 * Architecture:
 * - Imports modular managers for specific tasks (files, levels, rendering, etc.)
 * - Maintains global application state (viewport, current level, settings)
 * - Uses event-driven interaction pattern for UI controls
 * - Employs requestAnimationFrame for efficient rendering
 */

/* ========================================================================== */
/* MODULE IMPORTS                                                             */
/* ========================================================================== */
/**
 * Import all required manager classes and utilities.
 * Each module handles a specific domain of functionality.
 */

import { FileManager } from './file_manager.js';      // File scanning and categorization
import { EGA } from './ega.js';                      // EGA graphics decoding
import { AssetManager } from './assets.js';          // Tile and sprite loading
import { LevelManager } from './level.js';           // Level file parsing
import { Renderer } from './renderer.js';            // Canvas drawing operations
import { SPRITE_MAP } from './sprites.js';           // Sprite definitions database
import { DataViewer } from './data_viewer.js';       // High scores and keyboard data viewer
import { AudioPlayer } from './audio_player.js';     // PC Speaker sound player
import { LevelStats } from './level_stats.js';       // Level statistics panel

/* ========================================================================== */
/* DOM ELEMENT REFERENCES                                                     */
/* ========================================================================== */
/**
 * Cache references to frequently accessed DOM elements.
 * This improves performance by avoiding repeated DOM queries.
 */

const logBox = document.getElementById('app-log');           // System log container
const assetBox = document.getElementById('asset-list');      // File list container
const previewCanvas = document.getElementById('preview-canvas'); // Main rendering canvas
const folderInput = document.getElementById('folder-input'); // Hidden file input
const mainContent = document.querySelector('.main-content'); // Canvas parent container

/* ========================================================================== */
/* DYNAMIC UI INJECTION                                                       */
/* ========================================================================== */
/**
 * Create and inject UI elements that are too complex to define in HTML.
 * These panels are built dynamically to allow for programmatic control.
 */

/* -------------------------------------------------------------------------- */
/* Main Control Panel                                                         */
/* -------------------------------------------------------------------------- */
/**
 * Control panel for layer visibility and sprite display modes.
 * 
 * Structure:
 * - Collapsible header for show/hide functionality
 * - Layer visibility checkboxes (Bonuses, Enemies, Hazards, etc.)
 * - Sprite display mode radio buttons (Icon, Shrink, Full)
 * - DROP backdrop view mode options (Sheet vs Assembled)
 * 
 * The panel is initially hidden and shown only when viewing map levels.
 */

const controlPanel = document.createElement('div');
controlPanel.className = "sidebar-section";
controlPanel.style.display = "none"; // Hidden by default
controlPanel.style.flex = "0 0 auto"; // Don't grow/shrink
controlPanel.innerHTML = `
    <div class="collapsible-header" style="margin-bottom: 8px;">
        <span class="collapse-arrow"></span>
        <h3>Controls</h3>
    </div>
    
    <div class="control-box">
        <!-- Layer Visibility Controls -->
        <div id="ctrl-layers" class="control-group">
            <div class="control-group-label">Visibility Layers</div>
            <div class="checkbox-grid">
                <label><input type="checkbox" id="layer-bonuses" checked> Bonuses</label>
                <label><input type="checkbox" id="layer-enemies" checked> Enemies</label>
                <label><input type="checkbox" id="layer-hazards" checked> Hazards</label>
                <label><input type="checkbox" id="layer-interactive" checked> Tech</label>
                <label><input type="checkbox" id="layer-decorative" checked> Deco</label>
            </div>
        </div>

        <!-- Sprite Display Mode Controls -->
        <div id="ctrl-sprites" class="control-group">
            <div class="control-group-label">Sprite Display Mode</div>
            <div style="display:flex; gap:10px; font-size:0.85rem; color:#eee;">
                <label><input type="radio" name="sprite-mode" value="icon" checked> Icon</label>
                <label><input type="radio" name="sprite-mode" value="shrink"> Shrink</label>
                <label><input type="radio" name="sprite-mode" value="full"> Full</label>
            </div>
        </div>

        <!-- DROP Backdrop View Mode (hidden by default, shown only for DROP files) -->
        <div id="ctrl-drop" class="control-group" style="display:none;">
            <div class="control-group-label">Backdrop View</div>
            <div style="display:flex; gap:10px; font-size:0.85rem; color:#eee;">
                <label><input type="radio" name="drop-mode" value="sheet" checked> Sheet</label>
                <label><input type="radio" name="drop-mode" value="assembled"> Game</label>
            </div>
        </div>
    </div>
`;

/**
 * Insert control panel into sidebar after the Assets section.
 * This maintains visual hierarchy: Assets -> Controls -> Log
 */
if (assetBox) {
    const assetsSection = assetBox.parentNode;
    if (assetsSection.parentNode) {
        assetsSection.parentNode.insertBefore(controlPanel, assetsSection.nextElementSibling);
    }
}

/* -------------------------------------------------------------------------- */
/* Zoom Controls Panel                                                        */
/* -------------------------------------------------------------------------- */
/**
 * Floating panel for zoom level control and display options.
 * 
 * Features:
 * - Fit button: Auto-zoom to fit entire level
 * - 1x, 2x, 4x: Fixed zoom presets
 * - Black BG: Toggle solid black background (removes grid pattern)
 * - Grid Fix: Toggle pixel-perfect grid alignment fix
 * 
 * Positioned absolutely in top-right of main content area.
 */

const zoomPanel = document.createElement('div');
zoomPanel.className = 'zoom-controls';
zoomPanel.style.display = 'none'; // Hidden by default
zoomPanel.innerHTML = `
    <button class="zoom-btn" id="zoom-reset">Fit</button>
    <button class="zoom-btn" id="zoom-1x">1x</button>
    <button class="zoom-btn" id="zoom-2x">2x</button>
    <button class="zoom-btn" id="zoom-4x">4x</button>
    <label><input type="checkbox" id="viz-bg-solid"> Black BG</label>
    <label><input type="checkbox" id="viz-grid-fix"> Grid Fix</label>
`;
mainContent.appendChild(zoomPanel);

/* ========================================================================== */
/* CORE MANAGERS                                                              */
/* ========================================================================== */
/**
 * Instantiate all manager classes that handle specific application domains.
 * These managers encapsulate complex logic and expose clean interfaces.
 */

const fileManager = new FileManager((msg) => console.log(msg));  // File system operations
const assetManager = new AssetManager();                         // Graphics loading/caching
const levelManager = new LevelManager();                         // Level file parsing
const renderer = new Renderer(previewCanvas);                    // Canvas rendering
const dataViewer = new DataViewer('data-view-container');        // Data file viewer
const audioPlayer = new AudioPlayer('data-view-container');      // Sound player
const levelStats = new LevelStats('level-stats');                // Statistics overlay

/* ========================================================================== */
/* APPLICATION STATE                                                          */
/* ========================================================================== */
/**
 * Global state variables tracking the current application state.
 * These variables are referenced throughout the codebase and modified
 * by event handlers and file loading logic.
 */

/* -------------------------------------------------------------------------- */
/* File and Asset State                                                       */
/* -------------------------------------------------------------------------- */

let cachedFiles = [];              // All files from folder selection
let currentLevel = null;           // Currently loaded level/graphic object
let currentMasterTileset = [];     // Array of tile canvases for current view
let currentSpriteRegistry = {};    // Map of sprite ID -> sprite data
let currentEpisodeExt = "";        // Episode extension (.DN1, .DN2, or .DN3)
let selectedFilename = null;       // Name of currently selected file
let currentFile = null;            // File object for reloading after palette change

/* -------------------------------------------------------------------------- */
/* Rendering State                                                            */
/* -------------------------------------------------------------------------- */

let animationFrameId = null;       // ID for canceling pending renders

/**
 * Viewport state for panning and zooming.
 * - x, y: Center point coordinates in world space
 * - zoom: Scale factor (1 = native size)
 * - width, height: Canvas dimensions in screen pixels
 */
let viewport = {
    x: 0,
    y: 0,
    zoom: 1,
    width: 800,
    height: 600
};

/* -------------------------------------------------------------------------- */
/* Mouse Interaction State                                                    */
/* -------------------------------------------------------------------------- */

let isPanning = false;             // True while dragging to pan
let lastMouseX = 0;                // Previous mouse X for delta calculation
let lastMouseY = 0;                // Previous mouse Y for delta calculation

/* -------------------------------------------------------------------------- */
/* User Settings                                                              */
/* -------------------------------------------------------------------------- */

let isDebugMode = false;           // Enable debug overlays (unused in current build)
let useSolidBG = false;            // Use solid black background vs grid pattern
let spriteMode = 'icon';           // Sprite display: 'icon', 'shrink', or 'full'
let dropViewMode = 'sheet';        // DROP file view: 'sheet' or 'assembled'

/**
 * Layer visibility configuration for map rendering.
 * Each boolean controls whether a specific sprite type is displayed.
 */
let layerConfig = {
    showBonuses: true,              // Health, score items, power-ups
    showEnemies: true,              // All enemy sprites
    showHazards: true,              // Spikes, fire, electric barriers
    showInteractive: true,          // Switches, doors, terminals
    showDecorative: true            // Non-interactive visual elements
};

/**
 * Episode filter settings for asset list.
 * Controls which episode files are visible in the sidebar.
 */
let episodeFilters = {
    DN1: true,                      // Episode 1 (Shrapnel City)
    DN2: true,                      // Episode 2 (Mission: Moonbase)
    DN3: true                       // Episode 3 (Trapped in the Future)
};

/**
 * Grid fix setting for pixel-perfect rendering.
 * When enabled, adjusts sprite positioning to prevent sub-pixel gaps.
 */
let useGridFix = false;

/* ========================================================================== */
/* CONSTANTS                                                                  */
/* ========================================================================== */
/**
 * Application-wide constant values.
 * These define file categorization and asset mappings.
 */

/**
 * Valid file category prefixes for Duke Nukem 1.
 * Used for file scanning and categorization.
 * 
 * Categories include:
 * - WORLDAL: Level files
 * - ANIM: Animated sprite sheets
 * - BACK/SOLID: Background and solid tile sets
 * - BADGUY: Enemy showcase image
 * - And many others...
 */
const CATEGORIES = [
    "WORLDAL", "ANIM", "BACK", "BADGUY", "BORDER", "CREDITS", "DN", "DROP",
    "DUKE", "END", "FONT", "HIGHS", "KEYS", "MAN", "MY_DEMO", "NUMBERS",
    "OBJECT", "SAVED", "SOLID", "SPEED", "USERDEMO"
];

/**
 * Crate artwork mapping for composite crate sprites.
 * 
 * Crates are built from two parts:
 * - Base: The crate box itself (different colors)
 * - Content: The item inside the crate
 * 
 * This object defines which file and tile index to use for each crate color.
 */
const CRATE_ART = {
    grey: { file: "OBJECT0", index: 0 },  // Standard grey crate
    blue: { file: "OBJECT2", index: 0 },  // Blue weapon crate
    red: { file: "OBJECT2", index: 1 }    // Red explosive crate
};

/* ========================================================================== */
/* UI HELPER FUNCTIONS                                                        */
/* ========================================================================== */
/**
 * Utility functions for updating UI elements.
 * These provide consistent interfaces for logging and status updates.
 */

/**
 * Logs a message to the application log panel in the sidebar.
 * 
 * Messages are color-coded by type and automatically scrolled into view.
 * Each entry is prepended with "> " for visual consistency.
 * 
 * @param {string} message - The message text to display
 * @param {string} type - Log type: "info", "error", "warning", or "success"
 */
function uiLog(message, type = "info") {
    if (!logBox) return;
    
    const div = document.createElement('div');
    div.textContent = `> ${message}`;
    div.className = `log-entry log-${type}`;
    logBox.appendChild(div);
    
    // Auto-scroll to show newest message
    logBox.scrollTop = logBox.scrollHeight;
}

/**
 * Updates the header status display with dynamic content.
 * 
 * This area shows context-sensitive information such as:
 * - Map name and tile/sprite counts when viewing levels
 * - File names when viewing graphics or data
 * - "Waiting for Data..." when idle
 * 
 * @param {string} text - HTML text to display (can include formatting tags)
 */
function updateHeaderStatus(text) {
    const headerDisplay = document.getElementById('tile-count-display');
    if (headerDisplay) headerDisplay.innerHTML = text;
}

/* ========================================================================== */
/* RENDERING FUNCTIONS                                                        */
/* ========================================================================== */
/**
 * Functions that manage canvas rendering and viewport updates.
 * Uses requestAnimationFrame for efficient, synchronized rendering.
 */

/**
 * Requests a render on the next animation frame.
 * 
 * This function implements render throttling by:
 * 1. Canceling any pending render request
 * 2. Scheduling a new render for the next frame
 * 
 * This ensures we never render more than once per frame, even if
 * multiple events trigger render requests in quick succession.
 * 
 * The actual drawing is delegated to the Renderer class with
 * all current state passed as parameters.
 */
function requestRender() {
    // Cancel any pending render to prevent duplicate work
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    // Schedule render for next animation frame
    animationFrameId = requestAnimationFrame(() => {
        if (!currentLevel) return;
        
        renderer.draw(
            currentLevel,
            currentMasterTileset,
            currentSpriteRegistry,
            layerConfig,
            viewport,
            isDebugMode,
            spriteMode,
            useSolidBG,
            useGridFix
        );
    });
}

/**
 * Resizes the canvas to match the viewport dimensions.
 * 
 * Called on:
 * - Window resize events
 * - Initial application load
 * 
 * Updates both the canvas element size and the viewport state,
 * then disables image smoothing for pixel-perfect rendering.
 */
function resizeCanvas() {
    viewport.width = mainContent.clientWidth;
    viewport.height = mainContent.clientHeight;
    previewCanvas.width = viewport.width;
    previewCanvas.height = viewport.height;
    
    // Disable anti-aliasing for crisp pixel art
    const ctx = previewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    requestRender();
}

/* ========================================================================== */
/* VIEWPORT CONTROL FUNCTIONS                                                 */
/* ========================================================================== */
/**
 * Functions for managing zoom and viewport positioning.
 */

/**
 * Calculates the optimal zoom level to fit the entire level in the viewport.
 * 
 * Considers:
 * - Different content types (levels, images, tilesets)
 * - Aspect ratio of both content and viewport
 * - Padding around the content
 * 
 * @returns {number} Optimal zoom level (fit-to-screen)
 */
function getFitZoom() {
    if (!currentLevel) return 1;
    
    let w, h;
    
    // Calculate content dimensions based on type
    if (currentLevel.type === 'image') {
        // Images have pixel dimensions directly
        w = currentLevel.width;
        h = currentLevel.height;
    } else {
        // Tile-based content (levels and sheets)
        // Convert tile dimensions to pixels and add padding
        w = currentLevel.width * 16 + 32;
        h = currentLevel.height * 16 + 32;
    }
    
    // Avoid division by zero
    if (w === 0 || h === 0) return 1;
    
    // Return the limiting zoom factor (maintain aspect ratio)
    return Math.min(viewport.width / w, viewport.height / h);
}

/**
 * Sets the zoom level and centers the viewport on the content.
 * 
 * This function:
 * 1. Updates the zoom factor
 * 2. Calculates the center point of the content
 * 3. Positions the viewport to center on that point
 * 4. Triggers a re-render
 * 
 * @param {number} z - Target zoom level (1 = native size)
 */
function setZoom(z) {
    viewport.zoom = z;
    
    // Calculate center point based on content type
    if (currentLevel.type === 'image') {
        // Image dimensions are already in pixels
        viewport.x = currentLevel.width / 2;
        viewport.y = currentLevel.height / 2;
    } else {
        // Convert tile dimensions to pixels for viewport positioning
        viewport.x = (currentLevel.width * 16) / 2;
        viewport.y = (currentLevel.height * 16) / 2;
    }
    
    requestRender();
}

/* ========================================================================== */
/* DROP FILE HANDLING                                                         */
/* ========================================================================== */
/**
 * Special handling for DROP backdrop files.
 * 
 * DROP files contain background graphics that can be displayed in two modes:
 * - Sheet: 32-column tile grid (standard tileset view)
 * - Assembled: 13x10 layout as seen in-game
 */

/**
 * Rebuilds the level layout for DROP backdrop files.
 * 
 * This function reconfigures the grid based on the current view mode:
 * - In 'sheet' mode: Standard 32-column tileset grid
 * - In 'assembled' mode: Game-accurate 13x10 backdrop layout
 * 
 * After rebuilding, resets zoom to fit and triggers a render.
 */
function rebuildDropLevel() {
    if (dropViewMode === 'sheet') {
        // Display as a standard tile sheet
        const cols = 32;
        const rows = Math.ceil(currentMasterTileset.length / cols);
        
        currentLevel.width = cols;
        currentLevel.height = rows;
        currentLevel.grid = new Uint16Array(cols * rows);
        
        // Populate grid with sequential tile indices
        for (let i = 0; i < currentMasterTileset.length; i++) {
            currentLevel.grid[i] = i;
        }
    } else {
        // Display in game-accurate assembled layout
        // DROP backdrops are composed of 130 tiles in a 13x10 grid
        currentLevel.width = 13;
        currentLevel.height = 10;
        currentLevel.grid = new Uint16Array(130);
        
        // Populate grid with sequential tile indices
        for (let i = 0; i < 130; i++) {
            currentLevel.grid[i] = i;
        }
    }
    
    // Reset view to fit new layout
    setZoom(getFitZoom());
    requestRender();
}

/* ========================================================================== */
/* UTILITY FUNCTIONS                                                          */
/* ========================================================================== */
/**
 * General-purpose helper functions for data conversion and composition.
 */

/**
 * Converts ImageData to a Canvas element for faster rendering.
 * 
 * ImageData objects are used during decoding, but Canvas elements
 * are more efficient for repeated drawing operations. This function
 * creates a canvas and paints the image data onto it.
 * 
 * @param {ImageData} imageData - Source image data from EGA decoder
 * @returns {HTMLCanvasElement} Canvas containing the rendered image
 */
function imageDataToCanvas(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Composites multiple tiles into a single sprite canvas.
 * 
 * Many sprites in Duke Nukem 1 are composed of multiple tiles
 * arranged in a grid (e.g., 2x2 or 2x3 sprites). This function
 * assembles those tiles into a single composite image.
 * 
 * @param {Array<HTMLCanvasElement>} canvasTiles - Array of individual tile canvases
 * @param {Object} comp - Composition definition
 * @param {number} comp.width - Width in tiles
 * @param {number} comp.height - Height in tiles
 * @param {Array<number>} comp.indices - Tile indices to use, in left-to-right, top-to-bottom order
 * @returns {HTMLCanvasElement} Composite sprite canvas
 */
function compositeSprite(canvasTiles, comp) {
    const tileW = 16;  // Standard tile width
    const tileH = 16;  // Standard tile height
    
    // Create canvas sized to hold the full sprite
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = comp.width * tileW;
    spriteCanvas.height = comp.height * tileH;
    const ctx = spriteCanvas.getContext('2d');
    
    // Draw each tile in the composition
    for (let i = 0; i < comp.indices.length; i++) {
        const tileIndex = comp.indices[i];
        
        // Calculate position in sprite grid
        const x = (i % comp.width) * tileW;
        const y = Math.floor(i / comp.width) * tileH;
        
        // Draw tile if it exists
        if (canvasTiles[tileIndex]) {
            ctx.drawImage(canvasTiles[tileIndex], x, y);
        }
    }
    
    return spriteCanvas;
}

/* ========================================================================== */
/* SPRITE LOADING                                                             */
/* ========================================================================== */
/**
 * Sprite management functions.
 * Handles loading sprite source files and building the sprite registry.
 */

/**
 * Loads and processes all sprites for the current level.
 * 
 * This comprehensive function:
 * 1. Scans SPRITE_MAP to determine required source files
 * 2. Loads those files (ANIM, OBJECT, MAN, etc.)
 * 3. Builds the sprite registry with full-size and icon versions
 * 4. Handles special cases (crates, composite sprites, opacity fixes)
 * 5. Updates UI with sprite count
 * 
 * The sprite registry maps sprite IDs (e.g., 0x3000) to sprite data objects
 * containing the sprite name, type, and canvas elements for rendering.
 */
async function loadSprites() {
    currentSpriteRegistry = {};
    
    /* ---------------------------------------------------------------------- */
    /* Phase 1: Determine Required Files                                     */
    /* ---------------------------------------------------------------------- */
    
    const spriteFiles = {};          // Map of filename -> array of tile canvases
    const requiredFiles = new Set(); // Set of unique filenames needed
    
    // Scan sprite map to collect all referenced files
    for (const id in SPRITE_MAP) {
        const def = SPRITE_MAP[id];
        
        // Add primary sprite file
        if (def.file) {
            requiredFiles.add(def.file + currentEpisodeExt);
        }
        
        // Add crate content file (for crates with items inside)
        if (def.content?.file) {
            requiredFiles.add(def.content.file + currentEpisodeExt);
        }
    }
    
    /* ---------------------------------------------------------------------- */
    /* Phase 2: Load Source Files                                            */
    /* ---------------------------------------------------------------------- */
    
    for (const fileName of requiredFiles) {
        // Find file in graphics array
        const fileObj = fileManager.graphics.find(f => f.name.toUpperCase() === fileName);
        
        if (fileObj) {
            // Load and decode tileset
            const tiles = await assetManager.loadTileset(fileObj);
            
            // Convert ImageData to Canvas for faster rendering
            // Store without episode extension for easier lookup
            spriteFiles[fileName.replace(currentEpisodeExt, "")] = tiles.map(imageDataToCanvas);
        }
    }
    
    /* ---------------------------------------------------------------------- */
    /* Phase 3: Build Sprite Registry                                        */
    /* ---------------------------------------------------------------------- */
    
    let loadedCount = 0; // Track successful sprite loads
    
    for (const hexID in SPRITE_MAP) {
        const numID = parseInt(hexID, 16); // Convert hex string to number
        const def = SPRITE_MAP[hexID];
        
        // Skip mirror sprites - they're handled by the renderer based on ID
        // Mirrors don't need registry entries; they reference the base sprite
        
        /* ------------------------------------------------------------------ */
        /* Handle Crate Sprites (Composite Objects)                          */
        /* ------------------------------------------------------------------ */
        
        if (def.crate) {
            // Get base crate artwork (the box itself)
            const baseArt = CRATE_ART[def.crate];
            const baseFile = spriteFiles[baseArt.file];
            const baseTile = baseFile ? baseFile[baseArt.index] : null;
            
            // Get content artwork (item inside crate, if any)
            let contentTile = null;
            if (def.content) {
                const contentFile = spriteFiles[def.content.file];
                contentTile = contentFile ? contentFile[def.content.index] : null;
            }
            
            // Register crate with both base and content
            currentSpriteRegistry[numID] = {
                type: def.type,
                name: def.name,
                isCrate: true,
                base: baseTile,
                content: contentTile
            };
            
            loadedCount++;
        }
        
        /* ------------------------------------------------------------------ */
        /* Handle Standard Sprites                                            */
        /* ------------------------------------------------------------------ */
        
        else if (def.file) {
            const sourceFile = spriteFiles[def.file];
            
            if (sourceFile) {
                let iconSprite = null;  // Single tile for icon mode
                let fullSprite = null;  // Full composite for full mode
                
                // Icon is always the first tile from the sprite definition
                if (sourceFile[def.index]) {
                    iconSprite = sourceFile[def.index];
                }
                
                // Full sprite: composite multiple tiles if specified,
                // otherwise use the icon tile
                if (def.composition) {
                    fullSprite = compositeSprite(sourceFile, def.composition);
                } else {
                    fullSprite = iconSprite;
                }
                
                // Apply opacity override if specified
                // Some sprites incorrectly use color 0 as visible; fix alpha
                if (def.forceOpaque) {
                    const fixAlpha = (canvas) => {
                        if (!canvas) return;
                        
                        const ctx = canvas.getContext('2d');
                        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const pixels = imgData.data;
                        
                        // Set all alpha values to 255 (fully opaque)
                        for (let p = 3; p < pixels.length; p += 4) {
                            pixels[p] = 255;
                        }
                        
                        ctx.putImageData(imgData, 0, 0);
                    };
                    
                    fixAlpha(fullSprite);
                    fixAlpha(iconSprite);
                }
                
                // Register sprite if both icon and full versions exist
                if (iconSprite && fullSprite) {
                    currentSpriteRegistry[numID] = {
                        type: def.type,        // Category (enemy, bonus, hazard, etc.)
                        name: def.name,        // Display name
                        srcIcon: iconSprite,   // Source canvas for icon mode
                        srcFull: fullSprite,   // Source canvas for full mode
                        image: null,           // Active canvas (set by updateSpriteRegistryImages)
                        hTiles: def.composition ? def.composition.height : 1  // Height in tiles
                    };
                    
                    loadedCount++;
                }
            }
        }
    }
    
    /* ---------------------------------------------------------------------- */
    /* Phase 4: Update Active Sprite Images                                  */
    /* ---------------------------------------------------------------------- */
    
    // Set the active 'image' field based on current sprite mode
    updateSpriteRegistryImages();
    
    // Update UI with results
    uiLog(`Sprites Loaded: ${loadedCount}`, "success");
    updateHeaderStatus(`<strong>${currentLevel.name}</strong> | Tiles: ${currentMasterTileset.length} | Sprites: ${loadedCount}`);
    requestRender();
}

/**
 * Updates sprite images based on current sprite display mode.
 * 
 * Switches the active 'image' field in each sprite registry entry
 * between icon and full versions based on the current mode setting.
 * 
 * This allows instant mode switching without reloading sprites.
 */
function updateSpriteRegistryImages() {
    for (const id in currentSpriteRegistry) {
        const sprite = currentSpriteRegistry[id];
        
        // Skip crates (they handle rendering differently)
        if (sprite.isCrate) continue;
        
        // Set active image based on mode
        if (spriteMode === 'icon') {
            sprite.image = sprite.srcIcon;
        } else {
            sprite.image = sprite.srcFull;
        }
    }
}

/* ========================================================================== */
/* ASSET INSPECTION                                                           */
/* ========================================================================== */
/**
 * Main file inspection function.
 * 
 * This is the primary entry point for viewing any Duke Nukem 1 file.
 * It detects the file type and delegates to the appropriate handler.
 * 
 * Supported file types:
 * - WORLDAL*.DN*: Map levels
 * - DUKE1*.DN*: Sound banks
 * - KEYS*.DN*: Keyboard configuration
 * - HIGHS*.DN*: High scores
 * - BADGUY, CREDITS, DN, DUKE, END: Full-screen images
 * - Everything else: Graphics (tilesets/sprites)
 */

/**
 * Inspects and loads an asset file.
 * 
 * This function:
 * 1. Determines file type from filename
 * 2. Updates UI state (show/hide appropriate panels)
 * 3. Loads and processes file data
 * 4. Sets up rendering/viewing
 * 
 * @param {File} file - The file object to inspect
 */
async function inspectAsset(file) {
    // Store for palette reload functionality
    currentFile = file;
    
    const fileName = file.name.toUpperCase();
    
    /* ====================================================================== */
    /* CASE A: Level File (WORLDAL*.DN*)                                     */
    /* ====================================================================== */
    /**
     * Level files contain:
     * - Grid of tile IDs defining the map layout
     * - Sprite placement data
     * - Level metadata (name, dimensions)
     * 
     * Loading process:
     * 1. Parse level file structure
     * 2. Load required tileset files (BACK0-3, SOLID0-3)
     * 3. Apply tile patches (conveyor belts, breakable bricks)
     * 4. Load sprite definitions
     * 5. Set up viewport and controls
     */
    
    if (fileName.startsWith("WORLD")) {
        try {
            uiLog(`Loading ${file.name}...`, "info");
            updateHeaderStatus(`Loading ${file.name}...`);
            
            // Setup UI state
            previewCanvas.style.display = 'block';
            dataViewer.hide();
            audioPlayer.hide();
            
            /* -------------------------------------------------------------- */
            /* Load Level Data                                                */
            /* -------------------------------------------------------------- */
            
            currentLevel = await levelManager.loadLevel(file);
            currentEpisodeExt = fileName.match(/\.DN\d$/)[0];
            
            /* -------------------------------------------------------------- */
            /* Load Tilesets                                                  */
            /* -------------------------------------------------------------- */
            
            /**
             * Duke Nukem 1 uses 8 tileset files per episode:
             * - BACK0-3: Background tiles (non-solid)
             * - SOLID0-3: Solid tiles (platforms, walls)
             * 
             * Each file contains up to 48 tiles.
             * These are loaded into a master tileset array in specific slots.
             */
            
            const loadOrder = [
                `BACK0${currentEpisodeExt}`,
                `BACK1${currentEpisodeExt}`,
                `BACK2${currentEpisodeExt}`,
                `BACK3${currentEpisodeExt}`,
                `SOLID0${currentEpisodeExt}`,
                `SOLID1${currentEpisodeExt}`,
                `SOLID2${currentEpisodeExt}`,
                `SOLID3${currentEpisodeExt}`
            ];
            
            currentMasterTileset = [];
            const SLOT_SIZE = 48; // Each file reserves 48 tile slots
            
            for (const targetName of loadOrder) {
                const foundFile = fileManager.graphics.find(
                    f => f.name.toUpperCase() === targetName
                );
                
                if (foundFile) {
                    // Load and convert tiles
                    const tiles = await assetManager.loadTileset(foundFile);
                    const canvasTiles = tiles.map(imageDataToCanvas);
                    
                    if (canvasTiles.length > SLOT_SIZE) {
                        // Truncate if file has too many tiles
                        currentMasterTileset = currentMasterTileset.concat(
                            canvasTiles.slice(0, SLOT_SIZE)
                        );
                    } else {
                        // Add tiles and pad to slot size with nulls
                        currentMasterTileset = currentMasterTileset.concat(canvasTiles);
                        const padding = new Array(SLOT_SIZE - canvasTiles.length).fill(null);
                        currentMasterTileset = currentMasterTileset.concat(padding);
                    }
                } else {
                    // File missing - pad with nulls
                    uiLog(`Missing ${targetName}`, "warning");
                    currentMasterTileset = currentMasterTileset.concat(
                        new Array(SLOT_SIZE).fill(null)
                    );
                }
            }
            
            /* -------------------------------------------------------------- */
            /* Tile Patches: Context-Aware Corrections                        */
            /* -------------------------------------------------------------- */
            
            /**
             * Some levels have incorrect default tile assignments.
             * We fix these by detecting context (sprite markers) and
             * replacing tiles accordingly.
             * 
             * Example: Conveyor belts
             * - Conveyor zones are marked by sprite pairs (start/end markers)
             * - Within these zones, platform end tiles should be conveyor ends
             * - Outside these zones, conveyor ends should be platform ends
             */
            
            if (currentMasterTileset.length > 300 && currentLevel.grid) {
                const grid = currentLevel.grid;
                const width = currentLevel.width;
                const height = currentLevel.height;
                
                /* ---------------------------------------------------------- */
                /* Step 1: Identify Conveyor Zones                            */
                /* ---------------------------------------------------------- */
                
                /**
                 * Scan each row to find areas between conveyor sprite markers.
                 * 
                 * Left-moving conveyor: 0x3002 (start) -> 0x3003 (end)
                 * Right-moving conveyor: 0x3004 (start) -> 0x3005 (end)
                 */
                
                const isConveyorZone = new Uint8Array(grid.length); // 0=false, 1=true
                
                for (let y = 0; y < height; y++) {
                    let activeBelt = false;
                    const rowOffset = y * width;
                    
                    for (let x = 0; x < width; x++) {
                        const index = rowOffset + x;
                        const val = grid[index];
                        
                        // Start markers activate belt mode
                        if (val === 0x3002 || val === 0x3004) {
                            activeBelt = true;
                        }
                        
                        // Mark current tile if inside belt
                        if (activeBelt) {
                            isConveyorZone[index] = 1;
                        }
                        
                        // End markers deactivate belt mode
                        if (val === 0x3003 || val === 0x3005) {
                            activeBelt = false;
                        }
                    }
                }
                
                /* ---------------------------------------------------------- */
                /* Step 2: Apply Graphics Patches                             */
                /* ---------------------------------------------------------- */
                
                /**
                 * Replace tiles based on zone detection.
                 * 
                 * Tile IDs:
                 * - 203: Platform left end
                 * - 206: Platform right end
                 * - 224: Conveyor left end
                 * - 225: Conveyor right end
                 */
                
                for (let i = 0; i < grid.length; i++) {
                    const tileID = grid[i];
                    
                    if (isConveyorZone[i]) {
                        // Inside conveyor zone: use conveyor ends
                        if (tileID === 203) grid[i] = 224; // Left
                        if (tileID === 206) grid[i] = 225; // Right
                    } else {
                        // Outside conveyor zone: use platform ends
                        if (tileID === 224) grid[i] = 203; // Left
                        if (tileID === 225) grid[i] = 206; // Right
                    }
                }
            }
            
            /* -------------------------------------------------------------- */
            /* Pixel Patches: Color Corrections                               */
            /* -------------------------------------------------------------- */
            
            /**
             * Some tiles have incorrect color mappings.
             * We fix these by manipulating pixel data directly.
             * 
             * Example: Tile 192 (Breakable Brick)
             * - Uses black (0,0,0) for detailing
             * - Should use grey (#AAAAAA) for visibility
             */
            
            if (currentMasterTileset[192]) {
                const canvas = currentMasterTileset[192];
                const ctx = canvas.getContext('2d');
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                
                // Replace pure black with grey
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];
                    
                    if (r === 0 && g === 0 && b === 0 && a === 255) {
                        data[i] = 0xAA;
                        data[i + 1] = 0xAA;
                        data[i + 2] = 0xAA;
                    }
                }
                
                ctx.putImageData(imgData, 0, 0);
            }
            
            /* -------------------------------------------------------------- */
            /* Load Sprites and Setup UI                                      */
            /* -------------------------------------------------------------- */
            
            await loadSprites();
            
            // Show level-specific controls
            controlPanel.style.display = "block";
            document.getElementById('ctrl-layers').style.display = "block";
            document.getElementById('ctrl-sprites').style.display = "block";
            document.getElementById('ctrl-drop').style.display = "none";
            
            // Show zoom controls
            zoomPanel.style.display = "flex";
            
            // Set initial view
            setZoom(getFitZoom());
            requestRender();
            
            // Update statistics panel
            levelStats.update(currentLevel, currentSpriteRegistry);
            
            uiLog(`Rendered ${file.name}`, "success");
            
        } catch (err) {
            uiLog(`Error: ${err.message}`, "error");
            console.error(err);
        }
        return;
    }
    
    /* ====================================================================== */
    /* CASE B: Sound Files (DUKE1*.DN*)                                      */
    /* ====================================================================== */
    /**
     * Sound bank files contain PC Speaker sound effects.
     * 
     * Two versions exist:
     * - DUKE1: Normal sound effects
     * - DUKE1-B: Same sounds with different encoding
     */
    
    if (fileName.startsWith("DUKE1")) {
        try {
            uiLog(`Loading Sound Bank: ${file.name}`, "info");
            updateHeaderStatus(`Sound Board: ${file.name}`);
            
            // Setup UI: hide canvas, show data container
            previewCanvas.style.display = 'none';
            levelStats.hide();
            dataViewer.hide();
            document.getElementById('data-view-container').style.display = 'block';
            
            // Hide graphics controls
            controlPanel.style.display = 'none';
            zoomPanel.style.display = 'none';
            
            // Render sound player interface
            await audioPlayer.render(file);
            
        } catch (err) {
            uiLog(`Audio Error: ${err.message}`, "error");
        }
        return;
    }
    
    /* ====================================================================== */
    /* CASE C: Data Files (KEYS*.DN*, HIGHS*.DN*)                            */
    /* ====================================================================== */
    /**
     * Data files contain structured binary data:
     * - KEYS: Keyboard configuration settings
     * - HIGHS: High score tables
     * 
     * These are displayed as formatted tables.
     */
    
    if (fileName.startsWith("KEYS") || fileName.startsWith("HIGHS")) {
        try {
            uiLog(`Reading Data: ${file.name}`, "info");
            updateHeaderStatus(`Viewing Data: ${file.name}`);
            
            // Setup UI: hide canvas, show data viewer
            previewCanvas.style.display = 'none';
            levelStats.hide();
            audioPlayer.hide();
            
            // Hide graphics controls
            controlPanel.style.display = 'none';
            zoomPanel.style.display = 'none';
            
            // Render data table
            await dataViewer.render(file);
            
        } catch (err) {
            uiLog(err.message, "error");
        }
        return;
    }
    
    /* ====================================================================== */
    /* CASE D: Full-Screen Images (BADGUY, CREDITS, DN, DUKE, END)           */
    /* ====================================================================== */
    /**
     * Full-screen artwork files contain 320x200 EGA images.
     * 
     * These include:
     * - BADGUY: Enemy showcase screen
     * - CREDITS: Credits screen
     * - DN: Duke Nukem title logo
     * - DUKE: Duke Nukem portrait
     * - END: Episode ending screens
     */
    
    const fullScreenFiles = ["BADGUY", "CREDITS", "DN", "DUKE", "END"];
    
    if (fullScreenFiles.some(prefix => fileName.startsWith(prefix))) {
        try {
            uiLog(`View Image: ${file.name}`, "info");
            updateHeaderStatus(`Viewing Image: ${file.name}`);
            
            // Setup UI: show canvas, hide other viewers
            previewCanvas.style.display = 'block';
            dataViewer.hide();
            audioPlayer.hide();
            levelStats.hide();
            
            // Hide sprite controls, keep zoom
            controlPanel.style.display = 'none';
            zoomPanel.style.display = 'flex';
            
            /* -------------------------------------------------------------- */
            /* Load and Decode Image                                          */
            /* -------------------------------------------------------------- */
            
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            const imageData = EGA.decodePlanarScreen(data);
            const imageCanvas = imageDataToCanvas(imageData);
            
            /* -------------------------------------------------------------- */
            /* Create Level Object for Image                                  */
            /* -------------------------------------------------------------- */
            
            /**
             * We wrap the image in a "level" object to reuse the standard
             * rendering and interaction code. This allows panning and zooming
             * to work identically for images and maps.
             */
            
            currentLevel = {
                type: 'image',
                name: file.name,
                image: imageCanvas,
                width: imageCanvas.width,
                height: imageCanvas.height
            };
            
            // Reset view to fit
            setZoom(getFitZoom());
            requestRender();
            
        } catch (err) {
            uiLog(`Image Error: ${err.message}`, "error");
        }
        return;
    }
    
    /* ====================================================================== */
    /* CASE E: Graphics Files (Default - Tilesets/Sprite Sheets)             */
    /* ====================================================================== */
    /**
     * Any file not matching the above categories is treated as graphics.
     * 
     * This includes:
     * - BACK*: Background tiles
     * - SOLID*: Solid tiles
     * - ANIM*: Animated sprites
     * - OBJECT*: Object sprites
     * - DROP*: Backdrop graphics (special handling)
     * - And others...
     * 
     * Graphics are displayed as tile sheets (grids of individual tiles).
     */
    
    try {
        uiLog(`View ${file.name}`, "info");
        updateHeaderStatus(`Viewing ${file.name}`);
        
        // Setup UI: show canvas, hide other viewers
        previewCanvas.style.display = 'block';
        dataViewer.hide();
        audioPlayer.hide();
        levelStats.hide();
        
        /* ------------------------------------------------------------------ */
        /* Load Tileset                                                       */
        /* ------------------------------------------------------------------ */
        
        const tiles = await assetManager.loadTileset(file);
        
        // Store globally
        currentMasterTileset = tiles.map(imageDataToCanvas);
        currentSpriteRegistry = {};
        
        /* ------------------------------------------------------------------ */
        /* Special Handling for DROP Files                                    */
        /* ------------------------------------------------------------------ */
        
        const isDrop = fileName.startsWith('DROP');
        
        // Configure UI based on file type
        controlPanel.style.display = isDrop ? "block" : "none";
        zoomPanel.style.display = "flex";
        
        if (isDrop) {
            // Show DROP-specific controls, hide standard sprite controls
            document.getElementById('ctrl-layers').style.display = "none";
            document.getElementById('ctrl-sprites').style.display = "none";
            document.getElementById('ctrl-drop').style.display = "block";
        }
        
        /* ------------------------------------------------------------------ */
        /* Create Level Object for Tile Sheet                                 */
        /* ------------------------------------------------------------------ */
        
        currentLevel = { type: 'sheet', name: file.name };
        
        if (isDrop) {
            // Use DROP-specific layout (13x10 or 32-column sheet)
            rebuildDropLevel();
        } else {
            // Standard tile sheet layout (32 columns)
            const cols = 32;
            const rows = Math.ceil(tiles.length / cols);
            
            currentLevel.width = cols;
            currentLevel.height = rows;
            currentLevel.grid = new Uint16Array(cols * rows);
            
            // Populate grid with sequential tile indices
            for (let i = 0; i < tiles.length; i++) {
                currentLevel.grid[i] = i;
            }
            
            setZoom(getFitZoom());
            requestRender();
        }
        
    } catch (err) {
        uiLog(err.message, "error");
    }
}

/* ========================================================================== */
/* FILE SYSTEM HANDLERS                                                       */
/* ========================================================================== */
/**
 * Event handlers for file selection and asset list generation.
 */

/**
 * Handles folder selection and file scanning.
 * 
 * When the user selects a folder:
 * 1. Files are scanned and categorized by the FileManager
 * 2. Asset list is populated with collapsible groups
 * 3. Episode filters are applied
 * 4. Special sub-grouping for "Tiles and Sprites" category
 */
folderInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    /* ---------------------------------------------------------------------- */
    /* Update File Selection Status                                           */
    /* ---------------------------------------------------------------------- */
    
    const statusSpan = document.getElementById('file-input-status');
    if (files.length > 0) {
        statusSpan.textContent = `${files.length} files loaded`;
        statusSpan.style.color = "var(--text-main)";
    } else {
        statusSpan.textContent = "No folder selected";
    }
    
    cachedFiles = files;
    
    /* ---------------------------------------------------------------------- */
    /* Scan and Categorize Files                                              */
    /* ---------------------------------------------------------------------- */
    
    await fileManager.handleFiles(files);
    
    // Clear existing asset list
    assetBox.innerHTML = '';
    
    /* ---------------------------------------------------------------------- */
    /* Get Current Filter States                                              */
    /* ---------------------------------------------------------------------- */
    
    const showDN1 = document.getElementById('filter-dn1').checked;
    const showDN2 = document.getElementById('filter-dn2').checked;
    const showDN3 = document.getElementById('filter-dn3').checked;
    
    /* ---------------------------------------------------------------------- */
    /* Define Category Buckets                                                */
    /* ---------------------------------------------------------------------- */
    
    /**
     * Files are grouped into these categories for display.
     * Order determines display order in the sidebar.
     */
    
    const definedCategories = [
        "Levels",             // WORLDAL*.DN*
        "Tiles and Sprites",  // ANIM, BACK, DROP, FONT, MAN, NUMBERS, OBJECT, SOLID
        "Text",               // HIGHS, KEYS
        "Fullscreen Artwork", // BADGUY, CREDITS, DN, DUKE, END
        "Sounds"              // DUKE1, DUKE1-B
    ];
    
    const grouped = {};
    definedCategories.forEach(c => grouped[c] = []);
    
    /* ---------------------------------------------------------------------- */
    /* Episode Filter Helper                                                  */
    /* ---------------------------------------------------------------------- */
    
    /**
     * Checks if a file should be visible based on episode filters.
     * 
     * Files with .DN1, .DN2, or .DN3 extensions are filtered
     * according to the checkbox states.
     * 
     * @param {File} file - File to check
     * @returns {boolean} True if file should be visible
     */
    const isVisible = (file) => {
        const name = file.name.toUpperCase();
        const ext = name.match(/\.DN\d$/)?.[0];
        
        if (ext === '.DN1' && !showDN1) return false;
        if (ext === '.DN2' && !showDN2) return false;
        if (ext === '.DN3' && !showDN3) return false;
        
        return true;
    };
    
    /* ---------------------------------------------------------------------- */
    /* Group Files by Category                                                */
    /* ---------------------------------------------------------------------- */
    
    // 1. Group Levels (WORLDAL files)
    for (const file of fileManager.levels) {
        if (isVisible(file)) grouped["Levels"].push(file);
    }
    
    // 2. Group Text/Data (KEYS, HIGHS files)
    for (const file of fileManager.data) {
        if (isVisible(file)) grouped["Text"].push(file);
    }
    
    // 3. Group Graphics and Sounds (everything else)
    for (const file of fileManager.graphics) {
        if (!isVisible(file)) continue;
        
        const name = file.name.toUpperCase();
        
        /**
         * CRITICAL: Check "DUKE1" before "DUKE"
         * 
         * DUKE1 files are sounds, but they start with "DUKE".
         * If we check for "DUKE" first, sound files will be
         * incorrectly categorized as fullscreen artwork.
         */
        
        // A. Sounds (DUKE1 and DUKE1-B)
        if (name.startsWith("DUKE1")) {
            grouped["Sounds"].push(file);
            continue;
        }
        
        // B. Fullscreen Artwork
        const fullScreenPrefixes = ["BADGUY", "CREDITS", "DN", "DUKE", "END"];
        if (fullScreenPrefixes.some(p => name.startsWith(p))) {
            grouped["Fullscreen Artwork"].push(file);
            continue;
        }
        
        // C. Tiles and Sprites (catch-all)
        // Includes: ANIM, BACK, DROP, FONT, MAN, NUMBERS, OBJECT, SOLID, BORDER
        grouped["Tiles and Sprites"].push(file);
    }
    
    /* ---------------------------------------------------------------------- */
    /* Render Groups                                                          */
    /* ---------------------------------------------------------------------- */
    
    /**
     * Helper function to create a clickable file link.
     * 
     * When clicked:
     * - Removes 'active' class from all other links
     * - Adds 'active' class to clicked link
     * - Calls inspectAsset to load the file
     * 
     * @param {File} file - File to create link for
     * @returns {HTMLElement} Configured link element
     */
    const createFileLink = (file) => {
        const link = document.createElement('a');
        link.className = 'file-link';
        link.textContent = file.name;
        link.href = '#';
        link.dataset.filename = file.name;
        
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Update active state
            document.querySelectorAll('.file-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            selectedFilename = file.name;
            
            // Load file
            await inspectAsset(file);
        });
        
        return link;
    };
    
    /* ---------------------------------------------------------------------- */
    /* Render Each Category                                                   */
    /* ---------------------------------------------------------------------- */
    
    for (const category of definedCategories) {
        const files = grouped[category];
        if (files.length === 0) continue; // Skip empty categories
        
        // Create collapsible details element
        const details = document.createElement('details');
        
        // Auto-expand Levels category
        if (category === "Levels") details.open = true;
        
        // Create summary header
        const summary = document.createElement('summary');
        summary.textContent = `${category} (${files.length})`;
        details.appendChild(summary);
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'group-content';
        
        // Sort files naturally (handles numeric suffixes correctly)
        const sortedFiles = files.sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        
        /* ------------------------------------------------------------------ */
        /* Special Handling: Sub-Grouping for Tiles and Sprites              */
        /* ------------------------------------------------------------------ */
        
        /**
         * The "Tiles and Sprites" category contains many files.
         * We sub-group them by prefix for better organization.
         * 
         * For example:
         * - ANIM (4 files)
         * - BACK (4 files)
         * - SOLID (4 files)
         * etc.
         */
        
        if (category === "Tiles and Sprites") {
            const subGroups = {};
            
            // Group files by alphabetic prefix
            for (const file of sortedFiles) {
                const match = file.name.toUpperCase().match(/^([A-Z]+)/);
                const prefix = match ? match[1] : "MISC";
                
                if (!subGroups[prefix]) subGroups[prefix] = [];
                subGroups[prefix].push(file);
            }
            
            // Render each sub-group as a nested details element
            Object.keys(subGroups).sort().forEach(prefix => {
                const subFiles = subGroups[prefix];
                
                const subDetails = document.createElement('details');
                subDetails.style.marginLeft = "10px"; // Visual indentation
                subDetails.style.borderLeft = "1px solid var(--border)";
                
                const subSummary = document.createElement('summary');
                subSummary.textContent = `${prefix} (${subFiles.length})`;
                subSummary.style.fontSize = "0.9em";
                subDetails.appendChild(subSummary);
                
                const subContent = document.createElement('div');
                subContent.className = 'group-content';
                
                subFiles.forEach(file => {
                    subContent.appendChild(createFileLink(file));
                });
                
                subDetails.appendChild(subContent);
                content.appendChild(subDetails);
            });
        }
        
        /* ------------------------------------------------------------------ */
        /* Standard Rendering (Flat List)                                     */
        /* ------------------------------------------------------------------ */
        
        else {
            for (const file of sortedFiles) {
                content.appendChild(createFileLink(file));
            }
        }
        
        details.appendChild(content);
        assetBox.appendChild(details);
    }
    
    /* ---------------------------------------------------------------------- */
    /* Log Results                                                            */
    /* ---------------------------------------------------------------------- */
    
    uiLog(`Loaded ${fileManager.levels.length} levels, ${fileManager.graphics.length} graphics`, "success");
});

/* ========================================================================== */
/* EVENT LISTENERS                                                            */
/* ========================================================================== */
/**
 * Register event handlers for all user interactions.
 */

/* -------------------------------------------------------------------------- */
/* Window Resize Handler                                                      */
/* -------------------------------------------------------------------------- */
/**
 * Resize canvas when browser window changes size.
 * Ensures canvas always fills available space.
 */

window.addEventListener('resize', resizeCanvas);

/* -------------------------------------------------------------------------- */
/* Zoom Button Handlers                                                       */
/* -------------------------------------------------------------------------- */
/**
 * Fixed zoom level buttons.
 * - Fit: Auto-zoom to fit entire content
 * - 1x, 2x, 4x: Fixed scale factors
 */

document.getElementById('zoom-reset').addEventListener('click', () => setZoom(getFitZoom()));
document.getElementById('zoom-1x').addEventListener('click', () => setZoom(1));
document.getElementById('zoom-2x').addEventListener('click', () => setZoom(2));
document.getElementById('zoom-4x').addEventListener('click', () => setZoom(4));

/* -------------------------------------------------------------------------- */
/* Canvas Panning Handlers (Mouse Drag)                                       */
/* -------------------------------------------------------------------------- */
/**
 * Implement click-and-drag panning for navigating large maps.
 * 
 * Flow:
 * 1. mousedown: Start panning, record initial position
 * 2. mousemove: Calculate delta and update viewport position
 * 3. mouseup: Stop panning
 */

previewCanvas.addEventListener('mousedown', e => {
    if (!currentLevel) return;
    
    isPanning = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    mainContent.style.cursor = "grabbing";
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    mainContent.style.cursor = "grab";
});

window.addEventListener('mousemove', e => {
    if (!isPanning || !currentLevel) return;
    e.preventDefault();
    
    // Calculate mouse movement delta
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    // Update viewport position (inverse direction for natural feel)
    viewport.x -= dx / viewport.zoom;
    viewport.y -= dy / viewport.zoom;
    
    requestRender();
});

/* -------------------------------------------------------------------------- */
/* Mouse Wheel Zoom Handler                                                   */
/* -------------------------------------------------------------------------- */
/**
 * Implement zoom with mouse wheel.
 * 
 * Features:
 * - Scroll up: Zoom in (1.1x per tick)
 * - Scroll down: Zoom out (0.9x per tick)
 * - Zoom toward mouse cursor (keeps cursor over same world point)
 * - Clamped between 0.25x and 8x
 */

previewCanvas.addEventListener('wheel', e => {
    if (!currentLevel) return;
    e.preventDefault();
    
    // Calculate zoom delta
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(8, viewport.zoom * delta));
    
    /* ---------------------------------------------------------------------- */
    /* Zoom Toward Mouse Cursor                                               */
    /* ---------------------------------------------------------------------- */
    
    /**
     * We want to keep the point under the mouse cursor stationary
     * while zooming. This requires adjusting the viewport position.
     * 
     * Process:
     * 1. Convert mouse position to world coordinates at current zoom
     * 2. Update zoom level
     * 3. Recalculate viewport position to keep that world point
     *    under the cursor
     */
    
    const rect = previewCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate world coordinates at current zoom
    const worldX = (mouseX - viewport.width / 2) / viewport.zoom + viewport.x;
    const worldY = (mouseY - viewport.height / 2) / viewport.zoom + viewport.y;
    
    viewport.zoom = newZoom;
    
    // Recalculate viewport position to maintain cursor position
    viewport.x = worldX - (mouseX - viewport.width / 2) / viewport.zoom;
    viewport.y = worldY - (mouseY - viewport.height / 2) / viewport.zoom;
    
    requestRender();
});

/* -------------------------------------------------------------------------- */
/* Episode Filter Handlers                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Re-generate asset list when episode filters change.
 * Triggers the folder input change event to rebuild the list.
 */

document.getElementById('filter-dn1').addEventListener('change', () => {
    folderInput.dispatchEvent(new Event('change'));
});
document.getElementById('filter-dn2').addEventListener('change', () => {
    folderInput.dispatchEvent(new Event('change'));
});
document.getElementById('filter-dn3').addEventListener('change', () => {
    folderInput.dispatchEvent(new Event('change'));
});

/* -------------------------------------------------------------------------- */
/* Layer Visibility Handlers                                                  */
/* -------------------------------------------------------------------------- */
/**
 * Control which sprite types are displayed on maps.
 * Each checkbox toggles visibility of one sprite category.
 */

document.getElementById('layer-bonuses').addEventListener('change', e => {
    layerConfig.showBonuses = e.target.checked;
    requestRender();
});

document.getElementById('layer-enemies').addEventListener('change', e => {
    layerConfig.showEnemies = e.target.checked;
    requestRender();
});

document.getElementById('layer-hazards').addEventListener('change', e => {
    layerConfig.showHazards = e.target.checked;
    requestRender();
});

document.getElementById('layer-interactive').addEventListener('change', e => {
    layerConfig.showInteractive = e.target.checked;
    requestRender();
});

document.getElementById('layer-decorative').addEventListener('change', e => {
    layerConfig.showDecorative = e.target.checked;
    requestRender();
});

/* -------------------------------------------------------------------------- */
/* Sprite Display Mode Handlers                                               */
/* -------------------------------------------------------------------------- */
/**
 * Switch between sprite display modes.
 * 
 * Modes:
 * - Icon: Single tile representation
 * - Shrink: Full sprite scaled to tile size
 * - Full: Full sprite at native size
 */

document.querySelectorAll('input[name="sprite-mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
        spriteMode = e.target.value;
        updateSpriteRegistryImages();
        requestRender();
    });
});

/* -------------------------------------------------------------------------- */
/* DROP View Mode Handlers                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Switch between DROP backdrop display modes.
 * 
 * Modes:
 * - Sheet: Standard 32-column tileset view
 * - Assembled: Game-accurate 13x10 backdrop view
 */

document.querySelectorAll('input[name="drop-mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
        dropViewMode = e.target.value;
        rebuildDropLevel();
    });
});

/* -------------------------------------------------------------------------- */
/* Background Mode Handler                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Toggle between grid pattern and solid black background.
 */

document.getElementById('viz-bg-solid').addEventListener('change', e => {
    useSolidBG = e.target.checked;
    requestRender();
});

/* -------------------------------------------------------------------------- */
/* Grid Fix Handler                                                           */
/* -------------------------------------------------------------------------- */
/**
 * Toggle pixel-perfect grid alignment fix.
 * Prevents sub-pixel gaps in rendered tiles.
 */

document.getElementById('viz-grid-fix').addEventListener('change', e => {
    useGridFix = e.target.checked;
    requestRender();
});

/* ========================================================================== */
/* PALETTE EASTER EGG                                                         */
/* ========================================================================== */
/**
 * Hidden feature: Custom palette upload.
 * 
 * Implementation:
 * 1. Click debug canvas in system log to trigger file selection
 * 2. Upload a 160x10 PNG image (same size as debug canvas)
 * 3. Sample pixel colors to extract new palette
 * 4. Apply new palette and reload current view
 * 
 * This allows users to create custom color schemes for the viewer.
 */

const paletteInput = document.getElementById('palette-input');
const debugCanvas = document.getElementById('debug-canvas');

/* -------------------------------------------------------------------------- */
/* Step 1: Click Debug Bar to Trigger Upload                                  */
/* -------------------------------------------------------------------------- */
/**
 * The debug canvas serves double duty:
 * - Visual display of current palette
 * - Clickable trigger for palette upload
 */

debugCanvas.addEventListener('click', () => {
    paletteInput.click();
});

/* -------------------------------------------------------------------------- */
/* Step 2: Handle File Upload                                                 */
/* -------------------------------------------------------------------------- */

paletteInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            /* -------------------------------------------------------------- */
            /* Validation: Must be exactly 160x10                             */
            /* -------------------------------------------------------------- */
            
            /**
             * The palette image must match the debug canvas size.
             * This ensures we sample colors from the correct positions.
             */
            
            if (img.width !== 160 || img.height !== 10) {
                uiLog("Palette Error: Image must be exactly 160x10 PNG.", "error");
                return;
            }
            
            /* -------------------------------------------------------------- */
            /* Sample Colors from Image                                       */
            /* -------------------------------------------------------------- */
            
            /**
             * Draw image to invisible canvas to read pixel data.
             * 
             * The palette is 16 colors arranged horizontally.
             * Each color occupies a 10x10 pixel block.
             * We sample the center pixel (5,5) of each block.
             */
            
            const pCanvas = document.createElement('canvas');
            pCanvas.width = 160;
            pCanvas.height = 10;
            const ctx = pCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const newPalette = [];
            
            for (let i = 0; i < 16; i++) {
                // Calculate sample position (center of each color block)
                const x = (i * 10) + 5;
                const y = 5;
                
                // Sample pixel
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                
                // Store RGB values (ignore alpha)
                newPalette.push([pixel[0], pixel[1], pixel[2]]);
            }
            
            /* -------------------------------------------------------------- */
            /* Apply New Palette                                               */
            /* -------------------------------------------------------------- */
            
            /**
             * Update process:
             * 1. Replace EGA.PALETTE with new colors
             * 2. Redraw debug canvas with new palette
             * 3. Clear asset cache (forces re-decode with new colors)
             * 4. Reload current view to show new palette
             */
            
            // 1. Update EGA palette
            EGA.PALETTE = newPalette;
            
            // 2. Update debug bar visual
            testEGA();
            
            // 3. Clear cached tiles (they use old palette)
            assetManager.clearCache();
            
            // 4. Reload current view
            if (currentFile) {
                uiLog("Palette updated! Reloading...", "success");
                inspectAsset(currentFile);
            } else {
                uiLog("Palette updated! Load a file to see changes.", "success");
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be uploaded again
    paletteInput.value = '';
});

/* ========================================================================== */
/* TOOLTIP                                                                    */
/* ========================================================================== */
/**
 * Interactive tooltip for map tiles.
 * 
 * Displays:
 * - Tile coordinates (X, Y)
 * - Tile ID (decimal and hex)
 * - Sprite name (if tile is a sprite)
 * 
 * Only shown when:
 * - Mouse is over canvas
 * - A level is loaded (not tile sheets or images)
 * - Not currently panning
 */

const tooltip = document.getElementById('tooltip');

/* -------------------------------------------------------------------------- */
/* Mouse Move Handler                                                         */
/* -------------------------------------------------------------------------- */

previewCanvas.addEventListener('mousemove', e => {
    // Hide tooltip while panning or if no level loaded
    if (!currentLevel || isPanning) {
        if (tooltip) tooltip.style.display = 'none';
        return;
    }
    
    // Only show tooltips for actual levels (not tile sheets or images)
    if (currentLevel.type !== 'sheet' && currentLevel.type !== 'image') {
        /* ------------------------------------------------------------------ */
        /* Calculate World Coordinates                                        */
        /* ------------------------------------------------------------------ */
        
        /**
         * Convert mouse screen position to world coordinates.
         * 
         * Process:
         * 1. Get mouse position relative to canvas
         * 2. Adjust for viewport offset and zoom
         * 3. Convert to tile coordinates
         */
        
        const rect = previewCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Convert screen coords to world coords
        const worldX = viewport.x + (mouseX - viewport.width / 2) / viewport.zoom;
        const worldY = viewport.y + (mouseY - viewport.height / 2) / viewport.zoom;
        
        // Convert to tile coordinates
        const tileX = Math.floor(worldX / 16);
        const tileY = Math.floor(worldY / 16);
        
        /* ------------------------------------------------------------------ */
        /* Check Bounds and Build Tooltip                                     */
        /* ------------------------------------------------------------------ */
        
        if (tileX >= 0 && tileX < currentLevel.width && 
            tileY >= 0 && tileY < currentLevel.height) {
            
            // Get tile ID at this position
            const id = currentLevel.grid[tileY * currentLevel.width + tileX];
            
            // Build tooltip text
            let text = `X:${tileX} Y:${tileY}\nID:${id}`;
            
            // Add hex notation for sprite IDs (>= 3000)
            if (id >= 3000) {
                text += ` (0x${id.toString(16).toUpperCase()})`;
            }
            
            // Add sprite name if available
            if (currentSpriteRegistry[id]) {
                // Sprite in registry
                text += `\n${currentSpriteRegistry[id].name}`;
            } else if (id >= 3000) {
                // Check sprite map for mirrors and other unregistered sprites
                const hexKey = id.toString(16).toUpperCase();
                if (SPRITE_MAP[hexKey]) {
                    text += `\n${SPRITE_MAP[hexKey].name}`;
                } else {
                    text += `\nUnknown Sprite`;
                }
            }
            
            // Position and show tooltip
            tooltip.textContent = text;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        } else {
            // Mouse outside level bounds
            if (tooltip) tooltip.style.display = 'none';
        }
    } else {
        // Hide tooltip for tile sheets and images
        if (tooltip) tooltip.style.display = 'none';
    }
});

/* -------------------------------------------------------------------------- */
/* Mouse Out Handler                                                          */
/* -------------------------------------------------------------------------- */
/**
 * Hide tooltip when mouse leaves canvas.
 */

previewCanvas.addEventListener('mouseout', () => {
    if (tooltip) tooltip.style.display = 'none';
});

/* ========================================================================== */
/* INITIALIZATION                                                             */
/* ========================================================================== */
/**
 * Application startup code.
 * Runs once when the page loads.
 */

/**
 * Initialize collapsible panel functionality.
 * 
 * Finds all elements with class 'collapsible-header' and adds
 * click handlers that toggle the 'collapsed' class on the parent
 * sidebar section.
 * 
 * This enables show/hide functionality for:
 * - Asset list
 * - System log
 * - Controls panel
 */
function initCollapsibles() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Find parent section container
            const section = header.closest('.sidebar-section');
            if (section) {
                // Toggle collapsed state
                section.classList.toggle('collapsed');
            }
        });
    });
}

/**
 * Test EGA palette rendering and initialize the debug canvas.
 * 
 * This function:
 * 1. Renders the current EGA palette to the debug canvas
 * 2. Displays 16 color blocks horizontally
 * 3. Logs system ready message
 * 
 * Also called after custom palette upload to update the visual.
 */
function testEGA() {
    const canvas = document.getElementById('debug-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Calculate width of each color block
    const w = canvas.width / 16;
    
    // Draw each palette color
    EGA.PALETTE.forEach((color, index) => {
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.fillRect(index * w, 0, w, canvas.height);
    });
    
    uiLog("System Ready.", "success");
}

/* -------------------------------------------------------------------------- */
/* Run Initialization                                                         */
/* -------------------------------------------------------------------------- */

resizeCanvas();           // Size canvas to fit viewport
testEGA();               // Draw initial palette display
initCollapsibles();      // Activate collapsible panels
