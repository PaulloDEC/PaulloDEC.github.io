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
        
        // Determine which actor to pull frames from
        const sourceActorNum = metaframe.sourceActorNum !== undefined ? metaframe.sourceActorNum : actorNum;
        
        const layerBitmaps = [];
        
        for (const layer of metaframe.layers) {
            const frameBmp = await this.getSpriteBitmapDirect(sourceActorNum, layer.frameIndex);
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

    /**
     * Sort actors based on the specified mode
     */
    _sortActors(actors, sortMode) {
        const sorted = [...actors]; // Make a copy
        
        switch(sortMode) {
            case 'name':
                return sorted.sort((a, b) => a.name.localeCompare(b.name));
            
            case 'type':
                return sorted.sort((a, b) => {
                    const typeA = a.type || 'unknown';
                    const typeB = b.type || 'unknown';
                    if (typeA === typeB) {
                        return a.name.localeCompare(b.name);
                    }
                    return typeA.localeCompare(typeB);
                });
            
            case 'size':
                return sorted.sort((a, b) => {
                    // Calculate sprite area based on first frame
                    const sizeA = a.frames[0] ? (a.frames[0].widthTiles * a.frames[0].heightTiles) : 0;
                    const sizeB = b.frames[0] ? (b.frames[0].widthTiles * b.frames[0].heightTiles) : 0;
                    return sizeB - sizeA; // Largest first
                });
            
            default: // 'default' - by actor number
                return sorted.sort((a, b) => a.actorNum - b.actorNum);
        }
    }

    /**
     * Generate dynamic view data (returns actor objects instead of canvas)
     */
    async generateDynamicView(sortMode = 'default', currentZoom = 1) {
        if (!this.actorAtlas) return null;
        
        // Sort actors
        const sortedActors = this._sortActors(this.actorAtlas, sortMode);
        
        // Build actor data array
        const actors = [];
        
        for (const actor of sortedActors) {
            const metaframeBmp = await this.getMetaframeBitmap(actor.actorNum);
            
            if (metaframeBmp) {
                actors.push({
                    actorNum: actor.actorNum,
                    name: actor.name,
                    type: actor.type || 'unknown',
                    palette: actor.palette || 0,
                    metaframe: metaframeBmp.bitmap,
                    hotspotX: metaframeBmp.hotspotX,
                    hotspotY: metaframeBmp.hotspotY
                });
            }
        }
        
        return {
            actors: actors,
            sortMode: sortMode,
            zoom: currentZoom
        };
    }

    // ─── GENERATORS ──────────────────────────────────────────────────────────

    async generateSpriteSheet(viewMode = 'dynamic', sortMode = 'default', zoom = 1) {
        // Dynamic view - return actor data for DOM rendering
        if (viewMode === 'dynamic') {
            return this.generateDynamicView(sortMode, zoom);
        }
        
        // Raw view - return canvas as before
        if (viewMode === 'raw') {
            return this.generateRawTileSheet();
        }
        
        return null;
    }
    
    
    async generateRawTileSheet(columns = 32) {
        if (!this.graphicsData) return null;
        
        const TILE_SIZE = 8;
        const BYTES_PER_TILE = 40; 
        
        // --- SPLIT VIEW CONFIGURATION ---
        const NUM_STRIPS = 5;       // Number of side-by-side pieces
        const STRIP_GAP = 32;       // Pixel gap between pieces
        // --------------------------------

        const OVERRIDES = [
            { start: 2179, end: 3276, offset: -16, palette: 0 },
            { start: 15335, end: 15910, palette: 4 }, 
            { start: 15911, end: 16629, palette: 1 }, 
            { start: 16630, end: 16989, palette: 2 }, 
            { start: 17874, end: 17985, palette: 4 }  
        ];

        const totalTiles = Math.floor(this.graphicsData.length / BYTES_PER_TILE);
        
        // 1. Calculate Logical Dimensions (if it were one giant column)
        const logicalTotalRows = Math.ceil(totalTiles / columns);
        
        // 2. Calculate Split Dimensions
        // Divide the total rows by the number of strips to get height of one strip
        const rowsPerStrip = Math.ceil(logicalTotalRows / NUM_STRIPS);
        const stripPixelWidth = columns * TILE_SIZE;

        const canvas = document.createElement('canvas');
        
        // Calculate total canvas width: (Width * Count) + (Gap * (Count - 1))
        canvas.width = (stripPixelWidth * NUM_STRIPS) + (STRIP_GAP * (NUM_STRIPS - 1));
        canvas.height = rowsPerStrip * TILE_SIZE;
        
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const layout = [];
        let currentByteOffset = 0;

        for (let i = 0; i < totalTiles; i++) {
             // 1. Calculate "Logical" position (as if it were one long strip)
             const logicalCol = i % columns;
             const logicalRow = Math.floor(i / columns);

             // 2. Map Logical position to Split Position
             // Which of the 5 strips are we in?
             const stripIndex = Math.floor(logicalRow / rowsPerStrip);
             // Which row within that specific strip?
             const rowInStrip = logicalRow % rowsPerStrip;

             // Safety break if math slightly exceeds bounds
             if (stripIndex >= NUM_STRIPS) break;

             // 3. Calculate Final Pixel Coordinates
             // X = (Strip Offset) + (Column Offset)
             const x = (stripIndex * (stripPixelWidth + STRIP_GAP)) + (logicalCol * TILE_SIZE);
             const y = rowInStrip * TILE_SIZE;

             // --- DRAWING LOGIC (Unchanged, just uses new x/y) ---

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
                 layout.push({ id: i, x, y, width: TILE_SIZE, height: TILE_SIZE, isRawView: true });
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

    getMetaframeSync(actorNum) {
        return this.metaframeCache.get(actorNum) || null;
    }

    requestMetaframe(actorNum) {
        this.getMetaframeBitmap(actorNum);
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

