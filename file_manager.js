/**
 * File Manager
 * 
 * Scans and categorizes Duke Nukem game files.
 * Separates level files (WORLD*.DN*) from graphic assets (ANIM, OBJECT, SOLID, etc.)
 */

export class FileManager {
    /**
     * @param {Function} loggerCallback - Optional logging function
     */
    constructor(loggerCallback) {
        this.log = loggerCallback;
        this.levels = [];
        this.graphics = [];
    }
    
    /**
     * Processes a list of files and categorizes them
     * 
     * @param {FileList|Array<File>} fileList - Files to process
     * @returns {Object} Object containing sorted levels and graphics arrays
     */
    async handleFiles(fileList) {
        // Clear previous results
        this.levels = [];
        this.graphics = [];
        
        // Pattern to match Duke Nukem episode files (.DN1, .DN2, .DN3, etc.)
        const dnFilePattern = /\.DN\d$/i;
        
        let filesFound = 0;
        
        // ====================================================================
        // Categorize Files
        // ====================================================================
        
        for (const file of fileList) {
            const name = file.name.toUpperCase();
            
            // Only process valid Duke Nukem game files
            if (dnFilePattern.test(name)) {
                filesFound++;
                
                if (name.startsWith("WORLD")) {
                    // Level files
                    this.levels.push(file);
                } else {
                    // Everything else is a graphic asset
                    // (SOLID, BACK, OBJECT, ANIM, etc.)
                    this.graphics.push(file);
                }
            }
        }
        
        // ====================================================================
        // Sort Results
        // ====================================================================
        
        // Sort levels alphabetically for easier browsing
        this.levels.sort((a, b) => a.name.localeCompare(b.name));
        
        return this.reportResults(filesFound);
    }
    
    /**
     * Reports scan results and logs debug information
     * 
     * @param {number} count - Total number of valid files found
     * @returns {Object|undefined} Object with levels and graphics arrays
     */
    reportResults(count) {
        if (count === 0) {
            this.log("ERROR: No .DN* files found! Please check the folder.");
            return;
        }
        
        // Debug logging to verify file detection
        const solids = this.graphics.filter(
            f => f.name.toUpperCase().startsWith("SOLID")
        );
        
        console.log(
            `FileManager Scan: Found ${this.levels.length} levels, ` +
            `${this.graphics.length} graphics.`
        );
        console.log(`Debug: Found ${solids.length} SOLID files.`);
        
        return {
            levels: this.levels,
            graphics: this.graphics
        };
    }
}
