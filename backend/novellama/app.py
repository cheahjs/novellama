from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from novellama.models.translation_context import TranslationContext
from novellama.api.translation_api import TranslationAPI
from .storage import StorageManager

load_dotenv()

app = Flask(__name__)
CORS(app)

storage = StorageManager()
sessions = {}


@app.route("/api/session/<session_id>", methods=["GET"])
def get_session(session_id):
    data = storage.load_session(session_id)
    return jsonify(data)

@app.route("/api/session/<session_id>", methods=["PUT"])
def update_session(session_id):
    data = request.json
    storage.save_session(session_id, data)
    return jsonify({"status": "success"})

@app.route("/api/translate", methods=["POST"])
def translate():
    data = request.json
    source_text = data.get("text")
    session_id = data.get("sessionId", "default")
    
    if not source_text:
        return jsonify({"error": "No text provided"}), 400

    # Get or create session context
    if session_id not in sessions:
        sessions[session_id] = TranslationContext()
        
        # Load saved data
        saved_data = storage.load_session(session_id)
        if saved_data["systemPrompt"]:
            sessions[session_id].set_system_prompt(saved_data["systemPrompt"])
        for ref in saved_data["references"]:
            sessions[session_id].add_reference(ref)
        for trans in saved_data["translations"]:
            sessions[session_id].add_translation(trans["source"], trans["translation"])

    context = sessions[session_id]

    # Use the API to translate
    api = TranslationAPI()
    messages = context.get_context_for_api()
    messages.append({"role": "user", "content": source_text})

    try:
        translation = api.translate_text(messages)
        context.add_translation(source_text, translation)
        
        # Save updated translations
        saved_data = storage.load_session(session_id)
        saved_data["translations"].append({
            "source": source_text,
            "translation": translation
        })
        storage.save_session(session_id, saved_data)
        
        return jsonify({"translation": translation})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/system-prompt", methods=["POST"])
def update_system_prompt():
    data = request.json
    session_id = data.get("sessionId", "default")
    prompt = data.get("prompt", "")

    if session_id not in sessions:
        sessions[session_id] = TranslationContext()

    # Update context
    sessions[session_id].set_system_prompt(prompt)
    
    # Update storage
    saved_data = storage.load_session(session_id)
    saved_data["systemPrompt"] = prompt
    storage.save_session(session_id, saved_data)
    
    return jsonify({"success": True})


@app.route("/api/references", methods=["POST"])
def update_references():
    data = request.json
    session_id = data.get("sessionId", "default")
    references = data.get("references", [])

    if session_id not in sessions:
        sessions[session_id] = TranslationContext()

    # Update context
    sessions[session_id].clear_references()
    for reference in references:
        sessions[session_id].add_reference(reference)

    # Update storage
    saved_data = storage.load_session(session_id)
    saved_data["references"] = references
    storage.save_session(session_id, saved_data)

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
    app.run(debug=True, port=5001)

if __name__ == "__main__":
    main()
