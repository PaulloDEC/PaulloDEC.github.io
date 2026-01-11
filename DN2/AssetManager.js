/**
 * AssetManager.js
 * Handles Palette parsing, Graphic decoding, and Sheet Generation.
 * FEATURES:
 * - Robust Bit-Stream Decoder (Fixes garbled sprites)
 * - Multi-Palette Support (Slots 0-4)
 * - Palette argument in decodeTile for ActorManager
 */

export class AssetManager {
    constructor() {
        // Initialize 5 slots: 0=Game, 1=Story2, 2=Story3, 3=LCR, 4=Story.mni
        this.palettes = [
            [], // Slot 0: GAMEPAL (Default)
            [], // Slot 1: STORY2
            [], // Slot 2: STORY3
            [], // Slot 3: LCR (Intro/VGA)
            [], // Slot 4: STORY.MNI embedded palette
        ];
        
        this.vgaFontBitmap = null;

        // Fill with placeholder grayscale to prevent crashes if palettes aren't loaded
        for (let p = 0; p < 5; p++) {
            for (let i = 0; i < 256; i++) { 
                this.palettes[p].push([i, i, i]);
            }
        }
    }

    /**
     * Loads a palette file into a specific slot.
     */
    loadPalette(buffer, slot = 0) {
        let data;
        if (buffer instanceof Uint8Array) data = buffer;
        else if (buffer instanceof ArrayBuffer) data = new Uint8Array(buffer);
        else return;
        
        let colorCount = 0;
        let palData = data;

        // Detect format based on size
        if (data.length === 48) {
            colorCount = 16;
        } else if (data.length === 768) {
            colorCount = 256; 
        } else if (data.length === 64768) {
            // LCR.MNI contains 84 palettes. Use Palette #1 (Start of file)
            console.log("Detected LCR.MNI (Animation Container). Loading Palette #1...");
            palData = data.subarray(0, 768); 
            colorCount = 256;
        } else if (data.length === 32048) {
            // Fullscreen image with embedded palette (STORY.MNI)
            console.log("Detected fullscreen image with embedded palette.");
            palData = data.subarray(32000, 32048); // Last 48 bytes
            colorCount = 16;
        } else {
            console.warn(`Invalid palette size: ${data.length} bytes.`);
            return;
        }
        
        const newPal = [];
        for (let i = 0; i < colorCount; i++) {
            // Read 6-bit VGA values (0-63)
            const r6 = palData[i * 3];
            const g6 = palData[i * 3 + 1];
            const b6 = palData[i * 3 + 2];

            // Convert to 8-bit RGB (0-255)
            const r8 = Math.floor((r6 * 255) / 63);
            const g8 = Math.floor((g6 * 255) / 63);
            const b8 = Math.floor((b6 * 255) / 63);

            newPal.push([r8, g8, b8]);
        }
        
        this.palettes[slot] = newPal;
        console.log(`Loaded ${colorCount}-color Palette into Slot ${slot}`);
    }

    // ─── DECODING HELPERS (Critical for Correct Geometry) ────────────────────

    createBitIterator(data, offset = 0) {
        let byteIndex = offset;
        let bitIndex = 7; 
        return {
            readBit() {
                if (byteIndex >= data.length) return 0;
                const bit = (data[byteIndex] >> bitIndex) & 1;
                bitIndex--;
                if (bitIndex < 0) { bitIndex = 7; byteIndex++; }
                return bit;
            }
        };
    }

    readEgaColorData(bitIter, pixelCount) {
        const pixels = new Uint8Array(pixelCount);
        pixels.fill(0);
        for (let plane = 0; plane < 4; plane++) {
            for (let pixel = 0; pixel < pixelCount; pixel++) {
                const bit = bitIter.readBit();
                pixels[pixel] |= (bit << plane);
            }
        }
        return pixels;
    }

    readEgaMaskPlane(bitIter, pixelCount) {
        const mask = new Uint8Array(pixelCount);
        for (let pixel = 0; pixel < pixelCount; pixel++) {
            mask[pixel] = bitIter.readBit();
        }
        return mask;
    }

    /**
     * CORE DECODER
     * Supports Palette Swapping via paletteId (0-4).
     */
    decodeTile(data, tileIndex, mode, paletteId = 0) {
        const TILE_SIZE = 8;
        const pixels = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
        
        // 1. Select the requested palette (Safe Access)
        const activePalette = this.palettes[paletteId] || this.palettes[0];

        // --- MODE A: SOLID CZONE (Scanline-interleaved planar) ---
        if (mode === 'solid_czone') {
            const bytesPerTile = 32; 
            const offset = tileIndex * bytesPerTile;
            if (offset + bytesPerTile > data.length) return null;

            let pxIdx = 0;
            for (let y = 0; y < 8; y++) {
                const scanlineOffset = offset + (y * 4);
                const bBlue  = data[scanlineOffset + 0];
                const bGreen = data[scanlineOffset + 1];
                const bRed   = data[scanlineOffset + 2];
                const bInt   = data[scanlineOffset + 3];

                for (let x = 0; x < 8; x++) {
                    const bit = 7 - x;
                    const colorIndex = 
                        (((bInt >> bit) & 1) << 3) |
                        (((bRed >> bit) & 1) << 2) |
                        (((bGreen >> bit) & 1) << 1) |
                        ((bBlue >> bit) & 1);
                    
                    this.writePixel(pixels, pxIdx++, colorIndex, activePalette);
                }
            }
        } 
        // --- MODE B: MASKED (Actors/Sprites) ---
        // This uses the complex BitIterator logic to ensure correct geometry
        else if (mode === 'masked' || mode === true) {
            const bytesPerTile = 40;
            const offset = tileIndex * bytesPerTile;
            if (offset + bytesPerTile > data.length) return null;
            
            const bitIter = this.createBitIterator(data, offset);
            for (let row = 0; row < TILE_SIZE; row++) {
                const maskRow = this.readEgaMaskPlane(bitIter, TILE_SIZE);
                const colorRow = this.readEgaColorData(bitIter, TILE_SIZE);
                
                for (let col = 0; col < TILE_SIZE; col++) {
                    const idx = (row * TILE_SIZE + col) * 4;
                    
                    // Mask Bit: 1 = Transparent, 0 = Opaque (or vice versa depending on logic)
                    // In DN2: Mask 1 usually means "Background shows through" (Transparent)
                    if (maskRow[col] === 1) { 
                        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
                    } else {
                        // Apply specific palette here
                        this.writePixel(pixels, idx/4, colorRow[col], activePalette);
                    }
                }
            }
        }
        // --- MODE C: SOLID LOCAL (Standard Backdrops) ---
        else if (mode === 'solid_local') {
            const bytesPerTile = 32;
            const offset = tileIndex * bytesPerTile;
            if (offset + bytesPerTile > data.length) return null;

            let localIdx = 0;
            for (let y = 0; y < 8; y++) {
                const p0 = data[offset + localIdx++];
                const p1 = data[offset + localIdx++];
                const p2 = data[offset + localIdx++];
                const p3 = data[offset + localIdx++];

                for (let x = 0; x < 8; x++) {
                    const bit = 7 - x;
                    const colorIndex = 
                        (((p3 >> bit) & 1) << 3) |
                        (((p2 >> bit) & 1) << 2) |
                        (((p1 >> bit) & 1) << 1) |
                        ((p0 >> bit) & 1);
                    
                    this.writePixel(pixels, (y*8 + x), colorIndex, activePalette);
                }
            }
        }

        return new ImageData(pixels, TILE_SIZE, TILE_SIZE);
    }

    /**
     * Writes a pixel to the buffer using the specified palette.
     */
    writePixel(pixels, index, colorIndex, palette = null) {
        const pal = palette || this.palettes[0]; 
        const [r, g, b] = pal[colorIndex] || [0,0,0];
        const i = index * 4;
        pixels[i] = r;
        pixels[i+1] = g;
        pixels[i+2] = b;
        pixels[i+3] = 255;
    }

    // ─── GENERATORS ──────────────────────────────────────────────────────────

    async decodeFullScreenImage(data) {
        if (data.length !== 32048) return null;
        const WIDTH = 320;
        const HEIGHT = 200;
        const PLANE_SIZE = 8000;
        
        // Extract embedded palette (last 48 bytes)
        const palData = data.subarray(32000, 32048);
        const localPalette = [];
        for (let i = 0; i < 16; i++) {
            let r = Math.floor(palData[i * 3] * 255 / 63);
            let g = Math.floor(palData[i * 3 + 1] * 255 / 63);
            let b = Math.floor(palData[i * 3 + 2] * 255 / 63);
            localPalette.push([r, g, b]);
        }

        const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
        
        for (let i = 0; i < PLANE_SIZE; i++) {
            const b0 = data[i];
            const b1 = data[i + PLANE_SIZE];
            const b2 = data[i + PLANE_SIZE * 2];
            const b3 = data[i + PLANE_SIZE * 3];
            
            for (let bit = 0; bit < 8; bit++) {
                const shift = 7 - bit;
                const colorIndex = 
                    (((b3 >> shift) & 1) << 3) |
                    (((b2 >> shift) & 1) << 2) |
                    (((b1 >> shift) & 1) << 1) |
                    ((b0 >> shift) & 1);
                this.writePixel(pixels, (i * 8 + bit), colorIndex, localPalette);
            }
        }
        return createImageBitmap(new ImageData(pixels, WIDTH, HEIGHT));
    }

    async decode256ColorImage(imageData, paletteData) {
        // Validate sizes
        if (imageData.length !== 64000) {
            console.error(`Invalid 256-color image data size: ${imageData.length} (expected 64000)`);
            return null;
        }
        if (paletteData.length !== 768) {
            console.error(`Invalid palette data size: ${paletteData.length} (expected 768)`);
            return null;
        }
        
        const WIDTH = 320;
        const HEIGHT = 200;
        
        // Convert palette data to RGB array
        const palette = [];
        for (let i = 0; i < 256; i++) {
            const r = Math.floor((paletteData[i * 3] * 255) / 63);
            const g = Math.floor((paletteData[i * 3 + 1] * 255) / 63);
            const b = Math.floor((paletteData[i * 3 + 2] * 255) / 63);
            palette.push([r, g, b]);
        }
        
        // Create pixel buffer
        const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
        
        // For each pixel, look up its color in the palette
        for (let i = 0; i < 64000; i++) {
            const colorIndex = imageData[i];
            const [r, g, b] = palette[colorIndex] || [0, 0, 0];
            const pixelOffset = i * 4;
            pixels[pixelOffset] = r;
            pixels[pixelOffset + 1] = g;
            pixels[pixelOffset + 2] = b;
            pixels[pixelOffset + 3] = 255; // Alpha
        }
        
        return createImageBitmap(new ImageData(pixels, WIDTH, HEIGHT));
    }

    async generateVGAFontBitmap() {
        // Check if we already have it cached
        if (this.vgaFontBitmap) {
            return this.vgaFontBitmap;
        }
        
        // Wait for font to load
        if (document.fonts) {
            await document.fonts.ready;
            await document.fonts.load('16px "Perfect DOS VGA 437"');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        const CHAR_WIDTH = 8;
        const CHAR_HEIGHT = 16;
        const CHARS_PER_ROW = 32; // 32 characters per row = 8 rows for 256 chars
        const TOTAL_CHARS = 256;
        const ROWS = Math.ceil(TOTAL_CHARS / CHARS_PER_ROW);
        
        const atlasWidth = CHARS_PER_ROW * CHAR_WIDTH;  // 256 pixels
        const atlasHeight = ROWS * CHAR_HEIGHT;         // 128 pixels
        
        const canvas = document.createElement('canvas');
        canvas.width = atlasWidth;
        canvas.height = atlasHeight;
        const ctx = canvas.getContext('2d');
        
        // White background for visibility (will use color tinting later)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px "Perfect DOS VGA 437"';
        ctx.textBaseline = 'top';
        
        // Render all 256 CP437 characters
        for (let i = 0; i < TOTAL_CHARS; i++) {
            const col = i % CHARS_PER_ROW;
            const row = Math.floor(i / CHARS_PER_ROW);
            const x = col * CHAR_WIDTH;
            const y = row * CHAR_HEIGHT;
            
            // Draw black background for this character cell
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, CHAR_WIDTH, CHAR_HEIGHT);
            
            // Draw white character
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(String.fromCharCode(i), x, y);
        }
        
        // Convert to ImageBitmap and cache it
        this.vgaFontBitmap = await createImageBitmap(canvas);
        console.log('VGA font bitmap generated and cached');
        
        return this.vgaFontBitmap;
    }
    
    async decodeB800Text(data) {
        if (data.length !== 4000) {
            console.error(`Invalid B800 text data size: ${data.length} (expected 4000)`);
            return null;
        }
        
        const COLS = 80;
        const ROWS = 25;
        const CHAR_WIDTH = 8;
        const CHAR_HEIGHT = 16;
        
        const WIDTH = COLS * CHAR_WIDTH;  // 640
        const HEIGHT = ROWS * CHAR_HEIGHT; // 400
        
        // CGA 16-color palette (standard DOS colors)
        const palette = [
            [0, 0, 0],       // 0: Black
            [0, 0, 170],     // 1: Blue
            [0, 170, 0],     // 2: Green
            [0, 170, 170],   // 3: Cyan
            [170, 0, 0],     // 4: Red
            [170, 0, 170],   // 5: Magenta
            [170, 85, 0],    // 6: Brown
            [170, 170, 170], // 7: Light Gray
            [85, 85, 85],    // 8: Dark Gray
            [85, 85, 255],   // 9: Light Blue
            [85, 255, 85],   // 10: Light Green
            [85, 255, 255],  // 11: Light Cyan
            [255, 85, 85],   // 12: Light Red
            [255, 85, 255],  // 13: Light Magenta
            [255, 255, 85],  // 14: Yellow
            [255, 255, 255]  // 15: White
        ];
        
        // Load the VGA font bitmap
        const fontBitmap = await this.generateVGAFontBitmap();
        if (!fontBitmap) {
            console.error('Failed to generate VGA font bitmap');
            return null;
        }
        
        // Create a temporary canvas to extract font glyph pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = fontBitmap.width;
        tempCanvas.height = fontBitmap.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(fontBitmap, 0, 0);
        const fontImageData = tempCtx.getImageData(0, 0, fontBitmap.width, fontBitmap.height);
        
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext('2d');
        
        const outputImageData = ctx.createImageData(WIDTH, HEIGHT);
        const CHARS_PER_ROW = 32;
        
        // Render each cell
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const offset = (row * COLS + col) * 2;
                const charCode = data[offset];
                const attribute = data[offset + 1];
                
                // Decode attribute byte
                const bgColor = (attribute >> 4) & 0x0F;
                const fgColor = attribute & 0x0F;
                
                const [bgR, bgG, bgB] = palette[bgColor];
                const [fgR, fgG, fgB] = palette[fgColor];
                
                const destX = col * CHAR_WIDTH;
                const destY = row * CHAR_HEIGHT;
                
                // Calculate source position in font atlas
                const srcCol = charCode % CHARS_PER_ROW;
                const srcRow = Math.floor(charCode / CHARS_PER_ROW);
                const srcX = srcCol * CHAR_WIDTH;
                const srcY = srcRow * CHAR_HEIGHT;
                
                // Copy character pixel by pixel
                for (let py = 0; py < CHAR_HEIGHT; py++) {
                    for (let px = 0; px < CHAR_WIDTH; px++) {
                        // Source pixel in font atlas
                        const fontPixelIdx = ((srcY + py) * fontBitmap.width + (srcX + px)) * 4;
                        const isWhite = fontImageData.data[fontPixelIdx] > 128; // White pixel = character
                        
                        // Destination pixel in output
                        const outPixelIdx = ((destY + py) * WIDTH + (destX + px)) * 4;
                        
                        if (isWhite) {
                            // Draw foreground color
                            outputImageData.data[outPixelIdx] = fgR;
                            outputImageData.data[outPixelIdx + 1] = fgG;
                            outputImageData.data[outPixelIdx + 2] = fgB;
                            outputImageData.data[outPixelIdx + 3] = 255;
                        } else {
                            // Draw background color
                            outputImageData.data[outPixelIdx] = bgR;
                            outputImageData.data[outPixelIdx + 1] = bgG;
                            outputImageData.data[outPixelIdx + 2] = bgB;
                            outputImageData.data[outPixelIdx + 3] = 255;
                        }
                    }
                }
            }
        }
        
        ctx.putImageData(outputImageData, 0, 0);
        return createImageBitmap(canvas);
    }

    parseGameScript(data) {
        // Convert binary data to text
        let text = '';
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            if (char !== 0) { // Skip null bytes
                text += String.fromCharCode(char);
            }
        }
        
        // Split into lines
        const lines = text.split(/\r\n|\n|\r/);
        
        // Parse each line and apply syntax highlighting
        let html = '';
        
        for (const line of lines) {
            if (line.trim() === '') {
                // Blank line
                html += '\n';
            } else if (line.startsWith('//')) {
                // Command line - parse command and arguments
                const commandMatch = line.match(/^(\/\/\w+)\s*(.*)$/);
                if (commandMatch) {
                    const command = commandMatch[1];
                    const args = commandMatch[2].trim();
                    
                    html += `<span class="script-command">${command}</span>`;
                    
                    if (args) {
                        // Try to separate numeric parameters from text content
                        // Pattern: numbers at start, then text after
                        const paramMatch = args.match(/^((?:\d+\s+)*\d+)\s+(.+)$/);
                        
                        if (paramMatch) {
                            // Has numeric parameters followed by text
                            const params = paramMatch[1];
                            let textContent = paramMatch[2];
                            
                            // Remove leading special character if present (menu markers like ñ, ò)
                            if (textContent.length > 0 && textContent.charCodeAt(0) > 127) {
                                const specialChar = textContent[0];
                                textContent = textContent.substring(1);
                                html += ` <span class="script-param">${params}</span>`;
                                html += ` <span class="script-special">${specialChar}</span>`;
                                html += `<span class="script-text">${textContent}</span>`;
                            } else {
                                html += ` <span class="script-param">${params}</span>`;
                                html += ` <span class="script-text">${textContent}</span>`;
                            }
                        } else if (/^\d+(\s+\d+)*$/.test(args)) {
                            // Only numbers, no text
                            html += ` <span class="script-param">${args}</span>`;
                        } else if (/^[A-Za-z0-9._-]+\.[A-Z]{3}$/i.test(args)) {
                            // Filename (like MESSAGE.MNI)
                            html += ` <span class="script-param">${args}</span>`;
                        } else {
                            // Pure text content (no numeric prefix)
                            // Check for leading special character
                            let textContent = args;
                            if (textContent.length > 0 && textContent.charCodeAt(0) > 127) {
                                const specialChar = textContent[0];
                                textContent = textContent.substring(1);
                                html += ` <span class="script-special">${specialChar}</span>`;
                                html += `<span class="script-text">${textContent}</span>`;
                            } else {
                                html += ` <span class="script-text">${textContent}</span>`;
                            }
                        }
                    }
                    html += '\n';
                } else {
                    html += `<span class="script-command">${line}</span>\n`;
                }
            } else {
                // Section header (non-command, non-blank)
                html += `<span class="script-header">${line}</span>\n`;
            }
        }
        
        return html;
    }

    async generateTilesetImage(data, startOffset, count, mode, columns = 16) {
        const TILE_SIZE = 8;
        const rows = Math.ceil(count / columns);
        const canvas = document.createElement('canvas');
        canvas.width = columns * TILE_SIZE;
        canvas.height = rows * TILE_SIZE;
        const ctx = canvas.getContext('2d');
        
        let workingData = data;
        
        if (mode === 'solid_global') {
            workingData = data.subarray(startOffset); 
        } else {
            const bpt = (mode === 'masked') ? 40 : 32;
            const len = count * bpt;
            if (startOffset + len > data.length) return null;
            workingData = data.subarray(startOffset, startOffset + len);
        }

        for (let i = 0; i < count; i++) {
            // Default palette (0) is fine for tilesets
            const imgData = this.decodeTile(workingData, i, mode, 0);
            if (imgData) {
                const bmp = await createImageBitmap(imgData);
                const x = (i % columns) * TILE_SIZE;
                const y = Math.floor(i / columns) * TILE_SIZE;
                ctx.drawImage(bmp, x, y);
            }
        }
        return createImageBitmap(canvas);
    }

    async generateCZoneSheet(data) {
        if (!data || data.length < 3600 + 32000 + 6400) return null;

        const COLUMNS = 40;
        const TILE_SIZE = 8;
        const SOLID_OFFSET = 3600;
        const SOLID_COUNT = 1000;
        const MASKED_OFFSET = 3600 + 32000;
        const MASKED_COUNT = 160;
        
        const solidRows = Math.ceil(SOLID_COUNT / COLUMNS);
        const maskedRows = Math.ceil(MASKED_COUNT / COLUMNS);
        const totalRows = solidRows + maskedRows + 1; 
        
        const canvas = document.createElement('canvas');
        canvas.width = COLUMNS * TILE_SIZE;
        canvas.height = totalRows * TILE_SIZE;
        const ctx = canvas.getContext('2d');
        
        const solidData = data.subarray(SOLID_OFFSET);
        for (let i = 0; i < SOLID_COUNT; i++) {
            const img = this.decodeTile(solidData, i, 'solid_czone', 0);
            if (img) {
                const bmp = await createImageBitmap(img);
                const x = (i % COLUMNS) * TILE_SIZE;
                const y = Math.floor(i / COLUMNS) * TILE_SIZE;
                ctx.drawImage(bmp, x, y);
            }
        }
        
        const maskedStartY = (solidRows + 1) * TILE_SIZE;
        const maskedData = data.subarray(MASKED_OFFSET);
        for (let i = 0; i < MASKED_COUNT; i++) {
            const img = this.decodeTile(maskedData, i, 'masked', 0);
            if (img) {
                const bmp = await createImageBitmap(img);
                const x = (i % COLUMNS) * TILE_SIZE;
                const y = maskedStartY + Math.floor(i / COLUMNS) * TILE_SIZE;
                ctx.drawImage(bmp, x, y);
            }
        }
        
        return createImageBitmap(canvas);
    }
    async loadAnimation(buffer) {
        const view = new DataView(buffer);
        const u8 = new Uint8Array(buffer);
        let offset = 0;

        // 1. Read Header
        // 0-3: File Size, 4-5: Type Marker
        const numFrames = view.getUint16(6, true);
        const width = view.getUint16(8, true);
        const height = view.getUint16(10, true);
        
        offset = 128; // Skip header

        // 2. Read Main Chunk Header
        offset += 16; 

        // 3. Read Palette Sub-Chunk
        offset += 6;
        offset += 4; // Skip Padding

        // 4. Parse Palette
        const palette = [];
        for (let i = 0; i < 256; i++) {
            const r = Math.floor((u8[offset++] * 255) / 63);
            const g = Math.floor((u8[offset++] * 255) / 63);
            const b = Math.floor((u8[offset++] * 255) / 63);
            palette.push([r, g, b]);
        }

        // 5. Prepare Master Buffer
        const masterPixelBuffer = new Uint8ClampedArray(width * height * 4);
        
        const setPixel = (x, y, colorIdx) => {
            if (x >= width || y >= height) return;
            // Safety: prevent palette lookup crashes
            if (!palette[colorIdx]) return; 

            const idx = (y * width + x) * 4;
            const [r, g, b] = palette[colorIdx];
            masterPixelBuffer[idx] = r;
            masterPixelBuffer[idx + 1] = g;
            masterPixelBuffer[idx + 2] = b;
            masterPixelBuffer[idx + 3] = 255;
        };

        const bitmapFrames = [];

        // 6. Decode Base Frame
        const mainImageStartOffset = offset;
        const mainImageSize = view.getUint32(offset, true); offset += 4;
        offset += 2; // Skip type

        // RLE Decode Main Image
        for (let row = 0; row < height; row++) {
            const numRleFlags = u8[offset++];
            let col = 0;
            for (let flag = 0; flag < numRleFlags; flag++) {
                const marker = view.getInt8(offset++);
                if (marker > 0) { // Repeat
                    const val = u8[offset++];
                    for(let k=0; k<marker; k++) setPixel(col++, row, val);
                } else { // Literal
                    const count = Math.abs(marker);
                    for(let k=0; k<count; k++) setPixel(col++, row, u8[offset++]);
                }
            }
        }

        // Convert Base Frame to Bitmap
        bitmapFrames.push(await createImageBitmap(new ImageData(masterPixelBuffer, width, height)));

        offset = mainImageStartOffset + mainImageSize; // Sync

        // 7. Decode Animation Frames
        for (let f = 0; f < numFrames; f++) {
            offset += 16; // Chunk Header
            
            const frameSubStartOffset = offset;
            const frameSubSize = view.getUint32(offset, true); offset += 4;
            offset += 2; // Type

            const yOffset = view.getUint16(offset, true); offset += 2;
            const numRows = view.getUint16(offset, true); offset += 2;

            for (let row = 0; row < numRows; row++) {
                const actualRow = yOffset + row;
                let col = 0;
                const numRleWords = u8[offset++];
                for (let rle = 0; rle < numRleWords; rle++) {
                    const skip = u8[offset++];
                    col += skip;
                    const marker = -view.getInt8(offset++); // Inverted
                    
                    if (marker > 0) { // Repeat
                        const val = u8[offset++];
                        for(let k=0; k<marker; k++) setPixel(col++, actualRow, val);
                    } else { // Literal
                        const count = Math.abs(marker);
                        for(let k=0; k<count; k++) setPixel(col++, actualRow, u8[offset++]);
                    }
                }
            }
            
            offset = frameSubStartOffset + frameSubSize; // Sync
            
            // Create bitmap for this frame state
            // Note: We create a new ImageData here to capture the current state of the buffer
            bitmapFrames.push(await createImageBitmap(new ImageData(masterPixelBuffer, width, height)));
        }

        return { width, height, frames: bitmapFrames };
    }
}