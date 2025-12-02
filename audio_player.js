/**
 * Audio Player - Improved PC Speaker Emulation
 * Handles parsing and playback of Duke Nukem 1 PC Speaker sound files.
 * (DUKE1.DN1 and DUKE1-B.DN1)
 * 
 * Format: 
 * - 16-byte Header
 * - Directory of Sound Entries (Offset, Length, Name)
 * - Raw Frequency Data (UInt16 LE)
 * 
 * IMPROVEMENTS:
 * - Correct PIT divisor to Hz conversion (1193180 / divisor)
 * - Accurate 140Hz update rate (7.14ms per tone)
 * - Low-pass filtering to emulate physical speaker limitations
 * - Proper envelope to eliminate clicks/pops
 * - Better handling of invalid/silence frequencies
 */

export class AudioPlayer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.audioCtx = null;
        this.currentSource = null;
        this.masterVolume = 0.15; // Slightly higher default, we're adding filtering
        
        // PC Speaker hardware constants
        this.PIT_FREQUENCY = 1193180; // 8253/8254 PIT clock rate in Hz
        this.UPDATE_RATE = 140; // Duke Nukem updates PC Speaker ~140-145 times/second
        this.TONE_DURATION = 1.0 / this.UPDATE_RATE; // ~7.14ms per frequency change
    }

    /**
     * Initializes AudioContext on user interaction
     * (Browsers block auto-playing audio)
     */
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    /**
     * Main entry point: Renders the sound board for a file
     */
    async render(file) {
        const buffer = await file.arrayBuffer();
        const data = new DataView(buffer);
        const sounds = this.parseSndFile(data);

        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';

        // Header
        const header = document.createElement('h3');
        header.textContent = `Sound Bank: ${file.name}`;
        this.container.appendChild(header);

        // Volume Control
        const volContainer = document.createElement('div');
        volContainer.className = 'volume-controls';
        
        const volLabel = document.createElement('label');
        volLabel.textContent = `Volume: ${Math.round(this.masterVolume * 100)}%`;
        volLabel.style.width = "100px";
        
        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.min = 0;
        volSlider.max = 0.5;
        volSlider.step = 0.01;
        volSlider.value = this.masterVolume;
        
        volSlider.addEventListener('input', (e) => {
            this.masterVolume = parseFloat(e.target.value);
            volLabel.textContent = `Volume: ${Math.round(this.masterVolume * 100)}%`;
        });

        volContainer.appendChild(volLabel);
        volContainer.appendChild(volSlider);
        this.container.appendChild(volContainer);

        // Sound Grid
        const grid = document.createElement('div');
        grid.className = 'sound-grid';

        sounds.forEach(sound => {
            const btn = document.createElement('button');
            btn.className = 'sound-btn';
            btn.textContent = sound.name;
            btn.innerHTML = `<span class="icon">🔊</span> ${sound.name}`;
            
            btn.addEventListener('click', () => {
                this.playSound(sound.frequencies);
            });

            grid.appendChild(btn);
        });

        this.container.appendChild(grid);
    }

    /**
     * Parses the binary SND format
     */
    parseSndFile(view) {
        const sounds = [];
        let dirOffset = 0x10; // Directory starts after 16-byte header

        while (dirOffset < view.byteLength) {
            const sndOffset = view.getUint16(dirOffset, true);
            const sndLen = view.getUint16(dirOffset + 2, true);

            // Empty entry marks end of directory
            if (sndOffset === 0 && sndLen === 0) break;

            // Read Name (12 bytes, null-padded ASCII)
            let name = "";
            for (let i = 0; i < 12; i++) {
                const charCode = view.getUint8(dirOffset + 4 + i);
                if (charCode !== 0) name += String.fromCharCode(charCode);
            }

            // Read Frequency Data (as PIT divisors)
            const frequencies = [];
            const endPos = Math.min(sndOffset + sndLen, view.byteLength);
            
            for (let pos = sndOffset; pos < endPos; pos += 2) {
                const divisor = view.getUint16(pos, true);
                
                // Skip end-of-stream markers
                if (divisor === 0xFFFF || divisor === 0) break;
                
                frequencies.push(divisor);
            }

            if (name.trim().length > 0 && frequencies.length > 0) {
                sounds.push({ name, frequencies });
            }

            dirOffset += 16;
        }

        return sounds;
    }

    /**
     * Converts PIT divisor to actual frequency in Hz
     * The PC Speaker uses a PIT (Programmable Interval Timer) that counts down
     * from the divisor value at 1.19318 MHz
     */
    divisorToFrequency(divisor) {
        if (divisor === 0) return 0;
        const freq = this.PIT_FREQUENCY / divisor;
        
        // PC Speaker practical range: ~100 Hz to ~10 kHz
        // (Hardware couldn't reproduce frequencies outside this well)
        if (freq < 100 || freq > 10000) {
            return 0; // Treat as silence
        }
        
        return freq;
    }

    /**
     * Plays the sequence of frequencies using Web Audio API with improved emulation
     */
    playSound(divisors) {
        this.initAudio();
        
        // Stop previous sound if playing
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Already stopped
            }
        }

        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        
        // Create oscillator
        const osc = ctx.createOscillator();
        osc.type = 'square'; // PC Speaker produces square waves
        
        // Create gain nodes for envelope and volume
        const envelopeGain = ctx.createGain();
        const masterGain = ctx.createGain();
        masterGain.gain.value = this.masterVolume;
        
        // Create low-pass filter to emulate physical speaker limitations
        // Real PC Speakers had poor high-frequency response (~8-10 kHz cutoff)
        // and resonated inside the metal case, acting as a natural low-pass filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 8000; // Approximate PC Speaker frequency response limit
        filter.Q.value = 0.7; // Gentle rolloff, not too sharp
        
        // Audio chain: Oscillator -> Envelope -> Filter -> Master Volume -> Output
        osc.connect(envelopeGain);
        envelopeGain.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(ctx.destination);

        // Start with envelope at 0 to prevent initial click
        envelopeGain.gain.setValueAtTime(0, now);
        envelopeGain.gain.linearRampToValueAtTime(1.0, now + 0.001); // 1ms attack

        // Schedule frequency changes
        let time = now;
        let hasAudibleSound = false;
        
        divisors.forEach((divisor, index) => {
            const freq = this.divisorToFrequency(divisor);
            
            if (freq > 0) {
                osc.frequency.setValueAtTime(freq, time);
                hasAudibleSound = true;
            } else {
                // For silence/invalid frequencies, mute via gain instead of setting freq to 0
                // (Setting freq to 0 can cause issues with some browsers)
                envelopeGain.gain.setValueAtTime(0, time);
                envelopeGain.gain.setValueAtTime(1.0, time + this.TONE_DURATION * 0.1);
            }
            
            time += this.TONE_DURATION;
        });

        // Only play if we have audible content
        if (!hasAudibleSound) {
            return;
        }

        const totalDuration = divisors.length * this.TONE_DURATION;
        
        // Envelope release to prevent click at end (2ms fadeout)
        envelopeGain.gain.setValueAtTime(1.0, now + totalDuration - 0.002);
        envelopeGain.gain.linearRampToValueAtTime(0, now + totalDuration);
        
        // Start and stop oscillator
        osc.start(now);
        osc.stop(now + totalDuration);
        
        // Cleanup
        osc.onended = () => {
            try {
                osc.disconnect();
                envelopeGain.disconnect();
                filter.disconnect();
                masterGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
            if (this.currentSource === osc) {
                this.currentSource = null;
            }
        };

        this.currentSource = osc;
    }

    /**
     * Stops any currently playing sound
     */
    stop() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Already stopped
            }
            this.currentSource = null;
        }
    }

    hide() {
        this.stop();
        this.container.style.display = 'none';
    }
}