/**
 * FileSystem.js
 * Handles reading the NUKEM2.CMP archive.
 */

export class FileSystem {
    constructor() {
        this.files = new Map(); // Stores filename -> { offset, size, data }
    }

    /**
     * Entry point: Accepts the raw File object from the browser
     */
    async loadCMP(file) {
        const buffer = await file.arrayBuffer();
        const data = new DataView(buffer);
        
        // CMP Constants from ModdingWiki 
        const FAT_SIZE = 4000;
        const ENTRY_SIZE = 20; // 12 (name) + 4 (offset) + 4 (size)
        
        console.log("Parsing NUKEM2.CMP FAT...");
        this.files.clear();

        for (let i = 0; i < FAT_SIZE; i += ENTRY_SIZE) {
            // 1. Read Filename (12 bytes, null-terminated or space-padded)
            let name = "";
            for (let j = 0; j < 12; j++) {
                const char = data.getUint8(i + j);
                if (char === 0) break; // Null terminator
                name += String.fromCharCode(char);
            }
            name = name.trim();

            // Empty name usually means end of FAT or empty slot
            if (name.length === 0) continue;

            // 2. Read Offset and Size (Little Endian)
            const offset = data.getUint32(i + 12, true);
            const size = data.getUint32(i + 16, true);

            // 3. Store the file entry
            // We slice the buffer immediately so we have the raw data ready
            this.files.set(name.toUpperCase(), {
                offset: offset,
                size: size,
                data: new Uint8Array(buffer, offset, size)
            });
        }

        return Array.from(this.files.keys());
    }

    /**
     * Retrieve a specific file by name
     */
    getFile(filename) {
        const entry = this.files.get(filename.toUpperCase());
        if (entry) return entry.data;
        return null;
    }
}