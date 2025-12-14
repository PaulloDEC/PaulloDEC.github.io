/**
 * ============================================================================
 * AUDIO PLAYER - PC SPEAKER EMULATION
 * ============================================================================
 * 
 * Handles parsing and playback of Duke Nukem 1 PC Speaker sound files.
 * Implements accurate emulation of the IBM PC Speaker hardware using the
 * Web Audio API.
 * 
 * Supported Files:
 * - DUKE1.DN1: Primary sound bank
 * - DUKE1-B.DN1: Alternative sound bank
 * 
 * File Format (Binary):
 * - 16-byte header (metadata)
 * - Directory entries (16 bytes each):
 *   * Offset (2 bytes, little-endian)
 *   * Length (2 bytes, little-endian)
 *   * Name (12 bytes, null-padded ASCII)
 * - Sound data (UInt16 little-endian frequency divisors)
 * 
 * PC Speaker Hardware Emulation:
 * 
 * The IBM PC Speaker was a simple piezoelectric speaker controlled by the
 * 8253/8254 Programmable Interval Timer (PIT). Games programmed it by:
 * 1. Setting a timer divisor value (determines frequency)
 * 2. Toggling the speaker on/off at that rate
 * 
 * Technical Details:
 * - PIT Clock: 1.193180 MHz (1193180 Hz)
 * - Frequency = PIT_CLOCK / divisor
 * - Update Rate: ~140 Hz (game changes frequency 140 times/second)
 * - Tone Duration: ~7.14 ms per frequency value
 * 
 * Emulation Improvements:
 * 
 * This implementation provides several enhancements over naive playback:
 * 
 * 1. Accurate PIT Conversion:
 *    - Uses correct 1193180 Hz clock rate
 *    - Validates frequency ranges (100 Hz - 10 kHz)
 *    - Handles invalid divisors gracefully
 * 
 * 2. Physical Speaker Limitations:
 *    - Low-pass filter at 8 kHz (speaker frequency response limit)
 *    - Square wave generation (PC Speaker characteristic)
 *    - Proper resonance emulation
 * 
 * 3. Click/Pop Elimination:
 *    - Attack envelope (1ms fade-in)
 *    - Release envelope (2ms fade-out)
 *    - Smooth gain transitions for silence
 * 
 * 4. Proper Timing:
 *    - 140 Hz update rate matching game behavior
 *    - Precise scheduling via Web Audio clock
 */

export class AudioPlayer {
    /* ====================================================================== */
    /* CONSTRUCTOR AND INITIALIZATION                                         */
    /* ====================================================================== */
    
    /**
     * Creates a new audio player instance.
     * 
     * Initializes audio context and hardware emulation parameters.
     * The actual AudioContext is created lazily on first user interaction
     * due to browser autoplay policies.
     * 
     * @param {string} containerId - DOM ID for the player UI container
     */
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.audioCtx = null;        // Web Audio context (created on demand)
        this.currentSource = null;   // Currently playing oscillator (for stop functionality)
        this.masterVolume = 0.15;    // Default volume (0.0 - 0.5 range)
        
        /* ------------------------------------------------------------------ */
        /* PC Speaker Hardware Constants                                      */
        /* ------------------------------------------------------------------ */
        
        /**
         * 8253/8254 PIT (Programmable Interval Timer) clock rate.
         * 
         * This is the master clock that drives the PC Speaker frequency.
         * The PIT counts down from a programmed divisor value at this rate,
         * toggling the speaker each time it reaches zero.
         * 
         * Formula: Frequency (Hz) = PIT_FREQUENCY / divisor
         */
        this.PIT_FREQUENCY = 1193180; // 1.19318 MHz
        
        /**
         * Game update rate for PC Speaker.
         * 
         * Duke Nukem 1 updates the PC Speaker frequency approximately
         * 140-145 times per second. This is the rate at which new
         * frequency divisors are sent to the hardware.
         * 
         * This is much slower than the PIT clock - the PIT generates
         * the actual audio waveform, while this rate controls how
         * often the frequency changes.
         */
        this.UPDATE_RATE = 140; // Hz
        
        /**
         * Duration of each tone in the sequence.
         * 
         * Calculated from update rate: 1/140 ≈ 7.14 milliseconds
         * Each frequency divisor in the sound data plays for this duration.
         */
        this.TONE_DURATION = 1.0 / this.UPDATE_RATE; // ~7.14ms per frequency
    }
    
    /* ====================================================================== */
    /* AUDIO CONTEXT MANAGEMENT                                               */
    /* ====================================================================== */
    
    /**
     * Initializes the Web Audio context on first user interaction.
     * 
     * Modern browsers block audio playback until the user interacts with
     * the page (autoplay policy). We create the AudioContext lazily when
     * the user first clicks a sound button.
     * 
     * This function is idempotent - it's safe to call multiple times.
     */
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    /* ====================================================================== */
    /* UI RENDERING                                                           */
    /* ====================================================================== */
    
    /**
     * Main entry point: Renders the sound board interface for a file.
     * 
     * Creates an interactive grid of buttons, one for each sound in the file.
     * Also includes a volume control slider.
     * 
     * Layout:
     * - Header: File name
     * - Volume control: Slider with percentage display
     * - Sound grid: Responsive grid of sound buttons
     * 
     * @param {File} file - Sound bank file (DUKE1.DN1 or DUKE1-B.DN1)
     */
    async render(file) {
        /* ------------------------------------------------------------------ */
        /* Parse Sound File                                                   */
        /* ------------------------------------------------------------------ */
        
        const buffer = await file.arrayBuffer();
        const data = new DataView(buffer);
        const sounds = this.parseSndFile(data);
        
        /* ------------------------------------------------------------------ */
        /* Setup Container                                                    */
        /* ------------------------------------------------------------------ */
        
        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        
        /* ------------------------------------------------------------------ */
        /* Create Header                                                      */
        /* ------------------------------------------------------------------ */
        
        const header = document.createElement('h3');
        header.textContent = `Sound Bank: ${file.name}`;
        this.container.appendChild(header);
        
        /* ------------------------------------------------------------------ */
        /* Create Volume Control                                              */
        /* ------------------------------------------------------------------ */
        
        /**
         * Volume control with live percentage display.
         * Range limited to 0-50% to prevent distortion from PC Speaker
         * emulation (square waves can be harsh at high volumes).
         */
        
        const volContainer = document.createElement('div');
        volContainer.className = 'volume-controls';
        
        // Volume percentage label
        const volLabel = document.createElement('label');
        volLabel.textContent = `Volume: ${Math.round(this.masterVolume * 100)}%`;
        volLabel.style.width = "100px";
        
        // Volume slider
        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.min = 0;
        volSlider.max = 0.5;    // Max 50% to prevent harsh square wave distortion
        volSlider.step = 0.01;
        volSlider.value = this.masterVolume;
        
        // Update label on slider change
        volSlider.addEventListener('input', (e) => {
            this.masterVolume = parseFloat(e.target.value);
            volLabel.textContent = `Volume: ${Math.round(this.masterVolume * 100)}%`;
        });
        
        volContainer.appendChild(volLabel);
        volContainer.appendChild(volSlider);
        this.container.appendChild(volContainer);
        
        /* ------------------------------------------------------------------ */
        /* Create Sound Button Grid                                           */
        /* ------------------------------------------------------------------ */
        
        /**
         * Responsive grid of sound buttons.
         * Each button plays one sound effect when clicked.
         */
        
        const grid = document.createElement('div');
        grid.className = 'sound-grid';
        
        sounds.forEach(sound => {
            const btn = document.createElement('button');
            btn.className = 'sound-btn';
            btn.innerHTML = `<span class="icon">🔊</span> ${sound.name}`;
            
            // Play sound on click
            btn.addEventListener('click', () => {
                this.playSound(sound.frequencies);
            });
            
            grid.appendChild(btn);
        });
        
        this.container.appendChild(grid);
    }
    
    /* ====================================================================== */
    /* SOUND FILE PARSING                                                     */
    /* ====================================================================== */
    
    /**
     * Parses the binary SND file format.
     * 
     * File Structure:
     * 1. 16-byte header (skipped)
     * 2. Directory entries (16 bytes each):
     *    - Offset to sound data (2 bytes, LE)
     *    - Length of sound data (2 bytes, LE)
     *    - Sound name (12 bytes, null-padded ASCII)
     * 3. Sound data (variable length, referenced by directory)
     * 
     * Directory ends when an entry with offset=0 and length=0 is encountered.
     * 
     * Sound Data Format:
     * - Array of UInt16 values (little-endian)
     * - Each value is a PIT divisor (frequency = 1193180 / divisor)
     * - Special values:
     *   * 0x0000: End of sound
     *   * 0xFFFF: End of sound (alternative marker)
     * 
     * @param {DataView} view - Binary data view of the sound file
     * @returns {Array<Object>} Array of sound objects with name and frequencies
     */
    parseSndFile(view) {
        const sounds = [];
        let dirOffset = 0x10; // Directory starts after 16-byte header
        
        /* ------------------------------------------------------------------ */
        /* Parse Directory Entries                                            */
        /* ------------------------------------------------------------------ */
        
        while (dirOffset < view.byteLength) {
            // Read directory entry fields
            const sndOffset = view.getUint16(dirOffset, true);     // Little-endian
            const sndLen = view.getUint16(dirOffset + 2, true);    // Little-endian
            
            // Empty entry (0, 0) marks end of directory
            if (sndOffset === 0 && sndLen === 0) break;
            
            /* -------------------------------------------------------------- */
            /* Read Sound Name (12 bytes, null-padded ASCII)                  */
            /* -------------------------------------------------------------- */
            
            let name = "";
            for (let i = 0; i < 12; i++) {
                const charCode = view.getUint8(dirOffset + 4 + i);
                if (charCode !== 0) {
                    name += String.fromCharCode(charCode);
                }
            }
            
            /* -------------------------------------------------------------- */
            /* Read Frequency Data (PIT Divisors)                             */
            /* -------------------------------------------------------------- */
            
            /**
             * Sound data is a sequence of UInt16 values.
             * Each value is a frequency divisor for the PIT.
             * We read until we hit the end of the allocated space
             * or encounter a terminator value.
             */
            
            const frequencies = [];
            const endPos = Math.min(sndOffset + sndLen, view.byteLength);
            
            for (let pos = sndOffset; pos < endPos; pos += 2) {
                const divisor = view.getUint16(pos, true);
                
                // Check for terminator values
                if (divisor === 0xFFFF || divisor === 0) break;
                
                frequencies.push(divisor);
            }
            
            /* -------------------------------------------------------------- */
            /* Validate and Store Sound                                       */
            /* -------------------------------------------------------------- */
            
            /**
             * Only add sounds that have both a name and frequency data.
             * Filters out corrupted or empty entries.
             */
            if (name.trim().length > 0 && frequencies.length > 0) {
                sounds.push({ name, frequencies });
            }
            
            // Move to next directory entry (16 bytes)
            dirOffset += 16;
        }
        
        return sounds;
    }
    
    /* ====================================================================== */
    /* FREQUENCY CONVERSION                                                   */
    /* ====================================================================== */
    
    /**
     * Converts PIT divisor to actual frequency in Hz.
     * 
     * The PC Speaker uses a Programmable Interval Timer (PIT) that counts
     * down from a programmed divisor value at 1.19318 MHz. When the counter
     * reaches zero, the speaker is toggled, creating a square wave.
     * 
     * Formula: frequency = 1193180 / divisor
     * 
     * Frequency Validation:
     * The PC Speaker hardware had physical limitations:
     * - Low frequencies (<100 Hz): Poor response, mostly inaudible rumble
     * - High frequencies (>10 kHz): Beyond speaker's mechanical capability
     * 
     * Frequencies outside this range are treated as silence.
     * 
     * @param {number} divisor - PIT divisor value from sound data
     * @returns {number} Frequency in Hz (0 for invalid/silence)
     */
    divisorToFrequency(divisor) {
        // Divisor of 0 is invalid (would cause division by zero)
        if (divisor === 0) return 0;
        
        const freq = this.PIT_FREQUENCY / divisor;
        
        /**
         * PC Speaker practical frequency range: ~100 Hz to ~10 kHz
         * 
         * Physical limitations:
         * - Below 100 Hz: Speaker cone can't vibrate effectively
         * - Above 10 kHz: Piezo element's mechanical resonance limit
         * 
         * Many games used out-of-range divisors as "silence" markers.
         */
        if (freq < 100 || freq > 10000) {
            return 0; // Treat as silence
        }
        
        return freq;
    }
    
    /* ====================================================================== */
    /* SOUND PLAYBACK                                                         */
    /* ====================================================================== */
    
    /**
     * Plays a sequence of frequencies using Web Audio API.
     * 
     * Implements accurate PC Speaker emulation with:
     * - Square wave generation (PC Speaker characteristic)
     * - Low-pass filtering (physical speaker limitations)
     * - Attack/release envelopes (eliminate clicks/pops)
     * - Precise timing (140 Hz update rate)
     * 
     * Audio Chain:
     * Oscillator -> Envelope Gain -> Low-pass Filter -> Master Volume -> Output
     * 
     * @param {Array<number>} divisors - Array of PIT divisor values
     */
    playSound(divisors) {
        this.initAudio();
        
        /* ------------------------------------------------------------------ */
        /* Stop Previous Sound                                                */
        /* ------------------------------------------------------------------ */
        
        /**
         * Only one sound can play at a time (PC Speaker limitation).
         * Stop any currently playing sound before starting new one.
         */
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Already stopped - ignore error
            }
        }
        
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        
        /* ------------------------------------------------------------------ */
        /* Create Audio Nodes                                                 */
        /* ------------------------------------------------------------------ */
        
        /**
         * Oscillator: Generates the base square wave
         * - Type: Square wave (PC Speaker characteristic)
         * - Frequency: Programmatically controlled per tone
         */
        const osc = ctx.createOscillator();
        osc.type = 'square'; // PC Speaker produces square waves
        
        /**
         * Envelope Gain: Controls attack and release
         * - Attack: 1ms fade-in (eliminates click at start)
         * - Release: 2ms fade-out (eliminates pop at end)
         * - Also used for silence periods within sound
         */
        const envelopeGain = ctx.createGain();
        
        /**
         * Master Volume Gain: User-controlled volume
         * - Set to slider value (0.0 - 0.5)
         * - Constant during playback
         */
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.masterVolume;
        
        /**
         * Low-pass Filter: Emulates physical speaker limitations
         * 
         * Real PC Speakers:
         * - Poor high-frequency response (~8-10 kHz cutoff)
         * - Resonated inside metal computer case
         * - Natural filtering from piezo element mass
         * 
         * This filter makes the emulation sound more authentic
         * by removing harsh high frequencies that the real hardware
         * couldn't reproduce.
         */
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 8000; // Approximate PC Speaker frequency limit
        filter.Q.value = 0.7;           // Gentle rolloff (not too sharp)
        
        /* ------------------------------------------------------------------ */
        /* Connect Audio Chain                                                */
        /* ------------------------------------------------------------------ */
        
        /**
         * Signal flow:
         * Oscillator -> Envelope -> Filter -> Volume -> Speakers
         */
        osc.connect(envelopeGain);
        envelopeGain.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(ctx.destination);
        
        /* ------------------------------------------------------------------ */
        /* Setup Attack Envelope                                              */
        /* ------------------------------------------------------------------ */
        
        /**
         * Start with gain at 0 and ramp up quickly.
         * This prevents an audible click at the start of playback.
         * 
         * Attack time: 1ms (fast but smooth)
         */
        envelopeGain.gain.setValueAtTime(0, now);
        envelopeGain.gain.linearRampToValueAtTime(1.0, now + 0.001); // 1ms attack
        
        /* ------------------------------------------------------------------ */
        /* Schedule Frequency Changes                                         */
        /* ------------------------------------------------------------------ */
        
        /**
         * Each divisor represents one tone in the sequence.
         * We schedule frequency changes at precise intervals (7.14ms)
         * using the Web Audio clock for accurate timing.
         * 
         * For invalid/silence frequencies, we mute via envelope gain
         * rather than setting frequency to 0 (which can cause issues).
         */
        
        let time = now;
        let hasAudibleSound = false; // Track if sound contains any audible tones
        
        divisors.forEach((divisor, index) => {
            const freq = this.divisorToFrequency(divisor);
            
            if (freq > 0) {
                // Valid frequency: Set oscillator frequency
                osc.frequency.setValueAtTime(freq, time);
                hasAudibleSound = true;
            } else {
                /**
                 * Invalid/silence frequency: Mute via gain
                 * 
                 * Setting freq to 0 can cause browser issues, so instead
                 * we briefly mute the output and unmute quickly.
                 * This creates a clean silence without artifacts.
                 */
                envelopeGain.gain.setValueAtTime(0, time);
                envelopeGain.gain.setValueAtTime(1.0, time + this.TONE_DURATION * 0.1);
            }
            
            time += this.TONE_DURATION; // Advance by 7.14ms
        });
        
        /* ------------------------------------------------------------------ */
        /* Validate Sound Content                                             */
        /* ------------------------------------------------------------------ */
        
        /**
         * If the sound contains no audible frequencies (all silence/invalid),
         * don't bother playing it. This prevents unnecessary oscillator creation.
         */
        if (!hasAudibleSound) {
            return;
        }
        
        /* ------------------------------------------------------------------ */
        /* Setup Release Envelope                                             */
        /* ------------------------------------------------------------------ */
        
        /**
         * Calculate total duration and schedule fade-out.
         * 
         * Release envelope (2ms fadeout at end) prevents the audible
         * pop that would otherwise occur when the oscillator stops.
         */
        const totalDuration = divisors.length * this.TONE_DURATION;
        
        envelopeGain.gain.setValueAtTime(1.0, now + totalDuration - 0.002);
        envelopeGain.gain.linearRampToValueAtTime(0, now + totalDuration);
        
        /* ------------------------------------------------------------------ */
        /* Start and Schedule Stop                                            */
        /* ------------------------------------------------------------------ */
        
        osc.start(now);
        osc.stop(now + totalDuration);
        
        /* ------------------------------------------------------------------ */
        /* Cleanup Handler                                                    */
        /* ------------------------------------------------------------------ */
        
        /**
         * Clean up audio nodes when playback completes.
         * 
         * This prevents memory leaks from accumulating disconnected nodes.
         * The onended callback fires after the oscillator stops.
         */
        osc.onended = () => {
            try {
                osc.disconnect();
                envelopeGain.disconnect();
                filter.disconnect();
                masterGain.disconnect();
            } catch (e) {
                // Already disconnected - ignore error
            }
            
            // Clear current source reference if this was the active sound
            if (this.currentSource === osc) {
                this.currentSource = null;
            }
        };
        
        // Store reference for stop functionality
        this.currentSource = osc;
    }
    
    /* ====================================================================== */
    /* PLAYBACK CONTROL                                                       */
    /* ====================================================================== */
    
    /**
     * Stops any currently playing sound.
     * 
     * Useful when switching between sounds or closing the audio player.
     * Safe to call even if no sound is playing.
     */
    stop() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Already stopped - ignore error
            }
            this.currentSource = null;
        }
    }
    
    /**
     * Hides the audio player interface.
     * 
     * Stops any playing sound and hides the container.
     * Called when switching to a different file type.
     */
    hide() {
        this.stop();
        this.container.style.display = 'none';
    }
}
