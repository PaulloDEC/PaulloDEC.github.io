/**
 * ============================================================================
 * LEVEL STATISTICS MANAGER
 * ============================================================================
 * 
 * Generates a comprehensive "census" of the current level, providing players
 * with strategic information about what they'll encounter.
 * 
 * Features:
 * - Counts enemies, hazards, bonuses, and interactive objects
 * - Identifies required items (keys, power-ups)
 * - Lists optional collectibles
 * - Detects level objectives (bosses, reactors, exits)
 * - Displays item icons from sprite registry
 * - Collapsible interface to minimize screen space
 * 
 * Display Categories:
 * 1. Entity Counts: Numerical breakdown by type
 * 2. Required Items: Keys and essential power-ups
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
     * Initializes the floating stats panel and defines item/objective lists.
     * The panel is created as a child of the main content area if it doesn't
     * already exist in the DOM.
     * 
     * @param {string} containerId - DOM ID for the stats panel element
     */
    constructor(containerId) {
        /* ------------------------------------------------------------------ */
        /* Create Panel Container                                             */
        /* ------------------------------------------------------------------ */
        
        /**
         * Look for existing panel or create new one.
         * This allows the panel to persist across page loads if needed.
         */
        let panel = document.getElementById(containerId);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = containerId;
            panel.className = 'stats-panel';
            document.querySelector('.main-content').appendChild(panel);
        }
        
        this.panel = panel;
        this.panel.style.display = 'none'; // Hidden by default (shown when level loads)
        this.isCollapsed = false; // Start expanded
        
        /* ------------------------------------------------------------------ */
        /* Define Required Items                                              */
        /* ------------------------------------------------------------------ */
        
        /**
         * Items critical for level completion.
         * 
         * These items are typically required to:
         * - Unlock doors (keys)
         * - Access areas (power-ups like Shoes for high jumps)
         * - Progress through the level
         * 
         * IDs are in hexadecimal (0x prefix) to match the game's sprite system.
         */
        this.REQUIRED_ITEMS = [
            { id: 0x3044, name: "Red Key" },
            { id: 0x3045, name: "Green Key" },
            { id: 0x3046, name: "Blue Key" },
            { id: 0x3047, name: "Purple Key" },
            { id: 0x3033, name: "Access Card" },
            { id: 0x3020, name: "Robohand" },
            { id: 0x3006, name: "Shoes" },
            { id: 0x3008, name: "Claws" }
        ];
        
        /* ------------------------------------------------------------------ */
        /* Define Optional Items                                              */
        /* ------------------------------------------------------------------ */
        
        /**
         * Items that are useful but not required for completion.
         * 
         * These enhance gameplay but aren't strictly necessary:
         * - Extra ammunition
         * - Bonus collectibles
         * - Score items
         */
        this.OPTIONAL_ITEMS = [
            { id: 0x300F, name: "Raygun Ammo" }
        ];
        
        /* ------------------------------------------------------------------ */
        /* Define Level Objectives                                            */
        /* ------------------------------------------------------------------ */
        
        /**
         * Level objectives based on specific marker sprites.
         * 
         * The presence of these sprites indicates what the player must
         * accomplish in this level. Multiple objectives can exist.
         * 
         * Key: Trigger sprite ID (hex)
         * Value: Objective description
         */
        this.OBJECTIVE_DEFINITIONS = {
            0x3043: "Confront Dr. Proton", // Boss sprite (Episode 1)
            0x3042: "Confront Dr. Proton", // Boss sprite (Episode 3)
            0x302B: "Destroy Reactor",     // Blue reactor sprite
            0x3011: "Reach the Exit",      // Exit door sprite
            0x302F: "Locate Teleporter"    // Teleporter A sprite
        };
        
        /* ------------------------------------------------------------------ */
        /* Define Objective Colors                                            */
        /* ------------------------------------------------------------------ */
        
        /**
         * Color coding for different objective types.
         * 
         * Makes it easy to visually distinguish mission goals:
         * - Cyan: Environmental objectives (reactors)
         * - Blue: Exploration objectives (teleporters)
         * - Magenta: Combat objectives (bosses)
         * - Yellow: Standard objectives (exits)
         */
        this.OBJECTIVE_COLORS = {
            "Destroy Reactor": "#55ffff",     // Cyan
            "Locate Teleporter": "#5555ff",   // Blue
            "Confront Dr. Proton": "#ff55ff", // Magenta
            "Reach the Exit": "#ffff55"       // Yellow
        };
    }
    
    /* ====================================================================== */
    /* LEVEL ANALYSIS                                                         */
    /* ====================================================================== */
    
    /**
     * Analyzes the level and updates the statistics display.
     * 
     * This is the main entry point called when a level is loaded.
     * It performs a complete scan of the level grid, categorizing
     * every sprite and identifying important items/objectives.
     * 
     * Process:
     * 1. Initialize counters and tracking sets
     * 2. Scan entire level grid tile by tile
     * 3. Categorize each sprite by type
     * 4. Track specific important items
     * 5. Identify level objectives
     * 6. Render updated UI
     * 
     * @param {Object} level - Level data object
     * @param {Uint16Array} level.grid - Tile ID array
     * @param {number} level.width - Level width in tiles
     * @param {number} level.height - Level height in tiles
     * 
     * @param {Object} registry - Sprite registry mapping IDs to sprite data
     * @param {string} registry[id].type - Sprite category
     * @param {string} registry[id].name - Sprite name
     * @param {HTMLCanvasElement} registry[id].srcIcon - Sprite icon canvas
     */
    update(level, registry) {
        // Validate input
        if (!level || !level.grid) return;
        
        /* ------------------------------------------------------------------ */
        /* Step 1: Initialize Counters                                        */
        /* ------------------------------------------------------------------ */
        
        /**
         * Statistics counters for different entity types.
         * These are incremented as we scan the grid.
         */
        const stats = {
            enemies: 0,      // Hostile entities
            hazards: 0,      // Environmental dangers
            bonuses: 0,      // Collectible items (excluding health)
            health: 0,       // Health restoration items
            interactive: 0   // Doors, switches, teleporters, etc.
        };
        
        /**
         * Sets to track specific items found in the level.
         * Using Sets prevents duplicate counting if an item appears multiple times.
         */
        const foundItems = new Set();     // Required items
        const foundOptional = new Set();  // Optional items
        const foundObjectives = new Set(); // Level objectives (stores description strings)
        
        /* ------------------------------------------------------------------ */
        /* Step 2: Scan Level Grid                                            */
        /* ------------------------------------------------------------------ */
        
        /**
         * Iterate through every tile in the level.
         * Grid is a flat array representing a 2D map (row-major order).
         */
        for (let i = 0; i < level.grid.length; i++) {
            const id = level.grid[i];
            
            // Skip background tiles (ID < 3000)
            // Only sprites (ID >= 3000) are relevant for statistics
            if (id < 3000) continue;
            
            /* -------------------------------------------------------------- */
            /* Check for Specific Important Items                             */
            /* -------------------------------------------------------------- */
            
            if (this.isRequiredItem(id)) {
                foundItems.add(id);
            } else if (this.isOptionalItem(id)) {
                foundOptional.add(id);
            }
            
            /* -------------------------------------------------------------- */
            /* Check for Level Objectives                                     */
            /* -------------------------------------------------------------- */
            
            /**
             * Some sprites indicate level objectives.
             * We store the objective description (not the ID) to avoid
             * duplicates when multiple objective markers exist.
             */
            if (this.OBJECTIVE_DEFINITIONS[id]) {
                foundObjectives.add(this.OBJECTIVE_DEFINITIONS[id]);
            }
            
            /* -------------------------------------------------------------- */
            /* Count Entity Types                                             */
            /* -------------------------------------------------------------- */
            
            /**
             * Categorize sprite by type using the registry.
             * Each sprite type increments a different counter.
             */
            const sprite = registry[id];
            if (sprite) {
                if (sprite.type === 'enemy') {
                    stats.enemies++;
                } else if (sprite.type === 'hazard') {
                    stats.hazards++;
                } else if (sprite.type === 'interactive') {
                    stats.interactive++;
                } else if (sprite.type === 'bonus') {
                    /**
                     * Split bonuses into health and non-health categories.
                     * Health items are tracked separately for better information.
                     */
                    if (this.isHealthItem(sprite.name)) {
                        stats.health++;
                    } else {
                        stats.bonuses++;
                    }
                }
            }
        }
        
        /* ------------------------------------------------------------------ */
        /* Step 3: Render Updated UI                                          */
        /* ------------------------------------------------------------------ */
        
        this.renderUI(stats, foundItems, foundOptional, foundObjectives, registry, level.width, level.height);
        this.show();
    }
    
    /* ====================================================================== */
    /* ITEM CLASSIFICATION HELPERS                                            */
    /* ====================================================================== */
    
    /**
     * Checks if a sprite ID represents a required item.
     * 
     * @param {number} id - Sprite ID to check
     * @returns {boolean} True if item is in required items list
     */
    isRequiredItem(id) {
        return this.REQUIRED_ITEMS.some(item => item.id === id);
    }
    
    /**
     * Checks if a sprite ID represents an optional item.
     * 
     * @param {number} id - Sprite ID to check
     * @returns {boolean} True if item is in optional items list
     */
    isOptionalItem(id) {
        return this.OPTIONAL_ITEMS.some(item => item.id === id);
    }
    
    /**
     * Determines if an item is a health restoration item.
     * 
     * Health items are identified by name keywords rather than ID
     * because they appear in different sprite slots across episodes.
     * 
     * @param {string} name - Sprite name from registry
     * @returns {boolean} True if item restores health
     */
    isHealthItem(name) {
        const n = name.toUpperCase();
        return n.includes("SODA") || n.includes("TURKEY") || n.includes("MOLECULE");
    }
    
    /* ====================================================================== */
    /* UI RENDERING                                                           */
    /* ====================================================================== */
    
    /**
     * Generates and renders the statistics panel HTML.
     * 
     * Creates a multi-section panel with:
     * - Collapsible header
     * - Entity count grid
     * - Required items list with icons
     * - Optional items list with icons
     * - Level objectives (color-coded)
     * - Level dimensions
     * 
     * The panel uses dynamic HTML generation with icon canvases
     * inserted after the initial render.
     * 
     * @param {Object} stats - Entity count statistics
     * @param {Set} foundItems - Set of required item IDs found in level
     * @param {Set} foundOptional - Set of optional item IDs found in level
     * @param {Set} foundObjectives - Set of objective descriptions found in level
     * @param {Object} registry - Sprite registry for icon lookup
     * @param {number} w - Level width in tiles
     * @param {number} h - Level height in tiles
     */
    renderUI(stats, foundItems, foundOptional, foundObjectives, registry, w, h) {
        /* ------------------------------------------------------------------ */
        /* Determine Collapse State                                           */
        /* ------------------------------------------------------------------ */
        
        /**
         * Arrow direction indicates panel state:
         * - ▼ (down): Expanded
         * - ▶ (right): Collapsed
         */
        const arrow = this.isCollapsed ? '▶' : '▼';
        const displayStyle = this.isCollapsed ? 'none' : 'block';
        
        /* ------------------------------------------------------------------ */
        /* Build Header Section                                               */
        /* ------------------------------------------------------------------ */
        
        let html = `
            <div class="stats-header">
                <span class="stats-arrow">${arrow}</span> 
                <strong>LEVEL STATISTICS</strong>
            </div>
            
            <div class="stats-content" style="display: ${displayStyle}">
        `;
        
        /* ------------------------------------------------------------------ */
        /* Build Entity Count Grid                                            */
        /* ------------------------------------------------------------------ */
        
        /**
         * Displays numerical breakdown of all entity types.
         * Each row shows a category and its count.
         */
        html += `
                <div class="stats-grid">
                    <div class="stat-row"><span class="label">Enemies:</span> <span class="val">${stats.enemies}</span></div>
                    <div class="stat-row"><span class="label">Hazards:</span> <span class="val">${stats.hazards}</span></div>
                    <div class="stat-row"><span class="label">Bonuses:</span> <span class="val">${stats.bonuses}</span></div>
                    <div class="stat-row"><span class="label">Health:</span> <span class="val">${stats.health}</span></div>
                    <div class="stat-row"><span class="label">Interactive:</span> <span class="val">${stats.interactive}</span></div>
                </div>
                
                <div class="stats-divider"></div>
                <div class="stats-subtitle">REQUIRED ITEMS:</div>
                <div class="required-items-list">
        `;
        
        /* ------------------------------------------------------------------ */
        /* Helper Function: Build Item List                                   */
        /* ------------------------------------------------------------------ */
        
        /**
         * Generates HTML for an item list section.
         * 
         * For each found item:
         * - Creates a container div with unique ID
         * - Adds item name text
         * - Placeholder for icon (filled later with canvas)
         * 
         * @param {Array} itemList - Array of item definitions
         * @param {Set} foundSet - Set of found item IDs
         * @returns {string} HTML string for the list
         */
        const buildItemList = (itemList, foundSet) => {
            let listHtml = '';
            let count = 0;
            
            itemList.forEach(item => {
                if (foundSet.has(item.id)) {
                    count++;
                    const imgId = `req-item-${item.id}`;
                    listHtml += `
                        <div class="req-item">
                            <div class="req-icon-container" id="${imgId}"></div>
                            <span>${item.name}</span>
                        </div>
                    `;
                }
            });
            
            // Show "None found" message if no items in this category
            if (count === 0) {
                listHtml += `<div class="req-item" style="color: #666;">None found</div>`;
            }
            
            return listHtml;
        };
        
        /* ------------------------------------------------------------------ */
        /* Build Required Items Section                                       */
        /* ------------------------------------------------------------------ */
        
        html += buildItemList(this.REQUIRED_ITEMS, foundItems);
        html += `</div>`;
        
        /* ------------------------------------------------------------------ */
        /* Build Optional Items Section                                       */
        /* ------------------------------------------------------------------ */
        
        /**
         * Only show optional items section if we have optional items defined.
         * This keeps the UI clean when no optional items exist.
         */
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
            <div class="required-items-list" style="margin-bottom: 12px;">
        `;
        
        if (foundObjectives.size > 0) {
            /**
             * Sort objectives by priority for better readability.
             * 
             * Priority order:
             * 1. Destroy Reactor (critical)
             * 2. Locate Teleporter (navigation)
             * 3. Confront Dr. Proton (boss fight)
             * 4. Reach the Exit (standard completion)
             */
            const order = ["Destroy Reactor", "Locate Teleporter", "Confront Dr. Proton", "Reach the Exit"];
            const sortedObjs = Array.from(foundObjectives).sort((a, b) => {
                return order.indexOf(a) - order.indexOf(b);
            });
            
            sortedObjs.forEach(obj => {
                // Apply color coding for visual distinction
                const color = this.OBJECTIVE_COLORS[obj] || '#ffffff';
                html += `
                    <div class="req-item" style="color: ${color}; font-weight: bold; text-shadow: 0 0 5px rgba(0,0,0,0.5);">
                        <span>${obj}</span>
                    </div>
                `;
            });
        } else {
            // No specific objectives - generic exploration level
            html += `<div class="req-item" style="color: #666;">Explore Area</div>`;
        }
        html += `</div>`;
        
        /* ------------------------------------------------------------------ */
        /* Build Footer Section                                               */
        /* ------------------------------------------------------------------ */
        
        /**
         * Shows level dimensions as a reference.
         * Helps players understand the scale of the level.
         */
        html += `
                <div class="stats-divider"></div>
                <div class="map-dim">Fixed Grid Size: ${w} x ${h}</div>
            </div>
        `;
        
        /* ------------------------------------------------------------------ */
        /* Insert HTML into Panel                                             */
        /* ------------------------------------------------------------------ */
        
        this.panel.innerHTML = html;
        
        /* ------------------------------------------------------------------ */
        /* Post-Render: Attach Item Icon Canvases                             */
        /* ------------------------------------------------------------------ */
        
        /**
         * After HTML is inserted, add actual canvas elements for item icons.
         * 
         * This two-step process (HTML first, canvases second) is necessary
         * because canvas elements can't be serialized in HTML strings.
         * 
         * Process:
         * 1. Find icon container by ID
         * 2. Get sprite data from registry
         * 3. Create new canvas element
         * 4. Draw sprite icon onto canvas
         * 5. Append canvas to container
         * 
         * @param {Array} itemList - Array of item definitions
         * @param {Set} foundSet - Set of found item IDs
         */
        const attachImages = (itemList, foundSet) => {
            itemList.forEach(item => {
                if (foundSet.has(item.id)) {
                    const container = document.getElementById(`req-item-${item.id}`);
                    const sprite = registry[item.id];
                    
                    if (container && sprite && sprite.srcIcon) {
                        // Create canvas matching icon size
                        const iconCanvas = document.createElement('canvas');
                        iconCanvas.width = sprite.srcIcon.width;
                        iconCanvas.height = sprite.srcIcon.height;
                        
                        // Draw icon
                        const ctx = iconCanvas.getContext('2d');
                        ctx.drawImage(sprite.srcIcon, 0, 0);
                        
                        // Insert into container
                        container.appendChild(iconCanvas);
                    }
                }
            });
        };
        
        attachImages(this.REQUIRED_ITEMS, foundItems);
        attachImages(this.OPTIONAL_ITEMS, foundOptional);
        
        /* ------------------------------------------------------------------ */
        /* Re-attach Header Click Listener                                    */
        /* ------------------------------------------------------------------ */
        
        /**
         * Since we replaced the entire panel HTML, we need to re-attach
         * the click listener for collapse/expand functionality.
         */
        this.panel.querySelector('.stats-header').addEventListener('click', () => {
            this.toggleCollapse();
        });
    }
    
    /* ====================================================================== */
    /* PANEL VISIBILITY CONTROLS                                              */
    /* ====================================================================== */
    
    /**
     * Toggles the collapsed/expanded state of the panel.
     * 
     * Updates both the internal state and the visible UI elements:
     * - Rotates arrow indicator
     * - Shows/hides content section
     * 
     * Called when user clicks the panel header.
     */
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        
        // Update UI elements to reflect new state
        const content = this.panel.querySelector('.stats-content');
        const arrow = this.panel.querySelector('.stats-arrow');
        
        if (content) content.style.display = this.isCollapsed ? 'none' : 'block';
        if (arrow) arrow.textContent = this.isCollapsed ? '▶' : '▼';
    }
    
    /**
     * Shows the statistics panel.
     * Called when a level is loaded.
     */
    show() {
        this.panel.style.display = 'block';
    }
    
    /**
     * Hides the statistics panel.
     * Called when viewing non-level content (images, data files, etc.).
     */
    hide() {
        this.panel.style.display = 'none';
    }
}
