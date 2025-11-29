/**
 * Renderer
 * 
 * Handles all canvas drawing operations for the Duke Nukem 1 Map Viewer.
 * Implements viewport culling, layer rendering, and special effects (mirrors).
 * 
 * Rendering Pipeline:
 * 1. Clear background
 * 2. Apply viewport transform (pan & zoom)
 * 3. Pass 1: Draw map tiles with culling
 * 4. Pass 2: Draw sprites with background fill
 * 5. Pass 3: Render mirror reflections
 */

export class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas - Target canvas element
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.tileSize = 16;
        this.pattern = this.createCheckerboardPattern();
        this.ctx.imageSmoothingEnabled = false;
    }
    
    /**
     * Creates a checkerboard pattern for transparent backgrounds
     * @returns {CanvasPattern} Repeating checkerboard pattern
     */
    createCheckerboardPattern() {
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 32;
        pCanvas.height = 32;
        const pCtx = pCanvas.getContext('2d');
        
        // Dark background
        pCtx.fillStyle = '#111';
        pCtx.fillRect(0, 0, 32, 32);
        
        // Lighter squares
        pCtx.fillStyle = '#222';
        pCtx.fillRect(0, 0, 16, 16);
        pCtx.fillRect(16, 16, 16, 16);
        
        return this.ctx.createPattern(pCanvas, 'repeat');
    }
    
    /**
     * Main rendering function
     * 
     * @param {Object} level - Level data containing grid and dimensions
     * @param {Array} tileset - Array of tile canvases
     * @param {Object} spriteRegistry - Sprite definitions by ID
     * @param {Object} layerConfig - Visibility settings for sprite layers
     * @param {Object} viewport - Camera position and zoom
     * @param {boolean} debugMode - Show debug overlays
     * @param {string} spriteMode - Sprite display mode: 'icon', 'shrink', or 'full'
     * @param {boolean} solidBackground - Use solid black instead of checkerboard
     */
    draw(level, tileset, spriteRegistry, layerConfig, viewport, debugMode, spriteMode, solidBackground) {
        const ctx = this.ctx;
        const zoom = viewport.zoom;
        ctx.imageSmoothingEnabled = false;
        
        // ====================================================================
        // 1. Setup Canvas and Background
        // ====================================================================
        
        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Draw background
        if (solidBackground) {
            ctx.fillStyle = '#000000';
        } else {
            ctx.fillStyle = this.pattern;
        }
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        
        // ====================================================================
        // 2. Apply Viewport Transform
        // ====================================================================
        
        // Calculate viewport center
        const centerX = viewport.width / 2;
        const centerY = viewport.height / 2;
        
        // Calculate translation to center on viewport position
        const transX = centerX - (viewport.x * zoom);
        const transY = centerY - (viewport.y * zoom);
        
        // Apply transform
        ctx.translate(transX, transY);
        ctx.scale(zoom, zoom);
        
        // ====================================================================
        // 3. Calculate Visible Tile Range (Culling)
        // ====================================================================
        
        // Calculate world coordinates of viewport edges
        const viewWorldLeft = viewport.x - (centerX / zoom);
        const viewWorldTop = viewport.y - (centerY / zoom);
        const viewWorldRight = viewport.x + (centerX / zoom);
        const viewWorldBottom = viewport.y + (centerY / zoom);
        
        // Convert to tile coordinates with padding for safety
        const startCol = Math.floor(viewWorldLeft / 16) - 2;
        const endCol = Math.floor(viewWorldRight / 16) + 2;
        const startRow = Math.floor(viewWorldTop / 16) - 5;
        const endRow = Math.floor(viewWorldBottom / 16) + 3;
        
        // Clamp to level boundaries
        const c1 = Math.max(0, startCol);
        const c2 = Math.min(level.width, endCol);
        const r1 = Math.max(0, startRow);
        const r2 = Math.min(level.height, endRow);
        
        // Helper function: Check if tile is a background tile
        const isBackground = (id) => id < 192;
        
        // Check if we're rendering a tileset sheet
        const renderAll = level.type === 'sheet';
        
        // ====================================================================
        // PASS 1: Render Map Tiles
        // ====================================================================
        
        for (let y = r1; y < r2; y++) {
            for (let x = c1; x < c2; x++) {
                const index = y * level.width + x;
                
                // Bounds check
                if (index >= level.grid.length) continue;
                
                const tileID = level.grid[index];
                
                // Skip empty tiles (unless rendering sheet view)
                if (tileID === 0 && !renderAll) continue;
                
                // Calculate tile position
                const posX = x * 16;
                const posY = y * 16;
                
                // Skip sprites in this pass (unless rendering sheet view)
                if (!renderAll && tileID >= 3000) continue;
                
                // Draw tile if available
                if (tileID < tileset.length && tileset[tileID]) {
                    ctx.drawImage(tileset[tileID], posX, posY);
                }
                // Debug overlay for missing tiles
                else if (debugMode) {
                    ctx.fillStyle = (tileID > 190)
                        ? "rgba(255, 0, 0, 0.3)"  // Red for high IDs
                        : "rgba(255, 255, 255, 0.3)"; // White for low IDs
                    ctx.fillRect(posX, posY, 16, 16);
                }
            }
        }
        
        // ====================================================================
        // PASS 2: Render Sprites
        // ====================================================================
        
        // Skip sprite pass for sheet view
        if (renderAll) return;
        
        for (let y = r1; y < r2; y++) {
            for (let x = c1; x < c2; x++) {
                const index = y * level.width + x;
                
                // Bounds check
                if (index >= level.grid.length) continue;
                
                const tileID = level.grid[index];
                
                // Only process sprites (ID >= 3000)
                if (tileID < 3000) continue;
                
                const sprite = spriteRegistry[tileID];
                const posX = x * 16;
                const posY = y * 16;
                
                // ============================================================
                // A. Draw Background Fill
                // ============================================================
                // Non-decorative sprites need a background tile
                // Look in adjacent cells for a suitable background tile
                
                if (sprite && sprite.type !== 'decorative') {
                    let bgTileID = -1;
                    
                    // Check adjacent tiles for background
                    if (x > 0 && isBackground(level.grid[index - 1])) {
                        bgTileID = level.grid[index - 1]; // Left
                    } else if (x < level.width - 1 && isBackground(level.grid[index + 1])) {
                        bgTileID = level.grid[index + 1]; // Right
                    } else if (y > 0 && isBackground(level.grid[index - level.width])) {
                        bgTileID = level.grid[index - level.width]; // Top
                    } else if (y < level.height - 1 && isBackground(level.grid[index + level.width])) {
                        bgTileID = level.grid[index + level.width]; // Bottom
                    } else if (x > 0) {
                        bgTileID = level.grid[index - 1]; // Fallback to left
                    }
                    
                    // Draw background tile if found
                    if (bgTileID > 1 && bgTileID < 3000 && tileset[bgTileID]) {
                        ctx.drawImage(tileset[bgTileID], posX, posY);
                    }
                }
                
                // ============================================================
                // B. Draw Sprite
                // ============================================================
                
                if (sprite) {
                    // Check layer visibility
                    let visible = false;
                    if (sprite.type === 'bonus' && layerConfig.showBonuses) visible = true;
                    if (sprite.type === 'enemy' && layerConfig.showEnemies) visible = true;
                    if (sprite.type === 'hazard' && layerConfig.showHazards) visible = true;
                    if (sprite.type === 'interactive' && layerConfig.showInteractive) visible = true;
                    if (sprite.type === 'decorative' && layerConfig.showDecorative) visible = true;
                    
                    if (visible) {
                        // Handle crate sprites (composite objects)
                        if (sprite.isCrate) {
                            // Draw base crate
                            if (sprite.base) {
                                ctx.drawImage(sprite.base, posX, posY);
                            }
                            // Draw contents (offset for visual centering)
                            if (sprite.content) {
                                ctx.drawImage(sprite.content, posX + 2, posY + 4, 12, 12);
                            }
                        }
                        // Handle standard sprites
                        else {
                            if (spriteMode === 'full') {
                                // Full size mode: Draw at actual size (may be multi-tile)
                                const hInTiles = sprite.hTiles || 1;
                                const drawY = posY - ((hInTiles - 1) * 16);
                                ctx.drawImage(sprite.image, posX, drawY);
                            } else if (spriteMode === 'shrink') {
                                // Shrink mode: Scale to fit in 16x16
                                const srcW = sprite.image.width;
                                const srcH = sprite.image.height;
                                const scale = Math.min(16 / srcW, 16 / srcH);
                                const dstW = srcW * scale;
                                const dstH = srcH * scale;
                                const offX = (16 - dstW) / 2;
                                const offY = (16 - dstH) / 2;
                                ctx.drawImage(sprite.image, posX + offX, posY + offY, dstW, dstH);
                            } else {
                                // Icon mode: Draw pre-scaled icon
                                ctx.drawImage(sprite.image, posX, posY);
                            }
                        }
                    }
                }
                // Debug overlay for missing sprites
                else if (debugMode) {
                    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
                    ctx.fillRect(posX, posY, 16, 16);
                }
            }
        }
        
        // ====================================================================
        // PASS 3: Render Mirror Reflections
        // ====================================================================
        
        for (let y = r1; y < r2; y++) {
            for (let x = c1; x < c2; x++) {
                const index = y * level.width + x;
                
                // Bounds check
                if (index >= level.grid.length) continue;
                
                const tileID = level.grid[index];
                
                // ID 0x3014 = Mirror Floor
                if (tileID === 0x3014) {
                    // ========================================================
                    // Mirror Reflection Implementation
                    // ========================================================
                    // Capture the 2 tiles above the mirror and reflect them
                    // into the mirror tile
                    
                    // Calculate world coordinates for source area
                    const worldSrcX = x * 16;
                    const worldSrcY = (y * 16) - 32; // Read from 32px above
                    
                    // Convert to screen coordinates
                    const sx = Math.floor(transX + worldSrcX * zoom);
                    const sy = Math.floor(transY + worldSrcY * zoom);
                    const sw = 16 * zoom;
                    const sh = 32 * zoom;
                    
                    // Calculate destination (mirror tile position)
                    const posX = x * 16;
                    const posY = y * 16;
                    const mirrorHeight = 16; // Constrain to single tile
                    
                    // Ensure source is within canvas bounds
                    if (sx >= 0 && sy >= 0 &&
                        (sx + sw) <= this.canvas.width &&
                        (sy + sh) <= this.canvas.height) {
                        try {
                            ctx.save();
                            
                            // Flip vertically relative to bottom of mirror tile
                            ctx.translate(posX, posY + mirrorHeight);
                            ctx.scale(1, -1);
                            
                            // Draw reflected image
                            ctx.drawImage(
                                this.canvas,
                                sx, sy, sw, sh,
                                0, 0, 16, mirrorHeight
                            );
                            
                            ctx.restore();
                        } catch (e) {
                            // Ignore errors from off-screen clipping
                        }
                    }
                }
            }
        }
    }
}
