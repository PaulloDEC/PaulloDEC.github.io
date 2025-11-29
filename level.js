/**
 * Level Manager
 * 
 * Handles loading and parsing of Duke Nukem 1 level files (WORLD*.DN*).
 * 
 * Level File Format:
 * - Fixed size: 128 columns × 90 rows = 11,520 tiles
 * - Each tile: 2 bytes (16-bit value, little-endian)
 * - Header: Variable size (file size - map data size)
 * - Tile values:
 *   - 0x0000-0x2FFF: Map tiles (stored as memory offsets, divide by 32)
 *   - 0x3000+: Active sprites (stored as raw IDs, don't convert)
 */

export class LevelManager {
    constructor() {
        this.currentLevel = null;
        this.width = 128;
        this.height = 90;
    }
    
    /**
     * Loads and parses a level file
     * 
     * @param {File} fileObject - The level file to load
     * @returns {Promise<Object>} Parsed level data
     * @throws {Error} If file is too small or invalid
     */
    async loadLevel(fileObject) {
        // Read file as binary data
        const buffer = await fileObject.arrayBuffer();
        const data = new DataView(buffer);
        
        // ====================================================================
        // Validate File Size
        // ====================================================================
        
        const EXPECTED_SIZE = 128 * 90 * 2; // 11,520 tiles × 2 bytes
        
        if (buffer.byteLength < EXPECTED_SIZE) {
            throw new Error(
                `File too small. Expected ${EXPECTED_SIZE} bytes, ` +
                `got ${buffer.byteLength}`
            );
        }
        
        // ====================================================================
        // Calculate Header Offset
        // ====================================================================
        
        // Map data always starts at (file_size - expected_size)
        const headerOffset = buffer.byteLength - EXPECTED_SIZE;
        
        console.log(`Loading Level: ${fileObject.name}`);
        
        // ====================================================================
        // Parse Tile Grid
        // ====================================================================
        
        const grid = new Uint16Array(this.width * this.height);
        
        for (let i = 0; i < grid.length; i++) {
            // Read 2-byte tile value (little-endian)
            const rawValue = data.getUint16(headerOffset + (i * 2), true);
            
            // ================================================================
            // CRITICAL: Tile Value Conversion
            // ================================================================
            // Duke Nukem 1 uses different encoding for tiles vs sprites:
            //
            // - Standard Tiles (0x0000-0x2FFF):
            //   Stored as memory offsets (value × 32)
            //   Must divide by 32 to get tile index
            //   Example: 6144 ÷ 32 = 192
            //
            // - Active Sprites (0x3000+):
            //   Stored as raw sprite IDs
            //   Must NOT be divided
            //   Example: 12333 stays as 12333 (0x3030)
            //
            // Source: Duke 1 Level Format.pdf
            // ================================================================
            
            if (rawValue >= 0x3000) {
                // Sprite ID - keep as-is
                grid[i] = rawValue;
            } else {
                // Tile offset - convert to index
                grid[i] = rawValue / 32;
            }
        }
        
        // ====================================================================
        // Store Level Data
        // ====================================================================
        
        this.currentLevel = {
            name: fileObject.name,
            grid: grid,
            width: this.width,
            height: this.height
        };
        
        return this.currentLevel;
    }
}
