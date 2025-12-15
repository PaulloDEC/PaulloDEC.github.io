import createDukeBackend from './lib/libadlmidi.js';

export class MusicPlayer {
    constructor() {
        this.audioCtx = null;
        this.backend = null;
        this.player = null;
        this.scriptNode = null;
        this.gainNode = null; // NEW: Volume control
        
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTrackName = "";

        this.initPromise = this._init();
    }

    async _init() {
        try {
            const wasmConfig = {
                locateFile: (path) => path.endsWith('.wasm') ? 'lib/' + path : path
            };
            this.backend = await createDukeBackend(wasmConfig);
            console.log("☢️ Duke Nukem II Audio Engine Ready.");
        } catch (err) {
            console.error("Failed to initialize OPL3 engine:", err);
        }
    }

    /* Updated to accept a track name for display purposes */
    async playImf(imfBuffer, trackName = "Unknown Track") {
        if (!this.backend) await this.initPromise;
        this.stop();

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                await this.audioCtx.resume();
            }

            this.player = new this.backend.DukePlayer(this.audioCtx.sampleRate);
            this.currentTrackName = trackName;

            // Load Data
            const patchedData = this._patchDukeIMF(imfBuffer);
            if (this.player.loadData(patchedData) < 0) {
                throw new Error("Engine refused IMF data.");
            }

            // --- AUDIO GRAPH SETUP ---
            const bufferSize = 4096;
            this.scriptNode = this.audioCtx.createScriptProcessor(bufferSize, 0, 2);
            
            // NEW: Create Gain Node for Volume
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 1.0; // Default max volume

            // Connect: Script -> Gain -> Speakers
            this.scriptNode.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);

            this.scriptNode.onaudioprocess = (e) => {
                const outputL = e.outputBuffer.getChannelData(0);
                const outputR = e.outputBuffer.getChannelData(1);
                const samples = this.player.getSamples(bufferSize);

                for (let i = 0; i < bufferSize; i++) {
                    if (i * 2 + 1 < samples.length) {
                        outputL[i] = samples[i * 2];
                        outputR[i] = samples[i * 2 + 1];
                    } else {
                        outputL[i] = 0;
                        outputR[i] = 0;
                    }
                }
            };

            this.isPlaying = true;
            this.isPaused = false;
            console.log(`▶️ Playing: ${trackName}`);
			logMessage(`▶️ Playing: ${trackName}`, 'success');

        } catch (err) {
            console.error("Playback error:", err);
            this.stop();
        }
    }

    stop() {
    if (this.scriptNode) {
        this.scriptNode.disconnect();
        this.scriptNode = null;
    }
    if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
    }
    if (this.player) {
        this.player.delete();
        this.player = null;
    }
    
    // Only log if something was actually playing
    if (this.isPlaying && this.currentTrackName) {
        logMessage(`⏹️ Stopped: ${this.currentTrackName}`, 'info');
    }
    
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTrackName = "";
}

    // --- NEW CONTROL METHODS ---

    togglePause() {
    if (!this.audioCtx) return;

    if (this.isPaused) {
        this.audioCtx.resume();
        this.isPaused = false;
        logMessage(`▶️ Resumed: ${this.currentTrackName}`, 'info');
    } else {
        this.audioCtx.suspend();
        this.isPaused = true;
        logMessage(`⏸️ Paused: ${this.currentTrackName}`, 'info');
    }
    return this.isPaused;
}

    setVolume(value) {
        // Value between 0.0 and 1.0
        if (this.gainNode) {
            // Clamp value between 0 and 1
            const safeValue = Math.max(0, Math.min(1, value));
            this.gainNode.gain.value = safeValue;
        }
    }

    _patchDukeIMF(buffer) {
        const data = new Uint8Array(buffer);
        const commands = [];
        commands.push(0x01, 0x20, 0x00, 0x00); // Waveform Enable

        let ptr = 0;
        while (ptr < data.length - 3) {
            let reg = data[ptr];
            let val = data[ptr+1];
            let delay = data[ptr+2] | (data[ptr+3] << 8);
            commands.push(reg, val, delay & 0xFF, (delay >> 8) & 0xFF);
            ptr += 4;
        }
        
        const size = commands.length;
        commands.unshift(size & 0xFF, (size >> 8) & 0xFF);
        return new Uint8Array(commands);
    }
}