import { AssetManager } from './AssetManager.js';

export class ActorManager {
    constructor(assets) {
        this.assets = assets; 
        this.infoData = null; 
        this.graphicsData = null; 
        this.actorAtlas = null;        // NEW: Actor atlas with metadata
        this.spriteCache = new Map();
        this.metaframeCache = new Map(); 
        this.numActors = 0;
    }

    // ─── DATA LOADING ────────────────────────────────────────────────────────

    loadInfo(buffer) {
        if (buffer instanceof Uint8Array) {
            const temp = new Uint8Array(buffer.length);
            temp.set(buffer);
            this.infoData = new DataView(temp.buffer);
        } else if (buffer instanceof ArrayBuffer) {
            this.infoData = new DataView(buffer);
        }
        
        this.numActors = this.infoData.getUint16(0, true);
        console.log(`ACTRINFO.MNI loaded: ${this.numActors} actors (Legacy Header)`);
    }

    loadGraphics(buffer) {
        if (buffer instanceof Uint8Array) this.graphicsData = buffer;
        else if (buffer instanceof ArrayBuffer) this.graphicsData = new Uint8Array(buffer);
        
        this.spriteCache.clear(); 
        this.metaframeCache.clear();
        console.log(`ACTORS.MNI loaded: ${this.graphicsData.length} bytes`);
    }

    loadAtlas(jsonData) {
        if (Array.isArray(jsonData)) {
            this.actorAtlas = jsonData;
            
            // CRITICAL FIX: Clear caches when Atlas is loaded to remove "Palette 0" fallbacks
            this.spriteCache.clear();
            this.metaframeCache.clear();
            
            console.log(`Actor Atlas loaded: ${jsonData.length} actors. Cache cleared.`);
        } else {
            console.error('Invalid atlas data: expected array');
        }
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────

    getActorCount() {
        return this.actorAtlas ? this.actorAtlas.length : this.numActors;
    }

    getActorPalette(actorNum) {
        if (!this.actorAtlas) return 0;
        const actor = this.actorAtlas.find(a => a.actorNum === actorNum);
        return actor ? (Number(actor.palette) || 0) : 0;
    }

    getActorMetadata(actorNum) {
        if (!this.actorAtlas) return null;
        return this.actorAtlas.find(a => a.actorNum === actorNum);
    }

    getActorTable() {
        if (this.actorAtlas) {
            return this.actorAtlas.map(a => ({
                id: a.actorNum,
                name: a.name,
                numFrames: a.numFrames,
                offset: 0 
            }));
        }

        if (!this.infoData) return [];
        const actors = [];
        for (let i = 0; i < this.numActors; i++) {
            const tableOffset = 2 + (i * 2);
            if (tableOffset + 2 > this.infoData.byteLength) break;

            const wordOffset = this.infoData.getUint16(tableOffset, true);
            const actorOffset = wordOffset * 2;

            if (actorOffset !== 0 && actorOffset < this.infoData.byteLength) {
                const numFrames = this.infoData.getUint16(actorOffset, true);
                actors.push({ id: i, offset: actorOffset, numFrames });
            }
        }
        return actors;
    }

    // ─── CORE SPRITE RETRIEVAL ───────────────────────────────────────────────

    async getSpriteBitmapDirect(actorNum, frameIndex = 0) {
        if (!this.graphicsData || !this.actorAtlas) return null;

        const cacheKey = `${actorNum}_${frameIndex}`;
        if (this.spriteCache.has(cacheKey)) {
            return this.spriteCache.get(cacheKey);
        }

        const actor = this.actorAtlas.find(a => a.actorNum === actorNum);
        if (!actor) return null;

        if (!actor.frames || frameIndex >= actor.frames.length) return null;
        const frame = actor.frames[frameIndex];
        
        if (frame.widthTiles === 0 || frame.heightTiles === 0) return null;
        if (frame.widthTiles > 20 || frame.heightTiles > 20) return null; 

        const totalSize = frame.widthTiles * frame.heightTiles * 40; 
        if (frame.dataOffset + totalSize > this.graphicsData.length) return null;

        const paletteId = Number(actor.palette) || 0;
        
        const TILE_SIZE = 8;
        const canvas = document.createElement('canvas');
        canvas.width = frame.widthTiles * TILE_SIZE;
        canvas.height = frame.heightTiles * TILE_SIZE;
        const ctx = canvas.getContext('2d');

        const spriteData = this.graphicsData.subarray(frame.dataOffset, frame.dataOffset + totalSize);
        
        let tileIdx = 0;
        for (let y = 0; y < frame.heightTiles; y++) {
            for (let x = 0; x < frame.widthTiles; x++) {
                const imgData = this.assets.decodeTile(spriteData, tileIdx, true, paletteId);
                if (imgData) {
                    const bmp = await createImageBitmap(imgData);
                    ctx.drawImage(bmp, x * TILE_SIZE, y * TILE_SIZE);
                }
                tileIdx++;
            }
        }

        const finalBmp = await createImageBitmap(canvas);
        const result = { 
            bitmap: finalBmp, 
            hotspotX: frame.hotspotX || 0, 
            hotspotY: frame.hotspotY || 0 
        };

        this.spriteCache.set(cacheKey, result);
        return result;
    }

    async getSpriteBitmap(actorId, frameIndex = 0) {
        if (this.actorAtlas) {
            return this.getSpriteBitmapDirect(actorId, frameIndex);
        }
        return null;
    }

    async getMetaframeBitmap(actorNum) {
        if (this.metaframeCache.has(actorNum)) {
            return this.metaframeCache.get(actorNum);
        }

        if (!this.actorAtlas) return null;

        const actor = this.actorAtlas.find(a => a.actorNum === actorNum);
        if (!actor) return null;

        if (!actor.metaframe || !actor.metaframe.layers || actor.metaframe.layers.length === 0) {
            return await this.getSpriteBitmapDirect(actorNum, 0);
        }

        const metaframe = actor.metaframe;
        const layerBitmaps = [];
        
        for (const layer of metaframe.layers) {
            const frameBmp = await this.getSpriteBitmapDirect(actorNum, layer.frameIndex);
            if (frameBmp) {
                layerBitmaps.push({
                    bitmap: frameBmp.bitmap,
                    offsetX: layer.offsetX,
                    offsetY: layer.offsetY
                });
            }
        }

        if (layerBitmaps.length === 0) return null;

        let minX = 0, minY = 0, maxX = 0, maxY = 0;
        layerBitmaps.forEach(layer => {
            minX = Math.min(minX, layer.offsetX);
            minY = Math.min(minY, layer.offsetY);
            maxX = Math.max(maxX, layer.offsetX + layer.bitmap.width);
            maxY = Math.max(maxY, layer.offsetY + layer.bitmap.height);
        });

        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;

        const canvas = document.createElement('canvas');
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        layerBitmaps.forEach(layer => {
            ctx.drawImage(layer.bitmap, layer.offsetX - minX, layer.offsetY - minY);
        });

        const finalBmp = await createImageBitmap(canvas);
        const result = { 
            bitmap: finalBmp, 
            hotspotX: metaframe.hotspotX || 0, 
            hotspotY: metaframe.hotspotY || 0 
        };
        
        this.metaframeCache.set(actorNum, result);
        return result;
    }

    // ─── GENERATORS ──────────────────────────────────────────────────────────

    async generateSpriteSheet(viewMode = 'uniform') {
        if (viewMode === 'raw') {
            return this.generateRawTileSheet(); 
        }

        if (!this.graphicsData || !this.actorAtlas) return null;

        const entries = [];
        
        for (const actor of this.actorAtlas) {
            const metaframeBmp = await this.getMetaframeBitmap(actor.actorNum);
            if (metaframeBmp) {
                entries.push({ 
                    id: actor.actorNum, 
                    bmp: metaframeBmp.bitmap,
                    name: actor.name // Pass name to sheet generator
                });
            }
        }

        if (entries.length === 0) return null;

        if (viewMode === 'tiered' || viewMode === 'metaframe') {
            return this._generateTieredSheet(entries);
        } else {
            return this._generateUniformSheet(entries);
        }
    }

    async _generateUniformSheet(entries) {
        let maxW = 0, maxH = 0;
        entries.forEach(e => {
            if (e.bmp.width > maxW) maxW = e.bmp.width;
            if (e.bmp.height > maxH) maxH = e.bmp.height;
        });

        const padding = 10;
        const cellSize = Math.max(maxW, maxH) + padding;
        const targetRatio = 16 / 9;
        
        let cols = Math.ceil(Math.sqrt(entries.length * targetRatio));
        if (cols < 1) cols = 1;
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
            
            // FIX: Include name in layout
            layout.push({ 
                id: item.id, 
                name: item.name, 
                x, y, 
                width: cellSize, 
                height: cellSize 
            });
        }

        return { image: await createImageBitmap(canvas), layout };
    }

    async _generateTieredSheet(entries) {
        const buckets = {
            small:  { items: [], maxDim: 32 },
            medium: { items: [], maxDim: 96 },
            large:  { items: [], maxDim: 9999 }
        };

        entries.forEach(e => {
            const size = Math.max(e.bmp.width, e.bmp.height);
            if (size <= buckets.small.maxDim) buckets.small.items.push(e);
            else if (size <= buckets.medium.maxDim) buckets.medium.items.push(e);
            else buckets.large.items.push(e);
        });

        const sections = [];
        const padding = 10;
        const sectionGap = 40;
        const headerHeight = 30;
        
        let totalHeight = 0;
        let maxWidth = 0;

        for (const key of ['small', 'medium', 'large']) {
            const bucket = buckets[key];
            if (bucket.items.length === 0) continue;

            let localMax = 0;
            bucket.items.forEach(e => localMax = Math.max(localMax, e.bmp.width, e.bmp.height));
            const cellSize = localMax + padding;

            const cols = Math.ceil(Math.sqrt(bucket.items.length * (16/9)));
            const rows = Math.ceil(bucket.items.length / cols);
            
            const sectionWidth = cols * cellSize;
            const sectionHeight = rows * cellSize;

            sections.push({
                key, cols, cellSize, items: bucket.items,
                width: sectionWidth, height: sectionHeight
            });

            if (sectionWidth > maxWidth) maxWidth = sectionWidth;
            totalHeight += sectionHeight + sectionGap + headerHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let currentY = 0;
        const layout = [];

        for (const section of sections) {
            ctx.fillStyle = "#ffcc00";
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(`${section.key.toUpperCase()} (${section.items.length})`, 10, currentY + 20);
            currentY += headerHeight;

            for (let i = 0; i < section.items.length; i++) {
                const item = section.items[i];
                const col = i % section.cols;
                const row = Math.floor(i / section.cols);
                const x = col * section.cellSize;
                const y = currentY + (row * section.cellSize);
                
                ctx.strokeStyle = "#333";
                ctx.strokeRect(x, y, section.cellSize, section.cellSize);
                
                const dx = x + (section.cellSize - item.bmp.width) / 2;
                const dy = y + (section.cellSize - item.bmp.height) / 2;
                ctx.drawImage(item.bmp, dx, dy);

                // FIX: Include name in layout
                layout.push({ 
                    id: item.id, 
                    name: item.name,
                    x, y, 
                    width: section.cellSize, 
                    height: section.cellSize 
                });
            }
            currentY += section.height + sectionGap;
        }

        return { image: await createImageBitmap(canvas), layout };
    }

    async generateRawTileSheet(columns = 32) {
        if (!this.graphicsData) return null;
        
        const TILE_SIZE = 8;
        const BYTES_PER_TILE = 40; 
        
        const OVERRIDES = [
            { start: 2179, end: 3276, offset: -16, palette: 0 },
            { start: 15335, end: 15910, palette: 4 }, 
            { start: 15911, end: 16629, palette: 1 }, 
            { start: 16630, end: 16989, palette: 2 }, 
            { start: 17874, end: 17985, palette: 4 }  
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

             const startSegment = Math.floor(currentByteOffset / 65536);
             const endSegment = Math.floor((currentByteOffset + BYTES_PER_TILE - 1) / 65536);

             if (startSegment !== endSegment) {
                 ctx.fillStyle = "#FF0000"; 
                 ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                 currentByteOffset = endSegment * 65536; 
                 layout.push({ id: -1, type: "SEGMENT_GAP", x, y, width: TILE_SIZE, height: TILE_SIZE });
                 continue;
             }

             let activeOffset = 0;
             let activePalette = 0; 

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
             const imgData = this.assets.decodeTile(tileData, 0, true, activePalette);
             
             if(imgData) {
                 const bmp = await createImageBitmap(imgData);
                 ctx.drawImage(bmp, x, y);
                 layout.push({ id: i, x, y, width: TILE_SIZE, height: TILE_SIZE });
             }
             
             currentByteOffset += BYTES_PER_TILE;
        }
        return { image: await createImageBitmap(canvas), layout };
    }
    
    requestSprite(actorId) { this.getSpriteBitmap(actorId); }
    
    getSpriteSync(actorId, frameIndex = 0) {
        const cacheKey = `${actorId}_${frameIndex}`;
        return this.spriteCache.get(cacheKey) || null;
    }

    getActorForLevel(actorNum) {
        const actor = this.actorAtlas?.find(a => a.actorNum === actorNum);
        return {
            id: actorNum,
            name: actor?.name || `Actor ${actorNum}`,
            type: actor?.type || 'unknown',
            palette: actor?.palette || 0,
            hasMetaframe: !!(actor?.metaframe && actor?.metaframe.layers),
            getMetaframe: () => this.getMetaframeBitmap(actorNum),
            getFrame: (idx) => this.getSpriteBitmap(actorNum, idx)
        };
    }
}