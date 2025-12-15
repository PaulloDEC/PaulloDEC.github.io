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
     */
    async generateSpriteSheet() {
        if (!this.infoData || !this.graphicsData) return null;

        // 1. Gather all sprites
        const entries = [];
        for (let i = 0; i < 302; i++) {
            const spriteObj = await this.getSpriteBitmap(i, 0);
            if (spriteObj) {
                entries.push({ id: i, bmp: spriteObj.bitmap });
            }
        }

        // 2. Setup Layout
        const cellSize = 64;
        const cols = 10;
        const rows = Math.ceil(entries.length / cols);
        
        const canvas = document.createElement('canvas');
        canvas.width = cols * cellSize;
        canvas.height = rows * cellSize;
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. Draw Items and build Layout Map
        const layout = [];

        for (let i = 0; i < entries.length; i++) {
            const item = entries[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * cellSize;
            const y = row * cellSize;
            
            // Draw subtle cell border
            ctx.strokeStyle = "#333";
            ctx.strokeRect(x, y, cellSize, cellSize);
            
            // Center sprite
            const bmp = item.bmp;
            const drawW = Math.min(bmp.width, cellSize - 4);
            const drawH = Math.min(bmp.height, cellSize - 4);
            const dx = x + (cellSize - drawW) / 2;
            const dy = y + (cellSize - drawH) / 2;
            
            ctx.drawImage(bmp, dx, dy);
            
            // Register Hitbox (Full Cell)
            layout.push({
                id: item.id,
                x: x,
                y: y,
                width: cellSize,
                height: cellSize
            });
        }

        const finalImage = await createImageBitmap(canvas);
        
        // Return BOTH the image and the hit-map
        return {
            image: finalImage,
            layout: layout
        };
    }
    
    getActorCount() {
        return this.numActors;
    }
}
