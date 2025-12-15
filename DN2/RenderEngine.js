import { getActorInfo } from './SpriteDefinitions.js';

export class RenderEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.setPixelated();
        this.cacheCanvas = document.createElement('canvas');
        this.cacheCtx = this.cacheCanvas.getContext('2d', { alpha: true });
        this.isCached = false;
        this.tileSize = 8;
        this.actorHitboxes = [];
        this.lastViewport = null;
        this.setupTooltip();
    }

    setupTooltip() {
        this.tooltip = document.getElementById('tooltip');
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.id = 'tooltip';
            this.tooltip.style.cssText = `position:fixed;background:rgba(15,23,42,0.95);border:1px solid #38bdf8;color:#f1f5f9;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:12px;pointer-events:none;z-index:10000;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
            document.body.appendChild(this.tooltip);
        }
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => { this.tooltip.style.display = 'none'; });
    }

		handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const hovered = this.findActorsAtScreenPos(mouseX, mouseY);
        
        if (hovered.length > 0) {
            let html = `<div style="margin-bottom:4px;border-bottom:1px solid #555;padding-bottom:2px;color:#fc0;font-weight:bold;">${hovered.length} Item(s)</div>`;
            
            hovered.forEach(hit => {
                const actor = hit.actor;
                const info = getActorInfo(actor.id);
                const hexId = actor.id.toString(16).toUpperCase().padStart(4, '0');
                const sprite = hit.sprite;
                
                // CONDITIONAL FORMATTING
                let locationHtml = "";
                if (hit.type === 'map') {
                    locationHtml = `Map Pos: (${actor.x}, ${actor.y})<br>`;
                }
                
                let hotspotHtml = "";
                if (sprite) {
                    hotspotHtml = `<span style="color:#f90">Hotspot: ${sprite.hotspotX}, ${sprite.hotspotY}</span>`;
                }

                // UPDATED STYLES HERE:
                html += `
                    <div style="margin-top: 8px;">
                        <span style="color:#38bdf8; font-weight:bold; display:block; margin-bottom:3px;">${info.name}</span>
                        <div style="color:#94a3b8; font-size:11px; line-height:1.5;">
                            ID: ${actor.id} (0x${hexId})<br>
                            ${locationHtml}
                            ${hotspotHtml}
                        </div>
                    </div>
                `;
            });

            this.tooltip.innerHTML = html;
            this.tooltip.style.left = (e.clientX + 15) + 'px';
            this.tooltip.style.top = (e.clientY + 15) + 'px';
            this.tooltip.style.display = 'block';
        } else {
            this.tooltip.style.display = 'none';
        }
    }

    findActorsAtScreenPos(screenX, screenY) {
        if (!this.lastViewport || this.actorHitboxes.length === 0) return [];
        const zoom = this.lastViewport.zoom;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const wx = ((screenX - cx) / zoom) + this.lastViewport.x;
        const wy = ((screenY - cy) / zoom) + this.lastViewport.y;
        
        return this.actorHitboxes.filter(hit => 
            wx >= hit.x && wx < hit.x + hit.width && wy >= hit.y && wy < hit.y + hit.height
        ).reverse();
    }

    setPixelated() {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
    }

    preRender(map, assets, useGridFix) {
        if (!map || !assets) return;
        this.cacheCanvas.width = map.width * this.tileSize;
        this.cacheCanvas.height = map.height * this.tileSize;
        this.cacheCtx.imageSmoothingEnabled = false;
        this.cacheCtx.clearRect(0,0,this.cacheCanvas.width,this.cacheCanvas.height);
        const ds = useGridFix ? 8.4 : 8;
        for(let y=0; y<map.height; y++) {
            for(let x=0; x<map.width; x++) {
                const c = map.grid[y*map.width+x];
                if(c.bg!==null && assets.solidTiles[c.bg]) this.cacheCtx.drawImage(assets.solidTiles[c.bg], x*8, y*8, ds, ds);
                if(c.fg!==null && assets.maskedTiles[c.fg]) this.cacheCtx.drawImage(assets.maskedTiles[c.fg], x*8, y*8, ds, ds);
            }
        }
        this.isCached = true;
    }

    draw(state, viewport) {
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        const zoom = viewport.zoom;

        // Clear
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.fillStyle = state.useSolidBG ? '#000000' : '#0a0a0a';
        ctx.fillRect(0, 0, width, height);



        // Transform
        const cx = width / 2;
        const cy = height / 2;
        const tx = cx - (viewport.x * zoom);
        const ty = cy - (viewport.y * zoom);
        ctx.setTransform(zoom, 0, 0, zoom, tx, ty);

        this.lastViewport = viewport;
        this.actorHitboxes = []; 

        if (state.viewMode === 'map') {
            if (this.isCached) {
                if (state.layers.showMap) ctx.drawImage(this.cacheCanvas, 0, 0);
                if (state.layers.showSprites && state.currentMap && state.currentMap.actors) {
                    this.drawActors(ctx, state.currentMap, state.actorManager);
                }
            }
        } 
        else if (state.viewMode === 'asset' && state.currentAsset) {
            // Draw Asset Image
            ctx.drawImage(state.currentAsset.image, 0, 0);
            
            // Register Asset Hitboxes
            if (state.currentAsset.layout) {
                state.currentAsset.layout.forEach(item => {
                    // Fetch sprite info for hotspot data
                    const sprite = state.actorManager ? state.actorManager.getSpriteSync(item.id) : null;
                    
                    this.actorHitboxes.push({
                        type: 'asset',
                        actor: { id: item.id }, // Minimal object for ID
                        sprite: sprite,
                        x: item.x,
                        y: item.y,
                        width: item.width,
                        height: item.height
                    });
                });
            }
        }
    }

    drawActors(ctx, map, actorManager) {
        const TILE_SIZE = 8;
        for (const actor of map.actors) {
            if (actor.id === 0) continue;
            const sprite = actorManager.getSpriteSync(actor.id);
            if (sprite) {
                const ax = actor.x * TILE_SIZE;
                const ay = actor.y * TILE_SIZE;
                
                let dx = ax; 
                let dy = ay;
                
                if (sprite.hotspotX !== 0 || sprite.hotspotY !== 0) {
                    dx -= sprite.hotspotX;
                    dy -= sprite.hotspotY;
                } else {
                    const info = getActorInfo(actor.id);
                    if (!info.name.includes("CEILING") && !info.name.includes("TOP")) {
                        dy = (actor.y + 1) * 8 - sprite.bitmap.height;
                    }
                    if (info.name.includes("TURRET")) {
                        dx = (actor.x * 8) + 4 - (sprite.bitmap.width / 2);
                    }
                }

                ctx.drawImage(sprite.bitmap, dx, dy);
                
                this.actorHitboxes.push({
                    type: 'map',
                    actor: actor,
                    sprite: sprite,
                    x: dx,
                    y: dy,
                    width: sprite.bitmap.width,
                    height: sprite.bitmap.height
                });
            } else {
                actorManager.requestSprite(actor.id);
            }
        }
    }
}