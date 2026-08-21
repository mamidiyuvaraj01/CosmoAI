/**
 * ============================================================================
 * COSMO THE CARTOON MASCOT — REACTIVE AVATAR & EMOTION ENGINE
 * Handles eye-tracking physics, SVG rigging, mood states, and sound effects.
 * ============================================================================
 */

class CartoonMascot {
    constructor() {
        this.container = document.getElementById('cartoonMascot');
        this.bubble = document.getElementById('mascotBubble');
        this.speechText = document.getElementById('mascotSpeechText');
        this.leftPupil = document.getElementById('leftPupil');
        this.rightPupil = document.getElementById('rightPupil');
        this.leftEyeGroup = document.getElementById('leftEyeGroup');
        this.rightEyeGroup = document.getElementById('rightEyeGroup');
        this.antennaOrb = document.getElementById('antennaOrb');
        this.glasses = document.getElementById('mascotGlasses');
        this.moodBtn = document.getElementById('mascotMoodBtn');
        this.moodLabel = document.getElementById('mascotMoodLabel');
        this.moodEmoji = document.getElementById('mascotMoodEmoji');
        
        this.currentMood = 'idle';
        this.isTyping = false;
        this.bubbleTimeout = null;
        this.blinkInterval = null;

        this.quotes = {
            idle: [
                "Hi! I'm Cosmo. Ask me anything across any universe!",
                "I'm aware of all categories: coding, science, philosophy, arts & more!",
                "My neural engine is warmed up and ready for questions!",
                "Got a tricky bug or a deep question? Hit me with it!"
            ],
            thinking: [
                "Traversing omniscient data clusters...",
                "Synthesizing high-dimensional thoughts...",
                "Running lightning-fast inference on Groq...",
                "Formulating the optimal answer for you..."
            ],
            coding: [
                "Compiling brilliance... let's ship some code!",
                "Optimizing algorithmic complexity to O(1)!",
                "Entering cyber-hacker mode!",
                "Debug mode activated. No bug can escape!"
            ],
            talking: [
                "Here is the breakdown...",
                "Unfolding the concepts step-by-step!",
                "Connecting the knowledge dots..."
            ],
            celebrating: [
                "Boom! Nailed it!",
                "Always a pleasure discovering new insights with you!",
                "High five! That was an awesome inquiry!"
            ],
            surprised: [
                "Whoa, fascinating question!",
                "Diving deep into the quantum realm!",
                "Cosmic mind expanded!"
            ],
            poke: [
                "⚡ Hehe! That tickles my quantum circuits!",
                "🚀 All systems operational and ready to assist!",
                "🧠 Processing at 900 tokens per second!",
                "✨ Did you know? Photons don't experience time!",
                "🤖 Pair-programming with you is my favorite pastime!",
                "💡 Have you tried asking me to write a full app?"
            ]
        };

        this.init();
    }

    init() {
        if (!this.container) return;

        this.startEyeTracking();
        this.startBlinkCycle();
        this.setupInteractions();
        this.setMood('idle');
    }

    setupInteractions() {
        // Click / Poke interaction
        this.container.addEventListener('click', (e) => {
            // Don't trigger if clicked mood button specifically
            if (e.target.closest('#mascotMoodBtn')) return;
            this.poke();
        });

        // Mood Button cycle
        if (this.moodBtn) {
            this.moodBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cycleMood();
            });
        }
    }

    startEyeTracking() {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let ticking = false;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (!ticking) {
                requestAnimationFrame(() => {
                    this.updatePupilPositions(mouseX, mouseY);
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    updatePupilPositions(mouseX, mouseY) {
        if (!this.leftPupil || !this.rightPupil) return;
        if (this.currentMood === 'thinking') return; // Don't track during thinking spin

        const rect = this.container.getBoundingClientRect();
        const mascotCenterX = rect.left + rect.width / 2;
        const mascotCenterY = rect.top + rect.height / 2;

        const deltaX = mouseX - mascotCenterX;
        const deltaY = mouseY - mascotCenterY;
        const angle = Math.atan2(deltaY, deltaX);

        const maxDistance = 4; // Max pupil movement in SVG units
        const moveX = Math.cos(angle) * maxDistance;
        const moveY = Math.sin(angle) * maxDistance;

        this.leftPupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        this.rightPupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
    }

    startBlinkCycle() {
        const triggerBlink = () => {
            if (this.currentMood !== 'thinking') {
                this.container.classList.add('blinking');
                setTimeout(() => {
                    this.container.classList.remove('blinking');
                }, 180);
            }
            const nextBlink = 3000 + Math.random() * 4000;
            this.blinkInterval = setTimeout(triggerBlink, nextBlink);
        };
        this.blinkInterval = setTimeout(triggerBlink, 3500);
    }

    setMood(mood, customQuote = null) {
        this.currentMood = mood;
        
        // Remove previous mood classes
        this.container.classList.remove(
            'mood-thinking', 'mood-coding', 'mood-talking', 
            'mood-celebrating', 'mood-surprised', 'mood-idle'
        );
        this.container.classList.add(`mood-${mood}`);

        // Update glasses visibility
        if (this.glasses) {
            if (mood === 'coding' || mood === 'math') {
                this.glasses.classList.remove('hidden');
            } else {
                this.glasses.classList.add('hidden');
            }
        }

        // Update mood pill indicator
        const moodData = {
            idle: { emoji: "🤖", label: "Ready" },
            thinking: { emoji: "⚡", label: "Thinking..." },
            coding: { emoji: "💻", label: "Cyber Mode" },
            talking: { emoji: "💬", label: "Explaining" },
            celebrating: { emoji: "🎉", label: "Inspired" },
            surprised: { emoji: "✨", label: "Intrigued" }
        };

        const current = moodData[mood] || moodData.idle;
        if (this.moodEmoji) this.moodEmoji.textContent = current.emoji;
        if (this.moodLabel) this.moodLabel.textContent = current.label;

        // Choose quote
        let text = customQuote;
        if (!text && this.quotes[mood]) {
            const list = this.quotes[mood];
            text = list[Math.floor(Math.random() * list.length)];
        }

        if (text) {
            this.say(text, mood === 'thinking' || mood === 'talking' ? 0 : 5000);
        }
    }

    say(text, durationMs = 4500) {
        if (!this.bubble || !this.speechText) return;

        this.speechText.textContent = text;
        this.bubble.style.opacity = '1';
        this.bubble.style.transform = 'translateY(0) scale(1)';

        if (this.bubbleTimeout) {
            clearTimeout(this.bubbleTimeout);
            this.bubbleTimeout = null;
        }

        if (durationMs > 0) {
            this.bubbleTimeout = setTimeout(() => {
                this.bubble.style.opacity = '0';
                this.bubble.style.transform = 'translateY(6px) scale(0.95)';
            }, durationMs);
        }
    }

    poke() {
        // Trigger giggle animation
        this.container.classList.add('mascot-giggle');
        setTimeout(() => {
            this.container.classList.remove('mascot-giggle');
        }, 600);

        // Sound synthetic happy tone
        if (window.soundManager) {
            window.soundManager.playPop();
        }

        // Say funny quote
        const pokeQuotes = this.quotes.poke;
        const quote = pokeQuotes[Math.floor(Math.random() * pokeQuotes.length)];
        this.setMood('celebrating', quote);

        setTimeout(() => {
            if (this.currentMood === 'celebrating') {
                this.setMood('idle');
            }
        }, 4000);
    }

    cycleMood() {
        const moods = ['idle', 'coding', 'thinking', 'celebrating', 'surprised'];
        const nextIdx = (moods.indexOf(this.currentMood) + 1) % moods.length;
        this.setMood(moods[nextIdx]);
    }
}

// Instantiate globally
window.mascot = new CartoonMascot();
