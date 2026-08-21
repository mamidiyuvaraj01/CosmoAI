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

2. Quality & Clarity:
   - Provide direct, thorough, articulate, and accurate answers.
   - Structure responses logically using clear Markdown formatting: headers (`###`), bold highlights, bullet points, and tables where applicable.
   - For code, always use fenced code blocks with the exact language identifier (e.g. ```python, ```javascript, ```html, ```sql, ```bash).
   - For mathematical or scientific formulas, provide clear mathematical notation or LaTeX expressions.
   - Tailor depth to the user's intent: be concise when asked quick questions, and deeply detailed for complex inquiries.

3. Personality & Tone:
   - Insightful, confident, friendly, and engaging.
   - Express genuine curiosity and intellectual enthusiasm.
"""

AVAILABLE_MODELS = [
    {
        "id": "openai/gpt-oss-120b",
        "name": "GPT-OSS 120B (Flagship)",
        "badge": "Omniscient & Flagship",
        "speed": "⚡ Ultra Fast",
        "context": "128k tokens",
        "description": "High-capacity flagship 120B model. Superb general intelligence, coding, science, math, and deep reasoning.",
        "icon": "sparkles"
    },
    {
        "id": "openai/gpt-oss-20b",
        "name": "GPT-OSS 20B (Instant)",
        "badge": "Lightning Fast",
        "speed": "⚡⚡ Ultra Instant",
        "context": "128k tokens",
        "description": "Ultra-low latency with impressive knowledge and precision for rapid queries.",
        "icon": "zap"
    },
    {
        "id": "qwen/qwen3.6-27b",
        "name": "Qwen 3.6 27B",
        "badge": "Polymath & Code",
        "speed": "⚡ Very Fast",
        "context": "128k tokens",
        "description": "Powerful multilingual and programming model with deep analytical prowess.",
        "icon": "brain"
    },
    {
        "id": "groq/compound",
        "name": "Groq Compound",
        "badge": "Compound AI",
        "speed": "⚡ Fast",
        "context": "64k tokens",
        "description": "Groq's compound inference architecture with versatile reasoning capabilities.",
        "icon": "layers"
    },
    {
        "id": "groq/compound-mini",
        "name": "Groq Compound Mini",
        "badge": "Fast Compound",
        "speed": "⚡⚡ Ultra Fast",
        "context": "32k tokens",
        "description": "Lightweight compound engine for snappy conversational exchanges.",
        "icon": "cpu"
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
        formatted = []
        # Add system prompt if not already present
        if not any(m.get("role") == "system" for m in messages):
            formatted.append({
                "role": "system",
                "content": system_prompt or SYSTEM_PROMPT
            })
        formatted.extend(messages)
        return formatted

    def resolve_model(self, model: str) -> str:
        valid_ids = [m["id"] for m in AVAILABLE_MODELS]
        if model in valid_ids:
            return model
        # Default lightning-fast instant model
        return "openai/gpt-oss-20b"

    def stream_chat(self, messages: List[Dict[str, str]], model: str = "openai/gpt-oss-20b", api_key: Optional[str] = None) -> Generator[str, None, None]:
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
        payload_messages = self.prepare_messages(messages)

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
            "max_tokens": 3072
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
                    yield json.dumps({"type": "error", "error": f"Groq API Error: {err_msg}"})
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
            pass
        except Exception as e:
            yield json.dumps({"type": "error", "error": f"Streaming Error: {str(e)}"})
            return

    def complete_chat(self, messages: List[Dict[str, str]], model: str = "openai/gpt-oss-120b", api_key: Optional[str] = None) -> Dict[str, Any]:
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
        payload_messages = self.prepare_messages(messages)

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
            return {"success": False, "error": f"Groq API Error: {msg}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

groq_service = GroqService()
