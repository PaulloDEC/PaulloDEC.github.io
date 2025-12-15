/**
 * ============================================================================
 * EGA (ENHANCED GRAPHICS ADAPTER) DECODER
 * ============================================================================
 * 
 * Decodes Duke Nukem 1's planar EGA graphics format into modern RGBA ImageData
 * suitable for HTML5 Canvas rendering.
 * 
 * EGA Graphics Overview:
 * ----------------------
 * The Enhanced Graphics Adapter (EGA) was IBM's mid-1980s graphics standard
 * supporting 16 simultaneous colors from a 64-color palette. Duke Nukem 1
 * uses the standard 16-color EGA palette.
 * 
 * Planar Format Explained:
 * ------------------------
 * Unlike modern graphics formats that store pixels sequentially (RGB, RGB, RGB...),
 * EGA uses a "planar" format where color components are stored separately:
 * 
 * - Bit Plane 0: Blue component (1 bit per pixel)
 * - Bit Plane 1: Green component (1 bit per pixel)
 * - Bit Plane 2: Red component (1 bit per pixel)
 * - Bit Plane 3: Intensity component (1 bit per pixel)
 * - Mask Plane: Transparency (1 bit per pixel, optional)
 * 
 * Each plane stores one bit of color information per pixel. Four bits combine
 * to form a 4-bit color index (0-15) that maps to the EGA palette.
 * 
 * Data Organization:
 * ------------------
 * For tiles (16x16 pixels):
 * - Organized by scanline (top to bottom)
 * - Each scanline divided into 8-pixel chunks
 * - Each chunk contains 4-5 bytes (one per plane)
 * - Bits read MSB-first (bit 7 = leftmost pixel)
 * 
 * For full screens (320x200):
 * - Four complete planes stored sequentially
 * - No transparency mask
 * - Total size: 32,000 bytes (8,000 per plane)
 * 
 * Color Index Format (IRGB):
 * ---------------------------
 * Bit 3 (I): Intensity (brightens color)
 * Bit 2 (R): Red component
 * Bit 1 (G): Green component
 * Bit 0 (B): Blue component
 * 
 * Example: Color index 0b1110 (14) = Yellow
 * - I=1 (bright), R=1, G=1, B=0
 */

export class EGA {
    /* ====================================================================== */
    /* STANDARD EGA PALETTE                                                   */
    /* ====================================================================== */
    
    /**
     * Standard 16-color EGA palette.
     * 
     * This is the canonical IBM EGA palette used by Duke Nukem 1 and most
     * DOS games of the era. Colors are organized in pairs - the first 8
     * are darker variants, the second 8 are their bright counterparts
     * (achieved by setting the intensity bit).
     * 
     * Color Organization:
     * - Index 0-7: Standard colors (dark)
     * - Index 8-15: Bright variants (intensity bit set)
     * 
     * The intensity bit doesn't simply make colors brighter - it adds
     * specific RGB values that were characteristic of CRT monitors.
     * For example, Brown (6) becomes Yellow (14) with intensity.
     * 
     * Each color is defined as [R, G, B] in 0-255 range.
     * This palette can be replaced at runtime via the palette easter egg.
     */
    static PALETTE = [
        [0, 0, 0],          // 0: Black
        [0, 0, 170],        // 1: Blue
        [0, 170, 0],        // 2: Green
        [0, 170, 170],      // 3: Cyan
        [170, 0, 0],        // 4: Red
        [170, 0, 170],      // 5: Magenta
        [170, 85, 0],       // 6: Brown (Note: Not dark yellow)
        [170, 170, 170],    // 7: Light Gray
        [85, 85, 85],       // 8: Dark Gray (Black + Intensity)
        [85, 85, 255],      // 9: Bright Blue
        [85, 255, 85],      // 10: Bright Green
        [85, 255, 255],     // 11: Bright Cyan
        [255, 85, 85],      // 12: Bright Red
        [255, 85, 255],     // 13: Bright Magenta
        [255, 255, 85],     // 14: Yellow (Brown + Intensity)
        [255, 255, 255]     // 15: White
    ];
    
    /* ====================================================================== */
    /* TILE DECODING (16x16 SPRITES AND TILES)                                */
    /* ====================================================================== */
    
    /**
     * Decodes a single EGA tile from raw binary data.
     * 
     * This method handles the standard Duke Nukem 1 tile format used for:
     * - Background tiles (BACK*.DN*)
     * - Solid tiles (SOLID*.DN*)
     * - Animated sprites (ANIM*.DN*)
     * - Object sprites (OBJECT*.DN*)
     * - Other graphic assets (MAN*.DN*, FONT*.DN*, etc.)
     * 
     * Tile Format Structure:
     * ----------------------
     * For a standard 16x16 tile with transparency:
     * - 16 scanlines (rows)
     * - 2 chunks per scanline (8 pixels each)
     * - 5 bytes per chunk (Mask, Blue, Green, Red, Intensity)
     * - Total: 16 * 2 * 5 = 160 bytes
     * 
     * Decoding Process:
     * -----------------
     * 1. Iterate through each scanline (top to bottom)
     * 2. Process chunks within the scanline (left to right)
     * 3. Read 5 plane bytes for the chunk
     * 4. Extract 8 pixels by testing each bit position
     * 5. Combine bits into color index and look up palette color
     * 6. Write RGBA values to output buffer
     * 
     * Bit Order:
     * ----------
     * Bits are read MSB-first (bit 7 to bit 0), mapping to pixels left-to-right.
     * Example for first chunk (pixels 0-7):
     * - Bit 7 = Pixel 0 (leftmost)
     * - Bit 6 = Pixel 1
     * - ...
     * - Bit 0 = Pixel 7 (rightmost of chunk)
     * 
     * @param {Uint8Array} rawData - Raw tile bytes from game file
     * @param {number} width - Tile width in pixels (default: 16)
     * @param {number} height - Tile height in pixels (default: 16)
     * @param {boolean} hasMask - Whether tile includes transparency mask (default: true)
     * @returns {ImageData} Decoded tile as RGBA ImageData for canvas rendering
     */
    static decodeTile(rawData, width = 16, height = 16, hasMask = true) {
        /* ------------------------------------------------------------------ */
        /* Create Output Buffer                                               */
        /* ------------------------------------------------------------------ */
        
        /**
         * Allocate RGBA buffer (4 bytes per pixel).
         * Uint8ClampedArray automatically clamps values to 0-255 range,
         * which is required for ImageData compatibility.
         */
        const pixelData = new Uint8ClampedArray(width * height * 4);
        let readIndex = 0; // Current read position in input data
        
        /* ================================================================== */
        /* DECODING LOOP - THREE NESTED LEVELS                                */
        /* ================================================================== */
        
        /**
         * Decoding Structure:
         * 
         * Loop 1 (Outer): Process each scanline from top to bottom
         * Loop 2 (Middle): Process 8-pixel chunks within scanline (left to right)
         * Loop 3 (Inner): Extract individual pixels from bit planes
         * 
         * This organization matches how the data is stored in the file:
         * scanlines are complete rows, chunks are byte-aligned groups of 8 pixels,
         * and bits represent individual pixels.
         */
        
        /* ------------------------------------------------------------------ */
        /* LOOP 1: Process Each Scanline (Row)                                */
        /* ------------------------------------------------------------------ */
        
        for (let y = 0; y < height; y++) {
            
            /* -------------------------------------------------------------- */
            /* LOOP 2: Process 8-Pixel Chunks Within Scanline                 */
            /* -------------------------------------------------------------- */
            
            /**
             * Calculate number of chunks based on width.
             * 
             * Standard tiles are 16 pixels wide = 2 chunks:
             * - Chunk 0: Pixels 0-7 (left half)
             * - Chunk 1: Pixels 8-15 (right half)
             * 
             * Other widths are possible (e.g., 8-pixel wide = 1 chunk).
             */
            const numChunks = width / 8;
            
            for (let chunk = 0; chunk < numChunks; chunk++) {
                
                /* ---------------------------------------------------------- */
                /* Read Bit Plane Bytes for This Chunk                        */
                /* ---------------------------------------------------------- */
                
                /**
                 * Each chunk requires 4-5 bytes depending on transparency:
                 * 
                 * With Mask (5 bytes):
                 *   1. Mask byte (transparency: 1=opaque, 0=transparent)
                 *   2. Blue plane byte
                 *   3. Green plane byte
                 *   4. Red plane byte
                 *   5. Intensity plane byte
                 * 
                 * Without Mask (4 bytes):
                 *   1. Blue plane byte
                 *   2. Green plane byte
                 *   3. Red plane byte
                 *   4. Intensity plane byte
                 *   (All pixels assumed opaque)
                 */
                
                let byteMask, byteBlue, byteGreen, byteRed, byteInt;
                
                if (hasMask) {
                    // 5-byte format with transparency support
                    byteMask = rawData[readIndex++];
                    byteBlue = rawData[readIndex++];
                    byteGreen = rawData[readIndex++];
                    byteRed = rawData[readIndex++];
                    byteInt = rawData[readIndex++];
                } else {
                    // 4-byte format - assume all pixels opaque
                    byteMask = 0xFF; // All bits set = all pixels opaque
                    byteBlue = rawData[readIndex++];
                    byteGreen = rawData[readIndex++];
                    byteRed = rawData[readIndex++];
                    byteInt = rawData[readIndex++];
                }
                
                /* ---------------------------------------------------------- */
                /* Calculate Chunk Position                                   */
                /* ---------------------------------------------------------- */
                
                /**
                 * Calculate starting X coordinate for this chunk.
                 * Each chunk is 8 pixels wide.
                 */
                const xOffset = chunk * 8;
                
                /* ---------------------------------------------------------- */
                /* LOOP 3: Extract 8 Pixels from Bit Planes                   */
                /* ---------------------------------------------------------- */
                
                /**
                 * Process bits from MSB (7) to LSB (0).
                 * This order maps directly to pixels left-to-right.
                 * 
                 * For each bit position:
                 * 1. Create a mask to test that bit
                 * 2. Check transparency
                 * 3. Extract color component bits
                 * 4. Combine into palette index
                 * 5. Look up RGB values
                 * 6. Write to output buffer
                 */
                
                for (let bit = 7; bit >= 0; bit--) {
                    /* ------------------------------------------------------ */
                    /* Create Bit Mask for This Pixel                         */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Create a mask with only the current bit set.
                     * Example: bit 5 -> mask = 0b00100000
                     */
                    const bitFlag = 1 << bit;
                    
                    /* ------------------------------------------------------ */
                    /* Check Transparency                                     */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Test the mask byte at this bit position.
                     * If the bit is 0, pixel is transparent.
                     * If the bit is 1, pixel is opaque.
                     */
                    const isOpaque = (byteMask & bitFlag) !== 0;
                    
                    /* ------------------------------------------------------ */
                    /* Calculate Pixel Position                               */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Calculate X coordinate for this pixel.
                     * Reverse bit order for left-to-right pixel mapping:
                     * - Bit 7 -> Pixel 0 (leftmost)
                     * - Bit 0 -> Pixel 7 (rightmost)
                     */
                    const x = xOffset + (7 - bit);
                    
                    /**
                     * Calculate index in output buffer.
                     * Each pixel occupies 4 bytes (RGBA).
                     * Formula: (row * width + column) * 4
                     */
                    const idx = (y * width + x) * 4;
                    
                    /* ------------------------------------------------------ */
                    /* Render Pixel Based on Transparency                     */
                    /* ------------------------------------------------------ */
                    
                    if (!isOpaque) {
                        /* ================================================== */
                        /* TRANSPARENT PIXEL                                  */
                        /* ================================================== */
                        
                        /**
                         * Set alpha to 0 for transparency.
                         * RGB values default to 0 (already initialized).
                         * This allows tiles to blend with background.
                         */
                        pixelData[idx + 3] = 0;
                        
                    } else {
                        /* ================================================== */
                        /* OPAQUE PIXEL - DECODE COLOR                        */
                        /* ================================================== */
                        
                        /**
                         * Extract one bit from each color plane.
                         * Each bit contributes to the final color index.
                         * 
                         * Bit weights:
                         * - Blue (B): Bit 0 (weight 1)
                         * - Green (G): Bit 1 (weight 2)
                         * - Red (R): Bit 2 (weight 4)
                         * - Intensity (I): Bit 3 (weight 8)
                         */
                        const b = (byteBlue & bitFlag) ? 1 : 0;
                        const g = (byteGreen & bitFlag) ? 2 : 0;
                        const r = (byteRed & bitFlag) ? 4 : 0;
                        const i = (byteInt & bitFlag) ? 8 : 0;
                        
                        /**
                         * Combine bits into 4-bit color index (IRGB format).
                         * 
                         * Example: Red (4) + Intensity (8) = 12 (Bright Red)
                         * Binary: 0b1100
                         */
                        const colorIndex = i | r | g | b;
                        
                        /**
                         * Look up RGB values from EGA palette.
                         * Palette index 0-15 maps to predefined colors.
                         */
                        const color = this.PALETTE[colorIndex];
                        
                        /**
                         * Write RGBA values to output buffer.
                         * Format: [R, G, B, A, R, G, B, A, ...]
                         */
                        pixelData[idx] = color[0];       // Red component
                        pixelData[idx + 1] = color[1];   // Green component
                        pixelData[idx + 2] = color[2];   // Blue component
                        pixelData[idx + 3] = 255;        // Alpha (fully opaque)
                    }
                }
            }
        }
        
        /* ------------------------------------------------------------------ */
        /* Create and Return ImageData                                        */
        /* ------------------------------------------------------------------ */
        
        /**
         * Convert raw pixel buffer to ImageData object.
         * This format can be directly rendered to HTML5 Canvas.
         */
        return new ImageData(pixelData, width, height);
    }
    
    /* ====================================================================== */
    /* FULL-SCREEN DECODING (320x200 IMAGES)                                  */
    /* ====================================================================== */
    
    /**
     * Decodes a full-screen (320x200) planar EGA image.
     * 
     * This method handles special full-screen image files used for:
     * - CREDITS: Credits screen
     * - BADGUY: Enemy showcase
     * - DN: Duke Nukem title logo
     * - DUKE: Duke Nukem portrait
     * - END: Episode ending screens
     * 
     * Format Differences from Tiles:
     * -------------------------------
     * Unlike tiles, full-screen images use a different planar organization:
     * 
     * 1. Plane Organization:
     *    - All blue bits stored first (8,000 bytes)
     *    - Then all green bits (8,000 bytes)
     *    - Then all red bits (8,000 bytes)
     *    - Finally all intensity bits (8,000 bytes)
     *    - Total: 32,000 bytes
     * 
     * 2. No Transparency:
     *    - No mask plane (all pixels opaque)
     *    - Simpler decoding (4 planes instead of 5)
     * 
     * 3. No Header:
     *    - Raw pixel data only
     *    - Fixed size (exactly 32,000 bytes)
     * 
     * Memory Layout Calculation:
     * --------------------------
     * Resolution: 320x200 = 64,000 pixels
     * Bits per plane: 64,000 bits = 8,000 bytes
     * Planes needed: 4 (B, G, R, I)
     * Total size: 4 * 8,000 = 32,000 bytes
     * 
     * Each scanline: 320 pixels = 40 bytes per plane
     * 
     * @param {Uint8Array} data - Raw file data (must be exactly 32,000 bytes)
     * @returns {ImageData} Decoded 320x200 RGBA image
     * @throws {Error} If file size is not exactly 32,000 bytes
     */
    static decodePlanarScreen(data) {
        /* ------------------------------------------------------------------ */
        /* Define Constants                                                   */
        /* ------------------------------------------------------------------ */
        
        const width = 320;      // Standard VGA width
        const height = 200;     // Standard DOS resolution
        const planeSize = 8000; // Bytes per plane (320 * 200 / 8 bits)
        const expectedSize = 32000; // Total file size (4 planes)
        
        /* ------------------------------------------------------------------ */
        /* Validate File Size                                                 */
        /* ------------------------------------------------------------------ */
        
        /**
         * Strict validation ensures we're decoding the correct format.
         * Files that aren't exactly 32,000 bytes are not valid screen dumps.
         */
        if (data.length !== expectedSize) {
            throw new Error(
                `Invalid screen file size: ${data.length} bytes. ` +
                `(Expected ${expectedSize} bytes)`
            );
        }
        
        /* ================================================================== */
        /* SEPARATE BIT PLANES                                                 */
        /* ================================================================== */
        
        /**
         * Extract individual planes from sequential storage.
         * 
         * In Duke Nukem 1 screen dumps, planes are stored sequentially
         * in memory order (not interleaved like tile format).
         * 
         * Plane Order: Blue, Green, Red, Intensity
         * 
         * This order is consistent across all DN1 full-screen files.
         */
        
        const plane0 = data.subarray(0, planeSize);                    // Blue  (Bit 0)
        const plane1 = data.subarray(planeSize, planeSize * 2);        // Green (Bit 1)
        const plane2 = data.subarray(planeSize * 2, planeSize * 3);    // Red   (Bit 2)
        const plane3 = data.subarray(planeSize * 3, planeSize * 4);    // Intensity (Bit 3)
        
        /* ------------------------------------------------------------------ */
        /* Allocate Output Buffer                                             */
        /* ------------------------------------------------------------------ */
        
        /**
         * Create RGBA buffer for 320x200 image.
         * Size: 320 * 200 * 4 = 256,000 bytes
         */
        const pixelData = new Uint8ClampedArray(width * height * 4);
        let pixelIndex = 0; // Current write position in output
        
        /* ================================================================== */
        /* DECODING LOOP                                                       */
        /* ================================================================== */
        
        /**
         * Process pixels in scanline order (left-to-right, top-to-bottom).
         * 
         * For each pixel:
         * 1. Calculate which byte contains the pixel's bit
         * 2. Calculate which bit position within that byte
         * 3. Extract one bit from each plane
         * 4. Combine into color index
         * 5. Look up palette color
         * 6. Write RGBA to output
         */
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                
                /* ---------------------------------------------------------- */
                /* Calculate Byte Offset in Plane                             */
                /* ---------------------------------------------------------- */
                
                /**
                 * Each plane scanline is 40 bytes (320 pixels / 8 bits per byte).
                 * 
                 * Byte offset formula:
                 * - Row offset: y * 40 (move to correct scanline)
                 * - Column offset: floor(x / 8) (which byte in the scanline)
                 */
                const byteOffset = (y * 40) + Math.floor(x / 8);
                
                /* ---------------------------------------------------------- */
                /* Calculate Bit Position Within Byte                         */
                /* ---------------------------------------------------------- */
                
                /**
                 * Determine which bit represents this pixel.
                 * 
                 * Bits are ordered MSB-first (7 down to 0).
                 * Example: For x=9:
                 * - x % 8 = 1 (second pixel in byte)
                 * - Bit position = 7 - 1 = 6
                 */
                const bitPosition = 7 - (x % 8);
                
                /* ---------------------------------------------------------- */
                /* Extract Bits from Each Plane                               */
                /* ---------------------------------------------------------- */
                
                /**
                 * Read one bit from each plane at the calculated position.
                 * 
                 * Process:
                 * 1. Read byte from plane
                 * 2. Shift right to move target bit to position 0
                 * 3. Mask with 1 to extract only that bit
                 */
                const b = (plane0[byteOffset] >> bitPosition) & 1;
                const g = (plane1[byteOffset] >> bitPosition) & 1;
                const r = (plane2[byteOffset] >> bitPosition) & 1;
                const i = (plane3[byteOffset] >> bitPosition) & 1;
                
                /* ---------------------------------------------------------- */
                /* Combine Into Color Index                                   */
                /* ---------------------------------------------------------- */
                
                /**
                 * Assemble 4-bit color index from individual bits.
                 * 
                 * Format: IRGB
                 * - Bit 3 (MSB): Intensity
                 * - Bit 2: Red
                 * - Bit 1: Green
                 * - Bit 0 (LSB): Blue
                 * 
                 * Example: i=1, r=1, g=0, b=0 -> 0b1100 = 12 (Bright Red)
                 */
                const colorIndex = (i << 3) | (r << 2) | (g << 1) | b;
                
                /* ---------------------------------------------------------- */
                /* Look Up RGB from Palette                                   */
                /* ---------------------------------------------------------- */
                
                /**
                 * Convert color index to actual RGB values.
                 * EGA palette provides predefined colors for indices 0-15.
                 */
                const color = this.PALETTE[colorIndex];
                
                /* ---------------------------------------------------------- */
                /* Write to Output Buffer                                     */
                /* ---------------------------------------------------------- */
                
                /**
                 * Write RGBA components sequentially.
                 * All pixels are opaque (alpha = 255) in full-screen images.
                 */
                pixelData[pixelIndex++] = color[0]; // Red
                pixelData[pixelIndex++] = color[1]; // Green
                pixelData[pixelIndex++] = color[2]; // Blue
                pixelData[pixelIndex++] = 255;      // Alpha (always opaque)
            }
        }
        
        /* ------------------------------------------------------------------ */
        /* Create and Return ImageData                                        */
        /* ------------------------------------------------------------------ */
        
        return new ImageData(pixelData, width, height);
    }
}
