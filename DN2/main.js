import { FileSystem } from './FileSystem.js';
import { AssetManager } from './AssetManager.js';
import { MapParser } from './MapParser.js';
import { Viewport } from './Viewport.js';
import { RenderEngine } from './RenderEngine.js';
import { UIManager } from './UIManager.js';
import { LevelStats } from './LevelStats.js';
import { ActorManager } from './ActorManager.js';
import { AudioPlayer } from './AudioPlayer.js';
import { AnimationPlayer } from './AnimationPlayer.js';
import { MusicPlayer } from './MusicPlayer.js';
import { SoundManager } from './SoundManager.js';
import { PaletteViewer } from './PaletteViewer.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗    ██╗███╗   ██╗██╗████████╗
// ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║    ██║████╗  ██║██║╚══██╔══╝
// ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║    ██║██╔██╗ ██║██║   ██║   
// ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║    ██║██║╚██╗██║██║   ██║   
// ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║    ██║██║ ╚████║██║   ██║   
// ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝    ╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝   
// ═══════════════════════════════════════════════════════════════════════════════
// Initialize all the core system objects that the viewer needs to function.
// These objects handle file loading, graphics rendering, audio playback, etc.

	// ─────────────────────────────────────────────────────────────────────────
	// System Log
	// ─────────────────────────────────────────────────────────────────────────
	// Sets up the System Log readout.
	window.logMessage = function(message, type = 'info') {
		const logContainer = document.getElementById('app-log');
		const logEntry = document.createElement('div');
		logEntry.className = `log-entry log-${type}`;
    
		logEntry.textContent = `> ${message}`;
    
		logContainer.appendChild(logEntry);
		logContainer.scrollTop = logContainer.scrollHeight;
	}

	// ═══════════════════════════════════════════════════════════════════════════════
	// Header Status Management
	// ═══════════════════════════════════════════════════════════════════════════════
	// Tracks the current and previous header status for temporary notifications

	let currentHeaderStatus = 'Waiting for Data...';  // The "real" status
	let headerStatusTimer = null;                      // Timer for temporary messages

	// ─────────────────────────────────────────────────────────────────────────
	// Header Status Display
	// ─────────────────────────────────────────────────────────────────────────
	// Updates the header readout showing current file information

	/**
* Updates the header status display
* @param {string} text - HTML text to display
* @param {boolean} temporary - If true, reverts to previous status after 3 seconds
*/
function updateHeaderStatus(text, temporary = false) {
    const headerDisplay = document.getElementById('tile-count-display');
    if (!headerDisplay) return;
    
    if (temporary) {
        // Clear any existing timer
        if (headerStatusTimer) {
            clearTimeout(headerStatusTimer);
        }
        
        // Show temporary message immediately (no fade)
        headerDisplay.innerHTML = text;
        
        // Set timer to revert to stored status
        headerStatusTimer = setTimeout(() => {
            // Fade DOWN-UP when reverting from temporary to permanent
            headerDisplay.classList.add('updating');
            
            setTimeout(() => {
                headerDisplay.innerHTML = currentHeaderStatus;
                
                setTimeout(() => {
                    headerDisplay.classList.remove('updating');
                }, 50);
            }, 300);
            
            headerStatusTimer = null;
        }, 3000);
        
    } else {
        // This is a permanent status change
        currentHeaderStatus = text;
        
        // Update immediately (no fade)
        headerDisplay.innerHTML = text;
        
        // Clear any pending temporary timer
        if (headerStatusTimer) {
            clearTimeout(headerStatusTimer);
            headerStatusTimer = null;
        }
    }
}

	// ─────────────────────────────────────────────────────────────────────────
    // Collapsible Panel Handlers (REFACTORED)
    // ─────────────────────────────────────────────────────────────────────────
    // Enables collapse/expand functionality using the CSS Grid method

    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            // Find the parent section (closest .sidebar-section)
            const section = header.closest('.sidebar-section');
            if (section) {
                section.classList.toggle('collapsed');
            }
        });
    });

// Actor detail overlay close handlers
document.getElementById('actor-detail-close')?.addEventListener('click', () => {
    document.getElementById('actor-detail-overlay').classList.remove('active');
});

document.getElementById('actor-detail-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'actor-detail-overlay') {
        document.getElementById('actor-detail-overlay').classList.remove('active');
    }
});

const fs = new FileSystem();
const assets = new AssetManager();
const mapParser = new MapParser();
const ui = new UIManager();
const actorManager = new ActorManager(assets);
window.actorManager = actorManager;  // ADD THIS LINE - makes it global for debugging
const audioPlayer = new AudioPlayer();
const animationPlayer = new AnimationPlayer();
const musicPlayer = new MusicPlayer();
const soundManager = new SoundManager(audioPlayer.ctx, musicPlayer);

const canvas = document.getElementById('preview-canvas') || createFallbackCanvas();
const viewport = new Viewport(canvas);
const renderer = new RenderEngine(canvas, actorManager);
const paletteViewer = new PaletteViewer();
const levelStats = new LevelStats('level-stats');

logMessage('System Ready.', 'success');
updateHeaderStatus('Waiting for Data...');

// ─────────────────────────────────────────────────────────────────────────
// SIDEBAR CONTEXT MANAGER (NEW)
// ─────────────────────────────────────────────────────────────────────────
// Centralizes logic for which sidebar panels are visible

function updateSidebarContext(mode) {
    const actorPanel = document.getElementById('actor-controls-section');
    const levelPanel = document.getElementById('level-controls-section');
    
    // Safety check
    if (!actorPanel || !levelPanel) return;

    // 1. Reset: Hide ALL conditional panels first
    actorPanel.classList.add('hidden');
    levelPanel.classList.add('hidden');

    // 2. Enable specific panel based on mode
    switch (mode) {
        case 'ACTORS':
            actorPanel.classList.remove('hidden');
            actorPanel.classList.remove('collapsed'); 
            break;
            
        case 'MAP':
            levelPanel.classList.remove('hidden');
            levelPanel.classList.remove('collapsed');
            break;
            
        case 'ASSET':
        case 'SOUND':
        default:
            // Keep all hidden
            break;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ███████╗████████╗ █████╗ ████████╗███████╗
// ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝
// ███████╗   ██║   ███████║   ██║   █████╗  
// ╚════██║   ██║   ██╔══██║   ██║   ██╔══╝  
// ███████║   ██║   ██║  ██║   ██║   ███████╗
// ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝
// ═══════════════════════════════════════════════════════════════════════════════
// Central application state that tracks what's currently loaded and displayed.
// This object is passed around to different parts of the code so they can access
// the current map, tiles, sprites, and rendering settings.

let appState = {
    viewMode: 'map', 
    currentAsset: null, 
    solidTiles: [],
    maskedTiles: [],
    solidTileAttributes: [],
    maskedTileAttributes: [],
    currentMap: null,
    actorManager: actorManager,
    layers: { 
        showBackgroundTerrain: true,
        showForegroundTerrain: true,
        showSprites: true,
        showPlayer: true,
        showEnemies: true,
        showHazards: true,
        showBonuses: true,
        showPowerups: true,
        showKeys: true,
        showTech: true
    },
    difficulty: 0,  // 0 = Easy, 1 = Medium, 2 = Hard
    actorsAlwaysOnTop: false,
    hideBgGrid: false,
    useSolidBG: false,
    useGridFix: false,
    actorViewMode: 'dynamic',  // 'dynamic' or 'raw'
    actorSortMode: 'default',  // 'default', 'name', 'type', 'size'
    actorZoom: 1,               // 1, 2, or 4
    animationFiles: [],         // Animation files (.F1-.F5)
    activeBottomPanel: null    // 'music' or 'animation' - tracks which panel is visible
};

let lastTime = 0;

// ═══════════════════════════════════════════════════════════════════════════════
//  ██████╗ ██████╗ ██████╗ ███████╗    ██╗      ██████╗  ██████╗ ██████╗ 
// ██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██║     ██╔═══██╗██╔═══██╗██╔══██╗
// ██║     ██║   ██║██████╔╝█████╗      ██║     ██║   ██║██║   ██║██████╔╝
// ██║     ██║   ██║██╔══██╗██╔══╝      ██║     ██║   ██║██║   ██║██╔═══╝
// ╚██████╗╚██████╔╝██║  ██║███████╗    ███████╗╚██████╔╝╚██████╔╝██║     
//  ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝     
// ═══════════════════════════════════════════════════════════════════════════════
// The main rendering loop that continuously redraws the canvas.
// This function calls itself repeatedly using requestAnimationFrame to create
// smooth animation and update the display whenever the viewport or content changes.

function loop(timestamp) {
    // Calculate Delta Time (time since last frame in ms)
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // DEBUG: Log when assetType changes
    if (appState.assetType !== window.lastAssetType) {
        console.log('assetType changed from', window.lastAssetType, 'to', appState.assetType);
        window.lastAssetType = appState.assetType;
    }

    if (appState.assetType === 'animation') {
        // --- Animation Mode ---
        // 1. Clear Screen (Black background)
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 2. Update & Draw Animation
        animationPlayer.update(deltaTime);
        animationPlayer.draw(ctx, canvas.width, canvas.height);
    } else {
        // --- Standard Map/Asset Mode ---
        renderer.draw(appState, viewport);
    }
    
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ═══════════════════════════════════════════════════════════════════════════════
// ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ ███████╗
// ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗██╔════╝
// ███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝███████╗
// ██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║
// ██║  ██║███████╗███████╗██║     ███████╗██║  ██║███████║
// ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝
// ═══════════════════════════════════════════════════════════════════════════════
// Utility functions that support various operations throughout the application.

function createFallbackCanvas() {
    const c = document.createElement('canvas');
    c.id = 'preview-canvas';
    document.querySelector('.main-content').appendChild(c);
    return c;
}

function resetMainView() {
    const container = document.getElementById('data-view-container');
    const canvas = document.getElementById('preview-canvas');
    
    // Hide the grid, show the canvas
    if (container) container.style.display = 'none';
    if (canvas) {
        canvas.style.display = 'block';
        
        // Ensure internal resolution matches the screen size
        updateCanvasSize();
    }
}

// Show the little palette image next to the System Log
function displayPaletteBar(palData) {
    const canvas = document.getElementById('debug-canvas');
    if (!canvas || !palData || palData.length !== 48) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const colorWidth = width / 16;
    
    // Convert DN2 palette value (0-68) to RGB (0-255)
    function convertDN2ToRGB(dn2Value) {
        const vga6bit = Math.floor((dn2Value * 15) / 16);
        return Math.floor((vga6bit * 255) / 63);
    }
    
    // Parse and draw 16 colors
    for (let i = 0; i < 16; i++) {
        const offset = i * 3;
        const r = convertDN2ToRGB(palData[offset]);
        const g = convertDN2ToRGB(palData[offset + 1]);
        const b = convertDN2ToRGB(palData[offset + 2]);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(i * colorWidth, 0, colorWidth, height);
    }
}

function updateCanvasSize() {
    if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        renderer.setPixelated();
    }
}
updateCanvasSize();
window.addEventListener('resize', updateCanvasSize);

function handleFitZoom() {
    let contentW = 0;
    let contentH = 0;

    if (appState.viewMode === 'map' && appState.currentMap) {
        contentW = appState.currentMap.width * 8;
        contentH = appState.currentMap.height * 8;
    } else if (appState.viewMode === 'asset' && appState.currentAsset) {
        contentW = appState.currentAsset.image.width;
        contentH = appState.currentAsset.image.height;
    }

    if (contentW > 0 && contentH > 0) {
        const availW = canvas.width - 40;
        const availH = canvas.height - 40;
        const scale = Math.min(availW / contentW, availH / contentH);
        viewport.zoom = scale;
        
        if (appState.viewMode === 'map') {
            viewport.centerOn(appState.currentMap.width, appState.currentMap.height, 8, false);
        } else {
            viewport.centerOn(contentW / 8, contentH / 8, 8, false);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Actor Controls Helper Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Update actor controls panel state (enable/disable sort radios)
 */
function updateActorControls() {
    const isRaw = appState.actorViewMode === 'raw';
    
    // Disable/enable sort controls
    ['sort-default', 'sort-name', 'sort-type', 'sort-size'].forEach(id => {
        const label = document.getElementById(id);
        if (label) {
            if (isRaw) {
                label.classList.add('disabled');
            } else {
                label.classList.remove('disabled');
            }
        }
    });
    
    // Disable/enable scale controls
    ['scale-1x', 'scale-2x', 'scale-4x'].forEach(id => {
        const label = document.getElementById(id);
        if (label) {
            if (isRaw) {
                label.classList.add('disabled');
            } else {
                label.classList.remove('disabled');
            }
        }
    });
}

/**
 * Update zoom panel buttons based on current actor view mode
 */
function updateActorZoomPanel() {
    const zoomCtrl = document.querySelector('.zoom-controls');
    if (!zoomCtrl) return;

    // Only rebuild if we're actually in the actor viewer
    if (appState.assetType !== 'actors') return;
    
    const isRaw = appState.actorViewMode === 'raw';
    
    // HIDE zoom panel in Dynamic mode - controls are in sidebar
    if (!isRaw) {
        zoomCtrl.style.display = 'none';
        return;
    }

    // Rebuild zoom buttons based on mode
    if (isRaw) {
        // Raw mode: Fit, 1x, 2x, 4x
        zoomCtrl.innerHTML = `
            <button class="zoom-btn" id="zoom-fit">Fit</button>
            <button class="zoom-btn" id="zoom-1x">1x</button>
            <button class="zoom-btn" id="zoom-2x">2x</button>
            <button class="zoom-btn" id="zoom-4x">4x</button>
        `;
        
        // Attach handlers for raw mode
        document.getElementById('zoom-fit').onclick = handleFitZoom;
        document.getElementById('zoom-1x').onclick = () => viewport.zoom = 1.0;
        document.getElementById('zoom-2x').onclick = () => viewport.zoom = 2.0;
        document.getElementById('zoom-4x').onclick = () => viewport.zoom = 4.0;
    } else {
        // Dynamic mode: 1x, 2x, 4x only
        zoomCtrl.innerHTML = `
            <button class="zoom-btn" id="zoom-1x">1x</button>
            <button class="zoom-btn" id="zoom-2x">2x</button>
            <button class="zoom-btn" id="zoom-4x">4x</button>
        `;
        
        // Attach handlers for dynamic mode
        document.getElementById('zoom-1x').onclick = async () => {
            appState.actorZoom = 1;
            await renderActorView();
        };
        document.getElementById('zoom-2x').onclick = async () => {
            appState.actorZoom = 2;
            await renderActorView();
        };
        document.getElementById('zoom-4x').onclick = async () => {
            appState.actorZoom = 4;
            await renderActorView();
        };
    }
}

/**
 * Restore default zoom panel (for maps and other assets)
 */
function restoreDefaultZoomPanel() {
    const zoomCtrl = document.querySelector('.zoom-controls');
    if (!zoomCtrl) return;
    
    zoomCtrl.innerHTML = `
        <button class="zoom-btn" id="zoom-fit">Fit</button>
        <button class="zoom-btn" id="zoom-1x">1x</button>
        <button class="zoom-btn" id="zoom-2x">2x</button>
        <button class="zoom-btn" id="zoom-4x">4x</button>
    `;
    
    // Attach default handlers (for viewport)
    document.getElementById('zoom-fit').onclick = handleFitZoom;
    document.getElementById('zoom-1x').onclick = () => viewport.zoom = 1.0;
    document.getElementById('zoom-2x').onclick = () => viewport.zoom = 2.0;
    document.getElementById('zoom-4x').onclick = () => viewport.zoom = 4.0;
}

/**
 * Render the actor view (dynamic or raw)
 */
async function renderActorView() {
    const result = await actorManager.generateSpriteSheet(
        appState.actorViewMode,
        appState.actorSortMode,
        appState.actorZoom
    );
    
    if (!result) return;
    
    if (appState.actorViewMode === 'dynamic') {
        renderDynamicActorGrid(result);
    } else {
        // Raw mode - use canvas
        const container = document.getElementById('data-view-container');
        const canvas = document.getElementById('preview-canvas');
        container.style.display = 'none';
        canvas.style.display = 'block';
        
        appState.currentAsset = result;
        handleFitZoom();
    }
    
    updateActorControls();
    updateUIState();
    updateActorZoomPanel();
}

/**
 * Render dynamic actor grid (DOM-based)
 */
function renderDynamicActorGrid(data) {
    const container = document.getElementById('data-view-container');
    const canvas = document.getElementById('preview-canvas');
    
    // Hide canvas, show DOM container
    canvas.style.display = 'none';
    container.style.display = 'block';
    container.innerHTML = '';
    
    // Create grid
    const grid = document.createElement('div');
    grid.className = 'actor-grid';
    grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${80 * appState.actorZoom}px, 1fr))`;
    
    let currentType = null;
    
    for (const actor of data.actors) {
        // Add type header if sorting by type and type changes
        if (data.sortMode === 'type' && actor.type !== currentType) {
            currentType = actor.type;
            const header = document.createElement('div');
            header.className = 'type-header';
            const typeLabel = actor.type.charAt(0).toUpperCase() + actor.type.slice(1);
            header.innerHTML = `<h3>${typeLabel}</h3>`;
            grid.appendChild(header);
        }
        
        // Create actor cell
        const cell = createActorCell(actor);
        grid.appendChild(cell);
    }
    
    container.appendChild(grid);
}

/**
 * Show actor detail overlay
 */
function showActorDetail(actor) {
    const overlay = document.getElementById('actor-detail-overlay');
    const metaframeContainer = document.getElementById('detail-metaframe');
    const infoContainer = document.getElementById('detail-info');
    const framesContainer = document.getElementById('detail-frames');
    
    // Render metaframe at 2x
    metaframeContainer.innerHTML = '';
    const metaCanvas = document.createElement('canvas');
    metaCanvas.width = actor.metaframe.width * 2;
    metaCanvas.height = actor.metaframe.height * 2;
    const ctx = metaCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(actor.metaframe, 0, 0, metaCanvas.width, metaCanvas.height);
    metaframeContainer.appendChild(metaCanvas);
    
    // Render info
    infoContainer.innerHTML = `
        <h2>${actor.name}</h2>
        <div class="detail-info-row">
            <span class="detail-info-label">Actor Number:</span>
            <span class="detail-info-value">#${actor.actorNum}</span>
        </div>
        <div class="detail-info-row">
            <span class="detail-info-label">Type:</span>
            <span class="detail-info-value">${actor.type}</span>
        </div>
        <div class="detail-info-row">
            <span class="detail-info-label">Palette:</span>
            <span class="detail-info-value">${actor.palette}</span>
        </div>
    `;
    
    // Render all frames
    framesContainer.innerHTML = '';
    
    // Get all frames from the atlas
    const actorData = actorManager.actorAtlas.find(a => a.actorNum === actor.actorNum);
    if (actorData && actorData.frames) {
        infoContainer.innerHTML += `
            <div class="detail-info-row">
                <span class="detail-info-label">Frame Count:</span>
                <span class="detail-info-value">${actorData.frames.length}</span>
            </div>
        `;
        
        // Render each frame
        actorData.frames.forEach(async (frameData, i) => {
            const frameBmp = await actorManager.getSpriteBitmap(actor.actorNum, i);
            if (frameBmp && frameBmp.bitmap) {
                const frameCanvas = document.createElement('canvas');
                frameCanvas.width = frameBmp.bitmap.width;
                frameCanvas.height = frameBmp.bitmap.height;
                const fctx = frameCanvas.getContext('2d');
                fctx.drawImage(frameBmp.bitmap, 0, 0);
                framesContainer.appendChild(frameCanvas);
            }
        });
    }
    
    overlay.classList.add('active');
}

/**
 * Create an individual actor cell
 */
function createActorCell(actor) {
    const zoom = appState.actorZoom;
    
    const cell = document.createElement('div');
    cell.className = 'actor-cell';
    
    // Sprite container
    const spriteContainer = document.createElement('div');
    spriteContainer.className = 'actor-sprite';
    spriteContainer.style.width = `${64 * zoom}px`;
    spriteContainer.style.height = `${64 * zoom}px`;
    
    // Render metaframe canvas
    const canvas = document.createElement('canvas');
    canvas.width = actor.metaframe.width * zoom;
    canvas.height = actor.metaframe.height * zoom;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(actor.metaframe, 0, 0, canvas.width, canvas.height);
    
    // Check if sprite overflows container
    if (canvas.width > 64 * zoom || canvas.height > 64 * zoom) {
        spriteContainer.classList.add('overflow');
    }
    
    spriteContainer.appendChild(canvas);
    
    // Name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'actor-name';
    nameDiv.textContent = actor.name;
    
    // ID
    const idDiv = document.createElement('div');
    idDiv.className = 'actor-id';
    idDiv.textContent = `#${actor.actorNum}`;
    
    cell.appendChild(spriteContainer);
    cell.appendChild(nameDiv);
    cell.appendChild(idDiv);
    
    // Add click handler
    cell.addEventListener('click', () => {
        showActorDetail(actor);
    });

    return cell;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██╗   ██╗██╗    ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗ ███████╗███╗   ███╗███████╗███╗   ██╗████████╗
// ██║   ██║██║    ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝ ██╔════╝████╗ ████║██╔════╝████╗  ██║╚══██╔══╝
// ██║   ██║██║    ██╔████╔██║███████║██╔██╗ ██║███████║██║  ███╗█████╗  ██╔████╔██║█████╗  ██╔██╗ ██║   ██║   
// ██║   ██║██║    ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║   ██║██╔══╝  ██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║   
// ╚██████╔╝██║    ██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╔╝███████╗██║ ╚═╝ ██║███████╗██║ ╚████║   ██║   
//  ╚═════╝ ╚═╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝   
// ═══════════════════════════════════════════════════════════════════════════════
// Controls the visibility and behavior of UI panels (zoom controls, music controls).
// These functions decide when to show/hide the control panels based on what's loaded.

function updateUIState() {
    const zoomCtrl = document.querySelector('.zoom-controls');
    
    // Show zoom controls if we have any visual content (map or asset) loaded
    const hasVisuals = (appState.viewMode === 'map' && appState.currentMap) || 
                       (appState.viewMode === 'asset' && appState.currentAsset);
    
    if (zoomCtrl) {
        zoomCtrl.style.display = hasVisuals ? 'flex' : 'none';
    }

    // Show layer toggles only when viewing maps
    const layerToggles = document.querySelector(".layer-toggles");
    if (layerToggles) {
        layerToggles.style.display = (appState.viewMode === "map") ? "flex" : "none";
    }
	
	// Show View Mode checkboxes ONLY for Actor Sheet
    const viewToggles = document.querySelector(".view-toggles");
    if (viewToggles) {
        viewToggles.style.display = (appState.assetType === "actors") ? "flex" : "none";
    }

    // Handle bottom panel visibility (music/animation with swap button)
    updateBottomPanelVisibility();
}

function updateBottomPanelVisibility() {
    const musicCtrl = document.querySelector('.music-controls');
    const animCtrl = document.querySelector('.animation-controls');
    const swapBtn = document.querySelector('.panel-swap-btn');
    const swapLabel = document.getElementById('swap-label');
    
    const hasMusicPlaying = musicPlayer.isPlaying || musicPlayer.isPaused;
    const hasAnimationLoaded = appState.assetType === 'animation';
    
    // Both active: show swap button and respect activeBottomPanel state
    if (hasMusicPlaying && hasAnimationLoaded) {
        // Set default if not already set
        if (!appState.activeBottomPanel) {
            appState.activeBottomPanel = 'animation'; // Default to animation
        }
        
        // Show appropriate panel
        if (musicCtrl) musicCtrl.style.display = appState.activeBottomPanel === 'music' ? 'flex' : 'none';
        if (animCtrl) animCtrl.style.display = appState.activeBottomPanel === 'animation' ? 'flex' : 'none';
        
        // Show swap button with correct label
        if (swapBtn) {
            swapBtn.style.display = 'flex';
            if (swapLabel) {
                swapLabel.textContent = appState.activeBottomPanel === 'music' ? 'Animation' : 'Music';
            }
        }
    }
    // Only music active
    else if (hasMusicPlaying && !hasAnimationLoaded) {
        if (musicCtrl) musicCtrl.style.display = 'flex';
        if (animCtrl) animCtrl.style.display = 'none';
        if (swapBtn) swapBtn.style.display = 'none';
    }
    // Only animation active
    else if (!hasMusicPlaying && hasAnimationLoaded) {
        if (musicCtrl) musicCtrl.style.display = 'none';
        if (animCtrl) animCtrl.style.display = 'flex';
        if (swapBtn) swapBtn.style.display = 'none';
    }
    // Neither active
    else {
        if (musicCtrl) musicCtrl.style.display = 'none';
        if (animCtrl) animCtrl.style.display = 'none';
        if (swapBtn) swapBtn.style.display = 'none';
        appState.activeBottomPanel = null;
    }
}

function toggleControls(mode) {
    const zoomCtrl = document.querySelector('.zoom-controls');
    
    // Only handle zoom controls here; bottom panels handled by updateBottomPanelVisibility
    if (zoomCtrl) {
        zoomCtrl.style.display = mode === 'zoom' ? 'flex' : 'none';
    }
}

function updateMusicUI(trackName, isPlaying) {
    const nameLabel = document.getElementById('music-track-name');
    const playBtn = document.getElementById('music-play-pause');
    
    if (nameLabel) nameLabel.textContent = trackName;
    if (playBtn) playBtn.textContent = isPlaying ? "⏸" : "▶️";
}

function toggleBottomPanel() {
    const musicCtrl = document.querySelector('.music-controls');
    const animCtrl = document.querySelector('.animation-controls');
    
    // Toggle between music and animation
    if (appState.activeBottomPanel === 'music') {
        appState.activeBottomPanel = 'animation';
    } else {
        appState.activeBottomPanel = 'music';
    }
    
    // Update visibility
    updateBottomPanelVisibility();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██╗   ██╗██╗     ██████╗ ██████╗ ███╗   ██╗████████╗██████╗  ██████╗ ██╗     ███████╗
// ██║   ██║██║    ██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗██║     ██╔════╝
// ██║   ██║██║    ██║     ██║   ██║██╔██╗ ██║   ██║   ██████╔╝██║   ██║██║     ███████╗
// ██║   ██║██║    ██║     ██║   ██║██║╚██╗██║   ██║   ██╔══██╗██║   ██║██║     ╚════██║
// ╚██████╔╝██║    ╚██████╗╚██████╔╝██║ ╚████║   ██║   ██║  ██║╚██████╔╝███████╗███████║
//  ╚═════╝ ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝
// ═══════════════════════════════════════════════════════════════════════════════
// Creates and initializes the on-screen control panels (zoom buttons, music player).
// This section builds the HTML elements and wires up their event handlers.

function initControls() {
    const container = document.querySelector('.main-content');
    if (!container) return;

    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ZOOM CONTROLS (Top-Right Panel)
    // ─────────────────────────────────────────────────────────────────────────
    if (!document.querySelector('.zoom-controls')) {
        const div = document.createElement('div');
        div.className = 'zoom-controls';
        
        div.innerHTML = `
            <button class="zoom-btn" id="zoom-fit">Fit</button>
            <button class="zoom-btn" id="zoom-1x">1x</button>
            <button class="zoom-btn" id="zoom-2x">2x</button>
            <button class="zoom-btn" id="zoom-4x">4x</button>
            
            <div class="layer-toggles">
                <label><input type="checkbox" id="chk-map" checked> Map</label>
                <label><input type="checkbox" id="chk-sprites" checked> Sprites</label>
            </div>

        `;
        container.appendChild(div);
        
        // Existing Zoom Handlers
        document.getElementById('zoom-fit').onclick = handleFitZoom; 
        document.getElementById('zoom-1x').onclick = () => viewport.zoom = 1.0;
        document.getElementById('zoom-2x').onclick = () => viewport.zoom = 2.0;
        document.getElementById('zoom-4x').onclick = () => viewport.zoom = 4.0;
        document.getElementById('chk-map').onchange = (e) => appState.layers.showMap = e.target.checked;
        document.getElementById('chk-sprites').onchange = (e) => appState.layers.showSprites = e.target.checked;
              
        // Actor View Mode Handler
        document.querySelectorAll('input[name="actorView"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                appState.actorViewMode = e.target.value;
                await renderActorView();
            });
        });

        // Actor Scale Handler
        document.querySelectorAll('input[name="actorScale"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                appState.actorZoom = parseInt(e.target.value);
                await renderActorView();
            });
        });

        // Actor Sort Mode Handler
        document.querySelectorAll('input[name="actorSort"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                appState.actorSortMode = e.target.value;
                await renderActorView();
            });
        });

        // ─────────────────────────────────────────────────────────────────────
        // LEVEL LAYER CONTROLS
        // ─────────────────────────────────────────────────────────────────────
        // Wire up terrain and actor visibility toggles
        
        const actorsCheckbox = document.getElementById('layer-actors');
        
        // Type-specific checkboxes
        const typeCheckboxes = [
            document.getElementById('layer-player'),
            document.getElementById('layer-enemies'),
            document.getElementById('layer-hazards'),
            document.getElementById('layer-bonuses'),
            document.getElementById('layer-powerups'),
            document.getElementById('layer-keys'),
            document.getElementById('layer-tech')
        ];
        
        // Background terrain toggle
        const bgTerrainCheckbox = document.getElementById('layer-bg-terrain');
        if (bgTerrainCheckbox) {
            bgTerrainCheckbox.addEventListener('change', (e) => {
                appState.layers.showBackgroundTerrain = e.target.checked;
            });
        }
        
        // Foreground terrain toggle
        const fgTerrainCheckbox = document.getElementById('layer-fg-terrain');
        if (fgTerrainCheckbox) {
            fgTerrainCheckbox.addEventListener('change', (e) => {
                appState.layers.showForegroundTerrain = e.target.checked;
            });
        }
        
        // Actors master toggle
        if (actorsCheckbox) {
            actorsCheckbox.addEventListener('change', (e) => {
                appState.layers.showSprites = e.target.checked;
                
                // Enable/disable type-specific checkboxes
                typeCheckboxes.forEach(checkbox => {
                    if (checkbox) {
                        checkbox.disabled = !e.target.checked;
                        checkbox.parentElement.classList.toggle('disabled', !e.target.checked);
                    }
                });
            });
        }
        
        // Type-specific toggles
        if (document.getElementById('layer-player')) {
            document.getElementById('layer-player').addEventListener('change', (e) => {
                appState.layers.showPlayer = e.target.checked;
            });
        }
        
        if (document.getElementById('layer-enemies')) {
            document.getElementById('layer-enemies').addEventListener('change', (e) => {
                appState.layers.showEnemies = e.target.checked;
            });
        }
        
        if (document.getElementById('layer-hazards')) {
            document.getElementById('layer-hazards').addEventListener('change', (e) => {
                appState.layers.showHazards = e.target.checked;
            });
        }
        
        if (document.getElementById('layer-bonuses')) {
            document.getElementById('layer-bonuses').addEventListener('change', (e) => {
                appState.layers.showBonuses = e.target.checked;
            });
        }
        
        if (document.getElementById('layer-powerups')) {
            document.getElementById('layer-powerups').addEventListener('change', (e) => {
                appState.layers.showPowerups = e.target.checked;
            });
        }
        
        if (document.getElementById('layer-keys')) {
            document.getElementById('layer-keys').addEventListener('change', (e) => {
                appState.layers.showKeys = e.target.checked;
            });
        }
        
        if (document.getElementById('layer-tech')) {
            document.getElementById('layer-tech').addEventListener('change', (e) => {
                appState.layers.showTech = e.target.checked;
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // DIFFICULTY FILTER
        // ─────────────────────────────────────────────────────────────────────
        
        document.querySelectorAll('input[name="difficulty"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                appState.difficulty = parseInt(e.target.value);
                
                // Update level stats to reflect difficulty change
                if (appState.currentMap && appState.viewMode === 'map') {
                    levelStats.update(appState.currentMap, actorManager, appState.difficulty);
                }
            });
        });
    }

    // Actors Always on Top checkbox
        const actorsOnTopCheckbox = document.getElementById('actors-always-on-top');
        if (actorsOnTopCheckbox) {
            actorsOnTopCheckbox.addEventListener('change', (e) => {
                appState.actorsAlwaysOnTop = e.target.checked;
            });
        }
    
    // Hide BG Grid checkbox
        const hideBgGridCheckbox = document.getElementById('hide-bg-grid');
        if (hideBgGridCheckbox) {
            hideBgGridCheckbox.addEventListener('change', (e) => {
                appState.hideBgGrid = e.target.checked;
                
                // Re-render the level with the new setting
                if (appState.currentMap) {
                    renderer.preRender(
                        appState.currentMap,
                        {
                            solidTiles: appState.solidTiles,
                            maskedTiles: appState.maskedTiles,
                            solidTileAttributes: appState.solidTileAttributes,
                            maskedTileAttributes: appState.maskedTileAttributes
                        },
                        appState.useGridFix,
                        appState.hideBgGrid
                    );
                }
            });
        }

    // ─────────────────────────────────────────────────────────────────────────
    // MUSIC CONTROLS (Bottom-Center Panel)
    // ─────────────────────────────────────────────────────────────────────────
    // Provides play/pause/stop buttons and volume control for music playback

    if (!document.querySelector('.music-controls')) {
        const musicDiv = document.createElement('div');
        musicDiv.className = 'music-controls';
        musicDiv.innerHTML = `
            <div class="track-info">
                <span class="track-label">Now Playing</span>
                <span id="music-track-name" class="track-name">Unknown</span>
            </div>
            <div class="divider"></div>
            <button id="music-play-pause">⏸</button>
            <button id="music-stop">⏹</button>
            <div class="volume-group">
                <span>Vol</span>
                <input type="range" id="music-vol" min="0" max="100" value="70">
            </div>
        `;
        container.appendChild(musicDiv);

        document.getElementById('music-play-pause').onclick = () => {
            // Normal pause/resume
            const isPaused = musicPlayer.togglePause();
            document.getElementById('music-play-pause').textContent = isPaused ? "▶️" : "⏸";
        };

        document.getElementById('music-stop').onclick = () => {
            musicPlayer.stop();
            updateMusicUI("Stopped", false);
            
            if (typeof stopTimer !== 'undefined' && stopTimer) clearTimeout(stopTimer);
            stopTimer = setTimeout(() => {
				if (!musicPlayer.isPlaying) {
					// Let updateUIState decide what to show based on current view
					updateUIState();
				}
			}, 3000);
        };

        document.getElementById('music-vol').oninput = (e) => {
            musicPlayer.setVolume(e.target.value / 100);
        };
    }
}

// ═════════════════════════════════════════════════════════════════════════
// PANEL SWAP BUTTON (for when both music and animation are active)
// ═════════════════════════════════════════════════════════════════════════

function createPanelSwapButton() {
    if (document.querySelector('.panel-swap-btn')) return; // Already exists
    
    const swapBtn = document.createElement('div');
    swapBtn.className = 'panel-swap-btn';
    
    const icon = document.createElement('span');
    icon.className = 'swap-icon';
    icon.textContent = '🔄';
    
    const label = document.createElement('span');
    label.className = 'swap-label';
    label.id = 'swap-label';
    label.textContent = 'Animation';
    
    swapBtn.appendChild(icon);
    swapBtn.appendChild(label);
    
    swapBtn.addEventListener('click', () => {
        toggleBottomPanel();
    });
    
    const mainContent = document.querySelector('.main-content');
    mainContent.appendChild(swapBtn);
}

// Call this on page load
createPanelSwapButton();

	// ─────────────────────────────────────────────────────────────────────────
    // ADLIB/PC SPEAKER SOUNDBOARD CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    // Provides the soundboard interface for playing back PC Speaker / Adlib sounds

function renderSoundBoard(sounds) {
    const container = document.getElementById('data-view-container');
    const canvas = document.getElementById('preview-canvas');
    
	
	
    // Hide Canvas, Show Container
    canvas.style.display = 'none';
    container.style.display = 'grid';
    container.innerHTML = '';
    
    // Add grid class
    container.className = 'sound-grid-container';

    sounds.forEach((snd, index) => {
        const btn = document.createElement('button');
        btn.className = 'sound-card';
        
        btn.innerHTML = `
            <span class="sound-number">#${index}</span>
            <span class="sound-size">${snd.size} bytes</span>
        `;
        
        btn.onclick = () => {
            // Flash effect using CSS class
            btn.classList.add('playing');
            setTimeout(() => {
                btn.classList.remove('playing');
            }, 150);
            updateHeaderStatus(`🔊 Playing: <strong>${snd.name || `Sound #${index}`}</strong>`, true);
			
            // FIX 2: Pause Music (if playing) before playing SFX
            if (musicPlayer.isPlaying && !musicPlayer.isPaused) {
                musicPlayer.togglePause();
                
                // Update UI to show "Resume" button
                const currentTrackName = document.getElementById('music-track-name').textContent;
                updateMusicUI(currentTrackName, false);
            }
            
            // Play the sound (defaulting to AdLib for now)
            soundManager.play(snd.id, 'adlib');
        };
        
        container.appendChild(btn);
    });
}

function playSound(index) {
    // Resume audio context if suspended
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    // Determine type based on sound data inspection
    soundManager.play(index);
}

initControls();

// ═══════════════════════════════════════════════════════════════════════════════
//  █████╗ ███████╗███████╗███████╗████████╗    ██╗      ██████╗  █████╗ ██████╗ ██╗███╗   ██╗ ██████╗ 
// ██╔══██╗██╔════╝██╔════╝██╔════╝╚══██╔══╝    ██║     ██╔═══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔════╝ 
// ███████║███████╗███████╗█████╗     ██║       ██║     ██║   ██║███████║██║  ██║██║██╔██╗ ██║██║  ███╗
// ██╔══██║╚════██║╚════██║██╔══╝     ██║       ██║     ██║   ██║██╔══██║██║  ██║██║██║╚██╗██║██║   ██║
// ██║  ██║███████║███████║███████╗   ██║       ███████╗╚██████╔╝██║  ██║██████╔╝██║██║ ╚████║╚██████╔╝
// ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝       ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ 
// ═══════════════════════════════════════════════════════════════════════════════
// Functions that load and prepare different types of game assets for display.

// ─────────────────────────────────────────────────────────────────────────
// LEVEL LOADER
// ─────────────────────────────────────────────────────────────────────────
// Loads a game level/map file and all its associated tiles and sprites

async function loadLevel(filename) {
    try {
        
        // Clean up animation player
        animationPlayer.destroy();

        console.log(`Loading Level: ${filename}`);
        logMessage(`Loaded Level: ${filename}`, 'success');
		
		const levelData = fs.getFile(filename);
        if (!levelData) throw new Error("File missing");

		// --- Reset View to Canvas ---
        resetMainView();
		
		// Show Zoom controls
        toggleControls('zoom');

        restoreDefaultZoomPanel();

        // REFACTORED: Use Context Manager
        updateSidebarContext('MAP');

        appState.viewMode = 'map';
        appState.assetType = null;
		appState.currentMap = mapParser.parse(levelData);
        
        const czoneName = appState.currentMap.czone;
        const rawZone = fs.getFile(czoneName);
        if (rawZone) {
            appState.solidTiles = [];
            appState.maskedTiles = [];
            appState.solidTileAttributes = [];
            appState.maskedTileAttributes = [];
            
            // Parse tile attributes (offset 0, 1000 solid + 160 masked tiles)
            // Each attribute is 2 bytes (UINT16LE)
            const attributeView = new DataView(rawZone.buffer, rawZone.byteOffset, 3600);
            
            // Parse solid tile attributes (first 1000 tiles = 2000 bytes)
            for (let i = 0; i < 1000; i++) {
                const attrOffset = i * 2;
                const attribute = attributeView.getUint16(attrOffset, true);
                appState.solidTileAttributes[i] = attribute;
            }
            
            // Parse masked tile attributes (next 800 bytes = 160 tiles × 5 values × 2 bytes)
            // Only the first value per tile is used
            for (let i = 0; i < 160; i++) {
                const attrOffset = 2000 + (i * 10); // 2000 bytes for solid tiles, then 10 bytes per masked tile
                const attribute = attributeView.getUint16(attrOffset, true); // Little-endian
                appState.maskedTileAttributes[i] = attribute;
            }
            
            console.log(`Loaded ${appState.solidTileAttributes.length} solid tile attributes`);
            console.log(`Loaded ${appState.maskedTileAttributes.length} masked tile attributes`);
            
            const solidData = rawZone.subarray(3600);
            for (let i = 0; i < 1000; i++) {
                const img = assets.decodeTile(solidData, i, 'solid_czone', 0);
                if (img) appState.solidTiles[i] = await createImageBitmap(img);
            }
            
            const maskedData = rawZone.subarray(3600 + 32000);
            for (let i = 0; i < 160; i++) {
                const img = assets.decodeTile(maskedData, i, 'masked', 0);
                if (img) appState.maskedTiles[i] = await createImageBitmap(img);
            }
            
            console.log(`Loaded ${appState.maskedTileAttributes.length} masked tile attributes`);
        }

        if (appState.currentMap.actors) {
            const ids = [...new Set(appState.currentMap.actors.map(a => a.id))];
            ids.forEach(id => actorManager.requestSprite(id));
        }

        renderer.preRender(
            appState.currentMap, 
            { 
                solidTiles: appState.solidTiles, 
                maskedTiles: appState.maskedTiles,
                solidTileAttributes: appState.solidTileAttributes,
                maskedTileAttributes: appState.maskedTileAttributes
            }, 
            appState.useGridFix,
            appState.hideBgGrid
        );
        renderer.requestSpecialSprites(mapParser);
        handleFitZoom();
        updateUIState();
        
        // Update level statistics panel
        await levelStats.update(appState.currentMap, actorManager, appState.difficulty);

		// Enhanced header status
        const actorCount = appState.currentMap.actors.length;
		const dimensions = `${appState.currentMap.width}×${appState.currentMap.height}`;
		const czone = appState.currentMap.czone;

		updateHeaderStatus(
			`<strong>${filename}</strong> | ${dimensions} | ` +
			`${actorCount} actors | Tileset: ${czone}`
		);
		
    } catch (err) {
        console.error(err);
    }
}

// ═════════════════════════════════════════════════════════════════════════
// ANIMATION LOADER
// ═════════════════════════════════════════════════════════════════════════
// REPLACE THE EXISTING loadAnimation FUNCTION IN main.js WITH THIS:

async function loadAnimation(file) {
    try {
        // 1. Reset Global UI State
        levelStats.hide();
        animationPlayer.destroy(); // Cleanup previous animation/UI
        
        // 2. Set App State
        appState.viewMode = 'asset';
        appState.assetType = 'animation'; 
        appState.currentAsset = null; // Important: Clear previous asset so UI doesn't think we are viewing a generic image
        
        // 3. Load Data via AssetManager
        const buffer = await file.arrayBuffer();
        const data = await assets.loadAnimation(buffer);
        
        // 4. Initialize Player
        animationPlayer.load(data);
        
        // 5. Add Player UI to Screen
        const mainContent = document.querySelector('.main-content');
        mainContent.appendChild(animationPlayer.createControlPanel());
        
        // 6. Viewport & Control Cleanup
        resetMainView();
        
        // HIDE the standard floating zoom controls (The player has its own now)
        toggleControls('none'); 
        
        // HIDE sidebar panels (Level Controls, Actor Controls)
        updateSidebarContext('ASSET'); 
        
        // [NEW] Add System Log Entry
        logMessage(`Loaded Animation: ${file.name}`, 'success');

        updateHeaderStatus(`🎬 Animation: <strong>${file.name}</strong>`);
        updateUIState();
        
    } catch (err) {
        logMessage(`Error loading animation: ${err.message}`, 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// ASSET LOADER
// ─────────────────────────────────────────────────────────────────────────
// Loads individual assets like graphics, music, and sound effects based on
// file type. Handles .IMF music files, VOC sound effects, and various graphic formats.

async function loadAsset(filename) {
    console.log(`Loading Asset: ${filename}`);

	try {
        const upper = filename.toUpperCase();
        const rawFile = fs.getFile(filename);
        
        if (!rawFile) return;
        
        // Don't clean up animation or clear assetType for music/SFX - they play in background
        if (!upper.endsWith(".IMF") && !upper.startsWith("SB_") && !upper.startsWith("INTRO")) {
            animationPlayer.destroy();
            appState.assetType = null;
        }
        
        if (!rawFile) return;

        // ─────────────────────────────────────────────────────────────────────
        // MUSIC HANDLER (.IMF files)
        // ─────────────────────────────────────────────────────────────────────
        // Plays AdLib music files in the background

        if (upper.endsWith(".IMF")) {
            console.log("🎵 Music starting. Current assetType:", appState.assetType);
            console.log("Playing AdLib Music...");
            
            updateHeaderStatus(`🎵 Playing Music: <strong>${filename}</strong>`, true);
            
			updateMusicUI(filename, true);
            await musicPlayer.playImf(rawFile, filename);
            updateUIState();
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // SOUND EFFECTS HANDLER (VOC files)
        // ─────────────────────────────────────────────────────────────────────
        // Plays short sound effect files

        if (upper.startsWith("SB_") || upper.startsWith("INTRO")) {
            // Change: Pause music instead of stopping it
            if (musicPlayer.isPlaying && !musicPlayer.isPaused) {
                musicPlayer.togglePause();
                
                // Update the Play/Pause button to show "Resume" icon (▶️)
                // We grab the current name from the label so it doesn't disappear
                const currentTrackName = document.getElementById('music-track-name').textContent;
                updateMusicUI(currentTrackName, false); 
            }
            
            restoreDefaultZoomPanel();

            // REFACTORED: Use Context Manager
            updateSidebarContext('SOUND');

            // Play the sound effect
            logMessage(`▶️ Playing: ${filename}`, 'success');
			updateHeaderStatus(`🔊 Playing Sound: <strong>${filename}</strong>`, true);
			await audioPlayer.playVoc(rawFile);
            return;
			
        }

		// ─────────────────────────────────────────────────────────────────────
        // SOUND EFFECTS HANDLER (AUDIOHED / AUDIOT files)
        // ─────────────────────────────────────────────────────────────────────
        // Plays short Adlib and PC Speaker sound effect files
				if (upper === "AUDIOHED.MNI" || upper === "AUDIOT.MNI") {
            const headData = fs.getFile("AUDIOHED.MNI");
            const bodyData = fs.getFile("AUDIOT.MNI");
            			
            if (headData && bodyData) {
                // FIX 1: Don't stop music, just switch view
                // musicPlayer.stop(); <--- Removed
                
                // Clear any previous visual asset
                appState.currentAsset = null;
                appState.viewMode = 'soundboard';
                levelStats.hide();

                const sounds = soundManager.load(headData, bodyData);
                renderSoundBoard(sounds);
                
				updateHeaderStatus(`🎮 Sound Board: <strong>${sounds.length} Sounds</strong>`);
				
                restoreDefaultZoomPanel();

                // REFACTORED: Use Context Manager
                updateSidebarContext('SOUND');

                // Update UI: Hides Zoom (no visuals), Keeps Music (if playing)
                updateUIState(); 
            } else {
                console.error("Missing AUDIOHED.MNI or AUDIOT.MNI pair.");
            }
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // LCR.MNI HANDLER (256-Color Fullscreen Image)
        // ─────────────────────────────────────────────────────────────────────
        // Special handler for LCR.MNI which contains its own 256-color palette
        
        if (upper === "LCR.MNI" && rawFile.length === 64768) {
            appState.viewMode = 'asset';
            levelStats.hide();
            
            // Extract palette (first 768 bytes)
            const paletteData = rawFile.slice(0, 768);
            
            // Extract image data (remaining 64000 bytes = 320x200 pixels)
            const imageData = rawFile.slice(768);
            
            // Decode the 256-color image
            const img = await assets.decode256ColorImage(imageData, paletteData);
            if (img) {
                appState.currentAsset = { image: img, layout: null };
                handleFitZoom();
            }
            logMessage(`Displaying 256-Color Image: ${filename}`, 'success');
            updateHeaderStatus(`🖼️ Viewing 256-Color Image: <strong>${filename}</strong>`);
            
            restoreDefaultZoomPanel();
            resetMainView();
            toggleControls('zoom');
            updateSidebarContext('ASSET');
            updateUIState();
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // B800 TEXT HANDLER (DOS Text Mode Screens)
        // ─────────────────────────────────────────────────────────────────────
        // Displays 80x25 text mode screens (4000 bytes)
        
        if (rawFile.length === 4000) {
            appState.viewMode = 'asset';
            levelStats.hide();
            
            const img = await assets.decodeB800Text(rawFile);
            if (img) {
                appState.currentAsset = { image: img, layout: null };
                handleFitZoom();
            }
            logMessage(`Displaying B800 Text: ${filename}`, 'success');
            updateHeaderStatus(`📄 Viewing Text Screen: <strong>${filename}</strong>`);
            
            restoreDefaultZoomPanel();
            resetMainView();
            toggleControls('zoom');
            updateSidebarContext('ASSET');
            updateUIState();
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // GAME SCRIPT HANDLER (TEXT.MNI, OPTIONS.MNI, etc)
        // ─────────────────────────────────────────────────────────────────────
        // Displays Duke Nukem 2 script files with syntax highlighting
        
        if (upper === 'TEXT.MNI' || upper === 'OPTIONS.MNI' || upper === 'HELP.MNI' || upper === 'ORDERTXT.MNI') {
            appState.viewMode = 'data';
            levelStats.hide();
            
            const highlightedHTML = assets.parseGameScript(rawFile);
            
            // Create viewer element
            const viewer = document.createElement('pre');
            viewer.className = 'script-viewer';
            viewer.innerHTML = highlightedHTML;
            
            // Display in data view container
            const container = document.getElementById('data-view-container');
            const canvas = document.getElementById('preview-canvas');
            
            if (container && canvas) {
                canvas.style.display = 'none';
                container.style.display = 'block';
                container.innerHTML = '';
                container.appendChild(viewer);
            }
            
            logMessage(`Displaying Script: ${filename}`, 'success');
            updateHeaderStatus(`📜 Viewing Script: <strong>${filename}</strong>`);
            
            toggleControls('none');
            updateSidebarContext('ASSET');
            updateUIState();
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // FULLSCREEN IMAGE HANDLER
        // ─────────────────────────────────────────────────────────────────────
        // Displays fullscreen images (32048 bytes = 320x200 pixels)

        if (rawFile.length === 32048) {
            appState.viewMode = 'asset';
            levelStats.hide();
            const img = await assets.decodeFullScreenImage(rawFile);
            if (img) {
                appState.currentAsset = { image: img, layout: null };
                handleFitZoom();
            }
			logMessage(`Displaying Image: ${filename}`, 'success');
			updateHeaderStatus(`🖼️ Viewing Image: <strong>${filename}</strong>`);
			
            restoreDefaultZoomPanel();

			// --- Reset View to Canvas ---
			resetMainView();
		
			// Show Zoom controls
			toggleControls('zoom');

            // REFACTORED: Use Context Manager
            updateSidebarContext('ASSET');
			
            updateUIState();
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // ACTOR SPRITE SHEET HANDLER
        // ─────────────────────────────────────────────────────────────────────
        // Generates a sprite sheet showing all actor/enemy graphics

        if (upper === "ACTORS.MNI") {
            appState.viewMode = 'asset';
            levelStats.hide();
            appState.assetType = 'actors';
            appState.actorViewMode = 'dynamic';
            appState.actorSortMode = 'default';
            appState.actorZoom = 1;
            
            // REFACTORED: Use Context Manager
            updateSidebarContext('ACTORS');
            
            // Reset radio buttons
            const dynamicRadio = document.querySelector('input[name="actorView"][value="dynamic"]');
            if (dynamicRadio) dynamicRadio.checked = true;
            
            const defaultSortRadio = document.querySelector('input[name="actorSort"][value="default"]');
            if (defaultSortRadio) defaultSortRadio.checked = true;
            
            logMessage(`Displaying Sprites: ${filename}`, 'success');
            updateHeaderStatus(`👾 Actor Sprites: <strong>${actorManager.getActorCount()} Types</strong>`);
            
            resetMainView();
            toggleControls('zoom');
            
            await renderActorView();
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // CZONE TILESET HANDLER
        // ─────────────────────────────────────────────────────────────────────
        // Displays all tiles from a CZONE file as a grid

        else if (upper.includes("CZONE")) {
            appState.viewMode = 'asset';
            levelStats.hide();
            if (rawFile) {
                const sheet = await assets.generateCZoneSheet(rawFile);
                if (sheet) {
                    appState.currentAsset = { image: sheet, layout: null }; 
                    handleFitZoom();
                }
            }
            logMessage(`Displaying Tileset: ${filename}`, 'success');
			updateHeaderStatus(`🎨 Viewing Tileset: <strong>${filename}</strong>`);
			
			// --- Reset View to Canvas ---
			resetMainView();
		
			// Show Zoom controls
			toggleControls('zoom');
			
            restoreDefaultZoomPanel();

            // REFACTORED: Use Context Manager
            updateSidebarContext('ASSET');

			updateUIState();
        }
        
        // ─────────────────────────────────────────────────────────────────────
		// BACKDROP/DROP/STATUS TILESET HANDLER  
		// ─────────────────────────────────────────────────────────────────────
		// Handles backdrop images and status bar graphics
		else if (upper.startsWith("BACKDRP") || upper.startsWith("DROP") || upper === "STATUS.MNI") {
			appState.viewMode = 'asset';
            levelStats.hide();
			if (rawFile) {
				// All these files use 4-plane solid tiles (32 bytes per tile)
				const bytesPerTile = 32;
				const count = Math.floor(rawFile.length / bytesPerTile);
				const cols = 40; 
				const sheet = await assets.generateTilesetImage(rawFile, 0, count, 'solid_local', cols);
				if (sheet) {
					appState.currentAsset = { image: sheet, layout: null }; 
					handleFitZoom();
				}
			}
			logMessage(`Displaying Backdrop: ${filename}`, 'success');
			updateHeaderStatus(`🌆 Viewing Backdrop: <strong>${filename}</strong>`);
			
			// --- Reset View to Canvas ---
			resetMainView();
		
			// Show Zoom controls
			toggleControls('zoom');
			
            restoreDefaultZoomPanel();

            // REFACTORED: Use Context Manager
            updateSidebarContext('ASSET');

			updateUIState();
		}
		
	// ─────────────────────────────────────────────────────────────────────
    // PALETTE FILE HANDLER (.PAL)
    // ─────────────────────────────────────────────────────────────────────
    // Displays Duke Nukem 2 palette files as color bars and grids
    else if (upper.endsWith(".PAL")) {
        appState.viewMode = 'data';
        levelStats.hide();
    
        // Allow 48, 768, OR 64768 bytes
        if (rawFile && (rawFile.length === 48 || rawFile.length === 768 || rawFile.length === 64768)) {
            
            // Create the palette viewer UI
            const viewerElement = paletteViewer.createViewer(rawFile, filename);
        
            // Display in data view container
            const container = document.getElementById('data-view-container');
            const canvas = document.getElementById('preview-canvas');
        
            if (container && canvas) {
                canvas.style.display = 'none';
                container.style.display = 'block';
                container.innerHTML = '';
                container.appendChild(viewerElement);
            }
        
            logMessage(`Displaying Palette: ${filename}`, 'success');
            
            // Customize header status based on file type
            if (rawFile.length === 48) {
                updateHeaderStatus(`🎨 Palette: <strong>${filename}</strong> (16 colors)`);
            } else {
                updateHeaderStatus(`🎨 Palette: <strong>${filename}</strong> (256 colors)`);
            }
        
            // Hide zoom controls for palette view
            toggleControls('none');
            
            // REFACTORED: Use Context Manager
            updateSidebarContext('PALETTE');
            
            updateUIState();

            restoreDefaultZoomPanel();

        } else {
            logMessage(`Invalid palette file: ${filename} (Size mismatch)`, 'error');
        }
    }
		
    } catch (err) {
        console.error(err);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ███████╗██╗   ██╗███████╗███╗   ██╗████████╗    ██╗  ██╗ █████╗ ███╗   ██╗██████╗ ██╗     ███████╗██████╗ ███████╗
// ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝    ██║  ██║██╔══██╗████╗  ██║██╔══██╗██║     ██╔════╝██╔══██╗██╔════╝
// █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║       ███████║███████║██╔██╗ ██║██║  ██║██║     █████╗  ██████╔╝███████╗
// ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║       ██╔══██║██╔══██║██║╚██╗██║██║  ██║██║     ██╔══╝  ██╔══██╗╚════██║
// ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║       ██║  ██║██║  ██║██║ ╚████║██████╔╝███████╗███████╗██║  ██║███████║
// ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝       ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝
// ═══════════════════════════════════════════════════════════════════════════════
// Event handlers that respond to user interactions with the interface.

// ─────────────────────────────────────────────────────────────────────────
// FILE LIST SELECTION
// ─────────────────────────────────────────────────────────────────────────
// Triggered when user clicks on a file in the sidebar list

ui.onItemSelect = (filename, type) => {
    if (type === 'level') loadLevel(filename);
    else if (type === 'animation') loadAnimation(filename);
    else loadAsset(filename);
};

// ─────────────────────────────────────────────────────────────────────────
// FILE INPUT BUTTON
// ─────────────────────────────────────────────────────────────────────────
// Handles the file selection dialog for loading CMP archives

const fileInput = document.getElementById('folder-input');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        // Find CMP file
        const cmpFile = files.find(f => f.name.toUpperCase().endsWith('.CMP'));
        
        if (!cmpFile) {
            logMessage('No .CMP file found in selected folder', 'error');
            return;
        }
        
        // Find animation files (.F1 through .F5)
        const animFiles = files.filter(f => {
            const name = f.name.toUpperCase();
            return name.match(/\.F[1-5]$/);
        });
        
        // Store animation files in appState
        appState.animationFiles = animFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        // Process the CMP file
        handleFileSelection(cmpFile);
    });
}

// ─────────────────────────────────────────────────────────────────────────
// DRAG & DROP SUPPORT
// ─────────────────────────────────────────────────────────────────────────
// Allows users to drag and drop CMP files onto the page to load them

document.body.addEventListener('dragover', e => e.preventDefault());
document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelection(file);
});

// ─────────────────────────────────────────────────────────────────────────
// FILE SELECTION PROCESSOR
// ─────────────────────────────────────────────────────────────────────────
async function handleFileSelection(file) {
    try {
        console.log(`Processing ${file.name}...`);
        const fileList = await fs.loadCMP(file);
        
        logMessage(`${file.name} successfully loaded.`, 'success');
        logMessage(`Found ${fileList.length} assets.`);
        if (appState.animationFiles.length > 0) {
            logMessage(`Found ${appState.animationFiles.length} animation file(s).`, 'info');
        }

        // Load palettes
        const pal0 = fs.getFile("GAMEPAL.PAL");
        const pal1 = fs.getFile("STORY2.PAL");
        const pal2 = fs.getFile("STORY3.PAL");
        const pal3 = fs.getFile("LCR.MNI");
        const pal4 = fs.getFile("STORY.MNI");

        if (pal0) {
            assets.loadPalette(pal0, 0);
            displayPaletteBar(pal0);
        }
        if (pal1) assets.loadPalette(pal1, 1);
        if (pal2) assets.loadPalette(pal2, 2);
        if (pal3) assets.loadPalette(pal3, 3);
        if (pal4) assets.loadPalette(pal4, 4);
        
        // Load actors
        const actInfo = fs.getFile("ACTRINFO.MNI");
        const actGraph = fs.getFile("ACTORS.MNI");
        if (actInfo && actGraph) {
            actorManager.loadInfo(actInfo);
            actorManager.loadGraphics(actGraph);
            console.log("Actor Database Loaded.");
        }
        
        // NEW: Load actor atlas
        try {
            const atlasResponse = await fetch(`actor_atlas_final.json?v=${Date.now()}`);
            if (atlasResponse.ok) {
                const atlasData = await atlasResponse.json();
                actorManager.loadAtlas(atlasData);
                console.log("Actor Atlas Loaded.");
            }
        } catch (err) {
            console.warn("Could not load actor atlas:", err);
        }
        
        // Load level viewer config
        try {
            const configResponse = await fetch(`level_viewer_config.json?v=${Date.now()}`);
            if (configResponse.ok) {
                const viewerConfig = await configResponse.json();
                renderer.loadViewerConfig(viewerConfig);
                console.log("Level Viewer Config Loaded.");
            }
        } catch (err) {
            console.warn("Could not load level viewer config:", err);
        }
        
        // Combine CMP files with animation files
        const combinedFiles = [
            ...fileList,
            ...appState.animationFiles.map(f => ({ 
                name: f.name, 
                category: 'animations', 
                file: f 
            }))
        ];
        
        ui.populateLevelList(combinedFiles);
        console.log("Archive Ready.");
        
        updateHeaderStatus(`📦 Archive Loaded: <strong>${file.name}</strong> (${fileList.length} files)`);

        const dropZone = document.getElementById('drop-zone');
        if (dropZone) dropZone.classList.add('hidden');
        updateCanvasSize();
    } catch (err) {
        console.error("Error:", err);
    }
}