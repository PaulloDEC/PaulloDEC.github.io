/**
 * UIManager.js
 * Manages the sidebar file list and UI interactions.
 * Updated: Episode Filtering + Style Fixes.
 */
export class UIManager {
    constructor() {
        this.container = document.getElementById('asset-list');
        this.statusDisplay = document.getElementById('file-input-status'); 
        this.onItemSelect = null; 
        
        // Initialize Filters immediately
        this.setupFilters();
    }

    setupFilters() {
        // Bind event listeners to the 4 episode checkboxes
        for (let i = 1; i <= 4; i++) {
            const chk = document.getElementById(`filter-ep${i}`);
            if (chk) {
                chk.addEventListener('change', () => this.applyFilters());
            }
        }
    }

    applyFilters() {
        // Show/Hide groups based on checkbox state
        for (let i = 1; i <= 4; i++) {
            const chk = document.getElementById(`filter-ep${i}`);
            // Find the specific group in the container
            const groups = this.container.querySelectorAll(`.group-ep-${i}`);
            groups.forEach(g => {
                // Toggle the details element, or the parent div?
                // The structure is details > summary + div.group-content
                // We tagged the DETAILS element.
                if (chk) g.style.display = chk.checked ? 'block' : 'none';
            });
        }
    }

    populateLevelList(files) {
        this.container.innerHTML = '';
        
        // Define Categories
        const categories = {
            "Levels (Episode 1)": [],
            "Levels (Episode 2)": [],
            "Levels (Episode 3)": [],
            "Levels (Episode 4)": [],
            "Tilesets": [],
            "Backdrops": [],
            "Actor Data": [],
            "User Interface": [],
            "Screens & Logos": [],
            "Music": [],
            "SFX (AdLib/PC Speaker)": [],
            "SFX (Digitised)": [],
            "Demos": [],
			"Palettes": [],
            "Misc": []
        };

        // ... (Keep existing file sorting logic for brevity) ...
        // Copy the sorting block from the previous UIManager version here.
        // It starts with `files.forEach(f => { ...`
        
        files.forEach(f => {
			const upper = f.toUpperCase();
			
			// Skip files you don't want in any category
			if (upper === 'ACTRINFO.MNI') return;
			
			if (/^L\d\.MNI$/i.test(upper)) categories["Levels (Episode 1)"].push(f);
			else if (/^M\d\.MNI$/i.test(upper)) categories["Levels (Episode 2)"].push(f);
			else if (/^N\d\.MNI$/i.test(upper)) categories["Levels (Episode 3)"].push(f);
			else if (/^O\d\.MNI$/i.test(upper)) categories["Levels (Episode 4)"].push(f);
			else if (upper.includes('CZONE')) categories["Tilesets"].push(f);
			else if (upper.startsWith('BACKDRP') || upper.startsWith('DROP') || upper.startsWith('STATUS')) categories["Backdrops"].push(f);
			else if (upper === 'ACTORS.MNI') categories["Actor Data"].push(f);  // Removed ACTRINFO.MNI from here
			else if (upper.startsWith('FONT') || upper.startsWith('ALF') || upper.startsWith('NUM') || upper.startsWith('BOXES') || upper.startsWith('MAIN') || upper.startsWith('CREDITS') || upper.startsWith('HIGHS') || upper.startsWith('HUD')) categories["User Interface"].push(f);
			else if (upper.startsWith('TITLE') || upper.startsWith('LOGO') || upper.startsWith('RIGEL') || upper.startsWith('BONUS') || upper.startsWith('APOGEE') || upper.startsWith('GAMEOVER') || upper === 'BONUSSCN.MNI' || upper.startsWith('END') || upper === 'HINTS.MNI' || upper.startsWith('HY') || upper.startsWith('ITEMS') || upper.startsWith('KEYBOARD') || upper.startsWith('LOAD') || upper === 'MESSAGE.MNI' || (upper.startsWith('ORDER') && upper !== 'ORDERTXT.MNI') || upper.startsWith('PRIZES') || upper === 'STORY.MNI' || upper.startsWith('WEAPONS')) categories["Screens & Logos"].push(f);
			else if (upper.endsWith('.IMF')) categories["Music"].push(f);
			else if (upper === 'AUDIOHED.MNI' || upper === 'AUDIOT.MNI') categories["SFX (AdLib/PC Speaker)"].push(f);
			else if (upper.startsWith('SB_') || upper.startsWith('INTRO')) categories["SFX (Digitised)"].push(f);
			else if (upper.startsWith('DEMO')) categories["Demos"].push(f);
			else if (upper === 'LCR.MNI' || upper.endsWith('.PAL')) categories["Palettes"].push(f);
			else categories["Misc"].push(f);
		});

        // Render Categories
        for (const [title, items] of Object.entries(categories)) {
            if (items.length === 0) continue;
            items.sort();

            const details = document.createElement('details');
            
            // --- TAGGING FOR FILTERING ---
            if (title.includes("Episode 1")) details.classList.add('group-ep-1');
            if (title.includes("Episode 2")) details.classList.add('group-ep-2');
            if (title.includes("Episode 3")) details.classList.add('group-ep-3');
            if (title.includes("Episode 4")) details.classList.add('group-ep-4');
            
            // Auto-open logic
            // if (title.includes("Levels") || title.includes("Actor")) details.open = true;

            const summary = document.createElement('summary');
            summary.textContent = `${title} (${items.length})`;
            
            const content = document.createElement('div');
            content.className = 'group-content';

            items.forEach(fileName => {
                const link = document.createElement('a');
                link.className = 'file-link';
                link.textContent = fileName;
                
                link.addEventListener('click', () => {
                    const prev = this.container.querySelector('.active');
                    if (prev) prev.classList.remove('active');
                    link.classList.add('active');
                    if (this.onItemSelect) {
                        const type = title.includes("Levels") ? "level" : "asset";
                        this.onItemSelect(fileName, type);
                    }
                });

                content.appendChild(link);
            });

            details.appendChild(summary);
            details.appendChild(content);
            this.container.appendChild(details);
        }

        if (this.statusDisplay) {
            this.statusDisplay.textContent = "NUKEM2.CMP Loaded";
            this.statusDisplay.style.color = "#cd7f32"; 
        }
        
        // Re-apply filters to initial state
        this.applyFilters();
    }
}