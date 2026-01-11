export class AnimationPlayer {
    constructor() {
        this.animationData = null;
        this.frameIndex = 0;
        this.fps = 10;
        this.timer = 0;
        this.isPlaying = true;
        this.zoom = 2; // Default zoom
        
        this.controlPanel = null;
    }
    
    // --- Data Loading ---
    load(data) {
        this.animationData = data;
        this.frameIndex = 0;
        this.timer = 0;
        this.isPlaying = true;
        this.updateFrameCounter();
    }

    // --- Main Loop Hooks ---
    
    update(deltaTime) {
        if (!this.animationData || !this.isPlaying) return;

        this.timer += deltaTime;
        const interval = 1000 / this.fps;

        if (this.timer >= interval) {
            this.timer -= interval;
            this.next(false); // false = don't pause on auto-advance
        }
    }

    draw(ctx, canvasWidth, canvasHeight) {
        if (!this.animationData) return;

        const frame = this.animationData.frames[this.frameIndex];
        
        // Centered Draw Logic
        const drawW = this.animationData.width * this.zoom;
        const drawH = this.animationData.height * this.zoom;
        const x = Math.floor((canvasWidth - drawW) / 2);
        const y = Math.floor((canvasHeight - drawH) / 2);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(frame, x, y, drawW, drawH);
    }

    // --- Controls ---

    next(pause = true) {
        if (!this.animationData) return;
        if (pause) this.pause();
        
        this.frameIndex++;
        if (this.frameIndex >= this.animationData.frames.length) {
            this.frameIndex = 0;
        }
        this.updateFrameCounter();
    }

    prev() {
        if (!this.animationData) return;
        this.pause();
        
        this.frameIndex--;
        if (this.frameIndex < 0) {
            this.frameIndex = this.animationData.frames.length - 1;
        }
        this.updateFrameCounter();
    }

    first() {
        if (!this.animationData) return;
        this.pause();
        this.frameIndex = 0;
        this.updateFrameCounter();
    }

    last() {
        if (!this.animationData) return;
        this.pause();
        this.frameIndex = this.animationData.frames.length - 1;
        this.updateFrameCounter();
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        this.updatePlayButton();
    }

    pause() {
        this.isPlaying = false;
        this.updatePlayButton();
    }

    setSpeed(fps) {
        this.fps = fps;
        const label = document.getElementById('anim-speed-val');
        if (label) label.textContent = `${fps} FPS`;
    }
    
    setZoom(zoom) {
        this.zoom = zoom;
    }

    // --- UI Logic ---

    createControlPanel() {
        const panel = document.createElement('div');
        panel.className = 'animation-controls';
        
        // Row 1: Playback Buttons
        const playbackGroup = document.createElement('div');
        playbackGroup.className = 'anim-row';
        
        const btnFirst = this.createButton('⏮', () => this.first());
        const btnPrev = this.createButton('◀', () => this.prev());
        const btnPlay = this.createButton('⏸', () => this.togglePlay());
        btnPlay.id = 'anim-btn-play';
        btnPlay.classList.add('play-btn');
        
        const btnNext = this.createButton('▶', () => this.next());
        const btnLast = this.createButton('⏭', () => this.last());
        
        // Frame Counter
        const frameCounter = document.createElement('div');
        frameCounter.id = 'anim-frame-counter';
        frameCounter.className = 'anim-counter';
        frameCounter.textContent = 'Frame --/--';

        playbackGroup.append(btnFirst, btnPrev, btnPlay, btnNext, btnLast, frameCounter);

        // Row 2: Speed & Zoom
        const settingsGroup = document.createElement('div');
        settingsGroup.className = 'anim-row settings';

        // Speed Control
        const speedWrapper = document.createElement('div');
        speedWrapper.className = 'anim-row';
        speedWrapper.style.width = 'auto';

        const speedLabel = document.createElement('span');
        speedLabel.textContent = 'Speed:';
        speedLabel.className = 'anim-label';

        const speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.min = '1'; speedSlider.max = '60'; speedSlider.value = this.fps; // Sync with current FPS
        speedSlider.className = 'anim-input';
        speedSlider.style.width = '100px';
        speedSlider.oninput = (e) => this.setSpeed(parseInt(e.target.value));

        const speedValue = document.createElement('span');
        speedValue.id = 'anim-speed-val';
        speedValue.textContent = `${this.fps} FPS`; // Sync with current FPS
        speedValue.className = 'anim-value';

        speedWrapper.append(speedLabel, speedSlider, speedValue);

        // Zoom Control
        const zoomWrapper = document.createElement('div');
        zoomWrapper.className = 'anim-row';
        zoomWrapper.style.width = 'auto';

        const zoomLabel = document.createElement('span');
        zoomLabel.textContent = 'Zoom:';
        zoomLabel.className = 'anim-label';

        const zoomSelect = document.createElement('select');
        zoomSelect.className = 'anim-input';
        
        [1, 2, 3, 4].forEach(z => {
            const opt = document.createElement('option');
            opt.value = z;
            opt.textContent = `${z}x`;
            
            // [FIX] Select the option that matches the CURRENT zoom, not the default "2"
            if (z === this.zoom) opt.selected = true;
            
            zoomSelect.appendChild(opt);
        });
        
        zoomSelect.onchange = (e) => this.setZoom(parseInt(e.target.value));

        zoomWrapper.append(zoomLabel, zoomSelect);

        settingsGroup.append(speedWrapper, zoomWrapper);

        panel.append(playbackGroup, settingsGroup);
        this.controlPanel = panel;
        return panel;
    }

    createButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = 'anim-btn';
        btn.onclick = onClick;
        return btn;
    }

    updateFrameCounter() {
        const counter = document.getElementById('anim-frame-counter');
        if (counter && this.animationData) {
            counter.textContent = `Frame ${this.frameIndex + 1}/${this.animationData.frames.length}`;
        }
    }

    updatePlayButton() {
        const btn = document.getElementById('anim-btn-play');
        if (btn) btn.textContent = this.isPlaying ? '⏸' : '▶';
    }

    destroy() {
        this.pause();
        if (this.controlPanel && this.controlPanel.parentNode) {
            this.controlPanel.parentNode.removeChild(this.controlPanel);
        }
        this.animationData = null;
    }
}