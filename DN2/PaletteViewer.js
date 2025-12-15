/**
 * PaletteViewer.js
 * 
 * Module for displaying Duke Nukem 2 palette files (.PAL)
 * Handles the 16-color palette format with proper DN2 → VGA conversion
 */

export class PaletteViewer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.colors = [];
    }

    /**
     * Converts a Duke Nukem 2 palette value (0-68) to RGB
     * DN2 values are designed for a fade-in effect and need conversion
     * Formula: val × 15 / 16 → 6-bit VGA → 8-bit RGB
     * 
     * @param {number} dn2Value - DN2 palette value (0-68)
     * @returns {number} 8-bit RGB value (0-255)
     */
    convertDN2ToRGB(dn2Value) {
        // Convert DN2 palette value (0-68) to 6-bit VGA (0-63)
        const vga6bit = Math.floor((dn2Value * 15) / 16);
        // Convert 6-bit VGA to 8-bit RGB
        const rgb8bit = Math.floor((vga6bit * 255) / 63);
        return rgb8bit;
    }

    /**
     * Parses a 48-byte PAL file into an array of RGB color objects
     * 
     * @param {Uint8Array} palData - Raw palette file data (48 bytes)
     * @returns {Array<{r: number, g: number, b: number, dn2: {r: number, g: number, b: number}}>}
     */
    parsePalette(palData) {
        if (palData.length !== 48) {
            throw new Error(`Invalid palette file: expected 48 bytes, got ${palData.length} bytes`);
        }

        const colors = [];
        
        // Parse 16 colors (3 bytes each: R, G, B)
        for (let i = 0; i < 16; i++) {
            const offset = i * 3;
            const dn2_r = palData[offset];
            const dn2_g = palData[offset + 1];
            const dn2_b = palData[offset + 2];
            
            colors.push({
                r: this.convertDN2ToRGB(dn2_r),
                g: this.convertDN2ToRGB(dn2_g),
                b: this.convertDN2ToRGB(dn2_b),
                dn2: { r: dn2_r, g: dn2_g, b: dn2_b }
            });
        }

        return colors;
    }

    /**
     * Generates a horizontal color bar image showing all palette colors
     * 
     * @param {Uint8Array} palData - Raw palette file data
     * @returns {HTMLCanvasElement} Canvas containing the palette visualization
     */
    generateColorBar(palData) {
        try {
            this.colors = this.parsePalette(palData);

            // Create canvas for color bar (512×32 to match reference)
            this.canvas = document.createElement('canvas');
            this.canvas.width = 512;
            this.canvas.height = 32;
            this.ctx = this.canvas.getContext('2d');

            const colorWidth = this.canvas.width / 16;

            // Draw each color
            this.colors.forEach((color, i) => {
                this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                this.ctx.fillRect(i * colorWidth, 0, colorWidth, this.canvas.height);
            });

            return this.canvas;
        } catch (err) {
            console.error('Error generating color bar:', err);
            return null;
        }
    }

    /**
     * Creates an interactive color grid showing individual swatches
     * 
     * @returns {HTMLDivElement} Container with color swatches
     */
    createColorGrid() {
        const container = document.createElement('div');
        container.className = 'palette-grid';
        container.style.cssText = `
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 8px;
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
        `;

        this.colors.forEach((color, i) => {
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.style.cssText = `
                aspect-ratio: 1;
                background-color: rgb(${color.r}, ${color.g}, ${color.b});
                border: 2px solid var(--border);
                border-radius: 6px;
                position: relative;
                cursor: pointer;
                transition: all 0.2s;
            `;

            // Add index label
            const label = document.createElement('div');
            label.style.cssText = `
                position: absolute;
                bottom: 4px;
                right: 4px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                font-size: 11px;
                padding: 2px 5px;
                border-radius: 3px;
                font-weight: 600;
            `;
            label.textContent = i;

            swatch.appendChild(label);

            // Hover effect
            swatch.addEventListener('mouseenter', () => {
                swatch.style.borderColor = 'var(--accent)';
                swatch.style.transform = 'scale(1.05)';
                swatch.style.boxShadow = '0 4px 12px rgba(205, 127, 50, 0.4)';
            });

            swatch.addEventListener('mouseleave', () => {
                swatch.style.borderColor = 'var(--border)';
                swatch.style.transform = 'scale(1)';
                swatch.style.boxShadow = 'none';
            });

            // Tooltip with color values
            swatch.title = [
                `Color ${i}`,
                `RGB: (${color.r}, ${color.g}, ${color.b})`,
                `DN2: (${color.dn2.r}, ${color.dn2.g}, ${color.dn2.b})`
            ].join('\n');

            container.appendChild(swatch);
        });

        return container;
    }

    /**
     * Creates a complete palette viewer display with bar and grid
     * 
     * @param {Uint8Array} palData - Raw palette file data
     * @param {string} filename - Name of the palette file
     * @returns {HTMLDivElement} Complete viewer element
     */
    createViewer(palData, filename) {
        const container = document.createElement('div');
        container.className = 'palette-viewer';
        container.style.cssText = `
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        `;

        // Title
        const title = document.createElement('h2');
        title.style.cssText = `
            color: var(--accent);
            text-align: center;
            margin: 0 0 20px 0;
            font-size: 1.2rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        title.textContent = filename;

        // Generate color bar
        const colorBar = this.generateColorBar(palData);
        if (colorBar) {
            colorBar.style.cssText = `
                display: block;
                margin: 0 auto 30px auto;
                border: 2px solid var(--border);
                border-radius: 8px;
                image-rendering: pixelated;
                image-rendering: crisp-edges;
            `;
        }

        // Info section
        const info = document.createElement('div');
        info.style.cssText = `
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 0.85rem;
            line-height: 1.8;
        `;
        info.innerHTML = `
            <div style="color: var(--accent); font-weight: 600; margin-bottom: 8px; font-size: 0.9rem;">
                PALETTE INFORMATION
            </div>
            <div style="color: var(--text-muted);">
                <strong>Format:</strong> Duke Nukem 2 16-color palette<br>
                <strong>Size:</strong> 48 bytes (16 colors × RGB)<br>
                <strong>Color Range:</strong> DN2 values 0-68 → VGA 6-bit → RGB 8-bit<br>
                <strong>Note:</strong> DN2 uses special values for fade-in effects
            </div>
        `;

        // Assemble viewer
        container.appendChild(title);
        if (colorBar) container.appendChild(colorBar);
        container.appendChild(info);
        container.appendChild(this.createColorGrid());

        return container;
    }

    /**
     * Gets the parsed color array
     * Useful for other modules that need palette data
     * 
     * @returns {Array} Array of color objects
     */
    getColors() {
        return this.colors;
    }

    /**
     * Gets a specific color by index
     * 
     * @param {number} index - Color index (0-15)
     * @returns {Object|null} Color object or null if invalid index
     */
    getColor(index) {
        if (index >= 0 && index < this.colors.length) {
            return this.colors[index];
        }
        return null;
    }

    /**
     * Converts the palette to a format usable by other rendering modules
     * Returns flat RGB array suitable for canvas operations
     * 
     * @returns {Uint8ClampedArray} Flat array of RGB values [r,g,b,r,g,b,...]
     */
    toRGBArray() {
        const arr = new Uint8ClampedArray(this.colors.length * 3);
        this.colors.forEach((color, i) => {
            arr[i * 3] = color.r;
            arr[i * 3 + 1] = color.g;
            arr[i * 3 + 2] = color.b;
        });
        return arr;
    }
}
