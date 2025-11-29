/**
 * Duke Nukem 1 Map Viewer - Main Application
 * * This is the primary controller that orchestrates all components of the map viewer.
 * It handles user interactions, file loading, rendering, and UI state management.
 */

import { FileManager } from './file_manager.js';
import { EGA } from './ega.js';
import { AssetManager } from './assets.js';
import { LevelManager } from './level.js';
import { Renderer } from './renderer.js';
import { SPRITE_MAP } from './sprites.js';

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================

const logBox = document.getElementById('app-log');
const assetBox = document.getElementById('asset-list');
const previewCanvas = document.getElementById('preview-canvas');
const folderInput = document.getElementById('folder-input');
const mainContent = document.querySelector('.main-content');

// ============================================================================
// DYNAMIC UI INJECTION
// ============================================================================

// [REMOVED] Episode Filter Panel injection - Now handled in index.html

/**
 * Main Control Panel
 * Contains layer visibility, sprite display modes.
 * Refactored to match sidebar "Header > Box" styling with Collapsible Support.
 */
const controlPanel = document.createElement('div');
controlPanel.className = "sidebar-section"; // Wrapper for standard sidebar spacing
// REMOVED: controlPanel.style.marginTop = "15px"; // This caused the double spacing issue
controlPanel.style.display = "none";
controlPanel.style.flex = "0 0 auto"; // Prevent panel from growing/shrinking unexpectedly
controlPanel.innerHTML = `
    <div class="collapsible-header" style="margin-bottom: 8px;">
        <span class="collapse-arrow"></span>
        <h3>Controls</h3>
    </div>
    
    <div class="control-box"> <div id="ctrl-layers" class="control-group">
            <div class="control-group-label">Visibility Layers</div>
            <div class="checkbox-grid">
                <label><input type="checkbox" id="layer-bonuses" checked> Bonuses</label>
                <label><input type="checkbox" id="layer-enemies" checked> Enemies</label>
                <label><input type="checkbox" id="layer-hazards" checked> Hazards</label>
                <label><input type="checkbox" id="layer-interactive" checked> Tech</label>
                <label><input type="checkbox" id="layer-decorative" checked> Deco</label>
            </div>
        </div>

        <div id="ctrl-sprites" class="control-group">
            <div class="control-group-label">Sprite Display Mode</div>
            <div style="display:flex; gap:10px; font-size:0.85rem; color:#eee;">
                <label><input type="radio" name="sprite-mode" value="icon" checked> Icon</label>
                <label><input type="radio" name="sprite-mode" value="shrink"> Shrink</label>
                <label><input type="radio" name="sprite-mode" value="full"> Full</label>
            </div>
        </div>

        <div id="ctrl-drop" class="control-group" style="display:none;">
            <div class="control-group-label">Backdrop View</div>
            <div style="display:flex; gap:10px; font-size:0.85rem; color:#eee;">
                <label><input type="radio" name="drop-mode" value="sheet" checked> Sheet</label>
                <label><input type="radio" name="drop-mode" value="assembled"> Game</label>
            </div>
        </div>
    </div>
`;

// Append to sidebar (as a sibling between Assets and Log)
// assetBox is #asset-list, assetBox.parentNode is the Assets sidebar-section
// We want to insert AFTER the Assets sidebar-section
if (assetBox) {
    const assetsSection = assetBox.parentNode;
    if (assetsSection.parentNode) {
        assetsSection.parentNode.insertBefore(controlPanel, assetsSection.nextElementSibling);
    }
}

/**
 * Zoom Controls Panel
 * Provides zoom level buttons and background toggle
 */
const zoomPanel = document.createElement('div');
zoomPanel.className = 'zoom-controls';
zoomPanel.style.display = 'none'; 
zoomPanel.innerHTML = `
    <button class="zoom-btn" id="zoom-reset">Fit</button>
    <button class="zoom-btn" id="zoom-1x">1x</button>
    <button class="zoom-btn" id="zoom-2x">2x</button>
    <button class="zoom-btn" id="zoom-4x">4x</button>
    <label><input type="checkbox" id="viz-bg-solid"> Black BG</label>
`;
mainContent.appendChild(zoomPanel);

// ============================================================================
// CORE MANAGERS
// ============================================================================

const fileManager = new FileManager((msg) => console.log(msg)); 
const assetManager = new AssetManager();
const levelManager = new LevelManager();
const renderer = new Renderer(previewCanvas);

// ============================================================================
// APPLICATION STATE
// ============================================================================

let cachedFiles = [];
let currentLevel = null;
let currentMasterTileset = [];
let currentSpriteRegistry = {};
let currentEpisodeExt = "";
let animationFrameId = null;
let selectedFilename = null;

// Viewport state for panning and zooming
let viewport = {
    x: 0,
    y: 0,
    zoom: 1,
    width: 800,
    height: 600
};

// Mouse interaction state
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// User settings
let isDebugMode = false;
let useSolidBG = false;
let spriteMode = 'icon';
let dropViewMode = 'sheet';
let layerConfig = {
    showBonuses: true,
    showEnemies: true,
    showHazards: true,
    showInteractive: true,
    showDecorative: true
};
let episodeFilters = {
    DN1: true,
    DN2: true,
    DN3: true
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Valid file categories for Duke Nukem 1
 */
const CATEGORIES = [
    "WORLDAL", "ANIM", "BACK", "BADGUY", "BORDER", "CREDITS", "DN", "DROP",
    "DUKE", "END", "FONT", "HIGHS", "KEYS", "MAN", "MY_DEMO", "NUMBERS",
    "OBJECT", "SAVED", "SOLID", "SPEED", "USERDEMO"
];

/**
 * Crate artwork mapping
 * Defines which file and tile index to use for each crate color
 */
const CRATE_ART = {
    grey: { file: "OBJECT0", index: 0 },
    blue: { file: "OBJECT2", index: 0 },
    red: { file: "OBJECT2", index: 1 }
};

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

/**
 * Logs a message to the application log panel
 * @param {string} message - The message to display
 * @param {string} type - Log type: "info", "error", "warning", or "success"
 */
function uiLog(message, type = "info") {
    if (!logBox) return;
    const div = document.createElement('div');
    div.textContent = `> ${message}`;
    div.className = `log-entry log-${type}`;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
}

/**
 * Updates the header status display
 * @param {string} text - HTML text to display in the header
 */
function updateHeaderStatus(text) {
    const headerDisplay = document.getElementById('tile-count-display');
    if (headerDisplay) headerDisplay.innerHTML = text;
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Requests a render on the next animation frame
 * Prevents multiple renders per frame by canceling pending requests
 */
function requestRender() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
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
            useSolidBG
        );
    });
}

/**
 * Resizes the canvas to match the viewport
 * Called on window resize and initial load
 */
function resizeCanvas() {
    viewport.width = mainContent.clientWidth;
    viewport.height = mainContent.clientHeight;
    previewCanvas.width = viewport.width;
    previewCanvas.height = viewport.height;
    const ctx = previewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    requestRender();
}

// ============================================================================
// VIEWPORT CONTROL FUNCTIONS
// ============================================================================

/**
 * Calculates the zoom level that fits the entire level in the viewport
 * @returns {number} Optimal zoom level
 */
function getFitZoom() {
    if (!currentLevel) return 1;
    const w = currentLevel.width * 16 + 32;
    const h = currentLevel.height * 16 + 32;
    return Math.min(viewport.width / w, viewport.height / h);
}

/**
 * Sets the zoom level and centers the viewport
 * @param {number} z - Target zoom level
 */
function setZoom(z) {
    viewport.zoom = z;
    viewport.x = (currentLevel.width * 16) / 2;
    viewport.y = (currentLevel.height * 16) / 2;
    requestRender();
}

// ============================================================================
// DROP FILE HANDLING
// ============================================================================

/**
 * Rebuilds the level layout for DROP backdrop files
 * DROP files contain backdrop graphics that are assembled differently
 * based on the current view mode (sheet vs assembled)
 */
function rebuildDropLevel() {
    if (dropViewMode === 'sheet') {
        // Display as a simple tile sheet
        const cols = 32;
        const rows = Math.ceil(currentMasterTileset.length / cols);
        currentLevel.width = cols;
        currentLevel.height = rows;
        currentLevel.grid = new Uint16Array(cols * rows);
        for (let i = 0; i < currentMasterTileset.length; i++) {
            currentLevel.grid[i] = i;
        }
    } else {
        // Correct dimensions for assembled DROP backdrops
        currentLevel.width = 13;
        currentLevel.height = 10;
        currentLevel.grid = new Uint16Array(130);
        for (let i = 0; i < 130; i++) {
            currentLevel.grid[i] = i;
        }
    }
    
    setZoom(getFitZoom());
    requestRender();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts ImageData to a Canvas element for faster rendering
 * @param {ImageData} imageData - Source image data
 * @returns {HTMLCanvasElement} Canvas containing the image
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
 * Composites multiple tiles into a single sprite canvas
 * @param {Array} canvasTiles - Array of tile canvases
 * @param {Object} comp - Composition definition {width, height, indices}
 * @returns {HTMLCanvasElement} Composite sprite canvas
 */
function compositeSprite(canvasTiles, comp) {
    const tileW = 16;
    const tileH = 16;
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = comp.width * tileW;
    spriteCanvas.height = comp.height * tileH;
    const ctx = spriteCanvas.getContext('2d');
    
    for (let i = 0; i < comp.indices.length; i++) {
        const tileIndex = comp.indices[i];
        const x = (i % comp.width) * tileW;
        const y = Math.floor(i / comp.width) * tileH;
        if (canvasTiles[tileIndex]) {
            ctx.drawImage(canvasTiles[tileIndex], x, y);
        }
    }
    
    return spriteCanvas;
}

// ============================================================================
// SPRITE LOADING
// ============================================================================

/**
 * Loads and processes all sprites for the current level
 * Builds the sprite registry with full-size and icon versions
 */
async function loadSprites() {
    currentSpriteRegistry = {};
    
    // Load sprite source files (ANIM, OBJECT, MAN files)
    const spriteFiles = {};
    const requiredFiles = new Set();
    
    // Collect all required files from sprite map
    for (const id in SPRITE_MAP) {
        const def = SPRITE_MAP[id];
        if (def.file) requiredFiles.add(def.file + currentEpisodeExt);
        if (def.content?.file) requiredFiles.add(def.content.file + currentEpisodeExt);
    }
    
    // Load each required file
    for (const fileName of requiredFiles) {
        const fileObj = fileManager.graphics.find(f => f.name.toUpperCase() === fileName);
        if (fileObj) {
            const tiles = await assetManager.loadTileset(fileObj);
            spriteFiles[fileName.replace(currentEpisodeExt, "")] = tiles.map(imageDataToCanvas);
        }
    }
    
    let loadedCount = 0;
    
    // Build sprite registry from sprite map
    for (const hexID in SPRITE_MAP) {
        const numID = parseInt(hexID, 16);
        const def = SPRITE_MAP[hexID];
        
        // Correct: Skip mirrors entirely during sprite loading
        // They are handled only in Pass 3 via direct grid ID check
        
        // Handle crate sprites (special composite objects)
        if (def.crate) {
            const baseArt = CRATE_ART[def.crate];
            const baseFile = spriteFiles[baseArt.file];
            const baseTile = baseFile ? baseFile[baseArt.index] : null;
            
            let contentTile = null;
            if (def.content) {
                const contentFile = spriteFiles[def.content.file];
                contentTile = contentFile ? contentFile[def.content.index] : null;
            }
            
            currentSpriteRegistry[numID] = {
                type: def.type,
                name: def.name,
                isCrate: true,
                base: baseTile,
                content: contentTile
            };
            
            loadedCount++;
        }
        // Handle standard sprites
        else if (def.file) {
            const sourceFile = spriteFiles[def.file];
            if (sourceFile) {
                let iconSprite = null;
                let fullSprite = null;
                
                // Icon is always the first tile from def.index
                if (sourceFile[def.index]) {
                    iconSprite = sourceFile[def.index];
                }
                
                // Full sprite: composite if specified, otherwise same as icon
                if (def.composition) {
                    fullSprite = compositeSprite(sourceFile, def.composition);
                } else {
                    fullSprite = iconSprite;
                }
                
                // Apply opacity override if specified
                if (def.forceOpaque) {
                    const fixAlpha = (canvas) => {
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const pixels = imgData.data;
                        for (let p = 3; p < pixels.length; p += 4) {
                            pixels[p] = 255;
                        }
                        ctx.putImageData(imgData, 0, 0);
                    };
                    fixAlpha(fullSprite);
                    fixAlpha(iconSprite);
                }
                
                if (iconSprite && fullSprite) {
                    currentSpriteRegistry[numID] = {
                        type: def.type,
                        name: def.name,
                        srcIcon: iconSprite,
                        srcFull: fullSprite,
                        image: null,
                        hTiles: def.composition ? def.composition.height : 1
                    };
                    loadedCount++;
                }
            }
        }
    }
    
    updateSpriteRegistryImages();
    uiLog(`Sprites Loaded: ${loadedCount}`, "success");
    updateHeaderStatus(`<strong>${currentLevel.name}</strong> | Tiles: ${currentMasterTileset.length} | Sprites: ${loadedCount}`);
    requestRender();
}

/**
 * Updates sprite images based on current sprite display mode
 * Switches between full-size and icon versions
 */
function updateSpriteRegistryImages() {
    for (const id in currentSpriteRegistry) {
        const sprite = currentSpriteRegistry[id];
        
        if (sprite.isCrate) continue;
        
        if (spriteMode === 'icon') {
            sprite.image = sprite.srcIcon;
        } else {
            sprite.image = sprite.srcFull;
        }
    }
}

// ============================================================================
// ASSET INSPECTION
// ============================================================================

/**
 * Inspects and loads an asset file (either level or graphics)
 * @param {File} file - The file object to inspect
 */
async function inspectAsset(file) {
    const fileName = file.name.toUpperCase();
    
    // ========================================================================
    // CASE A: Level File (WORLD*.DN*)
    // ========================================================================
    if (fileName.startsWith("WORLD")) {
        try {
            uiLog(`Loading ${file.name}...`, "info");
            updateHeaderStatus(`Loading ${file.name}...`);
            
            // Load level data
            currentLevel = await levelManager.loadLevel(file);
            currentEpisodeExt = fileName.match(/\.DN\d$/)[0];
            
            // Define tileset load order (BACK and SOLID files)
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
            
            // Load tileset files in 48-tile slots
            currentMasterTileset = [];
            const SLOT_SIZE = 48;
            
            for (const targetName of loadOrder) {
                const foundFile = fileManager.graphics.find(
                    f => f.name.toUpperCase() === targetName
                );
                
                if (foundFile) {
                    const tiles = await assetManager.loadTileset(foundFile);
                    const canvasTiles = tiles.map(imageDataToCanvas);
                    
                    if (canvasTiles.length > SLOT_SIZE) {
                        // Truncate to slot size
                        currentMasterTileset = currentMasterTileset.concat(
                            canvasTiles.slice(0, SLOT_SIZE)
                        );
                    } else {
                        // Pad to slot size with nulls
                        currentMasterTileset = currentMasterTileset.concat(canvasTiles);
                        const padding = new Array(SLOT_SIZE - canvasTiles.length).fill(null);
                        currentMasterTileset = currentMasterTileset.concat(padding);
                    }
                } else {
                    uiLog(`Missing ${targetName}`, "warning");
                    currentMasterTileset = currentMasterTileset.concat(
                        new Array(SLOT_SIZE).fill(null)
                    );
                }
            }
            
            // ================================================================
            // Tile Patches (Context-Aware Corrections)
            // ================================================================
            if (currentMasterTileset.length > 300 && currentLevel.grid) {
                const grid = currentLevel.grid;
                const width = currentLevel.width;
                
                for (let i = 0; i < grid.length; i++) {
                    const tileID = grid[i];
                    
                    // Tile 203: Left cap or conveyor
                    if (tileID === 203) {
                        if ((i + 1) % width !== 0) {
                            const rightID = grid[i + 1];
                            if (rightID !== 205) {
                                grid[i] = 224; // Swap to conveyor
                            }
                        }
                    }
                    
                    // Tile 206: Right cap or conveyor
                    if (tileID === 206) {
                        if (i % width !== 0) {
                            const leftID = grid[i - 1];
                            if (leftID !== 205) {
                                grid[i] = 225; // Swap to conveyor
                            }
                        }
                    }
                }
            }
            
            // ================================================================
            // Pixel Patches (Color Corrections)
            // ================================================================
            
            // Tile 192 (Breakable Brick): Swap black (0,0,0) to grey (#AAAAAA)
            if (currentMasterTileset[192]) {
                const canvas = currentMasterTileset[192];
                const ctx = canvas.getContext('2d');
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                
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
            
            // Load sprite definitions
            await loadSprites();
            
            // Show level-specific UI controls
            controlPanel.style.display = "block";
            
            // FIX: Explicitly show layers and sprites (they may have been hidden by DROP viewer)
            document.getElementById('ctrl-layers').style.display = "block";
            document.getElementById('ctrl-sprites').style.display = "block";
            
            // Hide DROP-specific controls
            document.getElementById('ctrl-drop').style.display = "none";
            
            // Enable zoom UI
            zoomPanel.style.display = "flex";
            
            // Set initial view
            setZoom(getFitZoom());
            requestRender();
            uiLog(`Rendered ${file.name}`, "success");
            
        } catch (err) {
            uiLog(`Error: ${err.message}`, "error");
            console.error(err);
        }
        return;
    }
    
    // ========================================================================
    // CASE B: Graphic File (Tileset/Sprite Sheet View)
    // ========================================================================
    try {
        uiLog(`View ${file.name}`, "info");
        updateHeaderStatus(`Viewing ${file.name}`);
        
        const tiles = await assetManager.loadTileset(file);
        
        // Store tiles globally
        currentMasterTileset = tiles.map(imageDataToCanvas);
        currentSpriteRegistry = {};
        
        // Detect DROP backdrop files
        const isDrop = fileName.startsWith('DROP');
        
        // Configure UI for graphics viewing
        controlPanel.style.display = isDrop ? "block" : "none";
        zoomPanel.style.display = "flex";
        
        if (isDrop) {
            document.getElementById('ctrl-layers').style.display = "none";
            document.getElementById('ctrl-sprites').style.display = "none";
            document.getElementById('ctrl-drop').style.display = "block";
        }
        
        // Create fake level for sheet display
        currentLevel = { type: 'sheet', name: file.name };
        
        if (isDrop) {
            // Use DROP-specific layout
            rebuildDropLevel();
        } else {
            // Standard tile sheet layout (32 columns)
            const cols = 32;
            const rows = Math.ceil(tiles.length / cols);
            currentLevel.width = cols;
            currentLevel.height = rows;
            currentLevel.grid = new Uint16Array(cols * rows);
            
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

// ============================================================================
// FILE SYSTEM HANDLERS
// ============================================================================

/**
 * Handles folder selection and file scanning
 */
folderInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    // UI Update: Show file count next to button
    const statusSpan = document.getElementById('file-input-status');
    if (files.length > 0) {
        statusSpan.textContent = `${files.length} files loaded`;
        statusSpan.style.color = "var(--text-main)"; // Highlight success
    } else {
        statusSpan.textContent = "No folder selected";
    }

    cachedFiles = files;
    
    await fileManager.handleFiles(files);
    
    // Clear asset list
    assetBox.innerHTML = '';
    
    // Get current filter states
    const showDN1 = document.getElementById('filter-dn1').checked;
    const showDN2 = document.getElementById('filter-dn2').checked;
    const showDN3 = document.getElementById('filter-dn3').checked;
    
    // Group files by category
    const grouped = {};
    
    // Force Levels into their own "WORLDAL" category first
    grouped["WORLDAL"] = []; // Ensure it exists
    
    for (const file of fileManager.levels) {
        const name = file.name.toUpperCase();
        const ext = name.match(/\.DN\d$/)?.[0];
        
        if (ext === '.DN1' && !showDN1) continue;
        if (ext === '.DN2' && !showDN2) continue;
        if (ext === '.DN3' && !showDN3) continue;
        
        grouped["WORLDAL"].push(file);
    }

    // Process Graphics files into standard categories
    for (const file of fileManager.graphics) {
        const name = file.name.toUpperCase();
        const ext = name.match(/\.DN\d$/)?.[0];
        
        if (ext === '.DN1' && !showDN1) continue;
        if (ext === '.DN2' && !showDN2) continue;
        if (ext === '.DN3' && !showDN3) continue;
        
        let category = "MISC";
        for (const cat of CATEGORIES) {
            if (name.startsWith(cat)) {
                category = cat;
                break;
            }
        }
        
        // Skip adding if it's already in WORLDAL (unlikely for graphics, but safety check)
        if (category === "WORLDAL") continue;

        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(file);
    }
    
    // Sort categories: WORLDAL first, then alphabetical
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        if (a === "WORLDAL") return -1;
        if (b === "WORLDAL") return 1;
        return a.localeCompare(b);
    });

    // Render grouped file list
    for (const category of sortedCategories) {
        const files = grouped[category];
        if (files.length === 0) continue;

        const details = document.createElement('details');
        details.open = (category === "WORLDAL"); // Auto-expand WORLDAL
        
        const summary = document.createElement('summary');
        summary.textContent = `${category} (${files.length})`;
        details.appendChild(summary);
        
        const content = document.createElement('div');
        content.className = 'group-content';
        
        // Natural Sort Order (e.g. DROP1 -> DROP2 ... -> DROP10)
        for (const file of files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))) {
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
                
                await inspectAsset(file);
            });
            
            content.appendChild(link);
        }
        
        details.appendChild(content);
        assetBox.appendChild(details);
    }
    
    uiLog(`Loaded ${fileManager.levels.length} levels, ${fileManager.graphics.length} graphics`, "success");
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Window resize handler
window.addEventListener('resize', resizeCanvas);

// Zoom button handlers
document.getElementById('zoom-reset').addEventListener('click', () => setZoom(getFitZoom()));
document.getElementById('zoom-1x').addEventListener('click', () => setZoom(1));
document.getElementById('zoom-2x').addEventListener('click', () => setZoom(2));
document.getElementById('zoom-4x').addEventListener('click', () => setZoom(4));

// Canvas panning handlers
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
    
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    viewport.x -= dx / viewport.zoom;
    viewport.y -= dy / viewport.zoom;
    
    requestRender();
});

// Mouse wheel zoom handler
previewCanvas.addEventListener('wheel', e => {
    if (!currentLevel) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(8, viewport.zoom * delta));
    
    // Zoom towards mouse position
    const rect = previewCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = (mouseX - viewport.width / 2) / viewport.zoom + viewport.x;
    const worldY = (mouseY - viewport.height / 2) / viewport.zoom + viewport.y;
    
    viewport.zoom = newZoom;
    
    viewport.x = worldX - (mouseX - viewport.width / 2) / viewport.zoom;
    viewport.y = worldY - (mouseY - viewport.height / 2) / viewport.zoom;
    
    requestRender();
});

// Episode filter handlers
document.getElementById('filter-dn1').addEventListener('change', () => {
    folderInput.dispatchEvent(new Event('change'));
});
document.getElementById('filter-dn2').addEventListener('change', () => {
    folderInput.dispatchEvent(new Event('change'));
});
document.getElementById('filter-dn3').addEventListener('change', () => {
    folderInput.dispatchEvent(new Event('change'));
});

// Layer visibility handlers
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

// Sprite display mode handlers
document.querySelectorAll('input[name="sprite-mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
        spriteMode = e.target.value;
        updateSpriteRegistryImages();
        requestRender();
    });
});

// DROP view mode handlers
document.querySelectorAll('input[name="drop-mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
        dropViewMode = e.target.value;
        rebuildDropLevel();
    });
});

// Background mode handler
document.getElementById('viz-bg-solid').addEventListener('change', e => {
    useSolidBG = e.target.checked;
    requestRender();
});

// ============================================================================
// TOOLTIP
// ============================================================================

/**
 * Tooltip display for tile/sprite information
 * Shows tile coordinates, ID, and sprite name when hovering over the canvas
 */
const tooltip = document.getElementById('tooltip');

previewCanvas.addEventListener('mousemove', e => {
    // Hide tooltip while panning or if no level loaded
    if (!currentLevel || isPanning) {
        if (tooltip) tooltip.style.display = 'none';
        return;
    }
    
    // Only show tooltips for actual levels (not tile sheets)
    if (currentLevel.type !== 'sheet') {
        // Calculate world coordinates from mouse position
        const rect = previewCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = viewport.x + (mouseX - viewport.width / 2) / viewport.zoom;
        const worldY = viewport.y + (mouseY - viewport.height / 2) / viewport.zoom;
        
        // Convert to tile coordinates
        const tileX = Math.floor(worldX / 16);
        const tileY = Math.floor(worldY / 16);
        
        // Check if mouse is within level bounds
        if (tileX >= 0 && tileX < currentLevel.width && 
            tileY >= 0 && tileY < currentLevel.height) {
            
            // Get tile ID at this position
            const id = currentLevel.grid[tileY * currentLevel.width + tileX];
            
            // Build tooltip text
            let text = `X:${tileX} Y:${tileY}\nID:${id}`;
            if (id >= 3000) {
                text += ` (0x${id.toString(16).toUpperCase()})`;
            }
            
            // Add sprite name if available
            if (currentSpriteRegistry[id]) {
                text += `\n${currentSpriteRegistry[id].name}`;
            } else if (id >= 3000) {
                // Check sprite map even if not in registry (e.g., mirrors)
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
        // Hide tooltip for tile sheets
        if (tooltip) tooltip.style.display = 'none';
    }
});

// Hide tooltip when mouse leaves canvas
previewCanvas.addEventListener('mouseout', () => {
    if (tooltip) tooltip.style.display = 'none';
});

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Collapsible Panel Logic
 * Handles click events on panel headers to toggle visibility
 */
function initCollapsibles() {
    // Select all headers with the class .collapsible-header
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Find the parent section container
            const section = header.closest('.sidebar-section');
            if (section) {
                // Toggle the collapsed state class
                section.classList.toggle('collapsed');
            }
        });
    });
}

/**
 * Tests EGA palette rendering and initializes the debug canvas
 */
function testEGA() {
    const canvas = document.getElementById('debug-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Dynamically calculate bar width based on current canvas size
    const w = canvas.width / 16;
    
    EGA.PALETTE.forEach((color, index) => {
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.fillRect(index * w, 0, w, canvas.height);
    });
    
    uiLog("System Ready.", "success");
}

// Initialize canvas and display
resizeCanvas();
testEGA();
initCollapsibles(); // Activate collapsible panels