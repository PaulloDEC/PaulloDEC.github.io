/**
 * ============================================================================
 * DATA VIEWER - BINARY AND TEXT FILE PARSER
 * ============================================================================
 * 
 * Handles parsing and rendering of non-graphical game data files.
 * Displays structured data in formatted HTML tables for easy reading.
 * 
 * Supported File Types:
 * ---------------------
 * 
 * 1. KEYS.DN* (Keyboard Configuration):
 *    - Format: Binary (6 bytes)
 *    - Content: PC scan codes for game controls
 *    - Structure: Fixed 6-byte array (one byte per action)
 *    - Actions: Up, Down, Left, Right, Jump, Fire
 * 
 * 2. HIGHS.DN* (High Score Table):
 *    - Format: Text (Windows line endings)
 *    - Content: Score values and player names
 *    - Structure: Text lines with score+name format
 *    - Standard: Top 10 entries
 * 
 * Technical Details:
 * ------------------
 * 
 * IBM PC Scan Codes:
 * The keyboard configuration file uses IBM PC/XT Scan Code Set 1, which
 * assigns a unique byte value to each key on the keyboard. These codes
 * were generated directly by the keyboard controller and read by DOS programs.
 * 
 * Example scan codes:
 * - 0x48: Up Arrow
 * - 0x50: Down Arrow
 * - 0x39: Space Bar
 * - 0x1C: Enter
 * 
 * High Score Format:
 * High score files store data as plain text with a simple format:
 * - Leading digits: Score value
 * - Remaining text: Player name
 * - Example: "12500John Doe"
 * 
 * The parser separates scores from names and formats them for display.
 */

export class DataViewer {
    /* ====================================================================== */
    /* CONSTRUCTOR AND INITIALIZATION                                         */
    /* ====================================================================== */
    
    /**
     * Creates a new data viewer instance.
     * 
     * Initializes the container reference and defines lookup tables for:
     * - IBM PC scan codes (keyboard mapping)
     * - Game action names
     * 
     * @param {string} containerId - DOM ID for the viewer container
     */
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        /* ------------------------------------------------------------------ */
        /* IBM PC Scan Code Set 1 Mapping                                     */
        /* ------------------------------------------------------------------ */
        
        /**
         * Complete mapping of PC/XT keyboard scan codes to key names.
         * 
         * Scan Code Set 1 was the standard keyboard protocol for IBM PC
         * and compatibles. Each key press generates a unique make code
         * (key down) and break code (key up = make code | 0x80).
         * 
         * This table maps make codes to human-readable key names.
         * Organized roughly by keyboard layout (top to bottom, left to right).
         * 
         * Special Notes:
         * - 0x00: Not used (reserved)
         * - 0x1D: Left Ctrl (right Ctrl uses extended codes)
         * - 0x2A: Left Shift
         * - 0x36: Right Shift
         * - 0x38: Left Alt (right Alt uses extended codes)
         * 
         * Extended keys (arrows, keypad) use the prefix 0xE0 in real hardware,
         * but Duke Nukem 1 stores just the base code.
         */
        this.SCAN_CODES = {
            // Row 0: Escape and Function Keys
            0x01: 'Esc',
            0x3B: 'F1', 0x3C: 'F2', 0x3D: 'F3', 0x3E: 'F4', 0x3F: 'F5',
            0x40: 'F6', 0x41: 'F7', 0x42: 'F8', 0x43: 'F9', 0x44: 'F10',
            
            // Row 1: Number Row
            0x29: '`',
            0x02: '1', 0x03: '2', 0x04: '3', 0x05: '4', 0x06: '5',
            0x07: '6', 0x08: '7', 0x09: '8', 0x0A: '9', 0x0B: '0',
            0x0C: '-', 0x0D: '=',
            0x0E: 'Backspace',
            
            // Row 2: Tab and QWERTY Row
            0x0F: 'Tab',
            0x10: 'Q', 0x11: 'W', 0x12: 'E', 0x13: 'R', 0x14: 'T',
            0x15: 'Y', 0x16: 'U', 0x17: 'I', 0x18: 'O', 0x19: 'P',
            0x1A: '[', 0x1B: ']',
            0x1C: 'Enter',
            
            // Row 3: Caps Lock and ASDF Row
            0x3A: 'CapsLock',
            0x1E: 'A', 0x1F: 'S', 0x20: 'D', 0x21: 'F', 0x22: 'G',
            0x23: 'H', 0x24: 'J', 0x25: 'K', 0x26: 'L',
            0x27: ';', 0x28: "'", 0x2B: '\\',
            
            // Row 4: Shift and ZXCV Row
            0x2A: 'LShift',
            0x2C: 'Z', 0x2D: 'X', 0x2E: 'C', 0x2F: 'V', 0x30: 'B',
            0x31: 'N', 0x32: 'M',
            0x33: ',', 0x34: '.', 0x35: '/',
            0x36: 'RShift',
            
            // Row 5: Control Row
            0x1D: 'Ctrl', 0x38: 'Alt', 0x39: 'Space',
            
            // Special Keys
            0x37: 'PrtSc',
            0x45: 'NumLock',
            0x46: 'ScrollLock',
            
            // Arrow Keys and Editing Keys
            0x47: 'Home', 0x48: 'Up', 0x49: 'PgUp',
            0x4B: 'Left', 0x4C: 'Center', 0x4D: 'Right',
            0x4F: 'End', 0x50: 'Down', 0x51: 'PgDn',
            0x52: 'Ins', 0x53: 'Del',
            
            // Numeric Keypad
            0x4A: '-', 0x4E: '+'
        };
        
        /* ------------------------------------------------------------------ */
        /* Game Action Names                                                  */
        /* ------------------------------------------------------------------ */
        
        /**
         * Human-readable names for the 6 game actions in Duke Nukem 1.
         * 
         * The KEYS file stores scan codes in this exact order.
         * These actions correspond to the core movement and combat controls.
         * 
         * Order (0-5):
         * - 0: Move Up (climb ladders, jump)
         * - 1: Move Down (crouch, descend)
         * - 2: Move Left
         * - 3: Move Right
         * - 4: Jump
         * - 5: Fire (shoot weapon)
         */
        this.ACTIONS = [
            'Move Up',
            'Move Down',
            'Move Left',
            'Move Right',
            'Jump',
            'Fire'
        ];
    }
    
    /* ====================================================================== */
    /* MAIN RENDERING ENTRY POINT                                             */
    /* ====================================================================== */
    
    /**
     * Main rendering dispatcher.
     * 
     * Determines file type from filename and routes to appropriate parser.
     * Clears any previous content before rendering new data.
     * 
     * File Type Detection:
     * - Starts with "KEYS": Keyboard configuration
     * - Starts with "HIGHS": High score table
     * - Other: Error (unsupported format)
     * 
     * @param {File} file - Data file to parse and display
     */
    async render(file) {
        const name = file.name.toUpperCase();
        
        /* ------------------------------------------------------------------ */
        /* Clear Previous Content                                             */
        /* ------------------------------------------------------------------ */
        
        this.container.innerHTML = '';
        this.container.style.display = 'block';
        
        /* ------------------------------------------------------------------ */
        /* Route to Appropriate Parser                                        */
        /* ------------------------------------------------------------------ */
        
        if (name.startsWith('KEYS')) {
            await this.renderKeys(file);
        } else if (name.startsWith('HIGHS')) {
            await this.renderHighScores(file);
        } else {
            // Unknown file type
            this.container.innerHTML = `<div class="data-error">Unknown Data Format: ${name}</div>`;
        }
    }
    
    /* ====================================================================== */
    /* KEYBOARD CONFIGURATION PARSER                                          */
    /* ====================================================================== */
    
    /**
     * Parses and displays the 6-byte keyboard configuration file.
     * 
     * File Format (KEYS.DN*):
     * -----------------------
     * - Size: Exactly 6 bytes
     * - Format: Binary (raw scan codes)
     * - Structure:
     *   Byte 0: Move Up scan code
     *   Byte 1: Move Down scan code
     *   Byte 2: Move Left scan code
     *   Byte 3: Move Right scan code
     *   Byte 4: Jump scan code
     *   Byte 5: Fire scan code
     * 
     * Each byte is an IBM PC scan code (0x00-0xFF) representing
     * a keyboard key. The game reads these codes and maps them
     * to player actions.
     * 
     * Output Format:
     * --------------
     * Displays a 3-column table:
     * - Column 1: Action name (e.g., "Move Up")
     * - Column 2: Key name (e.g., "Up Arrow")
     * - Column 3: Scan code in hex (e.g., "0x48")
     * 
     * @param {File} file - KEYS.DN* file to parse
     */
    async renderKeys(file) {
        /* ------------------------------------------------------------------ */
        /* Read Binary Data                                                   */
        /* ------------------------------------------------------------------ */
        
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        
        /* ------------------------------------------------------------------ */
        /* Validate File Size                                                 */
        /* ------------------------------------------------------------------ */
        
        /**
         * KEYS files must be exactly 6 bytes.
         * Smaller files are corrupted or incomplete.
         */
        if (data.length < 6) {
            this.container.innerHTML = '<div class="data-error">Error: File too small (Expected 6 bytes)</div>';
            return;
        }
        
        /* ------------------------------------------------------------------ */
        /* Build HTML Table                                                   */
        /* ------------------------------------------------------------------ */
        
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
        
        /* ------------------------------------------------------------------ */
        /* Parse Each Action Mapping                                          */
        /* ------------------------------------------------------------------ */
        
        /**
         * Process exactly 6 bytes, one for each game action.
         * Each byte is converted to:
         * - Hexadecimal representation (for technical reference)
         * - Human-readable key name (via scan code lookup)
         */
        for (let i = 0; i < 6; i++) {
            const code = data[i];
            
            // Format scan code as hex with leading zeros (e.g., 0x48)
            const hex = '0x' + code.toString(16).toUpperCase().padStart(2, '0');
            
            // Look up key name (or show "Unknown" if not in table)
            const keyName = this.SCAN_CODES[code] || 'Unknown';
            
            // Get action name (or fallback if somehow out of range)
            const action = this.ACTIONS[i] || `Action ${i+1}`;
            
            // Add table row
            html += `
                <tr>
                    <td class="highlight">${action}</td>
                    <td><strong>${keyName}</strong></td>
                    <td class="mono">${hex}</td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        
        /* ------------------------------------------------------------------ */
        /* Display Table                                                      */
        /* ------------------------------------------------------------------ */
        
        this.container.innerHTML = html;
    }
    
    /* ====================================================================== */
    /* HIGH SCORE PARSER                                                      */
    /* ====================================================================== */
    
    /**
     * Parses and displays the text-based high score table.
     * 
     * File Format (HIGHS.DN*):
     * ------------------------
     * - Size: Variable (text file)
     * - Format: Plain text with Windows line endings (\r\n)
     * - Structure: One entry per line
     * - Entry Format: [Score digits][Player name]
     *   Example: "12500John Doe"
     * 
     * Parsing Strategy:
     * -----------------
     * 1. Read file as text
     * 2. Split into lines (handle \r\n and \n)
     * 3. Filter out empty lines
     * 4. Use regex to separate score from name
     * 5. Format and display in table
     * 
     * Display Features:
     * -----------------
     * - Shows rank (1-10)
     * - Formats scores with thousand separators
     * - Highlights #1 rank with special styling and trophy emoji
     * - Limits display to top 10 entries
     * 
     * @param {File} file - HIGHS.DN* file to parse
     */
    async renderHighScores(file) {
        /* ------------------------------------------------------------------ */
        /* Read Text Data                                                     */
        /* ------------------------------------------------------------------ */
        
        const text = await file.text();
        
        /* ------------------------------------------------------------------ */
        /* Split and Filter Lines                                             */
        /* ------------------------------------------------------------------ */
        
        /**
         * Split on both Windows (\r\n) and Unix (\n) line endings.
         * Filter removes empty lines and whitespace-only lines.
         */
        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        
        /* ------------------------------------------------------------------ */
        /* Build HTML Table                                                   */
        /* ------------------------------------------------------------------ */
        
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
        
        /* ------------------------------------------------------------------ */
        /* Define Parsing Pattern                                             */
        /* ------------------------------------------------------------------ */
        
        /**
         * Regular expression to separate score from name.
         * 
         * Pattern: /^(\d+)(.*)$/
         * - ^ : Start of line
         * - (\d+) : Capture group 1 - one or more digits (the score)
         * - (.*) : Capture group 2 - everything else (the name)
         * - $ : End of line
         * 
         * Example: "12500John Doe"
         * - Group 1: "12500"
         * - Group 2: "John Doe"
         */
        const parser = /^(\d+)(.*)$/;
        
        /* ------------------------------------------------------------------ */
        /* Parse and Format Each Entry                                        */
        /* ------------------------------------------------------------------ */
        
        lines.forEach((line, index) => {
            // Limit to standard 10 high score entries
            if (index >= 10) return;
            
            const match = line.match(parser);
            if (match) {
                /* ---------------------------------------------------------- */
                /* Extract and Format Score                                   */
                /* ---------------------------------------------------------- */
                
                /**
                 * Convert score string to number, then back to string with
                 * thousand separators for readability.
                 * 
                 * Example: "12500" -> 12,500
                 */
                const score = parseInt(match[1]).toLocaleString();
                
                /* ---------------------------------------------------------- */
                /* Extract Name                                               */
                /* ---------------------------------------------------------- */
                
                /**
                 * Name is everything after the score.
                 * If empty, show placeholder dash.
                 */
                const name = match[2] || '-';
                
                /* ---------------------------------------------------------- */
                /* Apply Special Styling for Rank 1                           */
                /* ---------------------------------------------------------- */
                
                /**
                 * First place gets:
                 * - Special CSS class for highlighting
                 * - Trophy emoji
                 */
                const rankClass = index === 0 ? 'rank-1' : '';
                const trophy = index === 0 ? ' 🏆' : '';
                
                /* ---------------------------------------------------------- */
                /* Add Table Row                                              */
                /* ---------------------------------------------------------- */
                
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
        
        /* ------------------------------------------------------------------ */
        /* Display Table                                                      */
        /* ------------------------------------------------------------------ */
        
        this.container.innerHTML = html;
    }
    
    /* ====================================================================== */
    /* VISIBILITY CONTROL                                                     */
    /* ====================================================================== */
    
    /**
     * Hides the data viewer and clears content.
     * 
     * Called when switching to a different file type (graphics, audio, etc.).
     * Clearing the HTML prevents stale data from briefly appearing
     * when the viewer is shown again.
     */
    hide() {
        this.container.style.display = 'none';
        this.container.innerHTML = '';
    }
}
