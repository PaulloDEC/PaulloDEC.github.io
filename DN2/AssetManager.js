/**
 * AssetManager.js
 * Handles Palette parsing, Graphic decoding, and Sheet Generation.
 * Updated: Correct Planar Logic for CZONE Solid Tiles.
 */

export class AssetManager {
    constructor() {
        this.palette = [];
        for (let i = 0; i < 16; i++) {
            this.palette.push([i * 16, i * 16, i * 16]);
        }
    }

    loadPalette(buffer) {
        let data;
        if (buffer instanceof Uint8Array) data = buffer;
        else if (buffer instanceof ArrayBuffer) data = new Uint8Array(buffer);
        else return;
        
        if (data.length !== 48) return;
        
        const newPal = [];
        for (let i = 0; i < 16; i++) {
            let r = Math.min(255, Math.floor((data[i * 3] * 15 / 16) * 256 / 63));
            let g = Math.min(255, Math.floor((data[i * 3 + 1] * 15 / 16) * 256 / 63));
            let b = Math.min(255, Math.floor((data[i * 3 + 2] * 15 / 16) * 256 / 63));
            newPal.push([r, g, b]);
        }
        this.palette = newPal;
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

    decodeTile(data, tileIndex, mode) {
        const TILE_SIZE = 8;
        const pixels = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
        
        // --- MODE A: SOLID GLOBAL (Map Tiles / CZONE Solid) ---
        // This expects 'data' to be the entire solid block (32000 bytes).
        // Planes are separated by 8000 bytes (1000 tiles * 8 bytes/plane).
        if (mode === 'solid_global' || mode === false) {
            const PLANE_SIZE = 8000; 
            const tileOffsetInPlane = tileIndex * 8; 
            const pBlue = tileOffsetInPlane;
            const pGreen = PLANE_SIZE + tileOffsetInPlane;
            const pRed = (PLANE_SIZE * 2) + tileOffsetInPlane;
            const pInt = (PLANE_SIZE * 3) + tileOffsetInPlane;

            if (pInt + 8 > data.length) return null;

            let pxIdx = 0;
            for (let y = 0; y < 8; y++) {
                const bBlue = data[pBlue + y];
                const bGreen = data[pGreen + y];
                const bRed = data[pRed + y];
                const bInt = data[pInt + y];

                for (let x = 0; x < 8; x++) {
                    const bit = 7 - x;
                    const colorIndex = 
                        (((bInt >> bit) & 1) << 3) |
                        (((bRed >> bit) & 1) << 2) |
                        (((bGreen >> bit) & 1) << 1) |
                        ((bBlue >> bit) & 1);
                    this.writePixel(pixels, pxIdx++, colorIndex);
                }
            }
        } 
        // --- MODE A2: SOLID CZONE (CZONE Solid Tiles - Scanline-interleaved planar) ---
        else if (mode === 'solid_czone') {
            const bytesPerTile = 32; // 8 scanlines × 4 planes per scanline
            const offset = tileIndex * bytesPerTile;
            if (offset + bytesPerTile > data.length) return null;

            let pxIdx = 0;
            for (let y = 0; y < 8; y++) {
                // Planes are interleaved per scanline: BGRB BGRB...
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
                    this.writePixel(pixels, pxIdx++, colorIndex);
                }
            }
        } 
        // --- MODE B: MASKED (Actors / CZONE Masked) ---
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
                    if (maskRow[col] === 1) { // Transparent
                        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
                    } else {
                        this.writePixel(pixels, idx/4, colorRow[col]);
                    }
                }
            }
        }
        // --- MODE C: SOLID LOCAL (Backdrops) ---
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
                    this.writePixel(pixels, (y*8 + x), colorIndex);
                }
            }
        }

        return new ImageData(pixels, TILE_SIZE, TILE_SIZE);
    }

    writePixel(pixels, index, colorIndex, palette = null) {
        const pal = palette || this.palette;
        const [r, g, b] = pal[colorIndex] || [0,0,0];
        const i = index * 4;
        pixels[i] = r;
        pixels[i+1] = g;
        pixels[i+2] = b;
        pixels[i+3] = 255;
    }

    // ... (Keep decodeFullScreenImage as is) ...
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