import { FileSystem } from './FileSystem.js';
import { AssetManager } from './AssetManager.js';
import { MapParser } from './MapParser.js';
import { Viewport } from './Viewport.js';
import { RenderEngine } from './RenderEngine.js';
import { UIManager } from './UIManager.js';
import { ActorManager } from './ActorManager.js';
import { AudioPlayer } from './AudioPlayer.js';
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
	// Collapsible Panel Handlers
	// ─────────────────────────────────────────────────────────────────────────
	// Enables collapse/expand functionality for sidebar panels

	document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.closest('.sidebar-section');
        
        if (section) {
            section.classList.toggle('collapsed');
        }
    });
});

const fs = new FileSystem();
const assets = new AssetManager();
const mapParser = new MapParser();
const ui = new UIManager();
const actorManager = new ActorManager(assets);
const audioPlayer = new AudioPlayer();
const musicPlayer = new MusicPlayer();
const soundManager = new SoundManager(audioPlayer.ctx, musicPlayer);

const canvas = document.getElementById('preview-canvas') || createFallbackCanvas();
const viewport = new Viewport(canvas);
const renderer = new RenderEngine(canvas);
const paletteViewer = new PaletteViewer();

logMessage('System Ready.', 'success');
updateHeaderStatus('Waiting for Data...');

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
    currentMap: null,
    actorManager: actorManager,
    layers: { showMap: true, showSprites: true },
    useSolidBG: false,
    useGridFix: false
};

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

function loop() {
    renderer.draw(appState, viewport);
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
    if (canvas) canvas.style.display = 'block';
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
    const musicCtrl = document.querySelector('.music-controls');
    
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

    // Show music controls if music is playing or paused
    const hasMusic = musicPlayer.isPlaying || musicPlayer.isPaused;
    
    if (musicCtrl) {
        musicCtrl.style.display = hasMusic ? 'flex' : 'none';
    }
}

function toggleControls(mode) {
    const zoomCtrl = document.querySelector('.zoom-controls');
    const musicCtrl = document.querySelector('.music-controls');
    
    // Hide all first to prevent overlap
    if (zoomCtrl) zoomCtrl.style.display = 'none';
    if (musicCtrl) musicCtrl.style.display = 'none';

    // Show requested
    if (mode === 'zoom' && zoomCtrl) zoomCtrl.style.display = 'flex';
    if (mode === 'music' && musicCtrl) musicCtrl.style.display = 'flex';
}

function updateMusicUI(trackName, isPlaying) {
    const nameLabel = document.getElementById('music-track-name');
    const playBtn = document.getElementById('music-play-pause');
    
    if (nameLabel) nameLabel.textContent = trackName;
    if (playBtn) playBtn.textContent = isPlaying ? "⏸" : "▶️";
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
    // Provides buttons to change zoom level and toggle map/sprite layers

    if (!document.querySelector('.zoom-controls')) {
        const div = document.createElement('div');
        div.className = 'zoom-controls';
        div.innerHTML = `
            <button class="zoom-btn" id="zoom-fit">Fit</button>
            <button class="zoom-btn" id="zoom-1x">1x</button>
            <button class="zoom-btn" id="zoom-2x">2x</button>
            <button class="zoom-btn" id="zoom-4x">4x</button>
            <div class="layer-toggles">
            <label>
                <input type="checkbox" id="chk-map" checked> Map
            </label>
            <label>
                <input type="checkbox" id="chk-sprites" checked> Sprites
            </label>
            </div>
        `;
        container.appendChild(div);
        
        document.getElementById('zoom-fit').onclick = handleFitZoom; 
        document.getElementById('zoom-1x').onclick = () => viewport.zoom = 1.0;
        document.getElementById('zoom-2x').onclick = () => viewport.zoom = 2.0;
        document.getElementById('zoom-4x').onclick = () => viewport.zoom = 4.0;
        document.getElementById('chk-map').onchange = (e) => appState.layers.showMap = e.target.checked;
        document.getElementById('chk-sprites').onchange = (e) => appState.layers.showSprites = e.target.checked;
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
        console.log(`Loading Level: ${filename}`);
        logMessage(`Loaded Level: ${filename}`, 'success');
		
		const levelData = fs.getFile(filename);
        if (!levelData) throw new Error("File missing");

		// --- Reset View to Canvas ---
        resetMainView();
		
		// Show Zoom controls
        toggleControls('zoom');

        appState.viewMode = 'map';
        appState.currentMap = mapParser.parse(levelData);
        
        const czoneName = appState.currentMap.czone;
        const rawZone = fs.getFile(czoneName);
        if (rawZone) {
            appState.solidTiles = [];
            appState.maskedTiles = [];
            const solidData = rawZone.subarray(3600, 3600 + 32000);
            for (let i = 0; i < 1000; i++) {
                const img = assets.decodeTile(solidData, i, 'solid_local');
                if (img) appState.solidTiles[i] = await createImageBitmap(img);
            }
            const maskedData = rawZone.subarray(35600);
            for (let i = 0; i < 160; i++) {
                const img = assets.decodeTile(maskedData, i, 'masked');
                if (img) appState.maskedTiles[i] = await createImageBitmap(img);
            }
        }

        if (appState.currentMap.actors) {
            const ids = [...new Set(appState.currentMap.actors.map(a => a.id))];
            ids.forEach(id => actorManager.requestSprite(id));
        }

        renderer.preRender(appState.currentMap, { solidTiles: appState.solidTiles, maskedTiles: appState.maskedTiles }, appState.useGridFix);
        handleFitZoom();
        updateUIState();
        
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

        // ─────────────────────────────────────────────────────────────────────
        // MUSIC HANDLER (.IMF files)
        // ─────────────────────────────────────────────────────────────────────
        // Plays AdLib music files in the background

        if (upper.endsWith(".IMF")) {
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
                
                const sounds = soundManager.load(headData, bodyData);
                renderSoundBoard(sounds);
                
				updateHeaderStatus(`🎮 Sound Board: <strong>${sounds.length} Sounds</strong>`);
				
                // Update UI: Hides Zoom (no visuals), Keeps Music (if playing)
                updateUIState(); 
            } else {
                console.error("Missing AUDIOHED.MNI or AUDIOT.MNI pair.");
            }
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // FULLSCREEN IMAGE HANDLER
        // ─────────────────────────────────────────────────────────────────────
        // Displays fullscreen images (32048 bytes = 320x200 pixels)

        if (rawFile.length === 32048) {
            appState.viewMode = 'asset';
            const img = await assets.decodeFullScreenImage(rawFile);
            if (img) {
                appState.currentAsset = { image: img, layout: null };
                handleFitZoom();
            }
			logMessage(`Displaying Image: ${filename}`, 'success');
			updateHeaderStatus(`🖼️ Viewing Image: <strong>${filename}</strong>`);
			
			// --- Reset View to Canvas ---
			resetMainView();
		
			// Show Zoom controls
			toggleControls('zoom');
			
            updateUIState();
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // ACTOR SPRITE SHEET HANDLER
        // ─────────────────────────────────────────────────────────────────────
        // Generates a sprite sheet showing all actor/enemy graphics

        if (upper === "ACTORS.MNI") {
            appState.viewMode = 'asset';
            const result = await actorManager.generateSpriteSheet();
            if (result && result.image) {
                appState.currentAsset = result; 
                handleFitZoom();
            }
            logMessage(`Displaying Sprites: ${filename}`, 'success');
			updateHeaderStatus(`👾 Actor Sprites: <strong>${actorManager.getActorCount()} Types</strong>`);
			
			// --- Reset View to Canvas ---
			resetMainView();
		
			// Show Zoom controls
			toggleControls('zoom');
			
			updateUIState();
        } 
        
        // ─────────────────────────────────────────────────────────────────────
        // CZONE TILESET HANDLER
        // ─────────────────────────────────────────────────────────────────────
        // Displays all tiles from a CZONE file as a grid

        else if (upper.includes("CZONE")) {
            appState.viewMode = 'asset';
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
			
			updateUIState();
        }
        
        // ─────────────────────────────────────────────────────────────────────
		// BACKDROP/DROP/STATUS TILESET HANDLER  
		// ─────────────────────────────────────────────────────────────────────
		// Handles backdrop images and status bar graphics
		else if (upper.startsWith("BACKDRP") || upper.startsWith("DROP") || upper === "STATUS.MNI") {
			appState.viewMode = 'asset';
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
			
			updateUIState();
		}
		
		// ─────────────────────────────────────────────────────────────────────
	// PALETTE FILE HANDLER (.PAL)
	// ─────────────────────────────────────────────────────────────────────
	// Displays Duke Nukem 2 palette files as color bars and grids

	else if (upper.endsWith(".PAL")) {
		appState.viewMode = 'data';
    
		if (rawFile && rawFile.length === 48) {
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
			updateHeaderStatus(`🎨 Palette: <strong>${filename}</strong> (16 colors)`);
        
			// Hide zoom controls for palette view
			toggleControls('none');
			updateUIState();
		} else {
			logMessage(`Invalid palette file: ${filename} (expected 48 bytes)`, 'error');
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
    else loadAsset(filename);
};

// ─────────────────────────────────────────────────────────────────────────
// FILE INPUT BUTTON
// ─────────────────────────────────────────────────────────────────────────
// Handles the file selection dialog for loading CMP archives

const fileInput = document.getElementById('folder-input');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelection(file);
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
// Main function that processes a selected CMP archive file.
// This extracts all the files, loads the palette and actor data, and
// populates the file list in the sidebar.
async function handleFileSelection(file) {
    try {
        console.log(`Processing ${file.name}...`);
        const fileList = await fs.loadCMP(file);
        
        logMessage(`${file.name} successfully loaded.`, 'success');
        logMessage(`Found ${fileList.length} assets.`);
        
        const palData = fs.getFile("GAMEPAL.PAL");
        if (palData) assets.loadPalette(palData);
        if (palData) displayPaletteBar(palData);
		
        const actInfo = fs.getFile("ACTRINFO.MNI");
        const actGraph = fs.getFile("ACTORS.MNI");
        if (actInfo && actGraph) {
            actorManager.loadInfo(actInfo);
            actorManager.loadGraphics(actGraph);
            console.log("Actor Database Loaded.");
        }
        ui.populateLevelList(fileList);
        console.log("Archive Ready.");
        
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) dropZone.classList.add('hidden');
        updateCanvasSize();
    } catch (err) {
        console.error("Error:", err);
    }
}