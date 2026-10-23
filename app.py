import os
import sys
from flask import Flask, render_template, request, jsonify, Response, stream_with_context

# Safely load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Minimal fallback parser for .env
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

from groq_service import groq_service, AVAILABLE_MODELS, CATEGORY_PRESETS, DEFAULT_MODEL_ID

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.urandom(24)

@app.route('/')
def index():
    has_key = bool(os.getenv("GROQ_API_KEY", "").strip())
    default_model = os.getenv("DEFAULT_MODEL", DEFAULT_MODEL_ID)
    return render_template(
        'index.html',
        models=AVAILABLE_MODELS,
        categories=CATEGORY_PRESETS,
        has_key=has_key,
        default_model=default_model
    )

@app.route('/api/health', methods=['GET'])
def health():
    key = os.getenv("GROQ_API_KEY", "").strip()
    return jsonify({
        "status": "healthy",
        "has_api_key": bool(key),
        "default_model": os.getenv("DEFAULT_MODEL", DEFAULT_MODEL_ID),
        "models_count": len(AVAILABLE_MODELS)
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    return jsonify({"models": AVAILABLE_MODELS})

@app.route('/api/categories', methods=['GET'])
def get_categories():
    return jsonify({"categories": CATEGORY_PRESETS})

@app.route('/api/chat', methods=['POST'])
def chat_standard():
    data = request.get_json() or {}
    messages = data.get("messages", [])
    model = data.get("model", DEFAULT_MODEL_ID)
    user_key = request.headers.get("X-Groq-Api-Key") or data.get("api_key")
    system_prompt = data.get("system_prompt") or data.get("custom_instructions")

    if not messages:
        return jsonify({"success": False, "error": "No messages provided."}), 400

    result = groq_service.complete_chat(
        messages=messages,
        model=model,
        api_key=user_key,
        system_prompt=system_prompt
    )
    if not result.get("success"):
        return jsonify(result), 400
    return jsonify(result)

@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    data = request.get_json() or {}
    messages = data.get("messages", [])
    model = data.get("model", DEFAULT_MODEL_ID)
    user_key = request.headers.get("X-Groq-Api-Key") or data.get("api_key")
    system_prompt = data.get("system_prompt") or data.get("custom_instructions")

    if not messages:
        return jsonify({"error": "No messages provided."}), 400

    def generate():
        for chunk in groq_service.stream_chat(
            messages=messages,
            model=model,
            api_key=user_key,
            system_prompt=system_prompt
        ):
            yield f"data: {chunk}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )

@app.route('/api/validate-key', methods=['POST'])
def validate_key():
    data = request.get_json() or {}
    key = (data.get("api_key") or "").strip()
    if not key:
        return jsonify({"valid": False, "message": "Key cannot be empty."}), 400

    # Quick test ping to Groq using the active default model
    test_messages = [{"role": "user", "content": "ping"}]
    res = groq_service.complete_chat(
        messages=test_messages,
        model=DEFAULT_MODEL_ID,
        api_key=key
    )
    if res.get("success"):
        return jsonify({"valid": True, "message": "Groq API Key is valid and active!"})
    else:
        err_msg = res.get("error", "Invalid API key or network failure.")
        return jsonify({"valid": False, "message": err_msg}), 400

@app.route('/api/save-key', methods=['POST'])
def save_key():
    data = request.get_json() or {}
    key = (data.get("api_key") or "").strip()
    if not key:
        return jsonify({"success": False, "message": "Key cannot be empty."}), 400

    # Save to current process environment
    os.environ["GROQ_API_KEY"] = key

    # Also persist to .env in workspace
    try:
        env_file = os.path.join(os.path.dirname(__file__), '.env')
        lines = []
        key_written = False
        if os.path.exists(env_file):
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip().startswith("GROQ_API_KEY="):
                        lines.append(f"GROQ_API_KEY={key}\n")
                        key_written = True
                    else:
                        lines.append(line)
        if not key_written:
            lines.append(f"GROQ_API_KEY={key}\n")
        with open(env_file, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        return jsonify({"success": True, "message": "API key successfully saved to environment and .env!"})
    except Exception as e:
        return jsonify({"success": True, "message": f"API key set for this session (file write note: {str(e)})"})

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    print(f">> Cosmo Groq Chatbot is launching at http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
