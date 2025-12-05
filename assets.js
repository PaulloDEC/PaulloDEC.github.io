/**
 * Asset Manager
 * 
 * Handles loading and caching of Duke Nukem 1 tileset files.
 * Processes binary tile data and converts it to ImageData format.
 */

import { EGA } from './ega.js';

export class AssetManager {
    constructor() {
        // Cache loaded tilesets to avoid redundant processing
        this.cache = new Map();
    }
    
	/**
     * Clears the tileset cache.
     * Call this when the EGA Palette changes.
     */
    clearCache() {
        this.cache.clear();
    }
	
    /**
     * Loads a tileset file and converts it to ImageData array
     * 
     * @param {File} fileObject - The tileset file to load
     * @returns {Promise<Array<ImageData>>} Array of tile ImageData objects
     */
    async loadTileset(fileObject) {
        // Return cached version if already loaded
        if (this.cache.has(fileObject.name)) {
            return this.cache.get(fileObject.name);
        }
        
        // Read file as binary data
        const buffer = await fileObject.arrayBuffer();
        const data = new Uint8Array(buffer);
        const name = fileObject.name.toUpperCase();
        
        // ====================================================================
        // Configuration: Tile dimensions and file header
        // ====================================================================
        
        let width = 16;
        let height = 16;
        let headerOffset = 3; // Standard Apogee header size
        
        // Font files use 8x8 tiles
        if (name.startsWith("FONT")) {
            width = 8;
            height = 8;
        }
        
        // Calculate tile size in bytes
        // All files use 5-plane format (mask + 4 color planes)
        const tileSize = (width * height / 8) * 5;
        
        // Handle files without header
        if (data.length < headerOffset) {
            headerOffset = 0;
        }
        
        // Calculate number of tiles in file
        const dataLength = data.length - headerOffset;
        const tileCount = Math.floor(dataLength / tileSize);
        
        // ====================================================================
        // Decode tiles
        // ====================================================================
        
        const tiles = [];
        
        for (let i = 0; i < tileCount; i++) {
            const offset = headerOffset + (i * tileSize);
            const tileData = data.slice(offset, offset + tileSize);
            
            // Decode tile using EGA decoder (includes mask and color data)
            const imageData = EGA.decodeTile(tileData, width, height, true);
            
            // ================================================================
            // Force Opacity for Map Tiles
            // ================================================================
            // SOLID and BACK files should always be opaque in-game,
            // even if the file contains a transparency mask
            
            if (name.startsWith("SOLID") || name.startsWith("BACK")) {
                const pixels = imageData.data;
                for (let p = 3; p < pixels.length; p += 4) {
                    pixels[p] = 255; // Set alpha to 100%
                }
            }
            
            tiles.push(imageData);
        }
        
        // Cache the processed tiles
        this.cache.set(fileObject.name, tiles);
        return tiles;
    }
}
