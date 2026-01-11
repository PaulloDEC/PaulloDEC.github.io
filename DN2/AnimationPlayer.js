/**
 * ============================================================================
 * ANIMATION PLAYER - Duke Nukem II
 * ============================================================================
 * 
 * Handles playback of Duke Nukem II intro animation files (.F1-.F5).
 * These files use a chunked, RLE-compressed format with delta frames.
 * 
 * Features:
 * - RLE decompression for main image and animation frames
 * - Delta frame compositing (frames apply changes on top of base image)
 * - Playback controls (play/pause, step forward/back, first/last)
 * - Adjustable playback speed (1-30 FPS)
 * - Zoom support (1x-4x)
 * - Floating control panel UI
 * 
 * File Format:
 * - Header with dimensions and frame count
 * - Main image chunk (base frame, RLE compressed)
 * - Animation frame chunks (deltas, RLE compressed)
 * - Each frame has Y offset and partial height (only changed rows)
 */

export class AnimationPlayer {
    constructor() {
        this.animationData = null;
        this.currentFrame = -1; // -1 = base image, 0+ = animation frames
        this.isPlaying = false;
        this.playbackInterval = null;
        this.fps = 10;
        this.zoom = 1;
        
        // UI elements will be created dynamically
        this.controlPanel = null;
    }
    
    /* ====================================================================== */
    /* FILE LOADING AND PARSING                                               */
    /* ====================================================================== */
    
    /**
     * Load and parse an animation file.
     * 
     * @param {File} file - Animation file (.F1-.F5)
     * @returns {Promise<Object>} Parsed animation data
     */
    async load(file) {
        const buffer = await file.arrayBuffer();
        this.animationData = this.parseAnimation(buffer);
        this.currentFrame = -1; // Start with base image
        return this.animationData;
    }
    
    /**
     * Parse animation file format.
     * 
     * Structure:
     * - 128 byte header
     * - Main image chunk (palette + RLE compressed base frame)
     * - Animation frame chunks (RLE compressed deltas)
     */
    parseAnimation(buffer) {
        const data = new Uint8Array(buffer);
        const view = new DataView(buffer);
        
        let offset = 0;
        
        // Read header (128 bytes)
        const fileSize = view.getUint32(offset, true); offset += 4;
        const typeMarker = view.getUint16(offset, true); offset += 2;
        const numFrames = view.getUint16(offset, true); offset += 2;
        const width = view.getUint16(offset, true); offset += 2;
        const height = view.getUint16(offset, true); offset += 2;
        
        if (typeMarker !== 0xAF11) {
            throw new Error('Invalid animation file type marker');
        }
        
        offset = 128; // Skip to end of header
        
        // Read main image chunk header
        const mainChunkSize = view.getUint32(offset, true); offset += 4;
        const mainChunkType = view.getUint16(offset, true); offset += 2;
        const mainNumSubChunks = view.getUint16(offset, true); offset += 2;
        offset += 8; // Skip unknown bytes
        
        if (mainChunkType !== 0xF1FA || mainNumSubChunks !== 2) {
            throw new Error('Invalid main chunk');
        }
        
        // Read palette sub-chunk
        const paletteSize = view.getUint32(offset, true); offset += 4;
        const paletteType = view.getUint16(offset, true); offset += 2;
        
        if (paletteType !== 0x0B || paletteSize !== 778) {
            throw new Error('Invalid palette chunk');
        }
        
        offset += 4; // Skip padding
        
        // Parse 6-bit VGA palette
        const palette = [];
        for (let i = 0; i < 256; i++) {
            const r = Math.floor((data[offset++] * 255) / 63);
            const g = Math.floor((data[offset++] * 255) / 63);
            const b = Math.floor((data[offset++] * 255) / 63);
            palette.push([r, g, b]);
        }
        
        // Read main image sub-chunk header
        const mainImageStartOffset = offset;
        const mainImageSize = view.getUint32(offset, true); offset += 4;
        const mainImageType = view.getUint16(offset, true); offset += 2;
        
        if (mainImageType !== 0x0F) {
            throw new Error('Invalid main image chunk');
        }
        
        // Decompress main image (RLE compressed row by row)
        const mainImagePixels = [];
        for (let row = 0; row < height; row++) {
            const numRleFlags = data[offset++];
            
            for (let flag = 0; flag < numRleFlags; flag++) {
                const marker = view.getInt8(offset++);
                offset = this.expandRleWord(marker, data, offset, (colorIndex) => {
                    mainImagePixels.push(colorIndex);
                });
            }
        }
        
        // Skip to end of main image subchunk
        offset = mainImageStartOffset + mainImageSize;
        
        // Read animation frames
        const frames = [];
        for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
            // Frame chunk header
            const frameChunkSize = view.getUint32(offset, true); offset += 4;
            const frameChunkType = view.getUint16(offset, true); offset += 2;
            const frameNumSubChunks = view.getUint16(offset, true); offset += 2;
            offset += 8; // Skip unknown
            
            if (frameChunkType !== 0xF1FA || frameNumSubChunks !== 1) {
                throw new Error(`Invalid frame ${frameIdx} chunk`);
            }
            
            // Frame sub-chunk header
            const frameSubStartOffset = offset;
            const frameSubSize = view.getUint32(offset, true); offset += 4;
            const frameSubType = view.getUint16(offset, true); offset += 2;
            
            if (frameSubType !== 0x0C) {
                throw new Error(`Invalid frame ${frameIdx} sub-chunk`);
            }
            
            const yOffset = view.getUint16(offset, true); offset += 2;
            const numRows = view.getUint16(offset, true); offset += 2;
            
            // Decompress frame delta
            const frameDelta = new Array(width * numRows).fill(null);
            
            for (let row = 0; row < numRows; row++) {
                const startOffset = row * width;
                let targetCol = 0;
                
                const numRleWords = data[offset++];
                
                for (let rleEntry = 0; rleEntry < numRleWords; rleEntry++) {
                    const pixelsToSkip = data[offset++];
                    targetCol += pixelsToSkip;
                    
                    // Inverted marker for animation frames
                    const invertedMarker = view.getInt8(offset++);
                    const actualMarker = -invertedMarker;
                    
                    offset = this.expandRleWord(actualMarker, data, offset, (colorIndex) => {
                        frameDelta[targetCol++ + startOffset] = colorIndex;
                    });
                }
            }
            
            // Skip to end of frame subchunk
            offset = frameSubStartOffset + frameSubSize;
            
            frames.push({ yOffset, numRows, delta: frameDelta });
        }
        
        return { width, height, palette, mainImage: mainImagePixels, frames };
    }
    
    /**
     * RLE decompression helper.
     * 
     * Format:
     * - Positive marker: Repeat next byte N times
     * - Negative marker: Copy next abs(N) bytes literally
     */
    expandRleWord(marker, data, offset, callback) {
        if (marker > 0) {
            // RLE: repeat next byte 'marker' times
            const value = data[offset++];
            for (let i = 0; i < marker; i++) {
                callback(value);
            }
        } else if (marker < 0) {
            // Literal: copy next 'abs(marker)' bytes
            const count = Math.abs(marker);
            for (let i = 0; i < count; i++) {
                callback(data[offset++]);
            }
        }
        return offset;
    }
    
    /* ====================================================================== */
    /* RENDERING                                                              */
    /* ====================================================================== */
    
    /**
     * Render the current frame to a canvas.
     * 
     * @param {HTMLCanvasElement} canvas - Target canvas
     */
    render(canvas) {
        if (!this.animationData) return;
        
        // [FIX] Store canvas reference so destroy() can clean it up later
        this.canvas = canvas; 
        
        const { width, height, palette, mainImage, frames } = this.animationData;
        
        // Set canvas to native size
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        const pixels = imageData.data;
        
        // Start with main image
        for (let i = 0; i < mainImage.length; i++) {
            const colorIndex = mainImage[i];
            const [r, g, b] = palette[colorIndex];
            pixels[i * 4] = r;
            pixels[i * 4 + 1] = g;
            pixels[i * 4 + 2] = b;
            pixels[i * 4 + 3] = 255;
        }
        
        // Apply all frames up to current frame
        for (let f = 0; f <= this.currentFrame && f < frames.length; f++) {
            const frame = frames[f];
            const startRow = frame.yOffset;
            
            for (let row = 0; row < frame.numRows; row++) {
                for (let col = 0; col < width; col++) {
                    const deltaIdx = row * width + col;
                    const colorIndex = frame.delta[deltaIdx];
                    
                    if (colorIndex !== null) {
                        const pixelIdx = ((startRow + row) * width + col) * 4;
                        const [r, g, b] = palette[colorIndex];
                        pixels[pixelIdx] = r;
                        pixels[pixelIdx + 1] = g;
                        pixels[pixelIdx + 2] = b;
                        pixels[pixelIdx + 3] = 255;
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    /* ====================================================================== */
    /* PLAYBACK CONTROLS                                                      */
    /* ====================================================================== */
    
    goToFrame(index) {
        if (!this.animationData) return;
        this.currentFrame = Math.max(-1, Math.min(index, this.animationData.frames.length - 1));
    }
    
    play() {
        if (!this.animationData) return;
        
        if (this.isPlaying) {
            this.pause();
            return;
        }
        
        this.isPlaying = true;
        
        this.playbackInterval = setInterval(() => {
            this.currentFrame++;
            if (this.currentFrame >= this.animationData.frames.length) {
                this.currentFrame = -1; // Loop back to base image
            }
        }, 1000 / this.fps);
    }
    
    pause() {
        this.isPlaying = false;
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
    }
    
    setSpeed(fps) {
        this.fps = fps;
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
    }
    
    setZoom(zoom) {
        this.zoom = zoom;
    }
    
    /* ====================================================================== */
    /* UI GENERATION                                                          */
    /* ====================================================================== */
    
    /**
     * Create the floating control panel.
     * Similar to music player controls.
     * 
     * @returns {HTMLElement} Control panel element
     */
    createControlPanel() {
        const panel = document.createElement('div');
        panel.className = 'animation-controls';
        panel.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(30, 41, 59, 0.95);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 12px 20px;
            display: flex;
            gap: 20px;
            align-items: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(4px);
            z-index: 100;
            font-family: monospace;
            font-size: 14px;
        `;
        
        // Playback buttons
        const playbackGroup = document.createElement('div');
        playbackGroup.style.cssText = 'display: flex; gap: 8px;';
        
        const btnFirst = this.createButton('⏮', 'First Frame');
        const btnPrev = this.createButton('◀', 'Previous Frame');
        const btnPlay = this.createButton('▶', 'Play/Pause');
        btnPlay.id = 'anim-btn-play';
        const btnNext = this.createButton('▶', 'Next Frame');
        const btnLast = this.createButton('⏭', 'Last Frame');
        
        playbackGroup.append(btnFirst, btnPrev, btnPlay, btnNext, btnLast);
        
        // Frame counter
        const frameCounter = document.createElement('div');
        frameCounter.id = 'anim-frame-counter';
        frameCounter.style.cssText = 'color: var(--text-muted); min-width: 80px; text-align: center;';
        frameCounter.textContent = 'Frame 1/1';
        
        // Speed control
        const speedGroup = document.createElement('div');
        speedGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        const speedLabel = document.createElement('label');
        speedLabel.textContent = 'Speed:';
        speedLabel.style.color = 'var(--text-muted)';
        
        const speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.min = '1';
        speedSlider.max = '30';
        speedSlider.value = '10';
        speedSlider.style.width = '120px';
        speedSlider.id = 'anim-speed-slider';
        
        const speedValue = document.createElement('span');
        speedValue.id = 'anim-speed-value';
        speedValue.style.cssText = 'color: var(--accent); min-width: 50px;';
        speedValue.textContent = '10 FPS';
        
        speedGroup.append(speedLabel, speedSlider, speedValue);
        
        // Zoom control
        const zoomGroup = document.createElement('div');
        zoomGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        const zoomLabel = document.createElement('label');
        zoomLabel.textContent = 'Zoom:';
        zoomLabel.style.color = 'var(--text-muted)';
        
        const zoomSelect = document.createElement('select');
        zoomSelect.id = 'anim-zoom-select';
        zoomSelect.style.cssText = `
            background: var(--bg-input);
            color: var(--text-main);
            border: 1px solid var(--border);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
        `;
        
        [1, 2, 3, 4].forEach(z => {
            const opt = document.createElement('option');
            opt.value = z;
            opt.textContent = `${z}x`;
            zoomSelect.appendChild(opt);
        });
        
        zoomGroup.append(zoomLabel, zoomSelect);
        
        // Assemble panel
        panel.append(playbackGroup, frameCounter, speedGroup, zoomGroup);
        
        this.controlPanel = panel;
        return panel;
    }
    
    createButton(text, title) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        btn.style.cssText = `
            background: var(--bg-input);
            color: var(--text-main);
            border: 1px solid var(--border);
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-family: monospace;
            font-size: 14px;
        `;
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--bg-hover)');
        btn.addEventListener('mouseleave', () => btn.style.background = 'var(--bg-input)');
        return btn;
    }
    
    updateFrameCounter() {
        if (!this.animationData) return;
        const counter = document.getElementById('anim-frame-counter');
        if (counter) {
            const totalFrames = this.animationData.frames.length + 1;
            counter.textContent = `Frame ${this.currentFrame + 2}/${totalFrames}`;
        }
    }
    
    updatePlayButton() {
        const btn = document.getElementById('anim-btn-play');
        if (btn) {
            btn.textContent = this.isPlaying ? '⏸' : '▶';
        }
    }
    
    /* ====================================================================== */
    /* CLEANUP                                                                */
    /* ====================================================================== */
    
    destroy() {
        this.pause();
        if (this.controlPanel && this.controlPanel.parentNode) {
            this.controlPanel.parentNode.removeChild(this.controlPanel);
        }
        this.controlPanel = null;
        this.animationData = null;
        
        // [FIX] This block will now execute because we set this.canvas in render()
        // Reset canvas styling
        if (this.canvas) {
            this.canvas.style.width = '';
            this.canvas.style.height = '';
            this.canvas.style.imageRendering = '';
        }
        
        this.canvas = null;
        this.ctx = null;
    }
}