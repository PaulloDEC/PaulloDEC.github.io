class ADLMIDIProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.player = null;
        
        this.port.onmessage = (e) => {
            if (e.data.type === 'init') {
                // Receive the player instance from main thread
                this.player = e.data.player;
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        if (!this.player) return true;
        
        const output = outputs[0];
        const bufferSize = output[0].length; // Typically 128 samples
        const samples = this.player.getSamples(bufferSize);
        
        // Fill left and right channels
        for (let i = 0; i < bufferSize; i++) {
            output[0][i] = samples[i * 2];     // Left
            output[1][i] = samples[i * 2 + 1]; // Right
        }
        
        return true; // Keep processor alive
    }
}

registerProcessor('adlmidi-processor', ADLMIDIProcessor);