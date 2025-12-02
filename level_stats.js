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
		this.panel.style.display = 'none';
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
        this.renderUI(stats, foundItems, foundOptional, registry, level.width, level.height);
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
    renderUI(stats, foundItems, foundOptional, registry, w, h) {
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

        // Append Required Items
        html += buildItemList(this.REQUIRED_ITEMS, foundItems);

        // Append Optional Items (Only if configured)
        if (this.OPTIONAL_ITEMS.length > 0) {
            html += `
                </div>
                <div class="stats-divider"></div>
                <div class="stats-subtitle">OPTIONAL ITEMS:</div>
                <div class="required-items-list">
            `;
            html += buildItemList(this.OPTIONAL_ITEMS, foundOptional);
        }

        html += `
                </div>
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