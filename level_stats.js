/**
 * Level Statistics Manager
 * * Generates a "census" of the current level, counting enemies, items,
 * and identifying critical path objects (Keys, Access Cards).
 */

export class LevelStats {
    constructor(containerId) {
        // Create the panel container if it doesn't exist
        let panel = document.getElementById(containerId);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = containerId;
            panel.className = 'stats-panel';
            document.querySelector('.main-content').appendChild(panel);
        }
        
        this.panel = panel;
        this.panel.style.display = 'none'; // Ensure hidden on startup
        this.isCollapsed = false;
        
        // Critical Items to look for
        // IDs must be Hexadecimal (0x) to match the game format
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

        // Useful but non-critical items
        this.OPTIONAL_ITEMS = [
            { id: 0x300F, name: "Raygun Ammo" }
        ];

        // Level Objectives based on specific marker sprites
        // The ID is the "Trigger" object that implies the objective exists
        this.OBJECTIVE_DEFINITIONS = {
            0x3043: "Confront Dr. Proton", // Boss (E1)
            0x3042: "Confront Dr. Proton", // Boss (E3)
            0x302B: "Destroy Reactor",     // Blue Reactor
            0x3011: "Reach the Exit",      // Exit Door
            0x302F: "Locate Teleporter"    // Teleporter A
        };

        // Text colors for specific objectives
        this.OBJECTIVE_COLORS = {
            "Destroy Reactor": "#55ffff",     // Cyan
            "Locate Teleporter": "#5555ff",   // Blue
            "Confront Dr. Proton": "#ff55ff", // Magenta
            "Reach the Exit": "#ffff55"       // Yellow
        };
    }

    /**
     * Analyzes the level and updates the UI
     * @param {Object} level - The level data object
     * @param {Object} registry - The sprite registry (for names/types/images)
     */
    update(level, registry) {
        if (!level || !level.grid) return;

        // 1. Reset Counters
        const stats = {
            enemies: 0,
            hazards: 0,
            bonuses: 0,
            health: 0,
            interactive: 0
        };
        
        const foundItems = new Set();
        const foundOptional = new Set();
        const foundObjectives = new Set(); // Stores strings, not IDs

        // 2. Scan Grid
        for (let i = 0; i < level.grid.length; i++) {
            const id = level.grid[i];
            
            // Skip empty/background
            if (id < 3000) continue;
            
            // Check for specific items
            if (this.isRequiredItem(id)) {
                foundItems.add(id);
            } else if (this.isOptionalItem(id)) {
                foundOptional.add(id);
            }

            // Check for Objectives
            if (this.OBJECTIVE_DEFINITIONS[id]) {
                foundObjectives.add(this.OBJECTIVE_DEFINITIONS[id]);
            }

            // Count Types
            const sprite = registry[id];
            if (sprite) {
                if (sprite.type === 'enemy') stats.enemies++;
                else if (sprite.type === 'hazard') stats.hazards++;
                else if (sprite.type === 'interactive') stats.interactive++;
                else if (sprite.type === 'bonus') {
                    // Split Health from generic Bonuses
                    if (this.isHealthItem(sprite.name)) {
                        stats.health++;
                    } else {
                        stats.bonuses++;
                    }
                }
            }
        }

        // 3. Render UI
        this.renderUI(stats, foundItems, foundOptional, foundObjectives, registry, level.width, level.height);
        this.show();
    }

    /**
     * formatting checks
     */
    isRequiredItem(id) {
        return this.REQUIRED_ITEMS.some(item => item.id === id);
    }

    isOptionalItem(id) {
        return this.OPTIONAL_ITEMS.some(item => item.id === id);
    }

    isHealthItem(name) {
        const n = name.toUpperCase();
        return n.includes("SODA") || n.includes("TURKEY") || n.includes("MOLECULE");
    }

    /**
     * Generates the HTML
     */
    renderUI(stats, foundItems, foundOptional, foundObjectives, registry, w, h) {
        // Toggle arrow direction
        const arrow = this.isCollapsed ? '▶' : '▼';
        const displayStyle = this.isCollapsed ? 'none' : 'block';

        let html = `
            <div class="stats-header">
                <span class="stats-arrow">${arrow}</span> 
                <strong>LEVEL STATISTICS</strong>
            </div>
            
            <div class="stats-content" style="display: ${displayStyle}">
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

        // Helper to generate item list HTML
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

            if (count === 0) {
                listHtml += `<div class="req-item" style="color: #666;">None found</div>`;
            }
            return listHtml;
        };

        // 1. Append Required Items
        html += buildItemList(this.REQUIRED_ITEMS, foundItems);
        html += `</div>`;

        // 2. Append Optional Items
        if (this.OPTIONAL_ITEMS.length > 0) {
            html += `
                <div class="stats-divider"></div>
                <div class="stats-subtitle">OPTIONAL ITEMS:</div>
                <div class="required-items-list">
            `;
            html += buildItemList(this.OPTIONAL_ITEMS, foundOptional);
            html += `</div>`;
        }

        // 3. Append Objectives (Moved to bottom)
        html += `
            <div class="stats-divider"></div>
            <div class="stats-subtitle">OBJECTIVES:</div>
            <div class="required-items-list" style="margin-bottom: 12px;">
        `;

        if (foundObjectives.size > 0) {
            // Sort objectives by priority: Reactor first, Exits/Bosses last
            const order = ["Destroy Reactor", "Locate Teleporter", "Confront Dr. Proton", "Reach the Exit"];
            const sortedObjs = Array.from(foundObjectives).sort((a, b) => {
                return order.indexOf(a) - order.indexOf(b);
            });

            sortedObjs.forEach(obj => {
                const color = this.OBJECTIVE_COLORS[obj] || '#ffffff';
                html += `
                    <div class="req-item" style="color: ${color}; font-weight: bold; text-shadow: 0 0 5px rgba(0,0,0,0.5);">
                        <span>${obj}</span>
                    </div>
                `;
            });
        } else {
            html += `<div class="req-item" style="color: #666;">Explore Area</div>`;
        }
        html += `</div>`;

        // 4. Footer
        html += `
                <div class="stats-divider"></div>
                <div class="map-dim">Fixed Grid Size: ${w} x ${h}</div>
            </div>
        `;

        this.panel.innerHTML = html;

        // Post-render: Append actual canvas images
        const attachImages = (itemList, foundSet) => {
            itemList.forEach(item => {
                if (foundSet.has(item.id)) {
                    const container = document.getElementById(`req-item-${item.id}`);
                    const sprite = registry[item.id];
                    if (container && sprite && sprite.srcIcon) {
                        const iconCanvas = document.createElement('canvas');
                        iconCanvas.width = sprite.srcIcon.width;
                        iconCanvas.height = sprite.srcIcon.height;
                        const ctx = iconCanvas.getContext('2d');
                        ctx.drawImage(sprite.srcIcon, 0, 0);
                        container.appendChild(iconCanvas);
                    }
                }
            });
        };

        attachImages(this.REQUIRED_ITEMS, foundItems);
        attachImages(this.OPTIONAL_ITEMS, foundOptional);

        // Re-attach header click listener
        this.panel.querySelector('.stats-header').addEventListener('click', () => {
            this.toggleCollapse();
        });
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        // Re-render to update UI state
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

