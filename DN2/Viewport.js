/**
 * Viewport.js
 * Manages camera position, zoom level, and coordinate transforms.
 */
export class Viewport {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 0; // World X (center of screen)
        this.y = 0; // World Y (center of screen)
        this.zoom = 1.0;
        
        // Drag state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupEvents();
    }

    setupEvents() {
        // Mouse Down - Start Drag
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });

        // Mouse Move - Pan
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            
            // Adjust camera position (divide by zoom to keep pan speed consistent)
            this.x -= dx / this.zoom;
            this.y -= dy / this.zoom;
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        // Mouse Up - Stop Drag
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });

        // Wheel - Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            
            // Determine direction
            const delta = -Math.sign(e.deltaY);
            const newZoom = this.zoom + (delta * zoomSpeed * this.zoom);
            
            // Clamp zoom (0.1x to 10x)
            this.zoom = Math.max(0.1, Math.min(newZoom, 10.0));
        });
    }

    /**
     * Centers the camera on the map
     * @param {boolean} resetZoom - If true, resets zoom to 1.0
     */
    centerOn(width, height, tileSize, resetZoom = false) {
        this.x = (width * tileSize) / 2;
        this.y = (height * tileSize) / 2;
        
        // Only reset zoom if explicitly requested
        if (resetZoom) {
            this.zoom = 1.0;
        }
    }
}