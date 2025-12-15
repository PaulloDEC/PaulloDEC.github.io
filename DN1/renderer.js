/**
 * ============================================================================
 * RENDERER - CANVAS DRAWING ENGINE
 * ============================================================================
 * 
 * Handles all canvas drawing operations for the Duke Nukem 1 Map Viewer.
 * Implements efficient viewport culling, multi-pass layer rendering, and
 * special visual effects including mirror reflections.
 * 
 * Rendering Pipeline (3-Pass Architecture):
 * 
 * Pass 1: Map Tiles
 *   - Renders all background and solid tiles
 *   - Applies viewport culling for performance
 *   - Skips sprite tiles (ID >= 3000)
 * 
 * Pass 2: Sprites
 *   - Draws background fills for non-decorative sprites
 *   - Renders sprites with layer visibility filtering
 *   - Handles special cases (crates, multi-tile sprites)
 *   - Supports three display modes (icon, shrink, full)
 * 
 * Pass 3: Mirror Reflections
 *   - Identifies mirror floor tiles (ID 0x3014)
 *   - Captures and reflects the area above each mirror
 *   - Uses canvas self-copy with vertical flip transform
 * 
 * Performance Optimizations:
 * - Viewport culling: Only renders visible tiles
 * - Transform caching: Single transform setup per frame
 * - Bounds checking: Prevents out-of-range array access
 * - Early returns: Skips unnecessary rendering passes
 */

export class Renderer {
    /* ====================================================================== */
    /* CONSTRUCTOR AND INITIALIZATION                                         */
    /* ====================================================================== */
    
    /**
     * Creates a new renderer instance.
     * 
     * Initializes the canvas context with:
     * - Alpha disabled for better performance (opaque background)
     * - Image smoothing disabled for crisp pixel art
     * - Checkerboard pattern for transparent areas
     * 
     * @param {HTMLCanvasElement} canvas - Target canvas element for rendering
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.tileSize = 16; // Standard Duke Nukem 1 tile size
        this.pattern = this.createCheckerboardPattern();
        this.ctx.imageSmoothingEnabled = false; // Prevent pixel art blurring
    }
    
    /**
     * Creates a checkerboard pattern for displaying transparent backgrounds.
     * 
     * This pattern is used as the canvas background and helps visualize
     * transparency in tiles and sprites. The checkerboard makes it clear
     * which pixels are transparent versus black.
     * 
     * Pattern specifications:
     * - 32x32 pixel repeating pattern
     * - Dark base color (#111) with lighter squares (#222)
     * - Two 16x16 squares positioned diagonally
     * 
     * @returns {CanvasPattern} Repeating checkerboard pattern
     */
    createCheckerboardPattern() {
        // Create small canvas for pattern
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 32;
        pCanvas.height = 32;
        const pCtx = pCanvas.getContext('2d');
        
        // Dark background fill
        pCtx.fillStyle = '#111';
        pCtx.fillRect(0, 0, 32, 32);
        
        // Lighter squares in checkerboard pattern
        pCtx.fillStyle = '#222';
        pCtx.fillRect(0, 0, 16, 16);      // Top-left square
        pCtx.fillRect(16, 16, 16, 16);    // Bottom-right square
        
        return this.ctx.createPattern(pCanvas, 'repeat');
    }
    
    /* ====================================================================== */
    /* MAIN RENDERING FUNCTION                                                */
    /* ====================================================================== */
    
    /**
     * Main rendering function - orchestrates the entire drawing process.
     * 
     * This is the primary entry point called by the application on every frame.
     * It handles all rendering logic including viewport transform, culling,
     * layer filtering, and special effects.
     * 
     * The function supports multiple content types:
     * - Standard levels (tile grid + sprites)
     * - Full-screen images (CREDITS, DUKE, etc.)
     * - Tile sheets (graphics file previews)
     * 
     * @param {Object} level - Level data object
     * @param {string} level.type - Content type: 'level', 'image', or 'sheet'
     * @param {Uint16Array} level.grid - Tile ID array (width * height)
     * @param {number} level.width - Level width in tiles
     * @param {number} level.height - Level height in tiles
     * @param {HTMLCanvasElement} level.image - Image canvas (for type='image')
     * 
     * @param {Array<HTMLCanvasElement>} tileset - Array of tile canvases indexed by tile ID
     * 
     * @param {Object} spriteRegistry - Map of sprite ID -> sprite data
     * @param {string} spriteRegistry[id].type - Sprite category for layer filtering
     * @param {HTMLCanvasElement} spriteRegistry[id].image - Active sprite canvas
     * @param {boolean} spriteRegistry[id].isCrate - True for composite crate sprites
     * @param {number} spriteRegistry[id].hTiles - Sprite height in tiles
     * 
     * @param {Object} layerConfig - Visibility settings for sprite types
     * @param {boolean} layerConfig.showBonuses - Show collectible items
     * @param {boolean} layerConfig.showEnemies - Show enemy sprites
     * @param {boolean} layerConfig.showHazards - Show environmental dangers
     * @param {boolean} layerConfig.showInteractive - Show interactive objects
     * @param {boolean} layerConfig.showDecorative - Show decorative elements
     * 
     * @param {Object} viewport - Camera position and zoom state
     * @param {number} viewport.x - Camera X position in world space
     * @param {number} viewport.y - Camera Y position in world space
     * @param {number} viewport.zoom - Zoom factor (1 = native size)
     * @param {number} viewport.width - Canvas width in pixels
     * @param {number} viewport.height - Canvas height in pixels
     * 
     * @param {boolean} debugMode - Enable debug visualization (unused in current build)
     * @param {string} spriteMode - Sprite display mode: 'icon', 'shrink', or 'full'
     * @param {boolean} solidBackground - Use solid black instead of checkerboard pattern
     * @param {boolean} useGridFix - Apply pixel-perfect grid alignment fix
     */
    draw(level, tileset, spriteRegistry, layerConfig, viewport, debugMode, spriteMode, solidBackground, useGridFix) {
        const ctx = this.ctx;
        const zoom = viewport.zoom;
        
        /* ------------------------------------------------------------------ */
        /* Grid Fix Calculation                                               */
        /* ------------------------------------------------------------------ */
        
        /**
         * Optional pixel-perfect grid alignment fix.
         * 
         * Problem: At certain zoom levels, gaps can appear between tiles due to
         * sub-pixel rounding in the browser's rendering engine.
         * 
         * Solution: Slightly overlap tiles by 1 screen pixel to eliminate gaps.
         * The overlap amount is calculated dynamically based on current zoom.
         * 
         * Formula: overlap = 1 / zoom
         * - At 1x zoom: 1 world pixel overlap
         * - At 2x zoom: 0.5 world pixel overlap
         * - At 4x zoom: 0.25 world pixel overlap
         * 
         * This ensures exactly 1 screen pixel of coverage regardless of zoom level.
         */
        
        const fix = useGridFix ? (1 / zoom) : 0;
        const size = 16 + fix; // Tile draw size (16 + optional overlap)
        
        /* ================================================================== */
        /* STEP 1: SETUP CANVAS AND BACKGROUND                               */
        /* ================================================================== */
        
        /**
         * Reset transform to identity matrix.
         * This clears any previous transformations and ensures we start
         * from a known state before applying our viewport transform.
         */
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        /**
         * Draw background pattern or solid color.
         * This covers the entire canvas before drawing any content.
         */
        if (solidBackground) {
            ctx.fillStyle = '#000000'; // Solid black
        } else {
            ctx.fillStyle = this.pattern; // Checkerboard pattern
        }
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        
        /* ================================================================== */
        /* STEP 2: APPLY VIEWPORT TRANSFORM                                   */
        /* ================================================================== */
        
        /**
         * Viewport transformation setup.
         * 
         * This transform:
         * 1. Centers the viewport on the specified world position
         * 2. Applies zoom scaling
         * 3. Uses integer pixel positions to prevent tile seams
         * 
         * The transform affects all subsequent draw operations until reset.
         */
        
        // Calculate viewport center in screen space
        const centerX = viewport.width / 2;
        const centerY = viewport.height / 2;
        
        /**
         * Calculate translation to center viewport on target position.
         * 
         * Formula: translation = screenCenter - (worldPosition * zoom)
         * 
         * Math.floor ensures integer pixel positions, which prevents
         * sub-pixel positioning that can cause gaps between tiles.
         */
        const transX = Math.floor(centerX - (viewport.x * zoom));
        const transY = Math.floor(centerY - (viewport.y * zoom));
        
        // Apply transformation
        ctx.translate(transX, transY); // Move origin to viewport center
        ctx.scale(zoom, zoom);         // Apply zoom factor
        
        /* ================================================================== */
        /* SPECIAL CASE: FULL-SCREEN IMAGE                                    */
        /* ================================================================== */
        
        /**
         * Handle full-screen images (CREDITS, DUKE, etc.).
         * 
         * These are pre-rendered 320x200 EGA images that don't use
         * the tile-based rendering system. We just draw the image
         * canvas directly and skip all other rendering passes.
         */
        if (level.type === 'image' && level.image) {
            ctx.drawImage(level.image, 0, 0);
            return; // Exit early - no tile rendering needed
        }
        
        /* ================================================================== */
        /* STEP 3: CALCULATE VISIBLE TILE RANGE (VIEWPORT CULLING)            */
        /* ================================================================== */
        
        /**
         * Viewport culling optimization.
         * 
         * Only renders tiles that are currently visible in the viewport.
         * This significantly improves performance for large levels.
         * 
         * Process:
         * 1. Calculate viewport edges in world coordinates
         * 2. Convert to tile coordinates
         * 3. Add padding for safety (tall sprites, etc.)
         * 4. Clamp to level boundaries
         */
        
        /* ------------------------------------------------------------------ */
        /* Calculate Viewport Edges in World Space                            */
        /* ------------------------------------------------------------------ */
        
        const viewWorldLeft = viewport.x - (centerX / zoom);
        const viewWorldTop = viewport.y - (centerY / zoom);
        const viewWorldRight = viewport.x + (centerX / zoom);
        const viewWorldBottom = viewport.y + (centerY / zoom);
        
        /* ------------------------------------------------------------------ */
        /* Convert to Tile Coordinates with Padding                           */
        /* ------------------------------------------------------------------ */
        
        /**
         * Padding values:
         * - Horizontal: ±2 tiles (handles scrolling and rounding errors)
         * - Vertical: -5 top, +3 bottom (handles tall sprites that extend upward)
         */
        const startCol = Math.floor(viewWorldLeft / 16) - 2;
        const endCol = Math.floor(viewWorldRight / 16) + 2;
        const startRow = Math.floor(viewWorldTop / 16) - 5;
        const endRow = Math.floor(viewWorldBottom / 16) + 3;
        
        /* ------------------------------------------------------------------ */
        /* Clamp to Level Boundaries                                          */
        /* ------------------------------------------------------------------ */
        
        const c1 = Math.max(0, startCol);
        const c2 = Math.min(level.width, endCol);
        const r1 = Math.max(0, startRow);
        const r2 = Math.min(level.height, endRow);
        
        /* ------------------------------------------------------------------ */
        /* Helper Functions                                                    */
        /* ------------------------------------------------------------------ */
        
        /**
         * Determines if a tile ID represents a background tile.
         * 
         * Background tiles (ID < 192) are used as fills behind sprites.
         * This distinction is important for sprite background rendering.
         * 
         * @param {number} id - Tile ID to check
         * @returns {boolean} True if tile is a background tile
         */
        const isBackground = (id) => id < 192;
        
        /**
         * Check if we're rendering a tileset sheet view.
         * 
         * Sheet view shows all tiles including sprites and empty slots.
         * Normal level view only shows placed tiles and applies sprite layering.
         */
        const renderAll = level.type === 'sheet';
        
        /* ================================================================== */
        /* PASS 1: RENDER MAP TILES                                           */
        /* ================================================================== */
        
        /**
         * First rendering pass: Map tiles only.
         * 
         * This pass draws all background and solid tiles (ID < 3000).
         * Sprite tiles are skipped and handled in Pass 2.
         * 
         * Benefits of separate passes:
         * - Tiles render in back-to-front order
         * - Sprites can have background fills
         * - Layer visibility only affects sprites
         */
        
        for (let y = r1; y < r2; y++) {
            for (let x = c1; x < c2; x++) {
                const index = y * level.width + x;
                
                // Bounds check: Skip if index exceeds grid size
                if (index >= level.grid.length) continue;
                
                const tileID = level.grid[index];
                
                // Skip empty tiles (unless rendering sheet view)
                if (tileID === 0 && !renderAll) continue;
                
                // Calculate tile position in world space
                const posX = x * 16;
                const posY = y * 16;
                
                // Skip sprites in this pass (unless rendering sheet view)
                // Sprite IDs are >= 3000 (0x3000 in hex)
                if (!renderAll && tileID >= 3000) continue;
                
                /* ---------------------------------------------------------- */
                /* Draw Tile                                                  */
                /* ---------------------------------------------------------- */
                
                if (tileID < tileset.length && tileset[tileID]) {
                    // Draw tile with optional grid fix overlap
                    ctx.drawImage(tileset[tileID], posX, posY, size, size);
                }
                
                /* ---------------------------------------------------------- */
                /* Debug Overlay (Optional)                                   */
                /* ---------------------------------------------------------- */
                
                /**
                 * Debug visualization for missing tiles.
                 * Shows semi-transparent colored squares:
                 * - Red: High IDs (likely sprites or special tiles)
                 * - White: Low IDs (likely regular tiles)
                 */
                else if (debugMode) {
                    ctx.fillStyle = (tileID > 190)
                        ? "rgba(255, 0, 0, 0.3)"      // Red for high IDs
                        : "rgba(255, 255, 255, 0.3)"; // White for low IDs
                    ctx.fillRect(posX, posY, 16, 16);
                }
            }
        }
        
        /* ================================================================== */
        /* PASS 2: RENDER SPRITES                                             */
        /* ================================================================== */
        
        /**
         * Second rendering pass: Sprite entities.
         * 
         * This pass handles all sprite tiles (ID >= 3000) with:
         * - Background fill for non-decorative sprites
         * - Layer visibility filtering
         * - Three display modes (icon, shrink, full)
         * - Special handling for crates and multi-tile sprites
         * 
         * Skip this pass entirely for sheet view (all tiles shown in Pass 1).
         */
        
        if (renderAll) return; // Exit early for sheet view
        
        for (let y = r1; y < r2; y++) {
            for (let x = c1; x < c2; x++) {
                const index = y * level.width + x;
                
                // Bounds check: Skip if index exceeds grid size
                if (index >= level.grid.length) continue;
                
                const tileID = level.grid[index];
                
                // Only process sprites (ID >= 3000)
                if (tileID < 3000) continue;
                
                const sprite = spriteRegistry[tileID];
                const posX = x * 16;
                const posY = y * 16;
                
                /* ---------------------------------------------------------- */
                /* SUB-PASS A: Draw Background Fill                           */
                /* ---------------------------------------------------------- */
                
                /**
                 * Non-decorative sprites need a background tile.
                 * 
                 * In Duke Nukem 1, sprites like enemies and bonuses are placed
                 * "on top of" background tiles. We simulate this by finding a
                 * nearby background tile and drawing it first.
                 * 
                 * Search order:
                 * 1. Left adjacent tile
                 * 2. Right adjacent tile
                 * 3. Top adjacent tile
                 * 4. Bottom adjacent tile
                 * 5. Fallback to left
                 * 
                 * This ensures sprites appear to be sitting on platforms or
                 * floating in front of background graphics.
                 */
                
                if (sprite && sprite.type !== 'decorative') {
                    let bgTileID = -1;
                    
                    // Search adjacent tiles for suitable background
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
                    
                    // Draw background tile if found and valid
                    if (bgTileID > 1 && bgTileID < 3000 && tileset[bgTileID]) {
                        ctx.drawImage(tileset[bgTileID], posX, posY, size, size);
                    }
                }
                
                /* ---------------------------------------------------------- */
                /* SUB-PASS B: Draw Sprite                                    */
                /* ---------------------------------------------------------- */
                
                /**
                 * Sprite rendering with layer visibility filtering.
                 * 
                 * Each sprite has a type (bonus, enemy, hazard, etc.) that
                 * determines which layer it belongs to. Users can toggle
                 * layer visibility to show/hide different sprite categories.
                 */
                
                if (sprite) {
                    /* ------------------------------------------------------ */
                    /* Check Layer Visibility                                 */
                    /* ------------------------------------------------------ */
                    
                    let visible = false;
                    if (sprite.type === 'bonus' && layerConfig.showBonuses) visible = true;
                    if (sprite.type === 'enemy' && layerConfig.showEnemies) visible = true;
                    if (sprite.type === 'hazard' && layerConfig.showHazards) visible = true;
                    if (sprite.type === 'interactive' && layerConfig.showInteractive) visible = true;
                    if (sprite.type === 'decorative' && layerConfig.showDecorative) visible = true;
                    
                    if (visible) {
                        /* -------------------------------------------------- */
                        /* Handle Crate Sprites (Composite Objects)           */
                        /* -------------------------------------------------- */
                        
                        /**
                         * Crates are special composite sprites made of two parts:
                         * - Base: The crate box itself (grey, blue, or red)
                         * - Content: The item inside the crate (if any)
                         * 
                         * We draw these separately with the content slightly
                         * offset and scaled to appear "inside" the crate.
                         */
                        
                        if (sprite.isCrate) {
                            // Draw base crate
                            if (sprite.base) {
                                ctx.drawImage(sprite.base, posX, posY);
                            }
                            
                            // Draw contents with offset for visual centering
                            // Offset: +2px X, +4px Y
                            // Size: 12x12 (scaled down from 16x16)
                            if (sprite.content) {
                                ctx.drawImage(sprite.content, posX + 2, posY + 4, 12, 12);
                            }
                        }
                        
                        /* -------------------------------------------------- */
                        /* Handle Standard Sprites                             */
                        /* -------------------------------------------------- */
                        
                        /**
                         * Three sprite display modes:
                         * 
                         * 1. Icon Mode (default):
                         *    - Uses pre-selected icon tile (usually first tile)
                         *    - Always 16x16 pixels
                         *    - Fast and clean
                         * 
                         * 2. Shrink Mode:
                         *    - Shows full sprite scaled to fit in 16x16
                         *    - Maintains aspect ratio
                         *    - Centered in tile
                         * 
                         * 3. Full Mode:
                         *    - Shows full sprite at native size
                         *    - May extend beyond single tile
                         *    - Tall sprites extend upward from marker position
                         */
                        
                        else {
                            if (spriteMode === 'full') {
                                /* ------------------------------------------ */
                                /* Full Size Mode                             */
                                /* ------------------------------------------ */
                                
                                /**
                                 * Draw sprite at full size.
                                 * 
                                 * For multi-tile sprites, adjust Y position
                                 * to extend upward from the marker tile.
                                 * This keeps the sprite "grounded" at the
                                 * correct vertical position.
                                 */
                                
                                const hInTiles = sprite.hTiles || 1;
                                const drawY = posY - ((hInTiles - 1) * 16);
                                ctx.drawImage(sprite.image, posX, drawY);
                                
                            } else if (spriteMode === 'shrink') {
                                /* ------------------------------------------ */
                                /* Shrink to Fit Mode                         */
                                /* ------------------------------------------ */
                                
                                /**
                                 * Scale sprite to fit within 16x16 tile.
                                 * 
                                 * Process:
                                 * 1. Calculate scale factor (fit within 16x16)
                                 * 2. Calculate scaled dimensions
                                 * 3. Calculate centering offset
                                 * 4. Draw scaled sprite
                                 */
                                
                                const srcW = sprite.image.width;
                                const srcH = sprite.image.height;
                                
                                // Calculate uniform scale (maintains aspect ratio)
                                const scale = Math.min(16 / srcW, 16 / srcH);
                                
                                // Calculate final dimensions
                                const dstW = srcW * scale;
                                const dstH = srcH * scale;
                                
                                // Calculate centering offset
                                const offX = (16 - dstW) / 2;
                                const offY = (16 - dstH) / 2;
                                
                                // Draw centered, scaled sprite
                                ctx.drawImage(sprite.image, posX + offX, posY + offY, dstW, dstH);
                                
                            } else {
                                /* ------------------------------------------ */
                                /* Icon Mode (Default)                        */
                                /* ------------------------------------------ */
                                
                                /**
                                 * Draw pre-selected icon tile.
                                 * This is the simplest and fastest mode.
                                 */
                                
                                ctx.drawImage(sprite.image, posX, posY);
                            }
                        }
                    }
                }
                
                /* ---------------------------------------------------------- */
                /* Debug Overlay for Missing Sprites                          */
                /* ---------------------------------------------------------- */
                
                /**
                 * Show red squares for sprite IDs that don't have
                 * corresponding sprite definitions in the registry.
                 */
                else if (debugMode) {
                    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
                    ctx.fillRect(posX, posY, 16, 16);
                }
            }
        }
        
        /* ================================================================== */
        /* PASS 3: RENDER MIRROR REFLECTIONS                                  */
        /* ================================================================== */
        
        /**
         * Third rendering pass: Mirror floor reflections.
         * 
         * Mirror tiles (ID 0x3014) create a reflection effect by:
         * 1. Capturing the rendered area above the mirror
         * 2. Flipping it vertically
         * 3. Drawing it into the mirror tile
         * 
         * This creates a real-time reflection of whatever is above
         * each mirror, including tiles, sprites, and other objects.
         * 
         * Technical approach:
         * - Uses canvas.drawImage() with the canvas as source
         * - Applies vertical flip transform before drawing
         * - Captures 2 tiles above each mirror (32px)
         * - Constrains reflection to mirror tile height (16px)
         */
        
        for (let y = r1; y < r2; y++) {
            for (let x = c1; x < c2; x++) {
                const index = y * level.width + x;
                
                // Bounds check: Skip if index exceeds grid size
                if (index >= level.grid.length) continue;
                
                const tileID = level.grid[index];
                
                // Check for mirror floor tile (ID 0x3014)
                if (tileID === 0x3014) {
                    /* ------------------------------------------------------ */
                    /* Mirror Reflection Implementation                       */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Reflection process:
                     * 
                     * 1. Calculate source area (2 tiles above mirror)
                     *    - World coordinates: 32px above mirror tile
                     *    - Screen coordinates: Account for zoom and pan
                     * 
                     * 2. Validate source area is within canvas bounds
                     *    - Prevents errors from reading off-screen pixels
                     * 
                     * 3. Apply vertical flip transform
                     *    - Translate to bottom of mirror tile
                     *    - Scale Y by -1 to flip
                     * 
                     * 4. Draw canvas onto itself
                     *    - Source: Screen coordinates of area above
                     *    - Destination: World coordinates of mirror tile
                     */
                    
                    /* ------------------------------------------------------ */
                    /* Calculate Source Area (What to Reflect)                */
                    /* ------------------------------------------------------ */
                    
                    // World coordinates of source area
                    const worldSrcX = x * 16;
                    const worldSrcY = (y * 16) - 32; // 32px above mirror
                    
                    // Convert world coordinates to screen coordinates
                    const sx = Math.floor(transX + worldSrcX * zoom);
                    const sy = Math.floor(transY + worldSrcY * zoom);
                    const sw = 16 * zoom; // Width in screen pixels
                    const sh = 32 * zoom; // Height in screen pixels (2 tiles)
                    
                    /* ------------------------------------------------------ */
                    /* Calculate Destination (Mirror Tile Position)           */
                    /* ------------------------------------------------------ */
                    
                    const posX = x * 16;
                    const posY = y * 16;
                    const mirrorHeight = 16; // Constrain reflection to single tile
                    
                    /* ------------------------------------------------------ */
                    /* Validate and Render Reflection                         */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Ensure source area is entirely within canvas bounds.
                     * Reading pixels outside the canvas will throw an error.
                     */
                    if (sx >= 0 && sy >= 0 &&
                        (sx + sw) <= this.canvas.width &&
                        (sy + sh) <= this.canvas.height) {
                        
                        try {
                            // Save transform state
                            ctx.save();
                            
                            // Apply vertical flip transform
                            ctx.translate(posX, posY + mirrorHeight);
                            ctx.scale(1, -1); // Flip Y axis
                            
                            // Draw reflected image
                            // Source: Screen coordinates (already rendered content)
                            // Destination: World coordinates (mirror tile)
                            ctx.drawImage(
                                this.canvas,           // Use canvas as source
                                sx, sy, sw, sh,        // Source rect (screen space)
                                0, 0, 16, mirrorHeight // Dest rect (world space, flipped)
                            );
                            
                            // Restore transform state
                            ctx.restore();
                            
                        } catch (e) {
                            // Ignore errors from edge cases
                            // (e.g., source partially off-screen due to rounding)
                        }
                    }
                }
            }
        }
    }
}
