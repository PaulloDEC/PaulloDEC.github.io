/**
 * AudioPlayer.js
 * Handles playback of Duke Nukem II Digitized Audio (VOC format).
 * ADPCM implementation based on Rigel Engine (derived from Sound Blaster firmware).
 */
export class AudioPlayer {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async playVoc(buffer) {
        this.init();
        if (this.ctx.state === 'suspended') await this.ctx.resume();

        const data = new Uint8Array(buffer);
        let offset = 0;

        // 1. Validate Header (26 bytes)
        const headerSig = "Creative Voice File";
        for (let i = 0; i < headerSig.length; i++) {
            if (data[i] !== headerSig.charCodeAt(i)) {
                console.error("Invalid VOC Header");
                return;
            }
        }
        
        // Header Size is at offset 20 (2 bytes). Usually 26 (0x1A).
        const dataStart = data[20] | (data[21] << 8);
        offset = dataStart;

        // 2. Parse Blocks
        // Track state for Block Type 2/8 combinations
        let lastSampleRate = 11025; // Default fallback
        let lastCodec = 0x00;       // 8-bit unsigned PCM
        let lastChannels = 1;       // Mono
        
        // Track ADPCM state across blocks
        this.adpcmReference = 0x80;
        this.adpcmStep = 1;
        
        while (offset < data.length) {
            const blockType = data[offset];
            offset++; 

            if (blockType === 0) { // Terminator
                break; 
            }

            // Read block length (3 bytes, little-endian)
            if (offset + 3 > data.length) break;
            const len = data[offset] | (data[offset+1] << 8) | (data[offset+2] << 16);
            offset += 3;

            if (blockType === 1) { // Sound Data with type (old format)
                // Read Props
                const timeConstant = data[offset];
                const codec = data[offset + 1];
                
                // Calculate Sample Rate
                const sampleRate = Math.floor(1000000 / (256 - timeConstant));
                
                console.log(`VOC Block 1: ${len-2} bytes @ ${sampleRate}Hz, codec=${codec}`);

                // Extract audio data (length is len - 2 for the 2 property bytes)
                let audioData = data.subarray(offset + 2, offset + len);
                
                // Decompress ADPCM if needed
                // Block Type 1 always has a reference byte as the first data byte
                if (codec === 0x01 || codec === 0x02 || codec === 0x03) {
                    audioData = this.decompressAdpcm(audioData, codec, true);
                    if (!audioData) {
                        console.warn(`Failed to decompress ADPCM codec ${codec}`);
                        offset += len;
                        continue;
                    }
                    console.log(`Decompressed to ${audioData.length} PCM samples`);
                }
                
                // Play it (codec 0x00 is already PCM, others are now decompressed)
                if (codec === 0x00 || codec === 0x01 || codec === 0x02 || codec === 0x03) {
                    this.playPcmBuffer(audioData, sampleRate);
                } else {
                    console.warn(`Unsupported codec in Block 1: ${codec}`);
                }
                
                offset += len;
            }
            else if (blockType === 2) { // Sound Data without type
                // Uses properties set by previous Block 8
                console.log(`VOC Block 2: ${len} bytes @ ${lastSampleRate}Hz, codec=${lastCodec}`);
                
                let audioData = data.subarray(offset, offset + len);
                
                // Decompress ADPCM if needed
                // Block Type 2 has NO reference byte (continues from previous block)
                if (lastCodec === 0x01 || lastCodec === 0x02 || lastCodec === 0x03) {
                    audioData = this.decompressAdpcm(audioData, lastCodec, false);
                    if (!audioData) {
                        console.warn(`Failed to decompress ADPCM codec ${lastCodec}`);
                        offset += len;
                        continue;
                    }
                    console.log(`Decompressed to ${audioData.length} PCM samples`);
                }
                
                // Play it
                if (lastCodec === 0x00 || lastCodec === 0x01 || lastCodec === 0x02 || lastCodec === 0x03) {
                    this.playPcmBuffer(audioData, lastSampleRate);
                } else {
                    console.warn(`Unsupported codec in Block 2: ${lastCodec}`);
                }
                
                offset += len;
            }
            else if (blockType === 3) { // Silence
                const silenceLen = data[offset] | (data[offset+1] << 8);
                const freqDiv = data[offset + 2];
                const sampleRate = Math.floor(1000000 / (256 - freqDiv));
                
                console.log(`VOC Block 3: ${silenceLen + 1} samples of silence @ ${sampleRate}Hz`);
                
                // Create silence buffer
                const silenceData = new Uint8Array(silenceLen + 1).fill(128); // 128 = silence in 8-bit unsigned
                this.playPcmBuffer(silenceData, sampleRate);
                
                offset += len;
            }
            else if (blockType === 8) { // Extra information
                // Sets properties for subsequent Block 2
                const freqDiv = data[offset] | (data[offset+1] << 8);
                const codec = data[offset + 2];
                const channels = data[offset + 3] + 1; // 0=mono, 1=stereo
                
                lastCodec = codec;
                lastChannels = channels;
                lastSampleRate = Math.floor(256000000 / (channels * (65536 - freqDiv)));
                
                console.log(`VOC Block 8: SR=${lastSampleRate}Hz, codec=${codec}, ch=${channels}`);
                
                offset += len;
            }
            else if (blockType === 9) { // Sound Data (new format)
                const sampleRate = data[offset] | (data[offset+1] << 8) | (data[offset+2] << 16) | (data[offset+3] << 24);
                const bitsPerSample = data[offset + 4];
                const channels = data[offset + 5];
                const codec = data[offset + 6] | (data[offset+7] << 8);
                // offset + 8..11 = reserved (4 bytes)
                
                console.log(`VOC Block 9: ${len-12} bytes @ ${sampleRate}Hz, ${bitsPerSample}-bit, ${channels}ch, codec=${codec}`);
                
                const pcmData = data.subarray(offset + 12, offset + len);
                
                // Play it (only if 8-bit unsigned PCM, mono)
                if (codec === 0x00 && bitsPerSample === 8 && channels === 1) {
                    this.playPcmBuffer(pcmData, sampleRate);
                } else {
                    console.warn(`Unsupported format in Block 9: ${bitsPerSample}-bit, codec=${codec}, ${channels}ch`);
                }
                
                offset += len;
            }
            else {
                // Unknown/Unsupported Block - skip it
                console.warn(`Skipping unknown VOC block type ${blockType}, length ${len}`);
                offset += len;
            }
        }
    }

    playPcmBuffer(pcmData, sampleRate) {
        const audioBuffer = this.ctx.createBuffer(1, pcmData.length, sampleRate);
        const channel = audioBuffer.getChannelData(0);
        
        // Convert 8-bit Unsigned (0..255) to Float32 (-1.0..1.0)
        // Silence is 128.
        for (let i = 0; i < pcmData.length; i++) {
            channel[i] = (pcmData[i] - 128) / 128.0;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.ctx.destination);
        source.start();
    }

    /**
     * Decompress Creative ADPCM to 8-bit PCM
     * Supports codecs 1, 2, and 3 (4-bit, 3-bit, 2-bit ADPCM)
     * Based on Rigel Engine's implementation (derived from Sound Blaster firmware)
     * 
     * @param compressedData - The ADPCM compressed data
     * @param codec - Codec type (0x01, 0x02, or 0x03)
     * @param hasRefByte - If true, first byte is the reference/predictor value (resets state)
     */
    decompressAdpcm(compressedData, codec, hasRefByte = true) {
        const decompressed = [];
        
        let dataOffset = 0;
        let reference = this.adpcmReference || 0x80;
        let step = this.adpcmStep || 1;
        
        // If hasRefByte, first byte is the reference (predictor) value - resets state
        if (hasRefByte && compressedData.length > 0) {
            reference = compressedData[0];
            step = 1; // Reset step when we have a new reference byte
            dataOffset = 1;
            
            // Add the reference byte as the first decoded sample
            decompressed.push(reference);
        }
        
        // Process remaining compressed data
        for (let i = dataOffset; i < compressedData.length; i++) {
            const byte = compressedData[i];
            
            if (codec === 0x01) {
                // 4-bit ADPCM - 2 samples per byte
                decompressed.push(this.decodeBits4(byte >> 4, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
                
                decompressed.push(this.decodeBits4(byte & 0x0F, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
            }
            else if (codec === 0x02) {
                // 3-bit ADPCM (2.6-bit) - 3 samples per byte
                // Bit layout: [7-5][4-2][1-0]
                decompressed.push(this.decodeBits2_6((byte >> 5) & 0x07, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
                
                decompressed.push(this.decodeBits2_6((byte >> 2) & 0x07, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
                
                // Last sample uses bits 1-0, rearranged as specified in Rigel Engine
                const lastSample = ((byte & 0x02) << 1) | (byte & 0x01);
                decompressed.push(this.decodeBits2_6(lastSample, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
            }
            else if (codec === 0x03) {
                // 2-bit ADPCM - 4 samples per byte
                decompressed.push(this.decodeBits2((byte >> 6) & 0x03, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
                
                decompressed.push(this.decodeBits2((byte >> 4) & 0x03, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
                
                decompressed.push(this.decodeBits2((byte >> 2) & 0x03, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
                
                decompressed.push(this.decodeBits2((byte >> 0) & 0x03, reference, step));
                reference = decompressed[decompressed.length - 1];
                step = this.adpcmStep;
            }
            else {
                return null;
            }
        }
        
        // Save state for next block (if Block Type 2 follows)
        this.adpcmReference = reference;
        // adpcmStep is already saved by the decode functions
        
        return new Uint8Array(decompressed);
    }
    
    /**
     * Decode a 4-bit ADPCM sample
     * Based on Rigel Engine's decodeBits4
     */
    decodeBits4(encoded, reference, step) {
        const dataBits = encoded & 0x07;  // Lower 3 bits
        const signBit = (encoded & 0x08) !== 0;  // Bit 3
        
        // Calculate delta
        const delta = ((dataBits * step) & 0xFF) + Math.floor(step / 2);
        
        // Update reference
        if (signBit) {
            reference -= delta;
        } else {
            reference += delta;
        }
        
        // Clamp to 8-bit unsigned range
        reference = Math.max(0, Math.min(255, reference));
        
        // Update step size
        if (dataBits === 0) {
            step = Math.max(Math.floor(step / 2), 1);
        } else if (dataBits >= 5) {
            step *= 2;
            if (step === 0x10) {
                step = 8;
            }
        }
        
        this.adpcmStep = step;
        return reference;
    }
    
    /**
     * Decode a 3-bit ADPCM sample (2.6-bit)
     * Based on Rigel Engine's decodeBits2_6
     */
    decodeBits2_6(encoded, reference, step) {
        const dataBits = encoded & 0x03;  // Lower 2 bits
        const signBit = (encoded & 0x04) !== 0;  // Bit 2
        
        // Calculate delta
        const delta = ((dataBits * step) & 0xFF) + Math.floor(step / 2);
        
        // Update reference
        if (signBit) {
            reference -= delta;
        } else {
            reference += delta;
        }
        
        // Clamp to 8-bit unsigned range
        reference = Math.max(0, Math.min(255, reference));
        
        // Update step size
        if (dataBits === 0) {
            step = Math.max(Math.floor(step / 2), 1);
        } else if (dataBits === 0x03) {
            if (step !== 0x10) {
                step *= 2;
            }
        }
        
        this.adpcmStep = step;
        return reference;
    }
    
    /**
     * Decode a 2-bit ADPCM sample
     * Based on Rigel Engine's decodeBits2
     */
    decodeBits2(encoded, reference, step) {
        const dataBit = encoded & 0x01;   // Bit 0
        const signBit = (encoded & 0x02) !== 0;  // Bit 1
        
        if (dataBit) {
            const delta = step + Math.floor(step / 2);
            
            // Update reference
            if (signBit) {
                reference -= delta;
            } else {
                reference += delta;
            }
            
            // Clamp to 8-bit unsigned range
            reference = Math.max(0, Math.min(255, reference));
            
            // Update step size
            if (step !== 0x20) {
                step *= 2;
            }
        } else {
            step = Math.floor(step / 2);
            
            if (step === 0) {
                step = 1;
                // NO reference update - reuse last reference value
            } else {
                // Update reference
                if (signBit) {
                    reference -= step;
                } else {
                    reference += step;
                }
                
                // Clamp to 8-bit unsigned range
                reference = Math.max(0, Math.min(255, reference));
            }
        }
        
        this.adpcmStep = step;
        return reference;
    }
}