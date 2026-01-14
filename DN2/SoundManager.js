/**
 * SoundManager.js
 * Handles parsing of AUDIOHED/AUDIOT and playback of PC Speaker/AdLib effects.
 */

export class SoundManager {
    constructor(audioCtx, musicPlayer) {
        this.ctx = audioCtx; 
        this.musicPlayer = musicPlayer;
        this.sounds = []; 
        this.audioBlob = null;
        this.activeInterval = null;
    }

    /**
     * Get or create AudioContext
     */
    getAudioContext() {
        // Try to use existing context from music player
        if (this.musicPlayer && this.musicPlayer.audioCtx) {
            return this.musicPlayer.audioCtx;
        }
        
        // Otherwise use the one passed in constructor
        if (this.ctx) {
            return this.ctx;
        }
        
        // Last resort: create our own
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        return this.ctx;
    }

    /**
     * Load sound definitions from AUDIOHED/AUDIOT file pair
     * @param {Uint8Array} hedData - AUDIOHED.MNI header data
     * @param {Uint8Array} audiotData - AUDIOT.MNI audio data
     * @returns {Array} Array of sound metadata objects
     */
    load(hedData, audiotData) {
        this.sounds = [];
        this.audioBlob = audiotData;

        // Parse header file (array of uint32 offsets)
        const alignedBuffer = hedData.slice().buffer;
        const header = new Uint32Array(alignedBuffer);
        
        for (let i = 0; i < header.length - 1; i++) {
            const start = header[i];
            const end = header[i + 1];
            const size = end - start;

            if (size > 0 && start < audiotData.length && end <= audiotData.length) {
                this.sounds.push({ 
                    id: i, 
                    start: start, 
                    end: end, 
                    size: size 
                });
            }
        }
        
        console.log(`SoundManager: Loaded ${this.sounds.length} sound clips`);
        return this.sounds;
    }

    /**
     * Stop currently playing sound effect
     */
    stop() {
        // Clear interval timer
        if (this.activeInterval) {
            clearInterval(this.activeInterval);
            this.activeInterval = null;
        }
        
        // Stop the music player if it's playing a sound effect
        if (this.musicPlayer && this.musicPlayer.currentTrackName.startsWith('SFX:')) {
            this.musicPlayer.stop();
        }
    }

    /**
     * Play a sound effect by index
     * @param {number} index - Sound index from AUDIOHED
     */
    play(index) {
        this.stop();

        const sound = this.sounds[index];
        if (!sound || !this.audioBlob) {
            console.warn(`SoundManager: Invalid sound index ${index}`);
            return;
        }

        const data = this.audioBlob.subarray(sound.start, sound.end);
        
        // Debug: Show first 24 bytes to see the header structure
        const preview = Array.from(data.slice(0, 24))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
        console.log(`Sound ${index} first 24 bytes: ${preview}`);
        
        // Detect sound type by index (Rigel Engine: 0-33 PC Speaker, 34-67 AdLib)
        const isPcSpeaker = this.detectPCSpeaker(data, index);
        
        console.log(`Playing sound ${index} (${isPcSpeaker ? 'PC Speaker' : 'AdLib'}, ${data.length} bytes)`);

        if (isPcSpeaker) {
            this.playPCSpeaker(data);
        } else {
            this.playAdLib(data, index);
        }
    }

    /**
     * Detect if sound data is PC Speaker format
     * Based on Rigel Engine source: sounds 0-33 are PC Speaker, 34-67 are AdLib
     * @param {Uint8Array} data - Sound data
     * @returns {boolean} True if PC Speaker format
     */
    detectPCSpeaker(data, index) {
        // Rigel Engine only loads AdLib sounds from indices 34-67
        return index < 34 || index >= 68;
    }

    /**
     * Play PC Speaker sound effect
     * AudioT Format: Each byte is an inverse frequency value
     * Playback rate: 140 Hz (140 bytes per second)
     * @param {Uint8Array} data - PC Speaker sound data
     */
    playPCSpeaker(data) {
        const ctx = this.getAudioContext();
        if (!ctx) {
            console.warn('SoundManager: No AudioContext available');
            return;
        }
        
        // Resume context if suspended
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        // Stop any currently playing music (same as stop button)
        if (this.musicPlayer && this.musicPlayer.isPlaying) {
            console.log('PC Speaker: Stopping music');
            this.musicPlayer.stop();
            
            // Update UI like the stop button does
            const nameLabel = document.getElementById('music-track-name');
            const playBtn = document.getElementById('music-play-pause');
            if (nameLabel) nameLabel.textContent = "Stopped";
            if (playBtn) playBtn.textContent = "▶️";
            
            // Auto-hide music controls after 3 seconds (same as stop button)
            setTimeout(() => {
                if (!this.musicPlayer.isPlaying) {
                    const musicControls = document.querySelector('.music-controls');
                    if (musicControls) {
                        musicControls.style.display = 'none';
                    }
                }
            }, 3000);
        }
        
        // Parse AudioT PC Sound header
        const length = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
        const priority = data[4] | (data[5] << 8);
        
        // Sound data starts at byte 6
        const soundData = data.slice(6, 6 + length);
        
        console.log(`PC Speaker: length=${length}, priority=${priority}, data=${soundData.length} bytes`);
        
        // Constants from AudioT documentation
        const PC_BASE_TIMER = 1193181; // PIT clock rate
        const PC_RATE = 140; // Playback rate: 140 bytes per second
        const SAMPLE_RATE = 22050; // Output sample rate for Web Audio
        const SAMPLES_PER_BYTE = Math.floor(SAMPLE_RATE / PC_RATE); // ~157 samples per byte
        
        // Pre-calculate total samples needed
        const totalSamples = soundData.length * SAMPLES_PER_BYTE;
        
        // Create audio buffer
        const audioBuffer = ctx.createBuffer(1, totalSamples, SAMPLE_RATE);
        const channelData = audioBuffer.getChannelData(0);
        
        // Generate square wave for each byte
        let outputIndex = 0;
        let phase = 0;
        let sign = 1;
        
        for (let i = 0; i < soundData.length; i++) {
            const inverseFreq = soundData[i];
            
            if (inverseFreq === 0) {
                // Silence
                for (let j = 0; j < SAMPLES_PER_BYTE; j++) {
                    channelData[outputIndex++] = 0;
                }
                phase = 0;
                sign = 1;
            } else {
                // Convert to frequency
                const tone = inverseFreq * 60; // PIT divisor
                const frequency = PC_BASE_TIMER / tone; // Hz
                
                // Calculate phase increment per sample
                const phaseLength = (SAMPLE_RATE * tone) / (2 * PC_BASE_TIMER);
                
                // Generate square wave samples
                for (let j = 0; j < SAMPLES_PER_BYTE; j++) {
                    channelData[outputIndex++] = sign * 0.05; // Volume: 0.05
                    
                    phase++;
                    if (phase >= phaseLength) {
                        sign = -sign;
                        phase = 0;
                    }
                }
            }
        }
        
        // Play the buffer
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.8;
        
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        source.start();
        
        const duration = soundData.length / PC_RATE;
        console.log(`Playing PC Speaker sound: ${duration.toFixed(2)}s`);
    }

    /**
     * Play AdLib sound effect by converting to IMF format
     * @param {Uint8Array} data - AdLib sound data
     * @param {number} index - Sound index for debugging
     */
    playAdLib(data, index) {
        if (!this.musicPlayer || !this.musicPlayer.backend) {
            console.warn('SoundManager: Music player not ready');
            return;
        }

        // Stop any currently playing music (same as stop button)
        if (this.musicPlayer.isPlaying) {
            console.log('AdLib: Stopping music');
            this.musicPlayer.stop();
            
            // Update UI like the stop button does
            const nameLabel = document.getElementById('music-track-name');
            const playBtn = document.getElementById('music-play-pause');
            if (nameLabel) nameLabel.textContent = "Stopped";
            if (playBtn) playBtn.textContent = "▶️";
            
            // Auto-hide music controls after 3 seconds (same as stop button)
            // For AdLib, hide even if a sound effect is playing
            setTimeout(() => {
                // Hide if no music is playing OR if only a sound effect is playing
                if (!this.musicPlayer.isPlaying || this.musicPlayer.currentTrackName.startsWith('SFX:')) {
                    const musicControls = document.querySelector('.music-controls');
                    if (musicControls) {
                        musicControls.style.display = 'none';
                    }
                }
            }, 3000);
        }

        // Convert to IMF format
        const imfData = this.convertSFXtoIMF(data);
        
        console.log(`Playing AdLib sound ${index} as IMF`);
        console.log(`IMF data preview (first 32 bytes):`, 
            Array.from(imfData.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // Play using the music player
        try {
            this.musicPlayer.playImf(imfData.buffer, `SFX: Sound ${index}`);
            
            // Stop after 3 seconds (max duration for any DN2 sound effect)
            setTimeout(() => {
                if (this.musicPlayer.currentTrackName === `SFX: Sound ${index}`) {
                    console.log(`AdLib sound ${index} auto-stop after 3s`);
                    this.musicPlayer.stop();
                }
            }, 3000);
            
        } catch (error) {
            console.error('Failed to play AdLib sound:', error);
        }
    }

    /**
     * Convert Duke 2 AdLib SFX format to IMF format
     * Based on Rigel Engine's renderAdlibSound function
     * Format:
     * - Bytes 0-3: Length (uint32 LE)
     * - Bytes 4-5: Priority (uint16 LE) 
     * - Bytes 6-21: 16 instrument settings
     * - Byte 22: Octave
     * - Bytes 23+: Note data (each byte is a frequency value)
     * @param {Uint8Array} data - AdLib SFX data
     * @returns {Uint8Array} IMF-formatted data (without size header - MusicPlayer adds it)
     */
    convertSFXtoIMF(data) {
        const commands = [];
        
        // Parse header
        const length = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
        const instrumentSettings = data.slice(6, 22); // 16 bytes
        const octave = data[22];
        
        console.log(`AdLib Sound: length=${length}, octave=${octave}`);
        
        // Configure instrument (Channel 0, Operators 0 and 3)
        // Operator 0 (Modulator)
        commands.push(0x20, instrumentSettings[0], 0, 0); // AM/VIB/EG/KSR/Multiple
        commands.push(0x40, instrumentSettings[2], 0, 0); // KSL/Output Level
        commands.push(0x60, instrumentSettings[4], 0, 0); // Attack/Decay
        commands.push(0x80, instrumentSettings[6], 0, 0); // Sustain/Release
        commands.push(0xE0, instrumentSettings[8], 0, 0); // Waveform
        
        // Operator 3 (Carrier)
        commands.push(0x23, instrumentSettings[1], 0, 0);
        commands.push(0x43, instrumentSettings[3], 0, 0);
        commands.push(0x63, instrumentSettings[5], 0, 0);
        commands.push(0x83, instrumentSettings[7], 0, 0);
        commands.push(0xE3, instrumentSettings[9], 0, 0);
        
        // Feedback/Algorithm
        commands.push(0xC0, 0x00, 0, 0);
        
        // Initial key off
        commands.push(0xB0, 0x00, 0, 0);
        
        // Octave bits: (octave & 7) << 2
        const octaveBits = (octave & 7) << 2;
        
        // AdLib sounds play at 140Hz, IMF at 280Hz
        // So each note gets 2 IMF ticks (280/140 = 2)
        const TICKS_PER_NOTE = 2;
        
        // Process note data
        const noteData = data.slice(23, 23 + length);
        console.log(`Processing ${noteData.length} notes`);
        
        for (let i = 0; i < noteData.length; i++) {
            const note = noteData[i];
            
            if (note === 0) {
                // Silence: Key off
                commands.push(0xB0, 0x00, TICKS_PER_NOTE, 0);
            } else {
                // Play note: Write frequency to 0xA0, then key-on to 0xB0
                commands.push(0xA0, note, 0, 0);
                commands.push(0xB0, 0x20 | octaveBits, TICKS_PER_NOTE, 0);
            }
        }
        
        // Final key off
        commands.push(0xB0, 0x00, 0, 0);
        
        // Add a very long delay to prevent looping
        // The 3-second timeout will stop playback before this matters
        commands.push(0x00, 0x00, 0xFF, 0xFF);
        
        // Return raw IMF commands (NO size header - MusicPlayer._patchDukeIMF adds it)
        const imfBuffer = new Uint8Array(commands);

        console.log(`Converted to IMF: ${commands.length / 4} commands, ${imfBuffer.length} bytes`);
        return imfBuffer;
    }
}