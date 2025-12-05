/**
 * Sprite Definitions
 * 
 * Maps sprite tile IDs (0x3000+) to their file locations and properties.
 * 
 * Sprite Types:
 * - bonus: Collectible items (points, powerups, keys)
 * - enemy: Hostile entities
 * - hazard: Environmental dangers
 * - interactive: Game mechanics (doors, teleporters, spawns)
 * - decorative: Visual-only elements
 * 
 * Special Properties:
 * - crate: Composite sprite (base + content)
 * - composition: Multi-tile sprite definition
 * - forceOpaque: Override transparency mask
 * 
 * Source: Duke 1 Level Format.pdf & User Corrections
 */

export const SPRITE_MAP = {
    // ========================================================================
    // BONUSES - Collectible Items
    // ========================================================================
    
    "3000": {
        type: "bonus",
        name: "Grey Box (Empty)",
        crate: "grey"
    },
    
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
    
    "3020": {
        file: "OBJECT1",
        index: 13,
        type: "bonus",
        name: "Robohand"
    },
    
    "3023": {
        type: "bonus",
        name: "Crate (Balloon)",
        crate: "blue",
        content: { file: "OBJECT1", index: 19 }
    },
    
    "3024": {
        file: "ANIM4",
        index: 8,
        type: "bonus",
        name: "Security Camera"
    },
    
    "3029": {
        file: "OBJECT1",
        index: 24,
        type: "bonus",
        name: "Nuclear Molecule"
    },
    
    "302D": {
        type: "bonus",
        name: "Crate (Flag)",
        crate: "blue",
        content: { file: "OBJECT1", index: 47 }
    },
    
    "302E": {
        type: "bonus",
        name: "Crate (Radio)",
        crate: "blue",
        content: { file: "OBJECT2", index: 2 }
    },
    
    "3033": {
        file: "OBJECT1",
        index: 14,
        type: "bonus",
        name: "Access Card"
    },
    
    // ------------------------------------------------------------------------
    // Collectible Letters (DUKE)
    // ------------------------------------------------------------------------
    
    "3037": {
        file: "OBJECT2",
        index: 18,
        type: "bonus",
        name: "Letter D"
    },
    
    "3038": {
        file: "OBJECT2",
        index: 19,
        type: "bonus",
        name: "Letter U"
    },
    
    "3039": {
        file: "OBJECT2",
        index: 20,
        type: "bonus",
        name: "Letter K"
    },
    
    "303A": {
        file: "OBJECT2",
        index: 21,
        type: "bonus",
        name: "Letter E"
    },
    
    "303B": {
        file: "ANIM2",
        index: 19,
        type: "bonus",
        name: "Rabbit Bonus",
        composition: {
            width: 1,
            height: 2,
            indices: [18, 19]
        }
    },
    
    // ========================================================================
    // ENEMIES - Hostile Entities
    // ========================================================================
    
    "300B": {
        file: "ANIM0",
        index: 0,
        type: "enemy",
        name: "Floating Robot",
        composition: {
            width: 1,
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
    
    "3010": {
        file: "ANIM1",
        index: 32,
        type: "enemy",
        name: "Tiny Robot"
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
    
    "303C": {
        file: "ANIM5",
        index: 1,
        type: "enemy",
        name: "Fire Monster"
    },
    
    // ------------------------------------------------------------------------
    // Boss Enemies
    // ------------------------------------------------------------------------
    
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
        name: "Dr Proton (E1)",
        composition: {
            width: 2,
            height: 2,
            indices: [30, 31, 34, 35]
        }
    },
    
    // ========================================================================
    // HAZARDS - Environmental Dangers
    // ========================================================================
    
    "3009": {
        file: "OBJECT0",
        index: 24,
        type: "hazard",
        name: "Flamethrower (R)"
    },
    
    "300A": {
        file: "OBJECT0",
        index: 29,
        type: "hazard",
        name: "Flamethrower (L)"
    },
    
    "301A": {
        file: "OBJECT1",
        index: 0,
        type: "hazard",
        name: "Blue Forcefield (H)"
    },
    
    "301B": {
        file: "ANIM3",
        index: 12,
        type: "hazard",
        name: "Fan (L)"
    },
    
    "301C": {
        file: "ANIM3",
        index: 16,
        type: "hazard",
        name: "Fan (R)",
        composition: {
            width: 1,
            height: 2,
            indices: [16, 17]
        }
    },
    
    "3021": {
        file: "OBJECT1",
        index: 15,
        type: "hazard",
        name: "Blue Forcefield (V)"
    },
    
    "302A": {
        file: "OBJECT1",
        index: 33,
        type: "hazard",
        name: "Falling Sign",
        composition: {
            width: 2,
            height: 1,
            indices: [33, 34]
        }
    },
    
    "302B": {
        file: "OBJECT1",
        index: 40,
        type: "hazard",
        name: "Blue Reactor",
        // Stack the reactor tile 3 times vertically
        composition: {
            width: 1,
            height: 3,
            indices: [40, 40, 40]
        }
    },
    
    "302C": {
        file: "OBJECT1",
        index: 45,
        type: "hazard",
        name: "Floor Spike"
    },
    
    "3031": {
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
    
    // ========================================================================
    // INTERACTIVE - Game Mechanics
    // ========================================================================
    
    "3001": {
        file: "OBJECT0",
        index: 5,
        type: "interactive",
        name: "Elevator"
    },
    
    // ------------------------------------------------------------------------
    // Conveyor Belts
    // ------------------------------------------------------------------------
    
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
    
    // ------------------------------------------------------------------------
    
    "3007": {
        file: "OBJECT0",
        index: 11,
        type: "interactive",
        name: "Rocket"
    },
    
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
    
    // ------------------------------------------------------------------------
    // Special Tiles
    // ------------------------------------------------------------------------
    
    "3014": {
        type: "decorative",
        name: "Mirror Floor"
        // Note: No file/index - uses special reflection rendering
    },
    
    "3019": {
        file: "ANIM3",
        index: 0,
        type: "interactive",
        name: "Bridge",
        forceOpaque: true
    },
    
    // ------------------------------------------------------------------------
    // Teleporters
    // ------------------------------------------------------------------------
    
    "302F": {
        file: "ANIM4",
        index: 24,
        type: "interactive",
        name: "Teleporter A",
        composition: {
            width: 3,
            height: 3,
            indices: [20, 21, 22, 23, 24, 25, 26, 27, 28]
        }
    },
    
    "3030": {
        file: "ANIM4",
        index: 24,
        type: "interactive",
        name: "Teleporter B",
        composition: {
            width: 3,
            height: 3,
            indices: [20, 21, 22, 23, 24, 25, 26, 27, 28]
        }
    },
    
    // ------------------------------------------------------------------------
    
    "3032": {
        file: "MAN1",
        index: 0,
        type: "interactive",
        name: "Player Spawn",
        composition: {
            width: 2,
            height: 2,
            indices: [0, 1, 2, 3]
        }
    },
    
    "3034": {
        file: "OBJECT2",
        index: 5,
        type: "interactive",
        name: "Card Reader"
    },
    
    "3035": {
        file: "OBJECT2",
        index: 14,
        type: "interactive",
        name: "Hand Reader"
    },
    
    "3036": {
        file: "SOLID3",
        index: 47,
        type: "interactive",
        name: "Grapple Ceiling L"
    },
    
    "3040": {
        file: "OBJECT2",
        index: 23,
        type: "interactive",
        name: "Message Screen"
    },
    
    "3041": {
        file: "ANIM5",
        index: 24,
        type: "interactive",
        name: "Proton Screen",
        composition: {
            width: 2,
            height: 2,
            indices: [24, 25, 16, 17]
        }
    },
    
    // ------------------------------------------------------------------------
    // Keys
    // ------------------------------------------------------------------------
    
    "3044": {
        file: "OBJECT2",
        index: 24,
        type: "interactive",
        name: "Red Key"
    },
    
    "3045": {
        file: "OBJECT2",
        index: 25,
        type: "interactive",
        name: "Green Key"
    },
    
    "3046": {
        file: "OBJECT2",
        index: 26,
        type: "interactive",
        name: "Blue Key"
    },
    
    "3047": {
        file: "OBJECT2",
        index: 27,
        type: "interactive",
        name: "Purple Key"
    },
    
    // ------------------------------------------------------------------------
    // Locks
    // ------------------------------------------------------------------------
    
    "3048": {
        file: "OBJECT2",
        index: 37,
        type: "interactive",
        name: "Red Lock"
    },
    
    "3049": {
        file: "OBJECT2",
        index: 38,
        type: "interactive",
        name: "Green Lock"
    },
    
    "304A": {
        file: "OBJECT2",
        index: 39,
        type: "interactive",
        name: "Blue Lock"
    },
    
    "304B": {
        file: "OBJECT2",
        index: 40,
        type: "interactive",
        name: "Purple Lock"
    },
    
    // ------------------------------------------------------------------------
    // Doors
    // ------------------------------------------------------------------------
    
    "304C": {
        file: "OBJECT2",
        index: 28,
        type: "interactive",
        name: "Red Door"
    },
    
    "304D": {
        file: "OBJECT2",
        index: 28,
        type: "interactive",
        name: "Green Door"
    },
    
    "304E": {
        file: "OBJECT2",
        index: 28,
        type: "interactive",
        name: "Blue Door"
    },
    
    "304F": {
        file: "OBJECT2",
        index: 28,
        type: "interactive",
        name: "Purple Door"
    },
    
    // ========================================================================
    // DECORATIVE - Visual Elements
    // ========================================================================
    
    "3025": {
        file: "ANIM4",
        index: 11,
        type: "decorative",
        name: "Brown Spikes"
    },
    
    "3026": {
        file: "ANIM4",
        index: 12,
        type: "decorative",
        name: "Rock Left"
    },
    
    "3027": {
        file: "ANIM4",
        index: 13,
        type: "decorative",
        name: "Rock Right"
    },
    
    "3028": {
        file: "ANIM4",
        index: 14,
        type: "decorative",
        name: "Round Window"
    },
    
    "303D": {
        file: "ANIM5",
        index: 12,
        type: "decorative",
        name: "Wire Mesh"
    },
    
    "303E": {
        file: "ANIM5",
        index: 13,
        type: "decorative",
        name: "Window L"
    },
    
    "303F": {
        file: "ANIM5",
        index: 14,
        type: "decorative",
        name: "Window R"
    },
    
    // ========================================================================
    // DUPLICATES - Alternative IDs for Same Objects
    // ========================================================================
    
    "3050": {
        file: "OBJECT1",
        index: 8,
        type: "bonus",
        name: "Football"
    },
    
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
    }
};
