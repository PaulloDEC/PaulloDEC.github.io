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
            "DOS Text Screens": [],
            "Misc": []
        };

        // Define categorization rules
		const rules = [
			// Skip files
			{ test: (f) => f === 'ACTRINFO.MNI', skip: true },
            { test: (f) => f === 'AUDIOT.MNI', skip: true },
            { test: (f) => f === 'NUKEM2.MNI', skip: true },
            { test: (f) => f === 'NUKUM2.MNI', skip: true },
			
			// Episodes (regex patterns)
			{ test: /^L\d\.MNI$/i, category: "Levels (Episode 1)" },
			{ test: /^M\d\.MNI$/i, category: "Levels (Episode 2)" },
			{ test: /^N\d\.MNI$/i, category: "Levels (Episode 3)" },
			{ test: /^O\d\.MNI$/i, category: "Levels (Episode 4)" },
			
			// Tilesets
			{ test: (f) => f.includes('CZONE'), category: "Tilesets" },
			
			// Backdrops
			{ test: (f) => f.startsWith('BACKDRP') || f.startsWith('DROP') || f.startsWith('STATUS'), 
			  category: "Backdrops" },
			
			// Actor Data
			{ test: (f) => f === 'ACTORS.MNI', category: "Actor Data" },
			
			// User Interface
			{ test: (f) => ['FONT', 'ALF', 'NUM', 'BOXES', 'MAIN', 'CREDITS', 'HIGHS', 'HUD']
			    .some(prefix => f.startsWith(prefix)), 
			  category: "User Interface" },
			
			// Screens & Logos
			{ test: (f) => ['TITLE', 'LOGO', 'RIGEL', 'BONUS', 'APOGEE', 'GAMEOVER', 'END', 'HY', 
			                'ITEMS', 'KEYBORD', 'LOAD', 'PRIZES', 'WEAPONS']
			    .some(prefix => f.startsWith(prefix)) ||
			    ['BONUSSCN.MNI', 'HINTS.MNI', 'MESSAGE.MNI', 'STORY.MNI', 'LCR.MNI'].includes(f) ||
			    (f.startsWith('ORDER') && f !== 'ORDERTXT.MNI'),
			  category: "Screens & Logos" },
			
			// Music
			{ test: /\.IMF$/i, category: "Music" },
			
			// Sound Effects
			{ test: (f) => f === 'AUDIOHED.MNI', category: "SFX (AdLib/PC Speaker)" },
			{ test: (f) => f.startsWith('SB_') || f.startsWith('INTRO'), category: "SFX (Digitised)" },
			
            // B800 Text Screens
			{ test: (f) => f.startsWith('DOSTEXT'), category: "DOS Text Screens" },
            { test: (f) => f.startsWith('NOMEM'), category: "DOS Text Screens" },

			// Demos & Palettes
			{ test: (f) => f.startsWith('DEMO'), category: "Demos" },
			{ test: /\.PAL$/i, category: "Palettes" }
		];
		
		// Categorize each file
		files.forEach(f => {
			const upper = f.toUpperCase();
			
			// Find matching rule
			for (const rule of rules) {
				let matches = false;
				
				if (rule.test instanceof RegExp) {
					matches = rule.test.test(upper);
				} else if (typeof rule.test === 'function') {
					matches = rule.test(upper);
				}
				
				if (matches) {
					if (rule.skip) return; // Skip this file
					categories[rule.category].push(f);
					return;
				}
			}
			
			// Default: Misc
			categories["Misc"].push(f);
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