/**
 * ============================================================================
 * ASSET MANAGER - TILESET LOADER AND CACHE
 * ============================================================================
 * 
 * Handles loading, processing, and caching of Duke Nukem 1 tileset files.
 * Converts binary tile data from game files into ImageData objects suitable
 * for canvas rendering.
 * 
 * Supported Tileset Types:
 * ------------------------
 * 
 * 1. Background Tiles (BACK*.DN*):
 *    - Non-solid decorative tiles
 *    - Used for backgrounds, scenery, patterns
 *    - Always rendered as opaque
 * 
 * 2. Solid Tiles (SOLID*.DN*):
 *    - Collidable platform tiles
 *    - Used for floors, walls, platforms
 *    - Always rendered as opaque
 * 
 * 3. Animated Sprites (ANIM*.DN*):
 *    - Animated sprite frames
 *    - Includes enemies, effects, interactive objects
 *    - May have transparency
 * 
 * 4. Static Objects (OBJECT*.DN*):
 *    - Non-animated sprite assets
 *    - Includes pickups, decorations, UI elements
 *    - May have transparency
 * 
 * 5. Fonts (FONT*.DN*):
 *    - 8×8 character tiles
 *    - Used for text rendering
 *    - Special smaller tile size
 * 
 * 6. Other Assets:
 *    - MAN*.DN*: Player sprites
 *    - Various special graphics
 * 
 * File Format:
 * ------------
 * Standard tileset structure:
 * - 3-byte Apogee header (usually ignored)
 * - Tile data (variable length)
 * - Each tile: width × height ÷ 8 × 5 bytes
 *   * 5 planes: 1 mask + 4 color (BGRI)
 * 
 * Standard tile: 16×16 pixels = (16×16÷8)×5 = 160 bytes
 * Font tile: 8×8 pixels = (8×8÷8)×5 = 40 bytes
 * 
 * Caching Strategy:
 * -----------------
 * Processed tilesets are cached by filename to avoid redundant decoding.
 * The cache is cleared when:
 * - User changes the EGA palette
 * - Memory needs to be freed
 * 
 * This dramatically improves performance when switching between levels
 * that use the same tileset files.
 */

import { EGA } from './ega.js';

export class AssetManager {
    /* ====================================================================== */
    /* CONSTRUCTOR AND INITIALIZATION                                         */
    /* ====================================================================== */
    
    /**
     * Creates a new asset manager instance.
     * 
     * Initializes an empty cache for storing processed tilesets.
     * The cache uses a Map for O(1) lookup performance.
     */
    constructor() {
        /**
         * Tileset cache: filename -> array of ImageData objects
         * 
         * Key: Original filename (e.g., "BACK0.DN1")
         * Value: Array of decoded tile ImageData objects
         * 
         * This prevents re-decoding tilesets when they're used
         * by multiple levels or viewed multiple times.
         */
        this.cache = new Map();
    }
    
    /* ====================================================================== */
    /* CACHE MANAGEMENT                                                       */
    /* ====================================================================== */
    
    /**
     * Clears the tileset cache.
     * 
     * Must be called when the EGA palette changes, since cached tiles
     * are rendered with the old palette and would display incorrect colors.
     * 
     * Also useful for freeing memory when working with large asset sets.
     * 
     * Use cases:
     * - User uploads custom palette
     * - User resets to default palette
     * - Manual memory cleanup
     */
    clearCache() {
        this.cache.clear();
    }
    
    /* ====================================================================== */
    /* TILESET LOADING AND PROCESSING                                         */
    /* ====================================================================== */
    
    /**
     * Loads a tileset file and converts it to an array of ImageData objects.
     * 
     * This is the main entry point for loading game graphics. It handles:
     * 1. Cache checking (return cached version if available)
     * 2. File reading (binary data)
     * 3. Configuration detection (tile size, header offset)
     * 4. Tile decoding (binary -> ImageData)
     * 5. Opacity enforcement (for map tiles)
     * 6. Cache storage (for future use)
     * 
     * Process Flow:
     * -------------
     * Check cache → Read file → Detect format → Calculate layout →
     * → Decode tiles → Enforce opacity → Cache result → Return array
     * 
     * @param {File} fileObject - The tileset file to load (e.g., BACK0.DN1)
     * 
     * @returns {Promise<Array<ImageData>>} Array of decoded tiles where:
     *   - Index: Tile ID (0-based)
     *   - Value: ImageData object ready for canvas rendering
     *   - Length: Variable (depends on file size)
     * 
     * @example
     * const tiles = await assetManager.loadTileset(backFile);
     * ctx.putImageData(tiles[42], x, y); // Draw tile #42
     */
    async loadTileset(fileObject) {
        /* ------------------------------------------------------------------ */
        /* Check Cache for Previously Loaded Tileset                          */
        /* ------------------------------------------------------------------ */
        
        /**
         * If this file has been loaded before, return the cached version.
         * This avoids expensive re-decoding of the same tileset.
         * 
         * Cache key is the filename (e.g., "BACK0.DN1").
         * Different episodes use different files, so filename uniquely
         * identifies each tileset.
         */
        if (this.cache.has(fileObject.name)) {
            return this.cache.get(fileObject.name);
        }
        
        /* ------------------------------------------------------------------ */
        /* Read File as Binary Data                                           */
        /* ------------------------------------------------------------------ */
        
        const buffer = await fileObject.arrayBuffer();
        const data = new Uint8Array(buffer);
        const name = fileObject.name.toUpperCase(); // Normalize for comparison
        
        /* ================================================================== */
        /* CONFIGURATION: DETECT TILE DIMENSIONS AND HEADER                   */
        /* ================================================================== */
        
        /**
         * Different file types use different tile dimensions.
         * We detect the file type from the filename prefix.
         */
        
        /* ------------------------------------------------------------------ */
        /* Default: Standard 16×16 Tiles                                      */
        /* ------------------------------------------------------------------ */
        
        let width = 16;   // Tile width in pixels
        let height = 16;  // Tile height in pixels
        let headerOffset = 3; // Standard Apogee 3-byte header
        
        /* ------------------------------------------------------------------ */
        /* Special Case: 8×8 Font Tiles                                       */
        /* ------------------------------------------------------------------ */
        
        /**
         * Font files use smaller 8×8 tiles for text characters.
         * This allows for more efficient storage of the character set
         * and provides standard text metrics.
         */
        if (name.startsWith("FONT")) {
            width = 8;
            height = 8;
        }
        
        /* ------------------------------------------------------------------ */
        /* Calculate Tile Size in Bytes                                       */
        /* ------------------------------------------------------------------ */
        
        /**
         * Tile size calculation:
         * 
         * Formula: (width × height ÷ 8) × 5
         * 
         * Breakdown:
         * - width × height = total pixels
         * - ÷ 8 = bytes per plane (8 pixels per byte)
         * - × 5 = five planes (1 mask + 4 color)
         * 
         * Examples:
         * - Standard tile: (16 × 16 ÷ 8) × 5 = 32 × 5 = 160 bytes
         * - Font tile: (8 × 8 ÷ 8) × 5 = 8 × 5 = 40 bytes
         * 
         * All Duke Nukem 1 tiles use 5-plane format:
         * 1. Mask plane (transparency)
         * 2. Blue plane
         * 3. Green plane
         * 4. Red plane
         * 5. Intensity plane
         */
        const tileSize = (width * height / 8) * 5;
        
        /* ------------------------------------------------------------------ */
        /* Handle Files Without Header                                        */
        /* ------------------------------------------------------------------ */
        
        /**
         * Some files may not have the standard 3-byte header.
         * If the file is too small to contain a header, assume no header.
         * 
         * This prevents reading beyond file boundaries.
         */
        if (data.length < headerOffset) {
            headerOffset = 0;
        }
        
        /* ------------------------------------------------------------------ */
        /* Calculate Number of Tiles in File                                  */
        /* ------------------------------------------------------------------ */
        
        /**
         * Determine how many complete tiles the file contains.
         * 
         * Process:
         * 1. Subtract header to get data length
         * 2. Divide by tile size to get count
         * 3. Use Math.floor to ignore partial tiles
         * 
         * Partial tiles (incomplete data at end of file) are ignored
         * as they cannot be properly decoded.
         */
        const dataLength = data.length - headerOffset;
        const tileCount = Math.floor(dataLength / tileSize);
        
        /* ================================================================== */
        /* DECODE TILES                                                       */
        /* ================================================================== */
        
        /**
         * Process each tile sequentially and build array of ImageData objects.
         * Each ImageData object can be directly rendered to HTML5 Canvas.
         */
        
        const tiles = [];
        
        for (let i = 0; i < tileCount; i++) {
            /* -------------------------------------------------------------- */
            /* Extract Tile Data from File                                    */
            /* -------------------------------------------------------------- */
            
            /**
             * Calculate byte offset for this tile.
             * Formula: header_offset + (tile_index × tile_size)
             * 
             * Then slice out exactly tileSize bytes.
             */
            const offset = headerOffset + (i * tileSize);
            const tileData = data.slice(offset, offset + tileSize);
            
            /* -------------------------------------------------------------- */
            /* Decode Tile Using EGA Decoder                                  */
            /* -------------------------------------------------------------- */
            
            /**
             * Convert binary planar data to RGBA ImageData.
             * 
             * Parameters:
             * - tileData: Raw bytes for this tile
             * - width: Tile width in pixels
             * - height: Tile height in pixels
             * - true: Include mask plane (transparency support)
             * 
             * The EGA decoder handles:
             * - Planar to packed pixel conversion
             * - Color palette lookup
             * - Transparency mask application
             * - RGBA buffer creation
             */
            const imageData = EGA.decodeTile(tileData, width, height, true);
            
            /* ============================================================== */
            /* FORCE OPACITY FOR MAP TILES                                    */
            /* ============================================================== */
            
            /**
             * Map tiles (SOLID and BACK) must always be opaque in-game,
             * even if the file contains a transparency mask.
             * 
             * Why this override is necessary:
             * --------------------------------
             * 1. Game Design:
             *    - Map tiles form the solid level geometry
             *    - Players should never see through floors/walls
             *    - Transparency would create visual holes in levels
             * 
             * 2. File Format Quirk:
             *    - Some SOLID/BACK files include mask planes
             *    - These masks were used during development/editing
             *    - Game engine ignores masks for these tile types
             * 
             * 3. Correct Rendering:
             *    - We must replicate the game's behavior
             *    - Override any transparency with full opacity
             * 
             * Implementation:
             * ---------------
             * Walk through alpha channel (every 4th byte) and set to 255.
             * This forces all pixels to be fully opaque.
             */
            
            if (name.startsWith("SOLID") || name.startsWith("BACK")) {
    /**
     * Alpha channel is at every 4th position (index 3, 7, 11, ...).
     * 
     * ImageData format: [R, G, B, A, R, G, B, A, ...]
     *                    0  1  2  3  4  5  6  7  ...
     * 
     * We start at index 3 and increment by 4 each time.
     * 
     * IMPORTANT: We modify a copy and create new ImageData
     * because some browsers (like Brave) don't properly update
     * when imageData.data is modified directly.
     */
    const pixels = new Uint8ClampedArray(imageData.data); // Create copy
    
    for (let p = 3; p < pixels.length; p += 4) {
        pixels[p] = 255; // Set alpha to 100% (fully opaque)
    }
    
    // Create new ImageData with corrected pixels
    imageData = new ImageData(pixels, width, height);
}
            
            /* -------------------------------------------------------------- */
            /* Add Tile to Array                                              */
            /* -------------------------------------------------------------- */
            
            tiles.push(imageData);
        }
        
        /* ================================================================== */
        /* CACHE AND RETURN RESULT                                            */
        /* ================================================================== */
        
        /**
         * Store processed tiles in cache for future use.
         * This dramatically speeds up subsequent loads of the same file.
         * 
         * Cache invalidation happens when:
         * - User changes EGA palette (clearCache() called)
         * - Page refresh (cache is in-memory only)
         */
        this.cache.set(fileObject.name, tiles);
        
        return tiles;
    }
}
