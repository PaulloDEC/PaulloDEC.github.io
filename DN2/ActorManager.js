import { AssetManager } from './AssetManager.js';
import { getActorInfo } from './SpriteDefinitions.js';

export class ActorManager {
    constructor(assets) {
        this.assets = assets; 
        this.infoData = null; 
        this.graphicsData = null; 
        this.spriteCache = new Map();
        this.numActors = 0;
    }

    loadInfo(buffer) {
        if (buffer instanceof Uint8Array) {
            const temp = new Uint8Array(buffer.length);
            temp.set(buffer);
            this.infoData = new DataView(temp.buffer);
        } else if (buffer instanceof ArrayBuffer) {
            this.infoData = new DataView(buffer);
        }
        this.numActors = this.infoData.getUint16(0, true);
        console.log(`ACTRINFO.MNI loaded: ${this.numActors} actors`);
    }

    loadGraphics(buffer) {
        if (buffer instanceof Uint8Array) this.graphicsData = buffer;
        else if (buffer instanceof ArrayBuffer) this.graphicsData = new Uint8Array(buffer);
        this.spriteCache.clear(); 
        console.log(`ACTORS.MNI loaded: ${this.graphicsData.length} bytes`);
    }

    getActorTable() {
        if (!this.infoData) return [];

        const actors = [];
        for (let i = 0; i < this.numActors; i++) {
            const tableOffset = 2 + (i * 2);
            if (tableOffset + 2 > this.infoData.byteLength) break;

            const wordOffset = this.infoData.getUint16(tableOffset, true);
            const actorOffset = wordOffset * 2;

            if (actorOffset !== 0 && actorOffset < this.infoData.byteLength) {
                const numFrames = this.infoData.getUint16(actorOffset, true);
                actors.push({
                    id: i,
                    offset: actorOffset,
                    numFrames: numFrames
                });
            }
        }
        return actors;
    }

    async getSpriteBitmap(actorId, frameIndex = 0) {
        if (!this.infoData || !this.graphicsData) return null;
        const cacheKey = `${actorId}_${frameIndex}`;
        if (this.spriteCache.has(cacheKey)) return this.spriteCache.get(cacheKey);

        const info = getActorInfo(actorId);
        const lookupIndex = info.gfxId !== undefined ? info.gfxId : -1;

        if (lookupIndex < 0 || lookupIndex >= this.numActors) return null;

        const tableOffset = 2 + (lookupIndex * 2);
        if (tableOffset + 2 > this.infoData.byteLength) return null;
        
        const wordOffset = this.infoData.getUint16(tableOffset, true);
        const actorOffset = wordOffset * 2;
        if (actorOffset === 0 || actorOffset >= this.infoData.byteLength) return null;

        const numFrames = this.infoData.getUint16(actorOffset, true);
        if (numFrames === 0 || frameIndex >= numFrames) return null;

        const frameInfoOffset = actorOffset + 4 + (frameIndex * 16);
        if (frameInfoOffset + 16 > this.infoData.byteLength) return null;

        const hotspotX = this.infoData.getInt16(frameInfoOffset + 0, true);
        const hotspotY = this.infoData.getInt16(frameInfoOffset + 2, true);
        const heightTiles = this.infoData.getUint16(frameInfoOffset + 4, true);
        const widthTiles = this.infoData.getUint16(frameInfoOffset + 6, true);
        const dataOffset = this.infoData.getUint32(frameInfoOffset + 8, true);

        if (widthTiles === 0 || heightTiles === 0 || widthTiles > 20 || heightTiles > 20) return null;
        const totalSize = widthTiles * heightTiles * 40;
        if (dataOffset + totalSize > this.graphicsData.length) return null; 

        const TILE_SIZE = 8;
        const canvas = document.createElement('canvas');
        canvas.width = widthTiles * TILE_SIZE;
        canvas.height = heightTiles * TILE_SIZE;
        const ctx = canvas.getContext('2d');

        const spriteData = this.graphicsData.subarray(dataOffset, dataOffset + totalSize);
        let tileIdx = 0;
        for (let y = 0; y < heightTiles; y++) {
            for (let x = 0; x < widthTiles; x++) {
                const imgData = this.assets.decodeTile(spriteData, tileIdx, true);
                if (imgData) {
                    const bmp = await createImageBitmap(imgData);
                    ctx.drawImage(bmp, x * TILE_SIZE, y * TILE_SIZE);
                }
                tileIdx++;
            }
        }

        const finalBmp = await createImageBitmap(canvas);
        const spriteData_obj = { bitmap: finalBmp, hotspotX, hotspotY };
        this.spriteCache.set(cacheKey, spriteData_obj);
        return spriteData_obj;
    }

    getSpriteSync(actorId, frameIndex = 0) {
        const cacheKey = `${actorId}_${frameIndex}`;
        return this.spriteCache.get(cacheKey) || null;
    }
    
    requestSprite(actorId) { this.getSpriteBitmap(actorId); }

    /**
     * Generates a "Contact Sheet" with a layout map for hit detection.
     * @param {string} viewMode - 'uniform', 'tiered', or 'raw'
     */
    async generateSpriteSheet(viewMode = 'uniform') {
        // 1. INTERCEPT: If Raw mode, skip actor logic and return immediately
        if (viewMode === 'raw') {
            // Ensure you added the generateRawTileSheet method from the previous step
            return this.generateRawTileSheet(); 
        }

        if (!this.infoData || !this.graphicsData) return null;

        // 2. STANDARD: Load actors only if we are in uniform or tiered mode
        const validActors = this.getActorTable();
        const entries = [];
        
        for (const actor of validActors) {
            const spriteObj = await this.getSpriteBitmap(actor.id, 0);
            if (spriteObj) {
                entries.push({ id: actor.id, bmp: spriteObj.bitmap });
            }
        }

        if (entries.length === 0) return null;

        if (viewMode === 'tiered') {
            return this._generateTieredSheet(entries);
        } else {
            return this._generateUniformSheet(entries);
        }
    }

    /**
     * STANDARD VIEW: Finds the single largest sprite dimension and forces all cells to match.
     * Good for alignment, bad for space efficiency.
     */
    async _generateUniformSheet(entries) {
        let maxW = 0; 
        let maxH = 0;
        entries.forEach(e => {
            if (e.bmp.width > maxW) maxW = e.bmp.width;
            if (e.bmp.height > maxH) maxH = e.bmp.height;
        });

        const padding = 10;
        const cellSize = Math.max(maxW, maxH) + padding;
        const targetRatio = 16 / 9;
        
        let cols = Math.ceil(Math.sqrt(entries.length * targetRatio));
        if (cols < 1) cols = 1;
        if (cols > entries.length) cols = entries.length;

        const rows = Math.ceil(entries.length / cols);
        
        const canvas = document.createElement('canvas');
        canvas.width = cols * cellSize;
        canvas.height = rows * cellSize;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const layout = [];
        for (let i = 0; i < entries.length; i++) {
            const item = entries[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * cellSize;
            const y = row * cellSize;
            
            ctx.strokeStyle = "#333";
            ctx.strokeRect(x, y, cellSize, cellSize);
            
            const dx = x + (cellSize - item.bmp.width) / 2;
            const dy = y + (cellSize - item.bmp.height) / 2;
            ctx.drawImage(item.bmp, dx, dy);
            
            layout.push({ id: item.id, x, y, width: cellSize, height: cellSize });
        }

        return { image: await createImageBitmap(canvas), layout };
    }

    /**
     * TIERED VIEW: Splits sprites into Small, Medium, and Large buckets.
     * Generates three separate grids and stacks them vertically.
     */
    async _generateTieredSheet(entries) {
        const buckets = {
            small:  { items: [], cellSize: 0, maxDim: 32 },
            medium: { items: [], cellSize: 0, maxDim: 96 },
            large:  { items: [], cellSize: 0, maxDim: 9999 } // Catch-all
        };

        // 1. Sort entries into buckets
        entries.forEach(e => {
            const size = Math.max(e.bmp.width, e.bmp.height);
            if (size <= buckets.small.maxDim) buckets.small.items.push(e);
            else if (size <= buckets.medium.maxDim) buckets.medium.items.push(e);
            else buckets.large.items.push(e);
        });

        // 2. Calculate Layouts for each bucket
        const sections = [];
        const targetRatio = 16 / 9;
        const padding = 10;
        const sectionGap = 40; // Space between tables
        let totalHeight = 0;
        let maxWidth = 0;

        for (const key of ['small', 'medium', 'large']) {
            const bucket = buckets[key];
            if (bucket.items.length === 0) continue;

            // Find max size specifically for this bucket
            let localMax = 0;
            bucket.items.forEach(e => localMax = Math.max(localMax, e.bmp.width, e.bmp.height));
            bucket.cellSize = localMax + padding;

            // Calculate grid
            let cols = Math.ceil(Math.sqrt(bucket.items.length * targetRatio));
            if (cols < 1) cols = 1;
            const rows = Math.ceil(bucket.items.length / cols);
            
            const sectionWidth = cols * bucket.cellSize;
            const sectionHeight = rows * bucket.cellSize;

            sections.push({
                key,
                cols,
                rows,
                width: sectionWidth,
                height: sectionHeight,
                cellSize: bucket.cellSize,
                items: bucket.items,
                yOffset: totalHeight + (totalHeight > 0 ? sectionGap : 0) // Add gap if not first
            });

            if (sectionWidth > maxWidth) maxWidth = sectionWidth;
            totalHeight += sectionHeight + (totalHeight > 0 ? sectionGap : 0);
        }

        // --- CUT generateRawTileSheet FROM HERE ---

        // Add header space
        const headerHeight = 30;
        totalHeight += (sections.length * headerHeight); 
        
        // 3. Draw Stacked
        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const layout = [];
        let currentY = 0;

        for (const section of sections) {
            // Draw Header
            ctx.fillStyle = "#ffcc00";
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(section.key.toUpperCase() + ` (${section.items.length})`, 10, currentY + 20);
            currentY += headerHeight;

            // Draw Grid
            for (let i = 0; i < section.items.length; i++) {
                const item = section.items[i];
                const col = i % section.cols;
                const row = Math.floor(i / section.cols);
                const x = col * section.cellSize;
                const y = currentY + (row * section.cellSize);
                
                // Draw Cell Border
                ctx.strokeStyle = "#333";
                ctx.strokeRect(x, y, section.cellSize, section.cellSize);
                
                // Draw Sprite
                const dx = x + (section.cellSize - item.bmp.width) / 2;
                const dy = y + (section.cellSize - item.bmp.height) / 2;
                ctx.drawImage(item.bmp, dx, dy);

                layout.push({
                    id: item.id,
                    x: x,
                    y: y,
                    width: section.cellSize,
                    height: section.cellSize
                });
            }
            currentY += section.height + sectionGap;
        }

        return { image: await createImageBitmap(canvas), layout };
    }

    /**
     * RAW VIEW (Smart with Manual Overrides & Palette Swapping)
     */
    async generateRawTileSheet(columns = 32) {
        if (!this.graphicsData) return null;

        const TILE_SIZE = 8;
        const BYTES_PER_TILE = 40; 
        
        // ADD PALETTE IDs HERE
        const OVERRIDES = [
            { start: 2179, end: 3276, offset: -16, palette: 0 },
			{ start: 15335, end: 15910, palette: 4 }, // Overlaid on the newscast backdrop during the intro
			{ start: 15911, end: 16629, palette: 1 }, // Overlaid on black, scenes of Duke being interrogated
			{ start: 16630, end: 16989, palette: 2 }, // Overlaid on black, scenes of Duke's molar and escape
			{ start: 17874, end: 17985, palette: 4 }  // Overlaid on the newscast backdrop during the intro
        ];

        const totalTiles = Math.floor(this.graphicsData.length / BYTES_PER_TILE);
        const rows = Math.ceil(totalTiles / columns);

        const canvas = document.createElement('canvas');
        canvas.width = columns * TILE_SIZE;
        canvas.height = rows * TILE_SIZE;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const layout = [];
        let currentByteOffset = 0;
        
        for (let i = 0; i < totalTiles; i++) {
            const col = i % columns;
            const row = Math.floor(i / columns);
            const x = col * TILE_SIZE;
            const y = row * TILE_SIZE;

            // 1. BOUNDARY CHECK
            const startSegment = Math.floor(currentByteOffset / 65536);
            const endSegment = Math.floor((currentByteOffset + BYTES_PER_TILE - 1) / 65536);

            if (startSegment !== endSegment) {
                ctx.fillStyle = "#FF0000"; 
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                currentByteOffset = endSegment * 65536;
                layout.push({ id: -1, type: "SEGMENT_GAP", x, y, width: TILE_SIZE, height: TILE_SIZE });
                continue;
            }

            // 2. CHECK FOR OVERRIDES
            let activeOffset = 0;
            let activePalette = 0; // Default to 0

            const override = OVERRIDES.find(o => i >= o.start && i <= o.end);
            if (override) {
                if (override.offset !== undefined) activeOffset = override.offset;
                if (override.palette !== undefined) activePalette = override.palette;
            }

            const readOffset = currentByteOffset + activeOffset;

            if (readOffset < 0 || readOffset + BYTES_PER_TILE > this.graphicsData.length) {
                currentByteOffset += BYTES_PER_TILE;
                continue;
            }

            const tileData = this.graphicsData.subarray(readOffset, readOffset + BYTES_PER_TILE);
            
            // 3. PASS activePalette TO DECODER
            const imgData = this.assets.decodeTile(tileData, 0, true, activePalette);

            if (imgData) {
                const bmp = await createImageBitmap(imgData);
                ctx.drawImage(bmp, x, y);
                layout.push({ id: i, x, y, width: TILE_SIZE, height: TILE_SIZE });
            }
            
            currentByteOffset += BYTES_PER_TILE;
        }

        return { image: await createImageBitmap(canvas), layout };
    }
    
    getActorCount() {
        return this.numActors;
    }
}