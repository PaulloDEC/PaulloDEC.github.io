/**
 * ============================================================================
 * SPRITE DEFINITIONS DATABASE
 * ============================================================================
 * 
 * Comprehensive mapping of Duke Nukem 1 sprite tile IDs to their file
 * locations, properties, and metadata. This database serves as the central
 * reference for all sprite entities in the game.
 * 
 * Data Structure:
 * ---------------
 * Each sprite is keyed by its hexadecimal tile ID (e.g., "3000", "3001") and
 * contains the following properties:
 * 
 * STANDARD PROPERTIES:
 * - type: Sprite category for layer filtering
 *   * "bonus" - Collectible items (points, powerups, keys)
 *   * "enemy" - Hostile entities
 *   * "hazard" - Environmental dangers (spikes, fire, electric)
 *   * "interactive" - Game mechanics (doors, teleporters, spawns)
 *   * "decorative" - Visual-only elements
 * 
 * - name: Human-readable sprite name
 * 
 * - file: Source tileset file (without episode extension)
 *   * Examples: "ANIM0", "OBJECT1", "SOLID0"
 * 
 * - index: Tile index within the source file (0-based)
 * 
 * OPTIONAL PROPERTIES:
 * - composition: Multi-tile sprite layout
 *   * width: Sprite width in tiles
 *   * height: Sprite height in tiles
 *   * indices: Array of tile indices in left-to-right, top-to-bottom order
 * 
 * - crate: Special composite sprite type
 *   * Values: "grey", "blue", "red" (determines crate box color)
 * 
 * - content: Item inside crate (for crate sprites only)
 *   * file: Source file for content item
 *   * index: Tile index for content item
 * 
 * - forceOpaque: Override transparency (forces all pixels to full alpha)
 *   * Used for sprites that incorrectly use color 0 as visible
 * 
 * ID Ranges:
 * ----------
 * - 0x3000-0x302F: Primary sprite range (bonuses, enemies, interactive)
 * - 0x3030-0x305F: Extended sprites (hazards, decorative, effects)
 * - Mirror sprites use same base ID with different flags
 * 
 * Sources:
 * --------
 * - Duke 1 Level Format.pdf (official documentation)
 * - User corrections and reverse engineering
 * - In-game testing and verification
 */

export const SPRITE_MAP = {
    /* ====================================================================== */
    /* BONUSES - COLLECTIBLE ITEMS                                           */
    /* ====================================================================== */
    /**
     * Collectible items that provide points, power-ups, or keys.
     * 
     * Categories:
     * - Point items: Flags, food, tech items (varying point values)
     * - Power-ups: Health, weapons, special abilities
     * - Keys: Access cards for locked areas
     * - Crates: Containers with items inside
     * 
     * Most bonuses use the "OBJECT" files, with some in "ANIM" files.
     */
    
    /* ---------------------------------------------------------------------- */
    /* Crates (Composite Sprites)                                             */
    /* ---------------------------------------------------------------------- */
    /**
     * Crates are special two-part sprites:
     * 1. Base: The crate box (grey, blue, or red)
     * 2. Content: The item inside (optional)
     * 
     * The renderer draws these separately with the content
     * scaled and positioned to appear "inside" the crate.
     */
    
    "3000": {
        type: "bonus",
        name: "Grey Box (Empty)",
        crate: "grey"
    },
    
    "3012": {
        type: "bonus",
        name: "Crate (Dynamite)",
        crate: "grey",
        content: { file: "ANIM2", index: 17 }
    },
    
    "3015": {
        type: "bonus",
        name: "Crate (Soda)",
        crate: "red",
        content: { file: "ANIM2", index: 32 }
    },
    
    "3018": {
        type: "bonus",
        name: "Crate (Turkey)",
        crate: "red",
        content: { file: "OBJECT0", index: 44 }
    },
    
    "301D": {
        type: "bonus",
        name: "Crate (Football)",
        crate: "blue",
        content: { file: "OBJECT1", index: 8 }
    },
    
    "301E": {
        type: "bonus",
        name: "Crate (Joystick)",
        crate: "blue",
        content: { file: "OBJECT1", index: 9 }
    },
    
    "301F": {
        type: "bonus",
        name: "Crate (Floppy)",
        crate: "blue",
        content: { file: "OBJECT1", index: 10 }
    },
    
    /* ---------------------------------------------------------------------- */
    /* Power-Ups and Equipment                                                */
    /* ---------------------------------------------------------------------- */
    /**
     * Items that enhance Duke's abilities:
     * - Shoes: Increased jump height
     * - Claws: Improved climbing
     * - Robohand: Unknown effect (possibly strength)
     * - Raygun Ammo: Weapon ammunition
     */
    
    "3006": {
        file: "OBJECT0",
        index: 10,
        type: "bonus",
        name: "Shoes"
    },
    
    "3008": {
        file: "OBJECT0",
        index: 18,
        type: "bonus",
        name: "Claws"
    },
    
    "300F": {
        file: "OBJECT0",
        index: 43,
        type: "bonus",
        name: "Raygun Ammo"
    },
    
    "3020": {
        file: "OBJECT1",
        index: 13,
        type: "bonus",
        name: "Robohand"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Health Items                                                           */
    /* ---------------------------------------------------------------------- */
    /**
     * Restore Duke's health when collected.
     * Different items restore different amounts.
     */
    
    "3021": {
        file: "OBJECT1",
        index: 14,
        type: "bonus",
        name: "Atomic Health"
    },
    
    "3024": {
        file: "OBJECT1",
        index: 19,
        type: "bonus",
        name: "Medicine Bottle"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Point Items                                                            */
    /* ---------------------------------------------------------------------- */
    /**
     * Collectibles that award points.
     * Values range from low (flags) to high (circuit boards).
     */
    
    "3023": {
        file: "OBJECT1",
        index: 18,
        type: "bonus",
        name: "Circuit Board"
    },
    
    "3025": {
        file: "OBJECT1",
        index: 20,
        type: "bonus",
        name: "Video Camera"
    },
    
    "3027": {
        file: "OBJECT1",
        index: 22,
        type: "bonus",
        name: "TV"
    },
    
    "3029": {
        file: "OBJECT1",
        index: 24,
        type: "bonus",
        name: "Phone"
    },
    
    "302A": {
        file: "OBJECT1",
        index: 25,
        type: "bonus",
        name: "Stereo"
    },
    
    "302B": {
        file: "OBJECT1",
        index: 26,
        type: "bonus",
        name: "Camcorder"
    },
    
    "302C": {
        file: "OBJECT1",
        index: 27,
        type: "bonus",
        name: "Computer"
    },
    
    "302D": {
        file: "OBJECT1",
        index: 28,
        type: "bonus",
        name: "VCR"
    },
    
    "302E": {
        file: "OBJECT1",
        index: 29,
        type: "bonus",
        name: "Popcorn"
    },
    
    "302F": {
        file: "OBJECT1",
        index: 30,
        type: "bonus",
        name: "Fries"
    },
    
    "3030": {
        file: "OBJECT1",
        index: 31,
        type: "bonus",
        name: "Pizza"
    },
    
    "3031": {
        file: "OBJECT1",
        index: 32,
        type: "bonus",
        name: "Sushi"
    },
    
    "3032": {
        file: "OBJECT1",
        index: 33,
        type: "bonus",
        name: "Burger"
    },
    
    "3035": {
        file: "OBJECT1",
        index: 36,
        type: "bonus",
        name: "Drumstick"
    },
    
    "3037": {
        file: "OBJECT1",
        index: 38,
        type: "bonus",
        name: "Hotdog"
    },
    
    "3039": {
        file: "OBJECT1",
        index: 40,
        type: "bonus",
        name: "Taco"
    },
    
    "303A": {
        file: "OBJECT1",
        index: 41,
        type: "bonus",
        name: "Sundae"
    },
    
    "303B": {
        file: "OBJECT1",
        index: 42,
        type: "bonus",
        name: "Lollipop"
    },
    
    "3045": {
        file: "OBJECT1",
        index: 45,
        type: "bonus",
        name: "Apple"
    },
    
    "3046": {
        file: "OBJECT1",
        index: 46,
        type: "bonus",
        name: "6-Pack Soda"
    },
    
    "3047": {
        file: "OBJECT1",
        index: 48,
        type: "bonus",
        name: "Basketball"
    },
    
    "3048": {
        file: "OBJECT1",
        index: 49,
        type: "bonus",
        name: "Bear Cub"
    },
    
    "304A": {
        file: "OBJECT2",
        index: 4,
        type: "bonus",
        name: "Lamp"
    },
    
    "304B": {
        file: "OBJECT2",
        index: 5,
        type: "bonus",
        name: "Disk"
    },
    
    "304C": {
        file: "OBJECT2",
        index: 6,
        type: "bonus",
        name: "Calculator"
    },
    
    "304D": {
        file: "OBJECT2",
        index: 7,
        type: "bonus",
        name: "Tape Deck"
    },
    
    "304E": {
        file: "OBJECT2",
        index: 8,
        type: "bonus",
        name: "Wristwatch"
    },
    
    "304F": {
        file: "OBJECT2",
        index: 9,
        type: "bonus",
        name: "Toilet Paper"
    },
    
    "3050": {
        file: "OBJECT2",
        index: 11,
        type: "bonus",
        name: "Treasure Chest"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Access Keys                                                            */
    /* ---------------------------------------------------------------------- */
    /**
     * Color-coded access cards for locked doors.
     * Required to progress through restricted areas.
     */
    
    "3009": {
        file: "OBJECT0",
        index: 19,
        type: "bonus",
        name: "Blue Key"
    },
    
    "300A": {
        file: "OBJECT0",
        index: 20,
        type: "bonus",
        name: "Red Key"
    },
    
    "300B": {
        file: "OBJECT0",
        index: 21,
        type: "bonus",
        name: "Green Key"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Special Items (Episode 3)                                              */
    /* ---------------------------------------------------------------------- */
    /**
     * Items that appear in later episodes or special locations.
     * Some of these mirror items from the main categories.
     */
    
    "3051": {
        file: "OBJECT0",
        index: 44,
        type: "bonus",
        name: "Turkey"
    },
    
    "3052": {
        file: "ANIM2",
        index: 32,
        type: "bonus",
        name: "Soda Can"
    },
    
    "3053": {
        file: "OBJECT1",
        index: 10,
        type: "bonus",
        name: "Floppy Disk"
    },
    
    "3054": {
        file: "OBJECT1",
        index: 9,
        type: "bonus",
        name: "Joystick"
    },
    
    "3055": {
        file: "OBJECT1",
        index: 47,
        type: "bonus",
        name: "Purple Flag"
    },
    
    "3056": {
        file: "OBJECT2",
        index: 2,
        type: "bonus",
        name: "Radio"
    },
    
    /* ====================================================================== */
    /* ENEMIES - HOSTILE ENTITIES                                             */
    /* ====================================================================== */
    /**
     * Hostile sprites that damage Duke on contact or attack.
     * 
     * Enemy Types:
     * - Robots: Various mechanical enemies with different movement patterns
     * - Creatures: Organic/alien enemies
     * - Bosses: Special high-health enemies (Dr. Proton)
     * 
     * Many enemies are multi-tile sprites requiring composition data.
     * Some enemies have directional variants (left/right facing).
     */
    
    /* ---------------------------------------------------------------------- */
    /* Robot Enemies                                                          */
    /* ---------------------------------------------------------------------- */
    /**
     * Mechanical enemies with varying sizes and behaviors.
     * Larger robots use multi-tile compositions.
     */
    
    "3004": {
        file: "ANIM0",
        index: 0,
        type: "enemy",
        name: "Small Robot",
        composition: {
            width: 2,
            height: 2,
            indices: [0, 6]
        }
    },
    
    "300C": {
        file: "ANIM0",
        index: 10,
        type: "enemy",
        name: "Jumping Robot",
        composition: {
            width: 2,
            height: 2,
            indices: [10, 11, 12, 13]
        }
    },
    
    "300D": {
        file: "ANIM0",
        index: 34,
        type: "enemy",
        name: "Wheeled Robot",
        composition: {
            width: 2,
            height: 1,
            indices: [34, 35]
        }
    },
    
    "3010": {
        file: "ANIM1",
        index: 32,
        type: "enemy",
        name: "Tiny Robot"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Creature Enemies                                                       */
    /* ---------------------------------------------------------------------- */
    /**
     * Organic or alien-type enemies.
     * Often have unique attack patterns or movement.
     */
    
    "300E": {
        file: "ANIM1",
        index: 22,
        type: "enemy",
        name: "Fire Wheel",
        composition: {
            width: 2,
            height: 2,
            indices: [16, 17, 18, 19]
        }
    },
    
    "3013": {
        file: "ANIM2",
        index: 24,
        type: "enemy",
        name: "Flying Orb"
    },
    
    "3016": {
        file: "ANIM2",
        index: 40,
        type: "enemy",
        name: "Green Bitey (R)"
    },
    
    "3017": {
        file: "ANIM2",
        index: 44,
        type: "enemy",
        name: "Green Bitey (L)"
    },
    
    "303C": {
        file: "ANIM5",
        index: 1,
        type: "enemy",
        name: "Fire Monster"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Large Enemies                                                          */
    /* ---------------------------------------------------------------------- */
    /**
     * Enemies that span multiple tiles.
     * Require larger composition arrays.
     */
    
    "3022": {
        file: "ANIM3",
        index: 20,
        type: "enemy",
        name: "Helicopter",
        composition: {
            width: 4,
            height: 2,
            indices: [32, 33, 34, 35, 20, 21, 22, 23]
        }
    },
    
    /* ---------------------------------------------------------------------- */
    /* Boss Enemies                                                           */
    /* ---------------------------------------------------------------------- */
    /**
     * Special enemies with high health.
     * Appear at end of episodes as final challenges.
     */
    
    "3042": {
        file: "ANIM5",
        index: 30,
        type: "enemy",
        name: "Dr Proton (E3)"
    },
    
    "3043": {
        file: "ANIM5",
        index: 30,
        type: "enemy",
        name: "Dr Proton (E2)"
    },
    
    "3044": {
        file: "ANIM5",
        index: 30,
        type: "enemy",
        name: "Dr Proton (E1)"
    },
    
    /* ====================================================================== */
    /* HAZARDS - ENVIRONMENTAL DANGERS                                        */
    /* ====================================================================== */
    /**
     * Environmental obstacles that damage Duke on contact.
     * 
     * Hazard Types:
     * - Spikes: Static damage tiles
     * - Fire: Animated flame obstacles
     * - Electric: Force fields and barriers
     * - Bombs: Explosive obstacles
     * - Lasers: Beam hazards
     * 
     * Unlike enemies, hazards are stationary and part of the environment.
     */
    
    /* ---------------------------------------------------------------------- */
    /* Spike Hazards                                                          */
    /* ---------------------------------------------------------------------- */
    /**
     * Sharp obstacles in various orientations.
     * Cause damage on contact.
     */
    
    "3058": {
        file: "OBJECT2",
        index: 48,
        type: "hazard",
        name: "Spikes (Up)"
    },
    
    "3059": {
        file: "OBJECT2",
        index: 49,
        type: "hazard",
        name: "Spikes (Down)"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Fire Hazards                                                           */
    /* ---------------------------------------------------------------------- */
    /**
     * Flame obstacles with animated sprites.
     * Often block passages or guard items.
     */
    
    "3033": {
        file: "OBJECT1",
        index: 34,
        type: "hazard",
        name: "Fire (Small)"
    },
    
    "3034": {
        file: "OBJECT1",
        index: 35,
        type: "hazard",
        name: "Fire (Large)",
        composition: {
            width: 2,
            height: 3,
            indices: [35, 36, 37, 38, 39, 40]
        },
        forceOpaque: true
    },
    
    /* ---------------------------------------------------------------------- */
    /* Electric Hazards                                                       */
    /* ---------------------------------------------------------------------- */
    /**
     * Force fields and electric barriers.
     * Block access to areas until deactivated.
     */
    
    "301A": {
        file: "OBJECT1",
        index: 6,
        type: "hazard",
        name: "Horizontal Force Field"
    },
    
    "301B": {
        file: "OBJECT1",
        index: 7,
        type: "hazard",
        name: "Vertical Force Field"
    },
    
    "3036": {
        file: "OBJECT1",
        index: 37,
        type: "hazard",
        name: "Electric Barrier"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Laser Hazards                                                          */
    /* ---------------------------------------------------------------------- */
    /**
     * Beam-type obstacles.
     * Often appear in sets creating obstacle courses.
     */
    
    "3038": {
        file: "OBJECT1",
        index: 39,
        type: "hazard",
        name: "Laser Beam"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Explosive Hazards                                                      */
    /* ---------------------------------------------------------------------- */
    /**
     * Bombs and explosive obstacles.
     * May have different behaviors (bouncing, static).
     */
    
    "3026": {
        file: "ANIM4",
        index: 31,
        type: "hazard",
        name: "Red Bomb (Bounce)"
    },
    
    "3057": {
        file: "ANIM4",
        index: 31,
        type: "hazard",
        name: "Red Bomb (Static)"
    },
    
    /* ====================================================================== */
    /* INTERACTIVE - GAME MECHANICS                                           */
    /* ====================================================================== */
    /**
     * Sprites that interact with gameplay systems.
     * 
     * Categories:
     * - Doors and Exits: Level transitions
     * - Conveyors: Moving platforms
     * - Teleporters: Transportation devices
     * - Spawners: Enemy generation points
     * - Switches: Activatable objects
     * - Elevators: Vertical transport
     * 
     * These sprites are essential for level progression and puzzles.
     */
    
    /* ---------------------------------------------------------------------- */
    /* Vertical Transport                                                     */
    /* ---------------------------------------------------------------------- */
    
    "3001": {
        file: "OBJECT0",
        index: 5,
        type: "interactive",
        name: "Elevator"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Conveyor Belts                                                         */
    /* ---------------------------------------------------------------------- */
    /**
     * Moving platform markers.
     * 
     * Conveyors are defined by pairs of sprites:
     * - Start marker: Beginning of conveyor
     * - End marker: End of conveyor
     * 
     * Two directions available (Left and Right).
     * The area between markers is treated as a moving platform.
     */
    
    "3002": {
        file: "SOLID0",
        index: 28,
        type: "interactive",
        name: "Conveyor Start (L)"
    },
    
    "3003": {
        file: "SOLID0",
        index: 34,
        type: "interactive",
        name: "Conveyor End (L)"
    },
    
    "3004": {
        file: "SOLID0",
        index: 28,
        type: "interactive",
        name: "Conveyor Start (R)"
    },
    
    "3005": {
        file: "SOLID0",
        index: 34,
        type: "interactive",
        name: "Conveyor End (R)"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Doors and Exits                                                        */
    /* ---------------------------------------------------------------------- */
    /**
     * Level exit points and locked doors.
     * Multi-tile sprites that span 2x2 tiles.
     */
    
    "3011": {
        file: "ANIM2",
        index: 0,
        type: "interactive",
        name: "Exit Door",
        composition: {
            width: 2,
            height: 2,
            indices: [0, 1, 2, 3]
        }
    },
    
    "301C": {
        file: "OBJECT1",
        index: 2,
        type: "interactive",
        name: "Locked Door (Blue)",
        composition: {
            width: 2,
            height: 2,
            indices: [2, 3, 4, 5]
        }
    },
    
    "3028": {
        file: "OBJECT1",
        index: 23,
        type: "interactive",
        name: "Locked Door (Green)"
    },
    
    "3049": {
        file: "OBJECT2",
        index: 3,
        type: "interactive",
        name: "Locked Door (Red)"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Special Transport                                                      */
    /* ---------------------------------------------------------------------- */
    
    "3007": {
        file: "OBJECT0",
        index: 11,
        type: "interactive",
        name: "Rocket"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Special Tiles                                                          */
    /* ---------------------------------------------------------------------- */
    /**
     * Unique interactive elements.
     * 
     * Mirror Floor uses special rendering logic (no file/index needed).
     */
    
    "3014": {
        type: "decorative",
        name: "Mirror Floor"
        // Note: No file/index - uses special reflection rendering in Pass 3
    },
    
    "3019": {
        file: "OBJECT0",
        index: 45,
        type: "interactive",
        name: "Teleporter"
    },
    
    "303D": {
        file: "ANIM5",
        index: 16,
        type: "interactive",
        name: "Spawn Point"
    },
    
    "303E": {
        file: "ANIM5",
        index: 19,
        type: "interactive",
        name: "Enemy Spawner"
    },
    
    "303F": {
        file: "ANIM5",
        index: 20,
        type: "interactive",
        name: "Timed Switch"
    },
    
    "3040": {
        file: "ANIM5",
        index: 22,
        type: "interactive",
        name: "Power Switch"
    },
    
    "3041": {
        file: "ANIM5",
        index: 27,
        type: "interactive",
        name: "Door Switch"
    },
    
    /* ====================================================================== */
    /* DECORATIVE - VISUAL ELEMENTS                                           */
    /* ====================================================================== */
    /**
     * Non-interactive sprites that enhance visual appearance.
     * 
     * These sprites:
     * - Don't interact with gameplay
     * - Don't require background fills
     * - Add atmosphere and detail to levels
     * 
     * Examples include:
     * - Environmental details (plants, debris)
     * - Atmospheric effects (smoke, particles)
     * - Background objects (signs, decorations)
     */
    
    /* ---------------------------------------------------------------------- */
    /* Environmental Details                                                  */
    /* ---------------------------------------------------------------------- */
    
    "3003": {
        file: "OBJECT0",
        index: 7,
        type: "decorative",
        name: "Small Plant"
    },
    
    "300D": {
        file: "OBJECT0",
        index: 22,
        type: "decorative",
        name: "Large Plant"
    },
    
    "3005": {
        file: "OBJECT0",
        index: 9,
        type: "decorative",
        name: "Debris"
    },
    
    /* ---------------------------------------------------------------------- */
    /* Signs and Text                                                         */
    /* ---------------------------------------------------------------------- */
    
    "301B": {
        file: "OBJECT0",
        index: 46,
        type: "decorative",
        name: "Warning Sign"
    },
    
    /* ====================================================================== */
    /* MIRRORS - HORIZONTAL REFLECTIONS                                       */
    /* ====================================================================== */
    /**
     * Horizontally-flipped variants of existing sprites.
     * 
     * These share the same sprite data as their base versions but
     * are rendered with horizontal flip. The renderer detects these
     * by checking ID ranges and applies the flip transform.
     * 
     * Implementation:
     * - Mirror IDs typically = Base ID + offset
     * - Renderer handles flip automatically
     * - No separate sprite data needed
     * 
     * Note: Not all sprites have mirror variants.
     */
    
    /* ---------------------------------------------------------------------- */
    /* Enemy Mirrors                                                          */
    /* ---------------------------------------------------------------------- */
    /**
     * Directional variants for enemies that face left/right.
     * Allows the same enemy to patrol in both directions.
     */
    
    "3060": {
        type: "enemy",
        name: "Small Robot (Mirrored)"
        // Renders 0x3004 with horizontal flip
    },
    
    "3061": {
        type: "enemy",
        name: "Jumping Robot (Mirrored)"
        // Renders 0x300C with horizontal flip
    },
    
    "3062": {
        type: "enemy",
        name: "Wheeled Robot (Mirrored)"
        // Renders 0x300D with horizontal flip
    }
};
