/**
 * PaletteViewer.js
 * Module for displaying Duke Nukem 2 palette files (.PAL) and LCR.MNI
 * Handles both 16-color DN2 format and 256-color Standard VGA format.
 */

export class PaletteViewer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.colors = [];
    }

    /**
     * Converts a Duke Nukem 2 palette value (0-68) to RGB
     */
    convertDN2ToRGB(dn2Value) {
        const vga6bit = Math.floor((dn2Value * 15) / 16);
        return Math.floor((vga6bit * 255) / 63);
    }

    /**
     * Converts a Standard VGA 6-bit value (0-63) to RGB (0-255)
     * Includes masking to handle "dirty" bits (e.g. 83 -> 19)
     */
    convertVGA6ToRGB(vgaValue) {
        // 1. MASK: Discard top 2 bits (0x3F = 00111111)
        const cleanValue = vgaValue & 0x3F;
        // 2. SCALE: Stretch 0-63 to 0-255
        return Math.floor((cleanValue * 255) / 63);
    }

    /**
     * Parses palette data based on file size
     */
    parsePalette(inputData) {
        let palData = inputData;
        if (inputData instanceof ArrayBuffer) {
            palData = new Uint8Array(inputData);
        }

        const colors = [];
        let workingData = palData;
        let format = 'UNKNOWN';

        // DETECT FORMAT
        if (palData.length === 64768) {
            console.log("PaletteViewer: Detected LCR.MNI. Reading Palette #1 (Offset 0)...");
            // FIX: Read the FIRST 768 bytes, not the last.
            workingData = palData.subarray(0, 768);
            format = 'VGA';
        } else if (palData.length === 768) {
            format = 'VGA';
        } else if (palData.length === 48) {
            format = 'DN2';
        } else {
            throw new Error(`Invalid palette file size: ${palData.length} bytes.`);
        }

        // PARSE COLORS
        if (format === 'DN2') {
            for (let i = 0; i < 16; i++) {
                const offset = i * 3;
                const r = workingData[offset];
                const g = workingData[offset + 1];
                const b = workingData[offset + 2];
                
                colors.push({
                    index: i,
                    r: this.convertDN2ToRGB(r),
                    g: this.convertDN2ToRGB(g),
                    b: this.convertDN2ToRGB(b),
                    raw: { r, g, b },
                    type: 'DN2'
                });
            }
        } else if (format === 'VGA') {
            for (let i = 0; i < 256; i++) {
                const offset = i * 3;
                const r = workingData[offset];
                const g = workingData[offset + 1];
                const b = workingData[offset + 2];
                
                colors.push({
                    index: i,
                    r: this.convertVGA6ToRGB(r),
                    g: this.convertVGA6ToRGB(g),
                    b: this.convertVGA6ToRGB(b),
                    raw: { r, g, b },
                    type: 'VGA'
                });
            }
        }

        return colors;
    }

    generateColorBar(palData) {
        try {
            this.colors = this.parsePalette(palData);

            this.canvas = document.createElement('canvas');
            this.canvas.width = 512;
            this.canvas.height = 32;
            this.ctx = this.canvas.getContext('2d');

            const colorWidth = this.canvas.width / this.colors.length;

            this.colors.forEach((color, i) => {
                this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                // Use +1 width to prevent sub-pixel rendering gaps
                this.ctx.fillRect(i * colorWidth, 0, colorWidth + 1, this.canvas.height);
            });

            return this.canvas;
        } catch (err) {
            console.error('PaletteViewer Error:', err);
            return null;
        }
    }

    createColorGrid() {
        if (!this.colors || this.colors.length === 0) return document.createElement('div');

        const is256 = this.colors.length > 16;
        const columns = is256 ? 16 : 8;

        const container = document.createElement('div');
        container.className = 'palette-grid';
        // RESTORED: Grid layout styles
        container.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${columns}, 1fr);
            gap: ${is256 ? '2px' : '8px'};
            padding: 20px;
            max-width: ${is256 ? '800px' : '600px'};
            margin: 0 auto;
        `;

        this.colors.forEach((color, i) => {
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            // RESTORED: Swatch styles (aspect-ratio, transition)
            swatch.style.cssText = `
                aspect-ratio: 1;
                background-color: rgb(${color.r}, ${color.g}, ${color.b});
                border: ${is256 ? '1px' : '2px'} solid var(--border);
                border-radius: ${is256 ? '2px' : '6px'};
                position: relative;
                cursor: pointer;
                transition: all 0.2s;
            `;

            // RESTORED: Labels for 16-color mode
            if (!is256) {
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
            }

            // RESTORED: Hover Listeners
            swatch.addEventListener('mouseenter', () => {
                swatch.style.borderColor = 'var(--accent)';
                swatch.style.transform = 'scale(1.2)';
                swatch.style.zIndex = '10';
                swatch.style.boxShadow = '0 4px 12px rgba(205, 127, 50, 0.4)';
            });

            swatch.addEventListener('mouseleave', () => {
                swatch.style.borderColor = 'var(--border)';
                swatch.style.transform = 'scale(1)';
                swatch.style.zIndex = '1';
                swatch.style.boxShadow = 'none';
            });

            // RESTORED: Full Tooltip
            const rawLabel = color.type === 'DN2' ? 'DN2' : 'VGA(6b)';
            swatch.title = [
                `Index ${i}`,
                `RGB: (${color.r}, ${color.g}, ${color.b})`,
                `${rawLabel}: (${color.raw.r}, ${color.raw.g}, ${color.raw.b})`
            ].join('\n');

            container.appendChild(swatch);
        });

        return container;
    }

    createViewer(palData, filename) {
        const container = document.createElement('div');
        container.className = 'palette-viewer';
        container.style.cssText = `width: 100%; max-width: 900px; margin: 0 auto; padding: 20px;`;

        const title = document.createElement('h2');
        title.style.cssText = `color: var(--accent); text-align: center; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px;`;
        title.textContent = filename;

        const colorBar = this.generateColorBar(palData);
        if (colorBar) {
            // RESTORED: Centered margin, fixed width (implicit by canvas size), nice border
            colorBar.style.cssText = `
                display: block;
                margin: 0 auto 30px auto;
                border: 2px solid var(--border);
                border-radius: 8px;
                image-rendering: pixelated;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            `;
        } else {
            return this.createErrorDisplay("Error parsing palette.");
        }

        const is256 = this.colors.length > 16;
        const formatText = is256 ? "Standard VGA 256-color" : "Duke Nukem 2 16-color";
        const rangeText = is256 ? "0-63 (Standard)" : "0-68 (Fade Effect)";

        const info = document.createElement('div');
        info.style.cssText = `
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 0.85rem;
            line-height: 1.6;
        `;
        info.innerHTML = `
            <div style="color: var(--accent); font-weight: 600; margin-bottom: 8px; font-size: 0.9rem;">PALETTE INFORMATION</div>
            <div style="color: var(--text-muted);">
                <strong>Format:</strong> ${formatText}<br>
                <strong>Size:</strong> ${palData.length} bytes (${this.colors.length} colors)<br>
                <strong>Range:</strong> ${rangeText}
            </div>
        `;

        container.appendChild(title);
        container.appendChild(colorBar);
        container.appendChild(info);
        container.appendChild(this.createColorGrid());

        return container;
    }

    createErrorDisplay(msg) {
        const div = document.createElement('div');
        div.style.color = '#ff4444';
        div.style.textAlign = 'center';
        div.style.padding = '20px';
        div.textContent = msg;
        return div;
    }
}