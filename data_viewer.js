/**
 * Data Viewer
 * * Handles parsing and rendering of non-graphical game data files:
 * - KEYS.DN1: Keyboard configuration (Binary)
 * - HIGHS.DN1: High score table (Text/Mixed)
 */

export class DataViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        // Standard IBM PC Scan Code Set 1 Mapping
        this.SCAN_CODES = {
            0x01: 'Esc', 0x02: '1', 0x03: '2', 0x04: '3', 0x05: '4', 0x06: '5',
            0x07: '6', 0x08: '7', 0x09: '8', 0x0A: '9', 0x0B: '0', 0x0C: '-',
            0x0D: '=', 0x0E: 'Backspace', 0x0F: 'Tab', 0x10: 'Q', 0x11: 'W',
            0x12: 'E', 0x13: 'R', 0x14: 'T', 0x15: 'Y', 0x16: 'U', 0x17: 'I',
            0x18: 'O', 0x19: 'P', 0x1A: '[', 0x1B: ']', 0x1C: 'Enter',
            0x1D: 'Ctrl', 0x1E: 'A', 0x1F: 'S', 0x20: 'D', 0x21: 'F',
            0x22: 'G', 0x23: 'H', 0x24: 'J', 0x25: 'K', 0x26: 'L', 0x27: ';',
            0x28: "'", 0x29: '`', 0x2A: 'LShift', 0x2B: '\\', 0x2C: 'Z',
            0x2D: 'X', 0x2E: 'C', 0x2F: 'V', 0x30: 'B', 0x31: 'N', 0x32: 'M',
            0x33: ',', 0x34: '.', 0x35: '/', 0x36: 'RShift', 0x37: 'PrtSc',
            0x38: 'Alt', 0x39: 'Space', 0x3A: 'CapsLock', 0x3B: 'F1',
            0x3C: 'F2', 0x3D: 'F3', 0x3E: 'F4', 0x3F: 'F5', 0x40: 'F6',
            0x41: 'F7', 0x42: 'F8', 0x43: 'F9', 0x44: 'F10', 0x45: 'NumLock',
            0x46: 'ScrollLock', 0x47: 'Home', 0x48: 'Up', 0x49: 'PgUp',
            0x4A: '-', 0x4B: 'Left', 0x4C: 'Center', 0x4D: 'Right',
            0x4E: '+', 0x4F: 'End', 0x50: 'Down', 0x51: 'PgDn', 0x52: 'Ins',
            0x53: 'Del'
        };

        this.ACTIONS = ['Move Up', 'Move Down', 'Move Left', 'Move Right', 'Jump', 'Fire'];
    }

    /**
     * Main render entry point
     */
    async render(file) {
        const name = file.name.toUpperCase();
        
        // Clear previous content
        this.container.innerHTML = '';
        this.container.style.display = 'block';

        if (name.startsWith('KEYS')) {
            await this.renderKeys(file);
        } else if (name.startsWith('HIGHS')) {
            await this.renderHighScores(file);
        } else {
            this.container.innerHTML = `<div class="data-error">Unknown Data Format: ${name}</div>`;
        }
    }

    /**
     * Parses and displays 6-byte KEYS.DN1 file
     *
     */
    async renderKeys(file) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);

        if (data.length < 6) {
            this.container.innerHTML = '<div class="data-error">Error: File too small (Expected 6 bytes)</div>';
            return;
        }

        let html = `
            <h3>Keyboard Configuration</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>Key Name</th>
                        <th>Scan Code (Hex)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Parse exactly 6 bytes mapped to fixed actions
        for (let i = 0; i < 6; i++) {
            const code = data[i];
            const hex = '0x' + code.toString(16).toUpperCase().padStart(2, '0');
            const keyName = this.SCAN_CODES[code] || 'Unknown';
            const action = this.ACTIONS[i] || `Action ${i+1}`;

            html += `
                <tr>
                    <td class="highlight">${action}</td>
                    <td><strong>${keyName}</strong></td>
                    <td class="mono">${hex}</td>
                </tr>
            `;
        }

        html += '</tbody></table>';
        this.container.innerHTML = html;
    }

    /**
     * Parses and displays text-based HIGHS.DN1 file
     *
     */
    async renderHighScores(file) {
        const text = await file.text();
        // Split by Windows newlines, filter empty lines
        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);

        let html = `
            <h3>High Scores</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Score</th>
                        <th>Name</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Regex to separate leading digits (Score) from remaining text (Name)
        //
        const parser = /^(\d+)(.*)$/;

        lines.forEach((line, index) => {
            if (index >= 10) return; // Limit to standard 10 entries

            const match = line.match(parser);
            if (match) {
                const score = parseInt(match[1]).toLocaleString(); // Add commas
                const name = match[2] || '-'; // Handle empty names
                
                // Highlight top score
                const rankClass = index === 0 ? 'rank-1' : '';
                const trophy = index === 0 ? ' 🏆' : '';

                html += `
                    <tr class="${rankClass}">
                        <td class="mono">#${index + 1}</td>
                        <td class="mono score">${score}</td>
                        <td>${name}${trophy}</td>
                    </tr>
                `;
            }
        });

        html += '</tbody></table>';
        this.container.innerHTML = html;
    }

    /**
     * Hides the data viewer
     */
    hide() {
        this.container.style.display = 'none';
        this.container.innerHTML = '';
    }
}