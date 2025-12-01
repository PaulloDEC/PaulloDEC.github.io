/**
 * File Manager
 * * Scans and categorizes Duke Nukem game files.
 * Separates levels, data files, and graphics assets.
 */

export class FileManager {
    /**
     * @param {Function} loggerCallback - Optional logging function
     */
    constructor(loggerCallback) {
        this.log = loggerCallback;
        this.levels = [];
        this.data = [];     // New category for KEYS, HIGHS, etc.
        this.graphics = [];
    }
    
    /**
     * Processes a list of files and categorizes them
     * * @param {FileList|Array<File>} fileList - Files to process
     * @returns {Object} Object containing sorted categorised arrays
     */
    async handleFiles(fileList) {
        // Clear previous results
        this.levels = [];
        this.data = [];
        this.graphics = [];
        
        // Pattern to match Duke Nukem episode files (.DN1, .DN2, .DN3, etc.)
        const dnFilePattern = /\.DN\d$/i;
        
        let filesFound = 0;
        
        for (const file of fileList) {
            const name = file.name.toUpperCase();
            
            // Only process valid Duke Nukem game files
            if (dnFilePattern.test(name)) {
                
                // ============================================================
                // NEW: Filter out unwanted files
                // ============================================================
                // MY_DEMO/USERDEMO: Non-playable demos
                // SAVED: Save game slots (SAVED1, SAVED2, SAVEDT, etc.)
                // SPEED: Timing data
                const ignoredPrefixes = ["MY_DEMO", "SAVED", "SPEED", "USERDEMO"];
                
                if (ignoredPrefixes.some(prefix => name.startsWith(prefix))) {
                    continue; // Skip this file completely
                }
                
                // ============================================================
                
                filesFound++;
                
                if (name.startsWith("WORLD")) {
                    // Level files
                    this.levels.push(file);
                } 
                else if (name.startsWith("KEYS") || name.startsWith("HIGHS")) {
                    // Data files
                    this.data.push(file);
                }
                else {
                    // Everything else is a graphic asset
                    this.graphics.push(file);
                }
            }
        }
        
        // Sort levels alphabetically
        this.levels.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        
        return this.reportResults(filesFound);
    }
    
    /**
     * Reports scan results and logs debug information
     */
    reportResults(count) {
        if (count === 0) {
            this.log("ERROR: No .DN* files found! Please check the folder.");
            return;
        }
        
        console.log(
            `FileManager Scan: ${this.levels.length} levels, ` +
            `${this.data.length} data files, ` +
            `${this.graphics.length} graphics.`
        );
        
        return {
            levels: this.levels,
            data: this.data,
            graphics: this.graphics
        };
    }
}