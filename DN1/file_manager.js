/**
 * ============================================================================
 * FILE MANAGER - GAME FILE SCANNER AND CATEGORIZER
 * ============================================================================
 * 
 * Scans and categorizes Duke Nukem 1 game files into logical groups.
 * Filters out unwanted files and organizes assets for easy access.
 * 
 * File Organization:
 * ------------------
 * Duke Nukem 1 stores different game data in separate files, all sharing
 * the .DN* extension pattern where * is the episode number (1, 2, or 3).
 * 
 * This manager categorizes files into three groups:
 * 
 * 1. LEVELS (WORLD*.DN*):
 *    - Map data for playable levels
 *    - Format: 128×90 tile grids
 *    - Examples: WORLDAL1.DN1, WORLDAL2.DN1
 * 
 * 2. DATA FILES (KEYS*.DN*, HIGHS*.DN*):
 *    - Non-graphical game data
 *    - KEYS: Keyboard configuration (6 bytes binary)
 *    - HIGHS: High score table (text format)
 * 
 * 3. GRAPHICS (Everything else):
 *    - Tileset files (BACK, SOLID, ANIM, OBJECT, etc.)
 *    - Full-screen images (CREDITS, DUKE, DN, etc.)
 *    - Font files (FONT)
 *    - Player sprites (MAN)
 *    - UI elements
 * 
 * File Filtering:
 * ---------------
 * Some files are intentionally excluded:
 * 
 * - MY_DEMO/USERDEMO: Non-playable demo recordings
 * - SAVED*: Save game files (SAVED1, SAVED2, SAVEDT, etc.)
 * - SPEED: Timing/performance data
 * 
 * These files use the same .DN* extension but aren't useful for
 * the asset viewer application.
 * 
 * Episode Organization:
 * ---------------------
 * Duke Nukem 1 has three episodes:
 * - Episode 1 (Shareware): .DN1 files
 * - Episode 2 (Commercial): .DN2 files
 * - Episode 3 (Commercial): .DN3 files
 * 
 * Each episode has its own complete set of assets. The viewer
 * can display files from any episode.
 */

export class FileManager {
    /* ====================================================================== */
    /* CONSTRUCTOR AND INITIALIZATION                                         */
    /* ====================================================================== */
    
    /**
     * Creates a new file manager instance.
     * 
     * Initializes empty category arrays and optionally connects
     * a logging callback for debug output.
     * 
     * @param {Function} loggerCallback - Optional logging function for status messages
     *   - Receives string messages about scan progress and errors
     *   - Typically connected to a UI log element
     *   - Example: (msg) => console.log(msg)
     */
    constructor(loggerCallback) {
        /**
         * Logger function for status messages.
         * If not provided, logging is silently skipped.
         */
        this.log = loggerCallback;
        
        /* ------------------------------------------------------------------ */
        /* File Category Arrays                                               */
        /* ------------------------------------------------------------------ */
        
        /**
         * These arrays store categorized files after scanning.
         * They're cleared at the start of each scan to prevent
         * accumulation from multiple folder selections.
         */
        
        this.levels = [];    // WORLD*.DN* files (map data)
        this.data = [];      // KEYS*.DN*, HIGHS*.DN* (configuration/scores)
        this.graphics = [];  // All other graphics assets
    }
    
    /* ====================================================================== */
    /* FILE SCANNING AND CATEGORIZATION                                       */
    /* ====================================================================== */
    
    /**
     * Processes a list of files and categorizes them into levels, data, and graphics.
     * 
     * This is the main entry point for file processing. It performs:
     * 1. Category array clearing (start fresh)
     * 2. File filtering (only valid .DN* files)
     * 3. Exclusion filtering (ignore demos, saves, etc.)
     * 4. Categorization (levels vs data vs graphics)
     * 5. Sorting (alphabetical with natural number ordering)
     * 6. Result reporting
     * 
     * Process Flow:
     * -------------
     * Clear arrays → Filter by extension → Filter by exclusions →
     * → Categorize by prefix → Sort levels → Report results
     * 
     * @param {FileList|Array<File>} fileList - Files to process
     *   - Can be from folder input (<input type="file" webkitdirectory>)
     *   - Can be from drag-and-drop
     *   - Can be programmatically generated File objects
     * 
     * @returns {Object} Categorized file lists:
     *   - levels: Array of level files (sorted alphabetically)
     *   - data: Array of data files (unsorted)
     *   - graphics: Array of graphics files (unsorted)
     * 
     * @example
     * const result = await fileManager.handleFiles(fileInput.files);
     * console.log(`Found ${result.levels.length} levels`);
     */
    async handleFiles(fileList) {
        /* ------------------------------------------------------------------ */
        /* Clear Previous Scan Results                                        */
        /* ------------------------------------------------------------------ */
        
        /**
         * Reset all category arrays to empty state.
         * This prevents files from previous scans from accumulating.
         * 
         * Each new folder selection should start fresh.
         */
        this.levels = [];
        this.data = [];
        this.graphics = [];
        
        /* ------------------------------------------------------------------ */
        /* Define Episode File Pattern                                        */
        /* ------------------------------------------------------------------ */
        
        /**
         * Regular expression to match Duke Nukem episode files.
         * 
         * Pattern: /\.DN\d$/i
         * - \. : Literal dot character
         * - DN : Literal "DN"
         * - \d : Single digit (0-9)
         * - $ : End of string
         * - i : Case-insensitive flag
         * 
         * Matches:
         * - .DN1 (Episode 1 - Shareware)
         * - .DN2 (Episode 2 - Commercial)
         * - .DN3 (Episode 3 - Commercial)
         * - .dn1, .dn2, .dn3 (lowercase variants)
         * 
         * Does NOT match:
         * - .DNT (thumbnail files)
         * - .DN (no episode number)
         * - .DN12 (multiple digits)
         * - Other extensions
         */
        const dnFilePattern = /\.DN\d$/i;
        
        /* ------------------------------------------------------------------ */
        /* Counter for Valid Files                                            */
        /* ------------------------------------------------------------------ */
        
        /**
         * Track how many valid Duke Nukem files we find.
         * Used for error reporting if no files match.
         */
        let filesFound = 0;
        
        /* ================================================================== */
        /* PROCESS EACH FILE                                                  */
        /* ================================================================== */
        
        for (const file of fileList) {
            const name = file.name.toUpperCase(); // Normalize for comparison
            
            /* -------------------------------------------------------------- */
            /* Filter: Only Process Valid Duke Nukem Files                    */
            /* -------------------------------------------------------------- */
            
            /**
             * Check if filename matches the .DN* pattern.
             * Skip files that don't match (other game files, system files, etc.).
             */
            if (dnFilePattern.test(name)) {
                
                /* ---------------------------------------------------------- */
                /* Filter: Exclude Unwanted File Types                        */
                /* ---------------------------------------------------------- */
                
                /**
                 * Some files use the .DN* extension but aren't useful
                 * for the asset viewer:
                 * 
                 * - MY_DEMO, USERDEMO: Demo recording files
                 *   * Non-playable gameplay recordings
                 *   * Used by game's demo mode
                 *   * Not relevant for asset viewing
                 * 
                 * - SAVED*: Save game files
                 *   * SAVED1, SAVED2, SAVED3: Individual save slots
                 *   * SAVEDT: Temporary save data
                 *   * Player progress snapshots
                 *   * Not useful for viewing game assets
                 * 
                 * - SPEED: Timing/performance data
                 *   * Internal game metrics
                 *   * Not displayable content
                 * 
                 * We skip these files entirely to keep the UI clean.
                 */
                const ignoredPrefixes = ["MY_DEMO", "SAVED", "SPEED", "USERDEMO"];
                
                if (ignoredPrefixes.some(prefix => name.startsWith(prefix))) {
                    continue; // Skip this file completely
                }
                
                /* ---------------------------------------------------------- */
                /* Count Valid Files                                          */
                /* ---------------------------------------------------------- */
                
                filesFound++;
                
                /* ========================================================== */
                /* CATEGORIZE FILE BY PREFIX                                  */
                /* ========================================================== */
                
                /**
                 * Determine file category based on filename prefix.
                 * Different prefixes indicate different content types.
                 */
                
                if (name.startsWith("WORLD")) {
                    /* ------------------------------------------------------ */
                    /* CATEGORY 1: Level Files                                */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Level map files (WORLD*.DN*).
                     * 
                     * Examples:
                     * - WORLDAL1.DN1: Episode 1, Level 1
                     * - WORLDAL2.DN1: Episode 1, Level 2
                     * - WORLDA1.DN2: Episode 2, Level 1
                     * 
                     * Format: 128×90 grid of 16-bit tile IDs
                     * Size: ~23KB (plus variable header)
                     */
                    this.levels.push(file);
                    
                } else if (name.startsWith("KEYS") || name.startsWith("HIGHS")) {
                    /* ------------------------------------------------------ */
                    /* CATEGORY 2: Data Files                                 */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Non-graphical game data files.
                     * 
                     * KEYS*.DN*:
                     * - Keyboard configuration
                     * - 6 bytes (one per action)
                     * - Binary scan codes
                     * 
                     * HIGHS*.DN*:
                     * - High score table
                     * - Text format
                     * - Score + player name per line
                     */
                    this.data.push(file);
                    
                } else {
                    /* ------------------------------------------------------ */
                    /* CATEGORY 3: Graphics Files                              */
                    /* ------------------------------------------------------ */
                    
                    /**
                     * Everything else is a graphics asset.
                     * 
                     * This includes:
                     * - BACK*.DN*: Background tiles
                     * - SOLID*.DN*: Solid/collidable tiles
                     * - ANIM*.DN*: Animated sprites
                     * - OBJECT*.DN*: Static objects/pickups
                     * - FONT*.DN*: Character fonts
                     * - MAN*.DN*: Player sprites
                     * - CREDITS, DUKE, DN, END: Full-screen images
                     * - And more...
                     * 
                     * All graphics files can be decoded and displayed
                     * as either tilesets or full images.
                     */
                    this.graphics.push(file);
                }
            }
        }
        
        /* ================================================================== */
        /* SORT LEVEL FILES                                                   */
        /* ================================================================== */
        
        /**
         * Sort levels alphabetically with natural number ordering.
         * 
         * Natural ordering ensures proper sequence:
         * - WORLDAL1 before WORLDAL2
         * - WORLDAL2 before WORLDAL10 (not WORLDAL1, WORLDAL10, WORLDAL2)
         * 
         * localeCompare with numeric: true enables natural sorting.
         * 
         * Data and graphics files don't need sorting as they're typically
         * accessed individually by name rather than sequentially.
         */
        this.levels.sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
        
        /* ================================================================== */
        /* REPORT RESULTS AND RETURN                                          */
        /* ================================================================== */
        
        return this.reportResults(filesFound);
    }
    
    /* ====================================================================== */
    /* RESULT REPORTING                                                       */
    /* ====================================================================== */
    
    /**
     * Reports scan results and logs debug information.
     * 
     * Provides feedback about what was found during the scan.
     * This helps users diagnose issues (wrong folder, missing files, etc.).
     * 
     * @param {number} count - Total number of valid .DN* files found
     * 
     * @returns {Object|undefined} Categorized file arrays, or undefined if error
     *   - levels: Array of level files
     *   - data: Array of data files
     *   - graphics: Array of graphics files
     */
    reportResults(count) {
        /* ------------------------------------------------------------------ */
        /* Error Case: No Valid Files Found                                   */
        /* ------------------------------------------------------------------ */
        
        /**
         * If no .DN* files were found, the user likely selected
         * the wrong folder or has file naming issues.
         * 
         * Log an error message and return early without data.
         */
        if (count === 0) {
            this.log("ERROR: No .DN* files found! Please check the folder.");
            return;
        }
        
        /* ------------------------------------------------------------------ */
        /* Success Case: Log Summary Statistics                               */
        /* ------------------------------------------------------------------ */
        
        /**
         * Output scan summary to console for debugging.
         * Shows breakdown of what was categorized.
         * 
         * Example output:
         * "FileManager Scan: 10 levels, 2 data files, 45 graphics."
         */
        console.log(
            `FileManager Scan: ${this.levels.length} levels, ` +
            `${this.data.length} data files, ` +
            `${this.graphics.length} graphics.`
        );
        
        /* ------------------------------------------------------------------ */
        /* Return Categorized File Lists                                      */
        /* ------------------------------------------------------------------ */
        
        /**
         * Return object with all categorized files.
         * This structure is consumed by the main application
         * to populate UI lists and handle file selection.
         */
        return {
            levels: this.levels,
            data: this.data,
            graphics: this.graphics
        };
    }
}
