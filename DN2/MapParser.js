/**
 * MapParser.js
 * Parses Duke Nukem II Level Files (*.MNI).
 * FIXED: Correctly reads numActorWords and parses actor data.
 */

export class MapParser {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.grid = []; 
        this.actors = [];
        this.czone = "";
    }

    parse(data) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        
        // 1. Read Header
        const dataOffset = view.getUint16(0, true);
        
        // Read numActorWords at offset 45 (2 bytes before end of header)
        const numActorWords = view.getUint16(45, true);
        const numActors = Math.floor(numActorWords / 3);
        
        // CZONE Filename (Offset 2, 13 bytes)
        let czoneName = "";
        for (let i = 0; i < 13; i++) {
            const char = view.getUint8(2 + i);
            if (char === 0) break;
            czoneName += String.fromCharCode(char);
        }
        this.czone = czoneName.trim().toUpperCase();

        // 2. Parse Actors
        // Actors start at offset 47 (after the 47-byte header)
        // Each actor is 6 bytes: ID (2) + X (2) + Y (2)
        this.actors = [];
        const actorsStart = 47;
        
        console.log(`Level header indicates ${numActors} actors (numActorWords: ${numActorWords})`);
        
        for (let i = 0; i < numActors; i++) {
            const offset = actorsStart + (i * 6);
            
            // Bounds check
            if (offset + 6 > dataOffset) {
                console.warn(`Actor ${i} would exceed data offset boundary. Stopping.`);
                break;
            }
            
            const id = view.getUint16(offset, true);
            const x = view.getUint16(offset + 2, true);
            const y = view.getUint16(offset + 4, true);
            
            // Filter out empty/null actors (ID 0)
            if (id !== 0) {
                this.actors.push({ id, x, y });
            }
        }
        
        console.log(`Parsed ${this.actors.length} valid actors (${numActors - this.actors.length} empty slots skipped).`);
		logMessage(`Parsed ${this.actors.length} valid actors`, 'info');

        // 3. Read Dimensions (Located AT dataOffset)
        this.width = view.getUint16(dataOffset, true);
        const MAP_CELLS = 32750; 
        this.height = Math.floor(MAP_CELLS / this.width);
        
        console.log(`Map dimensions: ${this.width}x${this.height}`);
		
        // 4. Extract Raw Map Grid
        const mapStart = dataOffset + 2;
        const mapEnd = mapStart + (MAP_CELLS * 2);
        
        const rawGrid = [];
        for (let i = 0; i < MAP_CELLS; i++) {
            rawGrid.push(view.getUint16(mapStart + (i * 2), true));
        }

        // 5. Parse Supplemental Data (RLE-compressed extra bits for masked tiles)
        const extraLen = view.getUint16(mapEnd, true);
        const extraDataStart = mapEnd + 2;
        const extraData = new Uint8Array(data.buffer, data.byteOffset + extraDataStart, extraLen);
        const highBits = this.decompressRLE(extraData, MAP_CELLS);

        // 6. Process Hybrid Grid
        this.grid = new Array(MAP_CELLS);
        for (let i = 0; i < MAP_CELLS; i++) {
            const val = rawGrid[i];
            const extra = highBits[i] || 0;
            let bgIndex = null;
            let fgIndex = null;

            if (val & 0x8000) {
                // Extended tile spec: separate indices for layers 0 and 1
                bgIndex = val & 0x03FF;
                let fgLow = (val >> 10) & 0x1F;
                fgIndex = fgLow + (extra * 32);
            } else {
                // Simple tile spec
                if (val < 8000) bgIndex = val / 8;
                else fgIndex = (val - 8000) / 40;
            }
            this.grid[i] = { bg: bgIndex, fg: fgIndex };
        }
        
        return this;
    }

    decompressRLE(data, totalCells) {
        const result = new Array(totalCells).fill(0); 
        let readIdx = 0;
        let tileIndex = 0;

        while (readIdx < data.length && tileIndex < totalCells) {
            const cmd = data[readIdx++];
            const count = (cmd << 24) >> 24; // Sign extend
            const absCount = Math.abs(count);

            if (count > 0) {
                // RLE: repeat next byte 'count' times
                const val = data[readIdx++];
                for (let c = 0; c < count; c++) {
                    this.applyClusterValue(result, tileIndex, val);
                    tileIndex += 4;
                }
            } else if (count < 0) {
                // Literal: copy next 'absCount' bytes
                for (let c = 0; c < absCount; c++) {
                    const val = data[readIdx++];
                    this.applyClusterValue(result, tileIndex, val);
                    tileIndex += 4;
                }
            }
            // count === 0 is terminator (shouldn't happen in middle of data)
        }
        return result;
    }

    applyClusterValue(resultArr, startIndex, byteVal) {
        // Each byte encodes 4 tiles worth of extra bits (2 bits each)
        if (startIndex < resultArr.length) resultArr[startIndex] = (byteVal & 0x03);
        if (startIndex + 1 < resultArr.length) resultArr[startIndex + 1] = (byteVal >> 2) & 0x03;
        if (startIndex + 2 < resultArr.length) resultArr[startIndex + 2] = (byteVal >> 4) & 0x03;
        if (startIndex + 3 < resultArr.length) resultArr[startIndex + 3] = (byteVal >> 6) & 0x03;
    }
}