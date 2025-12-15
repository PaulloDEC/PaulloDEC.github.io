/**
 * ============================================================================
 * LEVEL MANAGER - MAP FILE PARSER
 * ============================================================================
 * 
 * Handles loading and parsing of Duke Nukem 1 level files (WORLDAL*.DN*).
 * Converts binary map data into a structured grid format suitable for rendering.
 * 
 * Level File Overview:
 * --------------------
 * Duke Nukem 1 level files store the complete map layout as a 2D grid of
 * tile IDs. Each position can contain either a background/solid tile or
 * an active sprite (enemy, bonus, etc.).
 * 
 * File Format Specifications:
 * ---------------------------
 * 
 * Grid Dimensions:
 * - Width: 128 tiles (fixed)
 * - Height: 90 tiles (fixed)
 * - Total: 11,520 tiles per level
 * 
 * Data Storage:
 * - Format: Binary (little-endian 16-bit values)
 * - Tile Size: 2 bytes per tile
 * - Grid Size: 11,520 tiles × 2 bytes = 23,040 bytes
 * - Header: Variable size (file size - grid size)
 * 
 * File Structure:
 * [Variable Header] [23,040 bytes of tile data]
 * 
 * The header contains level metadata, but we don't parse it - we only
 * need the map data which is always at the end of the file.
 * 
 * Tile Value Encoding (Critical):
 * --------------------------------
 * Duke Nukem 1 uses TWO different encoding schemes in the same grid:
 * 
 * 1. Standard Tiles (0x0000-0x2FFF):
 *    - Stored as memory offsets (address in video RAM)
 *    - Formula: memory_offset = tile_index × 32
 *    - Must divide by 32 to get actual tile index
 *    - Example: Value 6144 → 6144 ÷ 32 = Tile 192
 * 
 * 2. Active Sprites (0x3000+):
 *    - Stored as raw sprite IDs (hexadecimal)
 *    - Must NOT be converted or divided
 *    - Example: Value 0x3030 (12336) → Sprite ID 0x3030
 * 
 * Why This Dual Encoding?
 * ------------------------
 * This encoding scheme is a relic of the original game engine's memory
 * management. Background tiles were referenced by their memory addresses
 * in EGA video RAM (which incremented by 32 bytes per tile), while sprites
 * needed direct ID lookup for their behavior routines.
 * 
 * The threshold of 0x3000 was chosen because:
 * - It's safely above all tile indices (max ~380 tiles)
 * - It provides a clear separation for the game logic
 * - It allows efficient if-else branching in the game loop
 * 
 * Reference: Duke 1 Level Format.pdf (reverse engineering documentation)
 */

export class LevelManager {
    /* ====================================================================== */
    /* CONSTRUCTOR                                                            */
    /* ====================================================================== */
    
    /**
     * Creates a new level manager instance.
     * 
     * Initializes with Duke Nukem 1's fixed grid dimensions.
     * These dimensions are hardcoded in the game engine and cannot change.
     */
    constructor() {
        this.currentLevel = null; // Cached parsed level data
        
        /**
         * Fixed grid dimensions for all Duke Nukem 1 levels.
         * These values are constants in the game engine.
         */
        this.width = 128;   // Tiles across (horizontal)
        this.height = 90;   // Tiles down (vertical)
    }
    
    /* ====================================================================== */
    /* LEVEL LOADING AND PARSING                                              */
    /* ====================================================================== */
    
    /**
     * Loads and parses a Duke Nukem 1 level file.
     * 
     * This method performs the complete level loading process:
     * 1. Read binary file data
     * 2. Validate file size
     * 3. Calculate header offset
     * 4. Parse tile grid
     * 5. Apply tile value conversion
     * 6. Return structured level data
     * 
     * The parser handles both tile IDs and sprite IDs correctly by
     * detecting which encoding scheme each value uses (memory offset vs raw ID).
     * 
     * Process Flow:
     * -------------
     * File bytes → DataView → Validate size → Calculate offset →
     * → Parse grid → Convert values → Return level object
     * 
     * @param {File} fileObject - The WORLDAL*.DN* file to load
     * 
     * @returns {Promise<Object>} Parsed level data containing:
     *   - name: Level filename
     *   - grid: Uint16Array of tile/sprite IDs (128×90 = 11,520 values)
     *   - width: Grid width in tiles (128)
     *   - height: Grid height in tiles (90)
     * 
     * @throws {Error} If file is too small (corrupted or not a valid level)
     */
    async loadLevel(fileObject) {
        /* ------------------------------------------------------------------ */
        /* Read File as Binary Data                                           */
        /* ------------------------------------------------------------------ */
        
        /**
         * Load entire file into memory as ArrayBuffer.
         * This gives us random access to the binary data.
         */
        const buffer = await fileObject.arrayBuffer();
        
        /**
         * Wrap in DataView for typed reading of multi-byte values.
         * DataView handles endianness conversion automatically.
         */
        const data = new DataView(buffer);
        
        /* ================================================================== */
        /* VALIDATE FILE SIZE                                                 */
        /* ================================================================== */
        
        /**
         * Calculate expected minimum size.
         * 
         * A valid level file must contain at least the grid data.
         * Format: 128 tiles × 90 tiles × 2 bytes = 23,040 bytes
         * 
         * Files smaller than this are corrupted or not level files.
         */
        const EXPECTED_SIZE = 128 * 90 * 2; // 23,040 bytes
        
        if (buffer.byteLength < EXPECTED_SIZE) {
            throw new Error(
                `File too small. Expected ${EXPECTED_SIZE} bytes, ` +
                `got ${buffer.byteLength}`
            );
        }
        
        /* ================================================================== */
        /* CALCULATE HEADER OFFSET                                            */
        /* ================================================================== */
        
        /**
         * Level files have variable-length headers containing metadata.
         * We don't need to parse the header - we only need the map data.
         * 
         * Map data is ALWAYS stored at the end of the file.
         * 
         * Offset calculation:
         * header_offset = file_size - expected_grid_size
         * 
         * Example:
         * - File is 23,300 bytes
         * - Grid requires 23,040 bytes
         * - Header offset = 23,300 - 23,040 = 260
         * - Header is first 260 bytes, grid starts at byte 260
         */
        const headerOffset = buffer.byteLength - EXPECTED_SIZE;
        
        console.log(`Loading Level: ${fileObject.name}`);
        
        /* ================================================================== */
        /* PARSE TILE GRID                                                    */
        /* ================================================================== */
        
        /**
         * Create output array for tile IDs.
         * 
         * Using Uint16Array for:
         * - Efficient memory usage (2 bytes per value)
         * - Automatic value clamping (0-65535)
         * - Fast array operations
         * 
         * Size: 128 × 90 = 11,520 values
         */
        const grid = new Uint16Array(this.width * this.height);
        
        /* ------------------------------------------------------------------ */
        /* Read and Convert Each Tile Value                                   */
        /* ------------------------------------------------------------------ */
        
        /**
         * Process grid in row-major order (left-to-right, top-to-bottom).
         * This matches how the data is stored in the file.
         */
        for (let i = 0; i < grid.length; i++) {
            /* -------------------------------------------------------------- */
            /* Read 16-bit Value (Little-Endian)                              */
            /* -------------------------------------------------------------- */
            
            /**
             * Read 2-byte tile value from file.
             * 
             * Position: headerOffset + (i × 2)
             * - headerOffset: Skip the header
             * - i × 2: Each tile is 2 bytes
             * 
             * Little-endian (true): Low byte first, then high byte
             * - Example bytes: [0x40, 0x18] = 0x1840 = 6208
             */
            const rawValue = data.getUint16(headerOffset + (i * 2), true);
            
            /* ============================================================== */
            /* CRITICAL: TILE VALUE CONVERSION                                */
            /* ============================================================== */
            
            /**
             * Duke Nukem 1 uses different encoding for tiles vs sprites.
             * We must detect which encoding and convert appropriately.
             * 
             * DETECTION RULE:
             * ---------------
             * if (rawValue >= 0x3000) {
             *     // It's a sprite ID - use as-is
             * } else {
             *     // It's a tile offset - divide by 32
             * }
             * 
             * ENCODING SCHEME 1: Standard Tiles (0x0000-0x2FFF)
             * --------------------------------------------------
             * Stored as memory offsets in EGA video RAM.
             * 
             * Why multiply by 32?
             * - EGA tiles are 16×16 pixels
             * - Each pixel is 4 bits (16 colors)
             * - Each tile needs 16×16÷2 = 128 bytes
             * - With planar format, this becomes 32 bytes per plane × 4 planes
             * - Game uses 32-byte increments to address tiles
             * 
             * Conversion formula: tile_index = memory_offset ÷ 32
             * 
             * Example:
             * - Raw value: 6144
             * - Tile index: 6144 ÷ 32 = 192 (breakable brick)
             * 
             * ENCODING SCHEME 2: Active Sprites (0x3000+)
             * --------------------------------------------
             * Stored as raw sprite IDs (hexadecimal notation).
             * 
             * These are NOT memory offsets - they're direct identifiers
             * used for sprite behavior lookup tables.
             * 
             * NO conversion needed - use value as-is.
             * 
             * Example:
             * - Raw value: 0x3030 (12336 decimal)
             * - Sprite ID: 0x3030 (stays as 12336)
             * 
             * WHY 0x3000 AS THE THRESHOLD?
             * -----------------------------
             * - Maximum tile index is ~380 (×32 = 12,160 = 0x2F80)
             * - 0x3000 (12,288) is safely above all tile offsets
             * - Provides clean separation: < 0x3000 = tiles, >= 0x3000 = sprites
             * 
             * Source: Duke 1 Level Format.pdf (community reverse engineering)
             */
            
            if (rawValue >= 0x3000) {
                /* ---------------------------------------------------------- */
                /* SPRITE ID - Keep Raw Value                                 */
                /* ---------------------------------------------------------- */
                
                /**
                 * Value is already a sprite ID.
                 * Store directly without modification.
                 * 
                 * These IDs map to entries in SPRITE_MAP (sprites.js)
                 * which defines sprite behavior and graphics.
                 */
                grid[i] = rawValue;
                
            } else {
                /* ---------------------------------------------------------- */
                /* TILE OFFSET - Convert to Index                             */
                /* ---------------------------------------------------------- */
                
                /**
                 * Value is a memory offset.
                 * Divide by 32 to get tile index.
                 * 
                 * The result maps to entries in the tileset arrays
                 * (BACK0-3, SOLID0-3) which contain the actual graphics.
                 */
                grid[i] = rawValue / 32;
            }
        }
        
        /* ================================================================== */
        /* STORE AND RETURN LEVEL DATA                                        */
        /* ================================================================== */
        
        /**
         * Cache the parsed level data for potential re-use.
         * This avoids re-parsing if the same level is loaded again.
         */
        this.currentLevel = {
            name: fileObject.name,  // Original filename
            grid: grid,             // Tile/sprite ID array
            width: this.width,      // Grid width (128)
            height: this.height     // Grid height (90)
        };
        
        return this.currentLevel;
    }
}
