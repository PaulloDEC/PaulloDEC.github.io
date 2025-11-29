/**
 * EGA (Enhanced Graphics Adapter) Decoder
 * 
 * Decodes Duke Nukem 1's planar EGA graphics format into modern RGBA ImageData.
 * 
 * EGA Format Overview:
 * - Uses 16-color palette (4-bit color)
 * - Colors encoded in planar format (separate bit planes for each component)
 * - Optional transparency mask plane
 * - Data organized by scanlines and 8-pixel chunks
 */

export class EGA {
    /**
     * Standard EGA 16-color palette
     * Each color is [R, G, B] in 0-255 range
     * 
     * Color indices:
     * 0-7: Standard colors (dark variants)
     * 8-15: Bright variants (intensity bit set)
     */
    static PALETTE = [
        [0, 0, 0],          // 0: Black
        [0, 0, 170],        // 1: Blue
        [0, 170, 0],        // 2: Green
        [0, 170, 170],      // 3: Cyan
        [170, 0, 0],        // 4: Red
        [170, 0, 170],      // 5: Magenta
        [170, 85, 0],       // 6: Brown
        [170, 170, 170],    // 7: Light Gray
        [85, 85, 85],       // 8: Dark Gray
        [85, 85, 255],      // 9: Bright Blue
        [85, 255, 85],      // 10: Bright Green
        [85, 255, 255],     // 11: Bright Cyan
        [255, 85, 85],      // 12: Bright Red
        [255, 85, 255],     // 13: Bright Magenta
        [255, 255, 85],     // 14: Yellow
        [255, 255, 255]     // 15: White
    ];
    
    /**
     * Decodes a single EGA tile from raw binary data
     * 
     * @param {Uint8Array} rawData - Raw tile bytes
     * @param {number} width - Tile width in pixels (default: 16)
     * @param {number} height - Tile height in pixels (default: 16)
     * @param {boolean} hasMask - Whether tile includes transparency mask (default: true)
     * @returns {ImageData} Decoded tile as RGBA ImageData
     */
    static decodeTile(rawData, width = 16, height = 16, hasMask = true) {
        // Create output buffer (4 bytes per pixel: RGBA)
        const pixelData = new Uint8ClampedArray(width * height * 4);
        let readIndex = 0;
        
        // ====================================================================
        // Decoding Structure:
        // ====================================================================
        // Loop 1: Iterate through each scanline (top to bottom)
        // Loop 2: Process 8-pixel chunks (left to right)
        // Loop 3: Extract individual pixels from bit planes
        
        // Loop 1: Process each row
        for (let y = 0; y < height; y++) {
            
            // Loop 2: Process 8-pixel chunks
            // Standard 16-pixel wide tiles use 2 chunks: left (0-7), right (8-15)
            const numChunks = width / 8;
            
            for (let chunk = 0; chunk < numChunks; chunk++) {
                
                // Read bit planes for this 8-pixel chunk
                let byteMask, byteBlue, byteGreen, byteRed, byteInt;
                
                if (hasMask) {
                    // 5-byte format: Mask, Blue, Green, Red, Intensity
                    byteMask = rawData[readIndex++];
                    byteBlue = rawData[readIndex++];
                    byteGreen = rawData[readIndex++];
                    byteRed = rawData[readIndex++];
                    byteInt = rawData[readIndex++];
                } else {
                    // 4-byte format: Blue, Green, Red, Intensity
                    // (Assume all pixels opaque)
                    byteMask = 0xFF;
                    byteBlue = rawData[readIndex++];
                    byteGreen = rawData[readIndex++];
                    byteRed = rawData[readIndex++];
                    byteInt = rawData[readIndex++];
                }
                
                // Calculate starting X position for this chunk
                const xOffset = chunk * 8;
                
                // Loop 3: Extract 8 pixels from bit planes
                // Bits are read from MSB (bit 7) to LSB (bit 0)
                for (let bit = 7; bit >= 0; bit--) {
                    const bitFlag = 1 << bit; // Create bit mask
                    
                    // Check if pixel is opaque
                    const isOpaque = (byteMask & bitFlag) !== 0;
                    
                    // Calculate pixel X position
                    // Reverse bit order: bit 7 = pixel 0, bit 0 = pixel 7
                    const x = xOffset + (7 - bit);
                    
                    // Calculate pixel index in output buffer
                    const idx = (y * width + x) * 4;
                    
                    // ========================================================
                    // Handle Transparent Pixels
                    // ========================================================
                    if (!isOpaque) {
                        pixelData[idx + 3] = 0; // Set alpha to 0
                    }
                    // ========================================================
                    // Handle Opaque Pixels
                    // ========================================================
                    else {
                        // Extract color component bits
                        const b = (byteBlue & bitFlag) ? 1 : 0;
                        const g = (byteGreen & bitFlag) ? 2 : 0;
                        const r = (byteRed & bitFlag) ? 4 : 0;
                        const i = (byteInt & bitFlag) ? 8 : 0;
                        
                        // Combine into 4-bit color index (IRGB format)
                        const colorIndex = i | r | g | b;
                        
                        // Look up RGB values from palette
                        const color = this.PALETTE[colorIndex];
                        
                        // Write RGBA values to output buffer
                        pixelData[idx] = color[0];       // Red
                        pixelData[idx + 1] = color[1];   // Green
                        pixelData[idx + 2] = color[2];   // Blue
                        pixelData[idx + 3] = 255;        // Alpha (opaque)
                    }
                }
            }
        }
        
        // Return as ImageData object
        return new ImageData(pixelData, width, height);
    }
}
