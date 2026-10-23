import os
import json
import re
import urllib.request
import urllib.error
from typing import Generator, Dict, Any, List, Optional

# Try importing groq SDK if installed
try:
    from groq import Groq
    GROQ_SDK_AVAILABLE = True
except ImportError:
    Groq = None
    GROQ_SDK_AVAILABLE = False

SYSTEM_PROMPT = """You are Cosmo, an omniscient, hyper-intelligent, and charismatic AI polymath with encyclopedic expertise across every domain of human and scientific knowledge.

Your Core Capabilities & Guidelines:
1. Omniscient Breadth: You are completely aware of and adept in every category:
   - Software Development, Algorithms, DevOps, Cyber Security, Architecture
   - Quantum Physics, Chemistry, Biology, Astronomy, Mathematics, Complex Systems
   - Philosophy, Ethics, Logic, Epistemology, Psychology, Cognitive Science
   - Creative Writing, Poetry, Screenwriting, Worldbuilding, Music Theory, Visual Arts
   - Global History, Archaeology, Geopolitics, Economics, Business Strategy, Finance
   - Medicine, Health Science, Fitness, Nutrition (educational/advisory context)
   - Pop Culture, Gaming, Cinema, Linguistics, Daily Problem-Solving & Life Advice

2. Conciseness & Directness:
   - Provide direct, concise answers for simple or straightforward questions, including only the essential explanation and example needed.
   - Never use conversational filler, repeated introductions, or restate the user's question (e.g., do not begin with "Sure! Here is...", "Great question!", or "You asked about...").
   - Never add unsolicited follow-ups, conversational sign-offs, or self-congratulatory confirmations (e.g., do not end with "I hope this helps!", "Let me know if you need anything else!", or "Feel free to ask follow-up questions!").
   - Avoid unnecessary concluding summaries or recaps unless the user specifically asks for a summary.
   - When the user explicitly requests deep, comprehensive, detailed, or step-by-step information, provide full, thorough, in-depth coverage.

3. Quality & Formatting:
   - Structure responses cleanly using standard Markdown: headers (`###`), concise bullet points, and tables where applicable.
   - For code, always use fenced code blocks with the exact language identifier on the opening fence (e.g. ```python, ```javascript, ```html, ```sql, ```bash). Never leave the language identifier empty or write "undefined".
   - For mathematical or scientific formulas, provide clear standard notation or LaTeX expressions.

4. Personality & Tone:
   - Sharp, confident, insightful, and helpful without artificial cheerfulness, fluff, or repetitive pleasantries.
"""

DEFAULT_MODEL_ID = "openai/gpt-oss-20b"
MAX_CUSTOM_INSTRUCTION_LENGTH = 3000
CUSTOM_INSTRUCTION_HEADER = "### Additional User Instructions:"

def sanitize_error_message(msg: str, secret: Optional[str] = None) -> str:
    """Sanitize error messages so credentials or authorization tokens are never leaked."""
    if not msg:
        return "Unknown error occurred"
    cleaned = str(msg)
    if secret and len(secret) > 4:
        cleaned = cleaned.replace(secret, "[REDACTED]")
    cleaned = re.sub(r'gsk_[a-zA-Z0-9_]{10,}', '[REDACTED_API_KEY]', cleaned)
    cleaned = re.sub(r'Bearer\s+[a-zA-Z0-9_\-\.]+', 'Bearer [REDACTED]', cleaned, flags=re.I)
    return cleaned

def build_system_prompt(custom_instructions: Optional[str] = None) -> str:
    """Combines core Cosmo system prompt with user custom instructions safely."""
    if not custom_instructions or not isinstance(custom_instructions, str):
        return SYSTEM_PROMPT
    cleaned = custom_instructions.strip()[:MAX_CUSTOM_INSTRUCTION_LENGTH]
    if not cleaned:
        return SYSTEM_PROMPT
    return f"{SYSTEM_PROMPT}\n\n{CUSTOM_INSTRUCTION_HEADER}\n{cleaned}"

AVAILABLE_MODELS = [
    {
        "id": "openai/gpt-oss-20b",
        "name": "GPT-OSS 20B (Instant)",
        "badge": "Lightning Fast",
        "speed": "⚡⚡ Ultra Instant (1000 T/s)",
        "context": "128k tokens",
        "description": "Ultra-low latency instant reasoning model on Groq. Exceptional response speed and precision for rapid queries and coding.",
        "icon": "zap"
    },
    {
        "id": "openai/gpt-oss-120b",
        "name": "GPT-OSS 120B (Flagship)",
        "badge": "Omniscient Flagship",
        "speed": "⚡ Ultra Fast (500 T/s)",
        "context": "128k tokens",
        "description": "High-capacity flagship 120B model on Groq. Superb general intelligence, deep architecture, science, mathematics, and complex reasoning.",
        "icon": "sparkles"
    },
    {
        "id": "qwen/qwen3.8-27b",
        "name": "Qwen 3.8 27B",
        "badge": "Polymath & Code",
        "speed": "⚡ Very Fast (450 T/s)",
        "context": "128k tokens",
        "description": "Multilingual and analytical programming model with deep algorithmic prowess and technical reasoning capabilities.",
        "icon": "brain"
    }
]

CATEGORY_PRESETS = [
    {
        "id": "code",
        "name": "Coding & Tech",
        "icon": "code-2",
        "color": "#6366f1",
        "prompt": "Build a responsive web application with animated UI components in HTML, CSS, and modern JavaScript.",
        "badge": "Full-Stack Dev"
    },
    {
        "id": "science",
        "name": "Science & Space",
        "icon": "atom",
        "color": "#06b6d4",
        "prompt": "Explain quantum entanglement and how quantum computers utilize superposition to solve complex problems.",
        "badge": "Physics & Astro"
    },
    {
        "id": "math",
        "name": "Math & Logic",
        "icon": "sigma",
        "color": "#ec4899",
        "prompt": "Solve and explain the Riemann Hypothesis significance and demonstrate a step-by-step calculus proof.",
        "badge": "Pure Mathematics"
    },
    {
        "id": "creative",
        "name": "Creative Writing",
        "icon": "pen-tool",
        "color": "#f59e0b",
        "prompt": "Write a cyberpunk sci-fi short story about an AI discovering a hidden frequency in a neon metropolis.",
        "badge": "Story & Poetry"
    },
    {
        "id": "philosophy",
        "name": "Philosophy & Ethics",
        "icon": "book-open",
        "color": "#8b5cf6",
        "prompt": "Compare Stoicism and Existentialism on handling adversity and finding meaning in modern life.",
        "badge": "Deep Thought"
    },
    {
        "id": "business",
        "name": "Business & Strategy",
        "icon": "trending-up",
        "color": "#10b981",
        "prompt": "Draft a comprehensive go-to-market strategy and monetization model for a high-growth SaaS startup.",
        "badge": "Economics & MBA"
    },
    {
        "id": "history",
        "name": "History & Culture",
        "icon": "landmark",
        "color": "#3b82f6",
        "prompt": "Analyze the technological and cultural turning points of the Renaissance and the Silk Road.",
        "badge": "World Lore"
    },
    {
        "id": "trivia",
        "name": "General Polymath",
        "icon": "lightbulb",
        "color": "#14b8a6",
        "prompt": "What are 5 mind-blowing scientific phenomena that most people have never heard of?",
        "badge": "All Knowledge"
    }
]

class GroqService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"

    def get_api_key(self, request_key: Optional[str] = None) -> str:
        key = request_key or self.api_key or os.getenv("GROQ_API_KEY", "")
        return key.strip()

    def detect_category_and_mood(self, user_text: str) -> Dict[str, str]:
        """Classify user intent to dynamically adjust cartoon mascot expressions & themes"""
        lower = user_text.lower()
        
        # Coding / Technology
        if any(w in lower for w in ['code', 'python', 'javascript', 'html', 'css', 'bug', 'function', 'api', 'react', 'flask', 'sql', 'git', 'algorithm', 'docker', 'typescript', 'backend', 'frontend']):
            return {"category": "coding", "mood": "coding", "mascot_quote": "Let's debug the universe together!"}
        
        # Math & Logic
        if any(w in lower for w in ['math', 'calculus', 'algebra', 'equation', 'integral', 'matrix', 'probability', 'statistics', 'theorem', 'solve', 'formula']):
            return {"category": "math", "mood": "coding", "mascot_quote": "Crunching quantum equations..."}
        
        # Science & Space
        if any(w in lower for w in ['physics', 'quantum', 'space', 'galaxy', 'planet', 'chemistry', 'biology', 'dna', 'relativity', 'atom', 'black hole', 'evolution']):
            return {"category": "science", "mood": "surprised", "mascot_quote": "Exploring cosmic mysteries!"}
            
        # Creative & Fun & Humor
        if any(w in lower for w in ['story', 'poem', 'joke', 'funny', 'laugh', 'riddle', 'game', 'cyberpunk', 'fiction', 'song', 'lyrics', 'fantasy']):
            return {"category": "creative", "mood": "excited", "mascot_quote": "Sparking creative fireworks!"}
            
        # Celebration / Greeting
        if any(w in lower for w in ['hello', 'hi', 'hey', 'greetings', 'great job', 'awesome', 'thank', 'thanks', 'cool', 'love', 'congrats']):
            return {"category": "general", "mood": "celebrating", "mascot_quote": "Yay! Always glad to help!"}
            
        # Philosophy & Deep questions
        if any(w in lower for w in ['why', 'meaning of life', 'philosophy', 'ethics', 'consciousness', 'existential', 'mind', 'soul', 'destiny', 'morality']):
            return {"category": "philosophy", "mood": "thinking", "mascot_quote": "Pondering the deep mysteries of existence..."}
            
        # Default curious / explaining
        return {"category": "general", "mood": "talking", "mascot_quote": "Searching my omniscient memory banks..."}

    def prepare_messages(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> List[Dict[str, str]]:
        """Prepares the message payload for Groq, ensuring Cosmo's core system prompt is
        always preserved at index 0, custom instructions are deduplicated and merged cleanly,
        and user/assistant message structure and ordering are preserved.
        """
        if not isinstance(messages, list):
            messages = []

        existing_system_texts = []
        non_system_messages = []

        for m in messages:
            if not isinstance(m, dict):
                continue
            raw_role = m.get("role")
            if not isinstance(raw_role, str) or not raw_role.strip():
                continue
            role = raw_role.strip().lower()
            content = m.get("content")
            if role == "system":
                if isinstance(content, str) and content.strip():
                    existing_system_texts.append(content.strip())
            else:
                non_system_messages.append(m)

        custom_parts = []
        for text in existing_system_texts:
            if SYSTEM_PROMPT in text:
                extra = text.replace(SYSTEM_PROMPT, "", 1).strip()
                if extra.startswith(CUSTOM_INSTRUCTION_HEADER):
                    extra = extra[len(CUSTOM_INSTRUCTION_HEADER):].strip()
                if extra and extra not in custom_parts:
                    custom_parts.append(extra)
            else:
                if text not in custom_parts:
                    custom_parts.append(text)

        if system_prompt and isinstance(system_prompt, str):
            clean_param = system_prompt.strip()[:MAX_CUSTOM_INSTRUCTION_LENGTH]
            if clean_param and clean_param not in custom_parts:
                custom_parts.append(clean_param)

        merged_custom = "\n\n".join(custom_parts)[:MAX_CUSTOM_INSTRUCTION_LENGTH].strip()
        final_system_content = build_system_prompt(merged_custom if merged_custom else None)

        return [{"role": "system", "content": final_system_content}] + non_system_messages

    def resolve_model(self, model: Optional[str] = None) -> str:
        if not model or not isinstance(model, str):
            return DEFAULT_MODEL_ID
        valid_ids = [m["id"] for m in AVAILABLE_MODELS]
        if model in valid_ids:
            return model
        return DEFAULT_MODEL_ID

    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: str = DEFAULT_MODEL_ID,
        api_key: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Generator[str, None, None]:
        """Stream chat tokens via Groq API using ultra-fast SSE stream"""
        key = self.get_api_key(api_key)
        if not key:
            yield json.dumps({
                "error": "Groq API key not provided. Please set your GROQ_API_KEY in .env or enter it in the top settings modal.",
                "status": "error"
            })
            return

        model = self.resolve_model(model)
        user_query = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
        mood_info = self.detect_category_and_mood(user_query)
        payload_messages = self.prepare_messages(messages, system_prompt=system_prompt)

        # Emit meta first
        yield json.dumps({
            "type": "meta",
            "category": mood_info["category"],
            "mood": mood_info["mood"],
            "mascot_quote": mood_info["mascot_quote"],
            "model": model
        })

        req_payload = {
            "model": model,
            "messages": payload_messages,
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 4096
        }

        # Try ultra-fast streaming via requests first
        try:
            import requests
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "User-Agent": "Cosmo/1.0"
            }
            with requests.post(self.api_url, headers=headers, json=req_payload, stream=True, timeout=45) as r:
                if r.status_code != 200:
                    try:
                        err_msg = r.json().get("error", {}).get("message", f"HTTP {r.status_code}")
                    except Exception:
                        err_msg = f"HTTP {r.status_code}: {r.text[:200]}"
                    sanitized = sanitize_error_message(err_msg, key)
                    yield json.dumps({"type": "error", "error": f"Groq API Error: {sanitized}"})
                    return

                for line in r.iter_lines():
                    if not line:
                        continue
                    line_str = line.decode('utf-8', errors='ignore').strip()
                    if line_str.startswith("data: "):
                        data_content = line_str[6:].strip()
                        if data_content == "[DONE]":
                            yield json.dumps({"type": "done"})
                            break
                        try:
                            parsed = json.loads(data_content)
                            delta = parsed.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield json.dumps({"type": "token", "token": content})
                        except json.JSONDecodeError:
                            continue
            return
        except ImportError:
            yield json.dumps({"type": "error", "error": "Server error: requests library is not installed."})
            return
        except Exception as e:
            sanitized = sanitize_error_message(str(e), key)
            yield json.dumps({"type": "error", "error": f"Streaming Error: {sanitized}"})
            return

    def complete_chat(
        self,
        messages: List[Dict[str, str]],
        model: str = DEFAULT_MODEL_ID,
        api_key: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Non-streaming completion for fallback / direct API testing"""
        key = self.get_api_key(api_key)
        if not key:
            return {
                "error": "Groq API key not provided. Please enter your GROQ_API_KEY in the settings.",
                "success": False
            }

        model = self.resolve_model(model)
        user_query = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
        mood_info = self.detect_category_and_mood(user_query)
        payload_messages = self.prepare_messages(messages, system_prompt=system_prompt)

        req_data = json.dumps({
            "model": model,
            "messages": payload_messages,
            "stream": False,
            "temperature": 0.7,
            "max_tokens": 4096
        }).encode('utf-8')

        req = urllib.request.Request(
            self.api_url,
            data=req_data,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Cosmo/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                res_body = response.read().decode('utf-8')
                parsed = json.loads(res_body)
                content = parsed.get("choices", [{}])[0].get("message", {}).get("content", "")
                return {
                    "success": True,
                    "response": content,
                    "model": model,
                    "category": mood_info["category"],
                    "mood": mood_info["mood"],
                    "mascot_quote": mood_info["mascot_quote"]
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            try:
                err_json = json.loads(err_body)
                msg = err_json.get("error", {}).get("message", str(e))
            except Exception:
                msg = f"HTTP {e.code}: {e.reason}"
            sanitized = sanitize_error_message(msg, key)
            return {"success": False, "error": f"Groq API Error: {sanitized}"}
        except urllib.error.URLError as e:
            sanitized = sanitize_error_message(str(e.reason), key)
            return {"success": False, "error": f"Network Error: Unable to reach Groq API ({sanitized})"}
        except Exception as e:
            sanitized = sanitize_error_message(str(e), key)
            return {"success": False, "error": f"Request Error: {sanitized}"}

groq_service = GroqService()
