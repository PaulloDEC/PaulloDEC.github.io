export class RenderEngine {
    // UPDATED: Now accepts actorManager as 2nd argument
    constructor(canvas, actorManager) {
        this.canvas = canvas;
        this.actorManager = actorManager; // Store reference for tooltips/alignment
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
                const sprite = hit.sprite;
                const hexId = actor.id.toString(16).toUpperCase().padStart(4, '0');
                
                // UPDATED: Use actorManager for metadata lookup (Atlas)
                const meta = this.actorManager ? this.actorManager.getActorMetadata(actor.id) : null;
                const name = meta ? meta.name : "Unknown Actor";
                
                // CONDITIONAL FORMATTING
                let typeHtml = "";
                if (meta && meta.type) {
                    typeHtml = `Type: ${meta.type}<br>`;
                }
                
                let locationHtml = "";
                if (hit.type === 'map') {
                    locationHtml = `Map Pos: (${actor.x}, ${actor.y})<br>`;
                }
                
                let hotspotHtml = "";
                if (sprite) {
                    hotspotHtml = `<span style="color:#f90">Hotspot: ${sprite.hotspotX}, ${sprite.hotspotY}</span>`;
                }

                // Show Palette info if valid
                let extraInfo = "";
                if (meta && meta.palette) extraInfo += `Pal: ${meta.palette} `;

                html += `
                    <div style="margin-top: 8px;">
                        <span style="color:#38bdf8; font-weight:bold; display:block; margin-bottom:3px;">${name}</span>
                        <div style="color:#94a3b8; font-size:11px; line-height:1.5;">
                            ID: ${actor.id} (0x${hexId})<br>
                            ${typeHtml}
                            ${locationHtml}
                            ${hotspotHtml}
                            ${extraInfo}
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
                    this.drawActors(ctx, state.currentMap, state.actorManager, state.layers, state.difficulty);
                }
            }
        } 
        else if (state.viewMode === 'asset' && state.currentAsset) {
            // Draw Asset Image
            ctx.drawImage(state.currentAsset.image, 0, 0);
            
            // Register Asset Hitboxes
            if (state.currentAsset.layout) {
                state.currentAsset.layout.forEach(item => {
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

    drawActors(ctx, map, actorManager, layers, difficulty = 0) {
        const TILE_SIZE = 8;
        const am = actorManager || this.actorManager;

        // First pass: build a set of positions with meta-difficulty actors
        const metaHardOnly = new Set();
        const metaMediumHardOnly = new Set();
        
        for (const actor of map.actors) {
            if (actor.id === 83) { // Meta_Hard_Only
                metaHardOnly.add(`${actor.x},${actor.y}`);
            } else if (actor.id === 82) { // Meta_Medium_Hard_Only
                metaMediumHardOnly.add(`${actor.x},${actor.y}`);
            }
        }

        // Helper function to check if an actor has a meta marker adjacent
        const hasAdjacentMeta = (x, y, metaSet) => {
            // Check all 8 surrounding positions
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue; // Skip the actor's own position
                    if (metaSet.has(`${x + dx},${y + dy}`)) {
                        return true;
                    }
                }
            }
            return false;
        };

        // Second pass: draw actors with difficulty filtering
        for (const actor of map.actors) {
            if (actor.id === 0) continue;
            
            // Get actor metadata to check type
            const meta = am ? am.getActorMetadata(actor.id) : null;
            const actorType = meta ? meta.type : null;
            
            // Never draw meta actors themselves
            if (actorType === 'meta') continue;
            
            // Check difficulty filtering
            const hasHardOnly = hasAdjacentMeta(actor.x, actor.y, metaHardOnly);
            const hasMediumHardOnly = hasAdjacentMeta(actor.x, actor.y, metaMediumHardOnly);
            
            if (hasHardOnly && difficulty !== 2) continue; // Only show on Hard
            if (hasMediumHardOnly && difficulty === 0) continue; // Hide on Easy
            
            // Filter by type based on layer settings
            if (layers) {
                if (actorType === 'player' && !layers.showPlayer) continue;
                if (actorType === 'enemy' && !layers.showEnemies) continue;
                if (actorType === 'hazard' && !layers.showHazards) continue;
                if (actorType === 'bonus' && !layers.showBonuses) continue;
                if (actorType === 'powerup' && !layers.showPowerups) continue;
                if (actorType === 'keyitem' && !layers.showKeys) continue;
                if (actorType === 'tech' && !layers.showTech) continue;
            }
            
            const sprite = am ? am.getMetaframeSync(actor.id) : null;
            
            if (sprite) {
                const ax = actor.x * TILE_SIZE;
                const ay = actor.y * TILE_SIZE;
                
                const dx = ax - sprite.hotspotX;
                const dy = ay - sprite.hotspotY;

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
            } else if (am) {
                am.requestMetaframe(actor.id);
            }
        }
    }
}