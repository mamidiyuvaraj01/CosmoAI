/**
 * ============================================================================
 * COSMO AI — MAIN CLIENT APPLICATION LOGIC
 * High-Speed Groq Streaming, Rich Markdown, Code Highlighting, TTS, STT & State
 * ============================================================================
 */

// Sound Synthesizer using Web Audio API
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
    }

    playPop() {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    }

    playSend() {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(640, this.ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) {}
    }

    playReceive() {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(750, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(520, this.ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.15);
        } catch (e) {}
    }
}

window.soundManager = new SoundManager();

// Main App Controller
class CosmoApp {
    constructor() {
        // State
        this.conversations = this.loadConversations();
        this.activeChatId = this.getActiveChatId();
        this.validModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
        this.currentModel = localStorage.getItem('cosmo_model') || 'openai/gpt-oss-20b';
        // Preserve selected model if in supported catalog; auto-migrate legacy model IDs
        if (!this.validModels.includes(this.currentModel)) {
            this.currentModel = 'openai/gpt-oss-20b';
            localStorage.setItem('cosmo_model', 'openai/gpt-oss-20b');
        }
        this.apiKey = localStorage.getItem('cosmo_groq_key') || '';
        this.customPrompt = localStorage.getItem('cosmo_custom_prompt') || '';
        this.sfxEnabled = localStorage.getItem('cosmo_sfx') !== 'false';
        if (window.soundManager) window.soundManager.enabled = this.sfxEnabled;
        this.savedVoice = localStorage.getItem('cosmo_tts_voice') || '';
        this.isStreaming = false;
        this.abortController = null;
        this.autoScrollEnabled = true;
        this.ttsEnabled = localStorage.getItem('cosmo_tts') === 'true';
        this.selectedVoice = null;
        this.recognition = null;

        // Cache DOM elements
        this.dom = {
            sidebar: document.getElementById('sidebar'),
            sidebarBackdrop: document.getElementById('sidebarBackdrop'),
            sidebarOpenBtn: document.getElementById('sidebarOpenBtn'),
            sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
            newChatBtn: document.getElementById('newChatBtn'),
            clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
            chatHistoryList: document.getElementById('chatHistoryList'),
            
            // Header & Model
            modelSelectBtn: document.getElementById('modelSelectBtn'),
            modelMenu: document.getElementById('modelMenu'),
            currentModelName: document.getElementById('currentModelName'),
            currentModelBadge: document.getElementById('currentModelBadge'),
            ttsToggleBtn: document.getElementById('ttsToggleBtn'),
            ttsIcon: document.getElementById('ttsIcon'),
            exportChatBtn: document.getElementById('exportChatBtn'),
            clearChatBtn: document.getElementById('clearChatBtn'),
            settingsModalBtn: document.getElementById('settingsModalBtn'),
            
            // Chat
            chatMessages: document.getElementById('chatMessages'),
            welcomeHero: document.getElementById('welcomeHero'),
            messagesContainer: document.getElementById('messagesContainer'),
            
            // Input
            chatForm: document.getElementById('chatForm'),
            userInput: document.getElementById('userInput'),
            charCounter: document.getElementById('charCounter'),
            activeCategoryTag: document.getElementById('activeCategoryTag'),
            voiceInputBtn: document.getElementById('voiceInputBtn'),
            voiceMicIcon: document.getElementById('voiceMicIcon'),
            stopGenerationBtn: document.getElementById('stopGenerationBtn'),
            sendBtn: document.getElementById('sendBtn'),
            
            // Settings Modal
            settingsModal: document.getElementById('settingsModal'),
            closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
            cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            groqApiKeyInput: document.getElementById('groqApiKeyInput'),
            systemRoleCustom: document.getElementById('systemRoleCustom'),
            validateKeyBtn: document.getElementById('validateKeyBtn'),
            keyValidateFeedback: document.getElementById('keyValidateFeedback'),
            openSettingsCard: document.getElementById('openSettingsCard'),
            keyStatusDot: document.getElementById('keyStatusDot'),
            keyStatusTitle: document.getElementById('keyStatusTitle'),
            keyStatusDesc: document.getElementById('keyStatusDesc'),
            ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
            sfxToggle: document.getElementById('sfxToggle'),
            toastContainer: document.getElementById('toastContainer')
        };

        this.init();
    }

    init() {
        this.setupMarked();
        this.setupTTS();
        this.setupSTT();
        this.bindEvents();
        this.renderHistory();
        this.loadActiveConversation();
        this.updateModelUI();
        this.checkInitialKeyStatus();
    }

    setupMarked() {
        if (window.marked) {
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && lang !== 'undefined' && lang !== 'null' && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {}
                    }
                    if (code && code.length < 5000) {
                        try {
                            return hljs.highlightAuto(code).value;
                        } catch (e) {}
                    }
                    return code;
                },
                breaks: true,
                gfm: true
            });
        }
    }

    setupTTS() {
        if ('speechSynthesis' in window) {
            const populateVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                if (this.dom.ttsVoiceSelect && voices.length > 0) {
                    this.dom.ttsVoiceSelect.innerHTML = '';
                    voices.forEach((v) => {
                        const opt = document.createElement('option');
                        opt.value = v.name;
                        opt.textContent = `${v.name} (${v.lang})`;
                        if (this.savedVoice && v.name === this.savedVoice) {
                            opt.selected = true;
                        } else if (!this.savedVoice && (v.default || v.name.includes('Google') || v.name.includes('Natural'))) {
                            opt.selected = true;
                        }
                        this.dom.ttsVoiceSelect.appendChild(opt);
                    });
                }
            };
            populateVoices();
            window.speechSynthesis.onvoiceschanged = populateVoices;
        }

        // Update TTS icon state
        if (this.dom.ttsToggleBtn) {
            this.dom.ttsToggleBtn.style.color = this.ttsEnabled ? 'var(--accent-cyan)' : 'var(--text-muted)';
        }
    }

    setupSTT() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (e) => {
                const transcript = Array.from(e.results)
                    .map(result => result[0].transcript)
                    .join('');
                this.dom.userInput.value = transcript;
                this.adjustTextareaHeight();
            };

            this.recognition.onend = () => {
                this.dom.voiceInputBtn.classList.remove('listening');
            };

            this.recognition.onerror = () => {
                this.dom.voiceInputBtn.classList.remove('listening');
            };
        } else {
            if (this.dom.voiceInputBtn) {
                this.dom.voiceInputBtn.style.display = 'none';
            }
        }
    }

    bindEvents() {
        // Form & Textarea
        this.dom.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUserSubmit();
        });

        // Auto-scroll management: track if user manually scrolls upward while streaming
        if (this.dom.chatMessages) {
            this.dom.chatMessages.addEventListener('scroll', () => {
                const el = this.dom.chatMessages;
                const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                if (distanceToBottom <= 80) {
                    this.autoScrollEnabled = true;
                } else if (this.isStreaming) {
                    this.autoScrollEnabled = false;
                }
            });
        }

        this.dom.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserSubmit();
            }
        });

        this.dom.userInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
            const len = this.dom.userInput.value.length;
            this.dom.charCounter.textContent = `${len}/8000`;
            
            // Notify mascot
            if (len > 0 && window.mascot && window.mascot.currentMood === 'idle') {
                window.mascot.say("Listening closely...", 2000);
            }
        });

        // Global Shortcut: Ctrl + K for new chat
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.createNewChat();
            }
        });

        // Sidebar Navigation
        if (this.dom.sidebarOpenBtn) {
            this.dom.sidebarOpenBtn.addEventListener('click', () => {
                this.dom.sidebar.classList.add('open');
                this.dom.sidebarBackdrop.classList.add('active');
            });
        }

        const closeSidebar = () => {
            this.dom.sidebar.classList.remove('open');
            this.dom.sidebarBackdrop.classList.remove('active');
        };

        if (this.dom.sidebarCloseBtn) this.dom.sidebarCloseBtn.addEventListener('click', closeSidebar);
        if (this.dom.sidebarBackdrop) this.dom.sidebarBackdrop.addEventListener('click', closeSidebar);

        if (this.dom.newChatBtn) {
            this.dom.newChatBtn.addEventListener('click', () => {
                this.createNewChat();
                closeSidebar();
            });
        }

        if (this.dom.clearAllHistoryBtn) {
            this.dom.clearAllHistoryBtn.addEventListener('click', () => {
                if (confirm("Are you sure you want to clear all chat history?")) {
                    this.conversations = {};
                    this.saveConversations();
                    this.createNewChat();
                    this.showToast("All chat history cleared.", "success");
                }
            });
        }

        // Category Pills Click
        document.querySelectorAll('.category-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                const catName = btn.querySelector('.cat-name')?.textContent || 'Domain';
                const catId = btn.dataset.id || 'general';
                const catIconMap = {
                    coding: 'code-2',
                    math: 'calculator',
                    science: 'atom',
                    creative: 'pen-tool',
                    philosophy: 'book-open',
                    business: 'trending-up',
                    history: 'landmark',
                    trivia: 'lightbulb'
                };
                this.updateActiveCategory(catName, catIconMap[catId] || 'sparkles');
                if (prompt) {
                    this.dom.userInput.value = prompt;
                    this.adjustTextareaHeight();
                    this.handleUserSubmit();
                    closeSidebar();
                }
            });
        });

        // Starter Cards Click
        document.querySelectorAll('.starter-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                if (prompt) {
                    this.dom.userInput.value = prompt;
                    this.adjustTextareaHeight();
                    this.handleUserSubmit();
                }
            });
        });

        // Model Selector Menu
        this.dom.modelSelectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dom.modelMenu.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!this.dom.modelMenu.contains(e.target) && !this.dom.modelSelectBtn.contains(e.target)) {
                this.dom.modelMenu.classList.remove('open');
            }
        });

        document.querySelectorAll('.model-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const modelId = opt.dataset.modelId;
                const modelName = opt.dataset.modelName;
                const modelBadge = opt.dataset.modelBadge;
                
                if (this.validModels.includes(modelId)) {
                    this.currentModel = modelId;
                    localStorage.setItem('cosmo_model', modelId);
                }

                document.querySelectorAll('.model-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                this.dom.currentModelName.textContent = modelName.replace('Llama ', '').replace('DeepSeek ', '');
                this.dom.currentModelBadge.textContent = modelBadge.split(' ')[0];
                this.dom.modelMenu.classList.remove('open');

                this.showToast(`Switched model to ${modelName}`, 'success');
                if (window.mascot) {
                    window.mascot.setMood('surprised', `Switched to ${modelName}! Ready!`);
                }
            });
        });

        // Header Actions
        this.dom.ttsToggleBtn.addEventListener('click', () => {
            this.ttsEnabled = !this.ttsEnabled;
            localStorage.setItem('cosmo_tts', this.ttsEnabled);
            this.dom.ttsToggleBtn.style.color = this.ttsEnabled ? 'var(--accent-cyan)' : 'var(--text-muted)';
            this.showToast(this.ttsEnabled ? "AI Voice Reading ON" : "AI Voice Reading OFF", "info");
        });

        this.dom.clearChatBtn.addEventListener('click', () => {
            if (confirm("Clear current conversation?")) {
                this.clearActiveChat();
            }
        });

        this.dom.exportChatBtn.addEventListener('click', () => {
            this.exportActiveChat();
        });

        // Voice STT Input Button
        if (this.dom.voiceInputBtn) {
            this.dom.voiceInputBtn.addEventListener('click', () => {
                if (!this.recognition) return;
                try {
                    this.dom.voiceInputBtn.classList.add('listening');
                    this.recognition.start();
                    if (window.mascot) window.mascot.say("I'm listening! Speak into your microphone.", 3000);
                } catch (e) {
                    this.recognition.stop();
                    this.dom.voiceInputBtn.classList.remove('listening');
                }
            });
        }

        // Stop Generation Button
        this.dom.stopGenerationBtn.addEventListener('click', () => {
            if (this.abortController) {
                this.abortController.abort();
                this.isStreaming = false;
                this.dom.stopGenerationBtn.classList.add('hidden');
                this.dom.sendBtn.classList.remove('hidden');
                if (window.mascot) window.mascot.setMood('idle', "Generation stopped.");
            }
        });

        // Settings Modal
        const openSettings = () => {
            this.dom.groqApiKeyInput.value = this.apiKey;
            if (this.dom.systemRoleCustom) {
                this.dom.systemRoleCustom.value = this.customPrompt || '';
            }
            if (this.dom.sfxToggle) {
                this.dom.sfxToggle.checked = this.sfxEnabled;
            }
            if (this.dom.ttsVoiceSelect && this.savedVoice) {
                this.dom.ttsVoiceSelect.value = this.savedVoice;
            }
            this.dom.settingsModal.classList.remove('hidden');
        };

        const closeSettings = () => {
            this.dom.settingsModal.classList.add('hidden');
        };

        this.dom.settingsModalBtn.addEventListener('click', openSettings);
        this.dom.openSettingsCard.addEventListener('click', openSettings);
        this.dom.closeSettingsModalBtn.addEventListener('click', closeSettings);
        this.dom.cancelSettingsBtn.addEventListener('click', closeSettings);

        // Validate Key Button
        this.dom.validateKeyBtn.addEventListener('click', async () => {
            const key = this.dom.groqApiKeyInput.value.trim();
            if (!key) {
                this.dom.keyValidateFeedback.textContent = "Please enter an API key first.";
                this.dom.keyValidateFeedback.style.color = "#f43f5e";
                return;
            }

            this.dom.keyValidateFeedback.textContent = "Validating key with Groq Cloud...";
            this.dom.keyValidateFeedback.style.color = "var(--accent-cyan)";

            try {
                const res = await fetch('/api/validate-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: key })
                });
                const data = await res.json();
                if (data.valid) {
                    this.dom.keyValidateFeedback.textContent = "✅ " + data.message;
                    this.dom.keyValidateFeedback.style.color = "var(--accent-emerald)";
                } else {
                    this.dom.keyValidateFeedback.textContent = "❌ " + (data.message || "Invalid API key");
                    this.dom.keyValidateFeedback.style.color = "#f43f5e";
                }
            } catch (err) {
                this.dom.keyValidateFeedback.textContent = "Validation error: " + err.message;
                this.dom.keyValidateFeedback.style.color = "#f43f5e";
            }
        });

        // Save Settings
        this.dom.saveSettingsBtn.addEventListener('click', async () => {
            const key = this.dom.groqApiKeyInput.value.trim();
            this.apiKey = key;
            localStorage.setItem('cosmo_groq_key', key);

            // Persist to backend
            if (key) {
                try {
                    await fetch('/api/save-key', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ api_key: key })
                    });
                } catch (e) {}
            }

            // Custom Instructions (Persona)
            if (this.dom.systemRoleCustom) {
                let instructions = this.dom.systemRoleCustom.value.trim();
                if (instructions.length > 2000) {
                    instructions = instructions.slice(0, 2000);
                    this.dom.systemRoleCustom.value = instructions;
                    this.showToast("Custom instructions trimmed to 2,000 character limit.", "info");
                }
                this.customPrompt = instructions;
                localStorage.setItem('cosmo_custom_prompt', this.customPrompt);
            }

            // SFX preference
            if (this.dom.sfxToggle) {
                this.sfxEnabled = this.dom.sfxToggle.checked;
                localStorage.setItem('cosmo_sfx', this.sfxEnabled);
                if (window.soundManager) {
                    window.soundManager.enabled = this.sfxEnabled;
                }
            }

            // TTS Voice preference
            if (this.dom.ttsVoiceSelect) {
                this.savedVoice = this.dom.ttsVoiceSelect.value;
                localStorage.setItem('cosmo_tts_voice', this.savedVoice);
            }

            this.updateKeyStatusBadge(bool(key));
            closeSettings();
            this.showToast("Settings and Groq API Key saved!", "success");
            if (window.mascot) window.mascot.setMood('celebrating', "Groq credentials connected!");
        });
    }

    adjustTextareaHeight() {
        const textarea = this.dom.userInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    }

    updateModelUI() {
        const activeOpt = document.querySelector(`.model-option[data-model-id="${this.currentModel}"]`);
        if (activeOpt) {
            document.querySelectorAll('.model-option').forEach(o => o.classList.remove('active'));
            activeOpt.classList.add('active');
            const name = activeOpt.dataset.modelName || 'GPT-OSS 20B';
            const badge = activeOpt.dataset.modelBadge || 'Lightning Fast';
            this.dom.currentModelName.textContent = name.replace('Llama ', '').replace('DeepSeek ', '');
            this.dom.currentModelBadge.textContent = badge.split(' ')[0];
        }
    }

    updateActiveCategory(name = 'All Domains', iconName = 'globe', color = null) {
        if (!this.dom.activeCategoryTag) return;
        this.dom.activeCategoryTag.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span>${this.escapeHtml(name)}</span>
        `;
        if (color) {
            const svg = this.dom.activeCategoryTag.querySelector('svg');
            if (svg) svg.style.color = color;
        }
        if (window.lucide) {
            lucide.createIcons({ root: this.dom.activeCategoryTag });
        }
    }

    async checkInitialKeyStatus() {
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            const hasKey = data.has_api_key || bool(this.apiKey);
            this.updateKeyStatusBadge(hasKey);
        } catch (e) {
            this.updateKeyStatusBadge(bool(this.apiKey));
        }
    }

    updateKeyStatusBadge(hasKey) {
        if (hasKey) {
            this.dom.keyStatusDot.className = "status-indicator-dot connected";
            this.dom.keyStatusTitle.textContent = "Groq API Connected";
            this.dom.keyStatusDesc.textContent = "Lightning-fast inference";
        } else {
            this.dom.keyStatusDot.className = "status-indicator-dot missing";
            this.dom.keyStatusTitle.textContent = "API Key Required";
            this.dom.keyStatusDesc.textContent = "Click to configure key";
        }
    }

    // ==========================================
    // CHAT & STREAMING LOGIC
    // ==========================================

    async handleUserSubmit() {
        const text = this.dom.userInput.value.trim();
        if (!text || this.isStreaming) return;

        // Reset input box
        this.dom.userInput.value = '';
        this.dom.charCounter.textContent = '0/8000';
        this.adjustTextareaHeight();

        // Sound effect
        window.soundManager.playSend();

        // Hide welcome hero if visible
        this.dom.welcomeHero.classList.add('hidden');

        // Add user message to UI & state
        this.appendMessage('user', text);
        this.saveMessageToActiveChat('user', text);

        // Mascot starts thinking
        if (window.mascot) {
            window.mascot.setMood('thinking');
        }

        // Prepare Bot Message UI Row with streaming cursor
        const botRow = this.createBotMessageRow();
        this.dom.messagesContainer.appendChild(botRow);
        this.scrollToBottom(true);

        const contentEl = botRow.querySelector('.message-text-content');
        const cursorEl = botRow.querySelector('.streaming-cursor');
        const metaPill = botRow.querySelector('.msg-meta-pill');

        // Toggle Streaming UI state
        this.isStreaming = true;
        this.abortController = new AbortController();
        this.dom.sendBtn.classList.add('hidden');
        this.dom.stopGenerationBtn.classList.remove('hidden');

        let fullBotReply = '';
        let detectedCategory = 'general';

        try {
            // Get conversation history payload
            const chatHistory = this.getActiveChatMessages();

            const reqPayload = {
                messages: chatHistory,
                model: this.currentModel,
                api_key: this.apiKey
            };
            if (this.customPrompt) {
                reqPayload.system_prompt = this.customPrompt;
            }

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Groq-Api-Key': this.apiKey
                },
                body: JSON.stringify(reqPayload),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); // Keep partial segment in buffer

                for (const chunk of lines) {
                    const cleanChunk = chunk.replace(/^data: /, '').trim();
                    if (!cleanChunk) continue;

                    try {
                        const parsed = JSON.parse(cleanChunk);

                        if (parsed.type === 'meta') {
                            detectedCategory = parsed.category;
                            metaPill.classList.remove('hidden');
                            metaPill.querySelector('.cat-label').textContent = `${detectedCategory.toUpperCase()} DOMAIN`;
                            
                            // Dynamically update active category indicator in input bar
                            const catMap = {
                                coding: { name: 'Coding & Tech', icon: 'code-2' },
                                math: { name: 'Mathematics & Logic', icon: 'calculator' },
                                science: { name: 'Science & Space', icon: 'atom' },
                                creative: { name: 'Creative & Fiction', icon: 'pen-tool' },
                                philosophy: { name: 'Philosophy', icon: 'book-open' },
                                business: { name: 'Business & Strategy', icon: 'trending-up' },
                                history: { name: 'History & Lore', icon: 'landmark' },
                                trivia: { name: 'General Polymath', icon: 'lightbulb' }
                            };
                            const mapped = catMap[detectedCategory] || { name: `${detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1)} Domain`, icon: 'sparkles' };
                            this.updateActiveCategory(mapped.name, mapped.icon);

                            // Adjust mascot to category mood
                            if (window.mascot) {
                                window.mascot.setMood(parsed.mood || 'talking', parsed.mascot_quote);
                            }
                        } else if (parsed.type === 'token') {
                            fullBotReply += parsed.token;
                            this.renderMarkdownStream(contentEl, fullBotReply);
                            this.scrollToBottom();
                        } else if (parsed.type === 'error') {
                            throw new Error(parsed.error);
                        } else if (parsed.type === 'done') {
                            break;
                        }
                    } catch (e) {
                        // In case of non-JSON chunks
                        if (cleanChunk && !cleanChunk.startsWith('{')) {
                            fullBotReply += cleanChunk;
                            this.renderMarkdownStream(contentEl, fullBotReply);
                        }
                    }
                }
            }

            // Finished successfully
            if (cursorEl) cursorEl.remove();
            this.finalizeBotMessage(botRow, fullBotReply);
            this.saveMessageToActiveChat('assistant', fullBotReply, detectedCategory);
            window.soundManager.playReceive();

            // Mascot celebration or idle
            if (window.mascot) {
                if (detectedCategory === 'coding' || detectedCategory === 'math') {
                    window.mascot.setMood('coding', "Code formatted & verified! 🚀");
                } else {
                    window.mascot.setMood('celebrating', "Hope that helps! Ask follow-ups anytime!");
                }
                setTimeout(() => {
                    if (window.mascot && window.mascot.currentMood === 'celebrating') {
                        window.mascot.setMood('idle');
                    }
                }, 5000);
            }

            // Speak response if TTS is on
            if (this.ttsEnabled) {
                this.speakText(fullBotReply);
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                if (cursorEl) cursorEl.remove();
                this.finalizeBotMessage(botRow, fullBotReply + "\n\n*(Generation stopped)*");
                this.saveMessageToActiveChat('assistant', fullBotReply + "\n\n*(Generation stopped)*");
            } else {
                if (cursorEl) cursorEl.remove();
                const errMsg = err.message || "An unexpected error occurred.";
                contentEl.innerHTML = `<div class="error-msg-box" style="color: #f43f5e; padding: 8px 12px; background: rgba(244, 63, 94, 0.1); border-radius: 8px; border: 1px solid rgba(244, 63, 94, 0.3);">
                    <strong>⚠️ Error:</strong> ${errMsg}
                    <br><small style="color: var(--text-muted); margin-top: 4px; display: block;">Check your Groq API key in the top right Settings modal.</small>
                </div>`;
                this.showToast(errMsg, "error");
                if (window.mascot) window.mascot.setMood('surprised', "Oops! Ran into a cosmic hitch.");
            }
        } finally {
            this.isStreaming = false;
            this.dom.stopGenerationBtn.classList.add('hidden');
            this.dom.sendBtn.classList.remove('hidden');
        }
    }

    renderMarkdownStream(targetEl, text, isFinal = false) {
        if (window.marked) {
            targetEl.innerHTML = marked.parse(text);
            if (isFinal) {
                targetEl.querySelectorAll('pre code').forEach((block) => {
                    if (!block.dataset.highlighted) {
                        hljs.highlightElement(block);
                    }
                });
                this.enhanceCodeBlocks(targetEl);
            }
        } else {
            targetEl.textContent = text;
        }
    }

    enhanceCodeBlocks(container) {
        container.querySelectorAll('pre').forEach((pre) => {
            if (pre.parentElement && pre.parentElement.classList.contains('code-block-container')) return;

            const codeEl = pre.querySelector('code');
            if (!codeEl) return;

            // Strip invalid or placeholder language classes
            if (codeEl.classList.contains('language-undefined')) codeEl.classList.remove('language-undefined');
            if (codeEl.classList.contains('language-null')) codeEl.classList.remove('language-null');

            const validLangClass = Array.from(codeEl.classList).find(c =>
                c.startsWith('language-') && c !== 'language-undefined' && c !== 'language-null'
            );
            let langName = validLangClass ? validLangClass.replace('language-', '').trim() : '';
            if (!langName || langName.toLowerCase() === 'undefined' || langName.toLowerCase() === 'null') {
                langName = 'code';
            }

            // Remove duplicated language label if model emitted language name as first line of code block
            const rawCode = codeEl.textContent || '';
            const lines = rawCode.split('\n');
            if (lines.length > 1 && lines[0].trim().toLowerCase() === langName.toLowerCase()) {
                lines.shift();
                codeEl.textContent = lines.join('\n');
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-container';

            const header = document.createElement('div');
            header.className = 'code-header';
            header.innerHTML = `
                <span class="code-lang-tag">${this.escapeHtml(langName)}</span>
                <button class="copy-code-btn" type="button" title="Copy code snippet">
                    <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                    <span>Copy</span>
                </button>
            `;

            const copyBtn = header.querySelector('.copy-code-btn');
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(codeEl.innerText);
                const span = copyBtn.querySelector('span');
                if (span) span.textContent = 'Copied!';
                setTimeout(() => {
                    if (span) span.textContent = 'Copy';
                }, 2000);
            });

            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(header);
            wrapper.appendChild(pre);

            if (window.lucide) lucide.createIcons({ root: header });
        });
    }

    finalizeBotMessage(botRow, text) {
        const contentEl = botRow.querySelector('.message-text-content');
        if (contentEl) {
            this.renderMarkdownStream(contentEl, text, true);
        }

        const contentWrapper = botRow.querySelector('.message-content-wrapper');
        if (!contentWrapper) return;

        // Remove any existing action toolbar to prevent duplicate Copy / Listen buttons
        const existingActions = contentWrapper.querySelector('.message-actions');
        if (existingActions) {
            existingActions.remove();
        }

        // Add action toolbar
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="action-tool-btn copy-msg-btn" type="button" title="Copy response text">
                <i data-lucide="copy"></i> <span>Copy</span>
            </button>
            <button class="action-tool-btn speak-msg-btn" type="button" title="Listen to response">
                <i data-lucide="volume-2"></i> <span>Listen</span>
            </button>
        `;

        actions.querySelector('.copy-msg-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(text);
            this.showToast("Response copied to clipboard!", "success");
        });

        actions.querySelector('.speak-msg-btn').addEventListener('click', () => {
            this.speakText(text);
        });

        contentWrapper.appendChild(actions);
        if (window.lucide) lucide.createIcons({ root: actions });
    }

    createBotMessageRow() {
        const row = document.createElement('div');
        row.className = 'message-row bot-row';
        row.innerHTML = `
            <div class="message-avatar bot-avatar">
                <i data-lucide="bot"></i>
            </div>
            <div class="message-content-wrapper">
                <div class="msg-meta-pill hidden">
                    <i data-lucide="sparkles"></i>
                    <span class="cat-label">GENERAL</span>
                </div>
                <div class="message-bubble">
                    <div class="message-text-content"></div>
                    <span class="streaming-cursor"></span>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons({ root: row });
        return row;
    }

    appendMessage(role, content) {
        if (role === 'user') {
            const row = document.createElement('div');
            row.className = 'message-row user-row';
            row.innerHTML = `
                <div class="message-content-wrapper">
                    <div class="message-bubble">
                        <p>${this.escapeHtml(content)}</p>
                    </div>
                </div>
                <div class="message-avatar user-avatar">
                    <i data-lucide="user"></i>
                </div>
            `;
            this.dom.messagesContainer.appendChild(row);
            if (window.lucide) lucide.createIcons({ root: row });
            this.scrollToBottom(true);
        }
    }

    speakText(rawMarkdown) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel(); // Stop any active speech

        // Strip code blocks and markdown symbols for smooth audio narration
        const cleanText = rawMarkdown
            .replace(/```[\s\S]*?```/g, 'Code block omitted.')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/[*#_~>]/g, '')
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        // Use selected voice if available
        const voiceName = this.dom.ttsVoiceSelect ? this.dom.ttsVoiceSelect.value : null;
        if (voiceName) {
            const voice = window.speechSynthesis.getVoices().find(v => v.name === voiceName);
            if (voice) utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
    }

    scrollToBottom(force = false) {
        const container = this.dom.chatMessages;
        if (!container) return;
        if (force) {
            this.autoScrollEnabled = true;
            container.scrollTop = container.scrollHeight;
            return;
        }
        if (!this.autoScrollEnabled) return;
        container.scrollTop = container.scrollHeight;
    }

    escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // ==========================================
    // CONVERSATION HISTORY & LOCAL STORAGE
    // ==========================================

    loadConversations() {
        try {
            return JSON.parse(localStorage.getItem('cosmo_chats') || '{}');
        } catch (e) {
            return {};
        }
    }

    saveConversations() {
        localStorage.setItem('cosmo_chats', JSON.stringify(this.conversations));
        this.renderHistory();
    }

    getActiveChatId() {
        let activeId = localStorage.getItem('cosmo_active_chat');
        if (!activeId || !this.conversations[activeId]) {
            activeId = 'chat_' + Date.now();
            this.conversations[activeId] = {
                id: activeId,
                title: 'New Conversation',
                timestamp: Date.now(),
                messages: []
            };
            localStorage.setItem('cosmo_active_chat', activeId);
            this.saveConversations();
        }
        return activeId;
    }

    getActiveChatMessages() {
        const chat = this.conversations[this.activeChatId];
        if (!chat || !chat.messages) return [];
        return chat.messages.map(m => ({ role: m.role, content: m.content }));
    }

    saveMessageToActiveChat(role, content, category = null) {
        if (!this.conversations[this.activeChatId]) {
            this.conversations[this.activeChatId] = {
                id: this.activeChatId,
                title: content.slice(0, 30) + '...',
                timestamp: Date.now(),
                messages: []
            };
        }
        const chat = this.conversations[this.activeChatId];
        chat.messages.push({ role, content, category, timestamp: Date.now() });

        // Update title if it's the first user message
        if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
            chat.title = content.length > 28 ? content.slice(0, 28) + '...' : content;
        }

        this.saveConversations();
    }

    createNewChat() {
        const newId = 'chat_' + Date.now();
        this.conversations[newId] = {
            id: newId,
            title: 'New Conversation',
            timestamp: Date.now(),
            messages: []
        };
        this.activeChatId = newId;
        localStorage.setItem('cosmo_active_chat', newId);
        this.saveConversations();
        this.loadActiveConversation();
        this.updateActiveCategory('All Domains', 'globe');
        if (window.mascot) window.mascot.setMood('idle', "Started a fresh conversation!");
    }

    clearActiveChat() {
        if (this.conversations[this.activeChatId]) {
            this.conversations[this.activeChatId].messages = [];
            this.conversations[this.activeChatId].title = 'New Conversation';
            this.saveConversations();
            this.loadActiveConversation();
            this.updateActiveCategory('All Domains', 'globe');
            this.showToast("Conversation cleared.", "info");
        }
    }

    loadActiveConversation() {
        this.dom.messagesContainer.innerHTML = '';
        const chat = this.conversations[this.activeChatId];

        if (!chat || !chat.messages || chat.messages.length === 0) {
            this.dom.welcomeHero.classList.remove('hidden');
            this.updateActiveCategory('All Domains', 'globe');
        } else {
            this.dom.welcomeHero.classList.add('hidden');
            let lastCategory = null;
            chat.messages.forEach(m => {
                if (m.role === 'user') {
                    this.appendMessage('user', m.content);
                } else if (m.role === 'assistant') {
                    const botRow = this.createBotMessageRow();
                    botRow.querySelector('.streaming-cursor')?.remove();
                    if (m.category) {
                        lastCategory = m.category;
                        const pill = botRow.querySelector('.msg-meta-pill');
                        pill.classList.remove('hidden');
                        pill.querySelector('.cat-label').textContent = `${m.category.toUpperCase()} DOMAIN`;
                    }
                    this.dom.messagesContainer.appendChild(botRow);
                    this.finalizeBotMessage(botRow, m.content);
                }
            });
            if (lastCategory) {
                const catMap = {
                    coding: { name: 'Coding & Tech', icon: 'code-2' },
                    math: { name: 'Mathematics & Logic', icon: 'calculator' },
                    science: { name: 'Science & Space', icon: 'atom' },
                    creative: { name: 'Creative & Fiction', icon: 'pen-tool' },
                    philosophy: { name: 'Philosophy', icon: 'book-open' },
                    business: { name: 'Business & Strategy', icon: 'trending-up' },
                    history: { name: 'History & Lore', icon: 'landmark' },
                    trivia: { name: 'General Polymath', icon: 'lightbulb' }
                };
                const mapped = catMap[lastCategory] || { name: `${lastCategory.charAt(0).toUpperCase() + lastCategory.slice(1)} Domain`, icon: 'sparkles' };
                this.updateActiveCategory(mapped.name, mapped.icon);
            } else {
                this.updateActiveCategory('All Domains', 'globe');
            }
            this.scrollToBottom(true);
        }
        this.renderHistory();
    }

    renderHistory() {
        if (!this.dom.chatHistoryList) return;
        this.dom.chatHistoryList.innerHTML = '';

        const ids = Object.keys(this.conversations).sort((a, b) => {
            return (this.conversations[b].timestamp || 0) - (this.conversations[a].timestamp || 0);
        });

        if (ids.length === 0) {
            this.dom.chatHistoryList.innerHTML = '<span class="empty-history-text">No previous conversations yet.</span>';
            return;
        }

        ids.forEach(id => {
            const chat = this.conversations[id];
            const item = document.createElement('div');
            item.className = `history-item ${id === this.activeChatId ? 'active' : ''}`;
            item.innerHTML = `
                <i data-lucide="message-square" style="width: 14px; height: 14px; margin-right: 6px;"></i>
                <span class="history-title">${this.escapeHtml(chat.title || 'Conversation')}</span>
                <button class="history-delete-btn" title="Delete chat"><i data-lucide="trash" style="width: 12px; height: 12px;"></i></button>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('.history-delete-btn')) {
                    e.stopPropagation();
                    delete this.conversations[id];
                    if (this.activeChatId === id) {
                        this.activeChatId = Object.keys(this.conversations)[0] || null;
                        if (!this.activeChatId) this.createNewChat();
                    }
                    this.saveConversations();
                    this.loadActiveConversation();
                    return;
                }
                this.activeChatId = id;
                localStorage.setItem('cosmo_active_chat', id);
                this.loadActiveConversation();
            });

            this.dom.chatHistoryList.appendChild(item);
        });

        if (window.lucide) lucide.createIcons({ root: this.dom.chatHistoryList });
    }

    exportActiveChat() {
        const chat = this.conversations[this.activeChatId];
        if (!chat || !chat.messages || chat.messages.length === 0) {
            this.showToast("No messages to export.", "error");
            return;
        }

        let markdownContent = `# Cosmo AI Conversation: ${chat.title}\n\n`;
        markdownContent += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

        chat.messages.forEach(m => {
            const speaker = m.role === 'user' ? '👤 **User**' : '🤖 **Cosmo (Groq)**';
            markdownContent += `### ${speaker}\n\n${m.content}\n\n---\n\n`;
        });

        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cosmo-chat-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast("Chat exported as Markdown file!", "success");
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'check-circle-2' : type === 'error' ? 'alert-circle' : 'info';
        toast.innerHTML = `<i data-lucide="${icon}" style="width: 16px; height: 16px;"></i> <span>${message}</span>`;
        this.dom.toastContainer.appendChild(toast);
        if (window.lucide) lucide.createIcons({ root: toast });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }
}

// Helper
function bool(val) {
    return Boolean(val && val !== 'false' && val !== '0');
}

// Launch application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CosmoApp();
});
