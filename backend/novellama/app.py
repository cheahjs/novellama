from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from novellama.models.translation_context import TranslationContext
from novellama.api.translation_api import TranslationAPI

load_dotenv()

app = Flask(__name__)
CORS(app)

# Store context per session (in a real app, you'd use a database)
sessions = {}


@app.route("/api/translate", methods=["POST"])
def translate():
    data = request.json
    session_id = data.get("sessionId", "default")
    source_text = data.get("text", "")

    if not source_text:
        return jsonify({"error": "No text provided"}), 400

    # Get or create session context
    if session_id not in sessions:
        sessions[session_id] = TranslationContext()

    context = sessions[session_id]

    # Use the API to translate
    api = TranslationAPI()
    messages = context.get_context_for_api()
    messages.append({"role": "user", "content": source_text})

    try:
        translated_text = api.translate_text(messages)

        # Update context with the new translation
        context.add_translation(source_text, translated_text)

        return jsonify({"translation": translated_text, "source": source_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/system-prompt", methods=["POST"])
def update_system_prompt():
    data = request.json
    session_id = data.get("sessionId", "default")
    prompt = data.get("prompt", "")

    if session_id not in sessions:
        sessions[session_id] = TranslationContext()

    sessions[session_id].set_system_prompt(prompt)
    return jsonify({"success": True})


@app.route("/api/references", methods=["POST"])
def update_references():
    data = request.json
    session_id = data.get("sessionId", "default")
    references = data.get("references", [])

    if session_id not in sessions:
        sessions[session_id] = TranslationContext()

    sessions[session_id].clear_references()
    for reference in references:
        sessions[session_id].add_reference(reference)

    return jsonify({"success": True})


@app.route("/api/context", methods=["GET"])
def get_context():
    session_id = request.args.get("sessionId", "default")

    if session_id not in sessions:
        return jsonify({"messages": []})

    return jsonify({"messages": sessions[session_id].messages})


@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(
        {
            "maxMessages": int(os.getenv("MAX_CONTEXT_MESSAGES", 10)),
            "maxTokens": int(os.getenv("MAX_TOKENS", 8000)),
            "modelName": os.getenv("MODEL_NAME", "gpt-3.5-turbo"),
        }
    )

def main():
    app.run(debug=True, port=5000)

if __name__ == "__main__":
    main()
