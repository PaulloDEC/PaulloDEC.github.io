/**
 * AssetManager.js
 * Handles Palette parsing, Graphic decoding, and Sheet Generation.
 * Updated: Support for LCR.MNI (768-byte / 256-color palettes).
 */

export class AssetManager {
    constructor() {
        // Initialize 4 slots: 0=Game, 1=Story2, 2=Story3, 3=LCR (Intro)
        this.palettes = [
            [], // Slot 0: GAMEPAL (Default)
            [], // Slot 1: STORY2
            [], // Slot 2: STORY3
            [], // Slot 3: LCR (Intro/VGA)
			[], // Slot 4: STORY.MNI embedded palette
        ];
        
        // Fill with placeholder grayscale to prevent crashes
        for (let p = 0; p < 4; p++) {
            for (let i = 0; i < 256; i++) { // expanded to 256 safe slots
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
			// FIX: LCR.MNI contains 84 palettes. 
			// We want Palette #1 (Main), which is at the START of the file.
			console.log("Detected LCR.MNI (Animation Container). Loading Palette #1...");
			palData = data.subarray(0, 768); 
			colorCount = 256;
		} else if (data.length === 32048) {
			// Fullscreen image with embedded palette (STORY.MNI)
			console.log("Detected fullscreen image with embedded palette (32048 bytes)");
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
            // Note: Masking & 0x3F is safer, but Palette #1 is likely clean.
            const r8 = Math.floor((r6 * 255) / 63);
            const g8 = Math.floor((g6 * 255) / 63);
            const b8 = Math.floor((b6 * 255) / 63);

            newPal.push([r8, g8, b8]);
        }
        
        this.palettes[slot] = newPal;
        console.log(`Loaded ${colorCount}-color Palette into Slot ${slot}`);
    }

    // --- DECODERS ---

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
     * Decodes a single 8x8 tile based on the provided mode.
     * Supports Palette Swapping via paletteId (0, 1, 2, 3).
     */
    decodeTile(data, tileIndex, mode, paletteId = 0) {
        const TILE_SIZE = 8;
        const pixels = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
        
        // Select the requested palette, fallback to Slot 0 if invalid
        const activePalette = this.palettes[paletteId] || this.palettes[0];

        // --- MODE A2: SOLID CZONE (Scanline-interleaved planar) ---
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
        // --- MODE B: MASKED ---
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
                    if (maskRow[col] === 1) { 
                        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
                    } else {
                        this.writePixel(pixels, idx/4, colorRow[col], activePalette);
                    }
                }
            }
        }
        // --- MODE C: SOLID LOCAL ---
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
        // LCR.MNI has 256 colors, so colorIndex 0-15 will map to the first 16 colors.
        const [r, g, b] = pal[colorIndex] || [0,0,0];
        const i = index * 4;
        pixels[i] = r;
        pixels[i+1] = g;
        pixels[i+2] = b;
        pixels[i+3] = 255;
    }

    // ... (generateTilesetImage, decodeFullScreenImage, generateCZoneSheet remain unchanged) ...
    async decodeFullScreenImage(data) {
        if (data.length !== 32048) return null;
        const WIDTH = 320;
        const HEIGHT = 200;
        const PLANE_SIZE = 8000;
        
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

    async generateTilesetImage(data, startOffset, count, mode, columns = 16) {
        const TILE_SIZE = 8;
        const rows = Math.ceil(count / columns);
        const canvas = document.createElement('canvas');
        canvas.width = columns * TILE_SIZE;
        canvas.height = rows * TILE_SIZE;
        const ctx = canvas.getContext('2d');
        
        let workingData = data;
        
        // CRITICAL FIX: For 'solid_global', we must pass the large buffer chunk
        // starting at startOffset, but allowing access to offsets +8000, +16000, etc.
        if (mode === 'solid_global') {
            workingData = data.subarray(startOffset); 
        } else {
            const bpt = (mode === 'masked') ? 40 : 32;
            const len = count * bpt;
            if (startOffset + len > data.length) return null;
            workingData = data.subarray(startOffset, startOffset + len);
        }

        for (let i = 0; i < count; i++) {
            const imgData = this.decodeTile(workingData, i, mode);
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
        
        // 1. Solid Tiles (32000 bytes, 1000 tiles)
        const SOLID_OFFSET = 3600;
        const SOLID_COUNT = 1000;
        
        // 2. Masked Tiles (6400 bytes, 160 tiles)
        const MASKED_OFFSET = 3600 + 32000;
        const MASKED_COUNT = 160;
        
        const solidRows = Math.ceil(SOLID_COUNT / COLUMNS);
        const maskedRows = Math.ceil(MASKED_COUNT / COLUMNS);
        const totalRows = solidRows + maskedRows + 1; 
        
        const canvas = document.createElement('canvas');
        canvas.width = COLUMNS * TILE_SIZE;
        canvas.height = totalRows * TILE_SIZE;
        const ctx = canvas.getContext('2d');
        
        // Draw Solid Tiles (CZONE Byte-planar format)
        // Each tile is 32 bytes: 4 planes x 8 bytes per plane
        const solidData = data.subarray(SOLID_OFFSET);
        for (let i = 0; i < SOLID_COUNT; i++) {
            const img = this.decodeTile(solidData, i, 'solid_czone');
            if (img) {
                const bmp = await createImageBitmap(img);
                const x = (i % COLUMNS) * TILE_SIZE;
                const y = Math.floor(i / COLUMNS) * TILE_SIZE;
                ctx.drawImage(bmp, x, y);
            }
        }
        
        // Draw Masked Tiles (Masked Local)
        const maskedStartY = (solidRows + 1) * TILE_SIZE;
        const maskedData = data.subarray(MASKED_OFFSET);
        for (let i = 0; i < MASKED_COUNT; i++) {
            const img = this.decodeTile(maskedData, i, 'masked');
            if (img) {
                const bmp = await createImageBitmap(img);
                const x = (i % COLUMNS) * TILE_SIZE;
                const y = maskedStartY + Math.floor(i / COLUMNS) * TILE_SIZE;
                ctx.drawImage(bmp, x, y);
            }
        }
        
        return createImageBitmap(canvas);
    }
}