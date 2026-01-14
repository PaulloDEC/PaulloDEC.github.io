/**
 * ============================================================================
 * LEVEL STATISTICS MANAGER - Duke Nukem II
 * ============================================================================
 * 
 * Generates a comprehensive "census" of the current level, providing players
 * with strategic information about what they'll encounter.
 * 
 * Features:
 * - Counts enemies, hazards, bonuses, and interactive objects
 * - Identifies required items (keys, power-ups)
 * - Lists optional collectibles
 * - Detects level objectives (bosses, teleporters, exits)
 * - Displays item icons using actor metaframes
 * - Collapsible interface to minimize screen space
 * 
 * Display Categories:
 * 1. Entity Counts: Numerical breakdown by type
 * 2. Required Items: Keys and essential items
 * 3. Optional Items: Useful but non-critical collectibles
 * 4. Objectives: Mission goals (color-coded by type)
 * 
 * The panel appears in the top-left corner when viewing map levels
 * and can be collapsed/expanded by clicking the header.
 */

export class LevelStats {
    /* ====================================================================== */
    /* CONSTRUCTOR AND INITIALIZATION                                         */
    /* ====================================================================== */
    
    /**
     * Creates a new level statistics manager.
     * 
     * @param {string} containerId - DOM ID for the stats panel element
     */
    constructor(containerId) {
        /* ------------------------------------------------------------------ */
        /* Create Panel Container                                             */
        /* ------------------------------------------------------------------ */
        
        let panel = document.getElementById(containerId);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = containerId;
            panel.className = 'stats-panel';
            document.querySelector('.main-content').appendChild(panel);
        }
        
        this.panel = panel;
        this.panel.style.display = 'none'; // Hidden by default
        this.isCollapsed = true; // Start collapsed
        
        /* ------------------------------------------------------------------ */
        /* Define Required Items                                              */
        /* ------------------------------------------------------------------ */
        
        this.REQUIRED_ITEMS = [
            { id: 37, name: "Circuit Card" },
            { id: 114, name: "Cloaking Device" },
            { id: 121, name: "Blue Key" }
        ];
        
        /* ------------------------------------------------------------------ */
        /* Define Optional Items                                              */
        /* ------------------------------------------------------------------ */
        
        this.OPTIONAL_ITEMS = [
            { id: 20, name: "Flamethrower" },
            { id: 28, name: "Health Molecule" },
            { id: 23, name: "Laser" },
            { id: 22, name: "Normal Weapon" },
            { id: 53, name: "Rapid Fire" },
            { id: 19, name: "Rocket Launcher" }
        ];
        
        /* ------------------------------------------------------------------ */
        /* Define Level Objectives                                            */
        /* ------------------------------------------------------------------ */
        
        /**
         * Objective detection rules.
         * Key: Objective name
         * Value: Array of actor IDs that trigger this objective
         */
        this.OBJECTIVE_TRIGGERS = {
            "Defeat Rigelatin Boss": [200, 101, 265, 279],
            "Breach Super Forcefield": [93],
            "Destroy Radar Dishes": [236],
            "Locate Teleporter": [50, 51]
        };
        
        /* ------------------------------------------------------------------ */
        /* Define Objective Classes (Refactored)                              */
        /* ------------------------------------------------------------------ */

        // Maps objective text to CSS classes instead of hex codes
        this.OBJECTIVE_CLASSES = {
            "Defeat Rigelatin Boss": "obj-boss",
            "Breach Super Forcefield": "obj-forcefield",
            "Destroy Radar Dishes": "obj-radar",
            "Locate Teleporter": "obj-teleport",
            "Reach the Exit": "obj-exit"
        };
    }
    
    /* ====================================================================== */
    /* LEVEL ANALYSIS                                                         */
    /* ====================================================================== */
    
    /**
     * Analyzes the level and updates the statistics display.
     * 
     * @param {Object} map - Map data with actors array
     * @param {ActorManager} actorManager - Actor manager for metadata/sprites
     */
    async update(map, actorManager, difficulty = 0) {
        if (!map || !map.actors) return;
        
        /* ------------------------------------------------------------------ */
        /* Step 1: Initialize Counters                                        */
        /* ------------------------------------------------------------------ */
        
        const stats = {
            enemies: 0,
            hazards: 0,
            bonuses: 0,
            powerups: 0,
            keyitems: 0,
            tech: 0
        };
        
        /* ------------------------------------------------------------------ */
        /* Step 2: Initialize Item Tracking                                   */
        /* ------------------------------------------------------------------ */
        
        const foundItems = new Set();
        const foundOptional = new Set();
        const foundObjectives = new Set();
        
        /* ------------------------------------------------------------------ */
        /* Step 3: Scan All Actors                                            */
        /* ------------------------------------------------------------------ */
        
        for (const actor of map.actors) {
            if (actor.id === 0) continue; // Skip empty actors
            
            // Get actor metadata
            const meta = actorManager.getActorMetadata(actor.id);
            const actorType = meta ? meta.type : null;
            
            // Skip meta actors
            if (actorType === 'meta') continue;
            
            // Apply difficulty filtering (same logic as RenderEngine)
            // Check for adjacent meta actors (Hard-only and Medium-Hard-only markers)
            const hasHardOnly = map.actors.some(m => 
                m.id === 83 && // Meta_Hard_Only
                Math.abs(m.x - actor.x) <= 1 && Math.abs(m.y - actor.y) <= 1 &&
                !(m.x === actor.x && m.y === actor.y)
            );
            const hasMediumHardOnly = map.actors.some(m => 
                m.id === 82 && // Meta_Medium_Hard_Only
                Math.abs(m.x - actor.x) <= 1 && Math.abs(m.y - actor.y) <= 1 &&
                !(m.x === actor.x && m.y === actor.y)
            );
            
            if (hasHardOnly && difficulty !== 2) continue; // Only show on Hard
            if (hasMediumHardOnly && difficulty === 0) continue; // Hide on Easy
            
            // Count by type
            if (actorType === 'enemy') stats.enemies++;
            else if (actorType === 'hazard') stats.hazards++;
            else if (actorType === 'bonus') stats.bonuses++;
            else if (actorType === 'powerup') stats.powerups++;
            else if (actorType === 'keyitem') stats.keyitems++;
            else if (actorType === 'tech') stats.tech++;
            
            // Track required items
            if (this.REQUIRED_ITEMS.find(item => item.id === actor.id)) {
                foundItems.add(actor.id);
            }
            
            // Track optional items
            if (this.OPTIONAL_ITEMS.find(item => item.id === actor.id)) {
                foundOptional.add(actor.id);
            }
            
            // Detect objectives
            for (const [objective, triggerIds] of Object.entries(this.OBJECTIVE_TRIGGERS)) {
                if (triggerIds.includes(actor.id)) {
                    foundObjectives.add(objective);
                }
            }
        }
        
        // Add "Reach the Exit" objective unless there's a boss
        if (!foundObjectives.has("Defeat Rigelatin Boss")) {
            foundObjectives.add("Reach the Exit");
        }
        
        /* ------------------------------------------------------------------ */
        /* Step 4: Build HTML                                                 */
        /* ------------------------------------------------------------------ */
        
        const w = map.width;
        const h = map.height;
        
        let html = `
            <div class="stats-header">
                <span class="stats-arrow">${this.isCollapsed ? '▶' : '▼'}</span>
                <span class="stats-title">LEVEL STATISTICS</span>
            </div>
            <div class="stats-content" style="display: ${this.isCollapsed ? 'none' : 'block'}">
                <div class="stats-grid">
                    <div class="stat-item">Enemies:<span>${stats.enemies}</span></div>
                    <div class="stat-item">Hazards:<span>${stats.hazards}</span></div>
                    <div class="stat-item">Bonuses:<span>${stats.bonuses}</span></div>
                    <div class="stat-item">Powerups:<span>${stats.powerups}</span></div>
                    <div class="stat-item">Key Items:<span>${stats.keyitems}</span></div>
                    <div class="stat-item">Tech:<span>${stats.tech}</span></div>
                </div>
                <div class="stats-divider"></div>
                <div class="stats-subtitle">REQUIRED ITEMS:</div>
                <div class="required-items-list">
        `;
        
        /* ------------------------------------------------------------------ */
        /* Build Required Items Section                                       */
        /* ------------------------------------------------------------------ */
        
        const buildItemList = (itemList, foundSet) => {
            let itemHtml = '';
            itemList.forEach(item => {
                if (foundSet.has(item.id)) {
                    itemHtml += `
                        <div class="req-item">
                            <div class="req-icon" id="req-item-${item.id}"></div>
                            <span>${item.name}</span>
                        </div>
                    `;
                }
            });
            return itemHtml;
        };
        
        html += buildItemList(this.REQUIRED_ITEMS, foundItems);
        html += `</div>`;
        
        /* ------------------------------------------------------------------ */
        /* Build Optional Items Section                                       */
        /* ------------------------------------------------------------------ */
        
        if (this.OPTIONAL_ITEMS.length > 0) {
            html += `
                <div class="stats-divider"></div>
                <div class="stats-subtitle">OPTIONAL ITEMS:</div>
                <div class="required-items-list">
            `;
            html += buildItemList(this.OPTIONAL_ITEMS, foundOptional);
            html += `</div>`;
        }
        
        /* ------------------------------------------------------------------ */
        /* Build Objectives Section                                           */
        /* ------------------------------------------------------------------ */

        html += `
            <div class="stats-divider"></div>
            <div class="stats-subtitle">OBJECTIVES:</div>
            <div class="required-items-list stats-objectives-wrapper">
        `;

        // Sort objectives by priority
        const order = [
            "Defeat Rigelatin Boss",
            "Breach Super Forcefield",
            "Destroy Radar Dishes",
            "Locate Teleporter",
            "Reach the Exit"
        ];

        const sortedObjs = Array.from(foundObjectives).sort((a, b) => {
            return order.indexOf(a) - order.indexOf(b);
        });

        sortedObjs.forEach(obj => {
            // Get the CSS class, fallback to default if not found
            const colorClass = this.OBJECTIVE_CLASSES[obj] || 'obj-default';
            
            // Uses classes instead of inline styles
            html += `
                <div class="req-item objective-text ${colorClass}">
                    <span>${obj}</span>
                </div>
            `;
        });

        html += `</div>`;
        
        /* ------------------------------------------------------------------ */
        /* Build Footer Section                                               */
        /* ------------------------------------------------------------------ */
        
        html += `
                <div class="stats-divider"></div>
                <div class="map-dim">Map Size: ${w} × ${h}</div>
            </div>
        `;
        
        /* ------------------------------------------------------------------ */
        /* Insert HTML into Panel                                             */
        /* ------------------------------------------------------------------ */
        
        this.panel.innerHTML = html;
        
        /* ------------------------------------------------------------------ */
        /* Post-Render: Attach Item Icon Sprites                             */
        /* ------------------------------------------------------------------ */
        
        const attachImages = async (itemList, foundSet) => {
            // First pass: check if we need to request any sprites
            let needsWait = false;
            for (const item of itemList) {
                if (foundSet.has(item.id)) {
                    let sprite = actorManager.getMetaframeSync(item.id);
                    if (!sprite) {
                        actorManager.requestMetaframe(item.id);
                        needsWait = true;
                    }
                }
            }
            
            // Only wait if we had to request sprites
            if (needsWait) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Second pass: attach the sprites
            for (const item of itemList) {
                if (foundSet.has(item.id)) {
                    const container = document.getElementById(`req-item-${item.id}`);
                    let sprite = actorManager.getMetaframeSync(item.id);
                    
                    if (container && sprite && sprite.bitmap) {
                        const iconCanvas = document.createElement('canvas');
                        iconCanvas.width = sprite.bitmap.width;
                        iconCanvas.height = sprite.bitmap.height;
                        
                        const ctx = iconCanvas.getContext('2d');
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(sprite.bitmap, 0, 0);
                        
                        container.appendChild(iconCanvas);
                    }
                }
            }
        };
        
        // Await both attachment operations
        await attachImages(this.REQUIRED_ITEMS, foundItems);
        await attachImages(this.OPTIONAL_ITEMS, foundOptional);
        
        /* ------------------------------------------------------------------ */
        /* Re-attach Header Click Listener                                    */
        /* ------------------------------------------------------------------ */
        
        this.panel.querySelector('.stats-header').addEventListener('click', () => {
            this.toggleCollapse();
        });
        
        // Show the panel after updating
        this.show();
        
    }
    
    /* ====================================================================== */
    /* PANEL VISIBILITY CONTROLS                                              */
    /* ====================================================================== */
    
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        
        const content = this.panel.querySelector('.stats-content');
        const arrow = this.panel.querySelector('.stats-arrow');
        
        if (content) content.style.display = this.isCollapsed ? 'none' : 'block';
        if (arrow) arrow.textContent = this.isCollapsed ? '▶' : '▼';
    }
    
    show() {
        this.panel.style.display = 'block';
    }
    
    hide() {
        this.panel.style.display = 'none';
    }
}
