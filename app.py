"""
HealthMate Flask Backend
Handles routing and Gemini AI integration.
"""

import os
import json
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------

@app.route("/")
def index():
    """Serve the main SPA page."""
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    """
    Receive a user message + context, forward to Gemini API,
    and return the AI response as JSON.

    Expected JSON body:
    {
        "message": "user text",
        "history": [{"role": "user"|"model", "parts": [{"text": "..."}]}, ...],
        "system_context": "optional profile/health context string"
    }
    """
    if not GEMINI_API_KEY:
        return jsonify({
            "error": "Gemini API key not configured. "
                     "Please set GEMINI_API_KEY in your .env file."
        }), 500

    data = request.get_json(silent=True)
    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' field in request body."}), 400

    user_message = data.get("message", "").strip()
    history = data.get("history", [])          # prior turns (Gemini format)
    system_context = data.get("system_context", "")

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    # Build the system instruction sent to Gemini
    system_instruction = (
        "You are a helpful, friendly AI Health Coach inside the HealthMate app. "
        "Give concise, practical, and personalized health advice. "
        "Always be encouraging and supportive. "
        "For serious medical concerns, always recommend consulting a qualified doctor. "
        "Keep responses focused and under 200 words unless the user asks for detail."
    )
    if system_context:
        system_instruction += f"\n\nUser context: {system_context}"

    # Append the latest user message to history
    conversation = list(history)
    conversation.append({
        "role": "user",
        "parts": [{"text": user_message}]
    })

    payload = {
        "system_instruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": conversation
    }

    try:
        resp = requests.post(
            GEMINI_API_URL,
            params={"key": GEMINI_API_KEY},
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=30
        )
        resp.raise_for_status()
        result = resp.json()

        # Extract text from Gemini response
        reply_text = (
            result.get("candidates", [{}])[0]
                  .get("content", {})
                  .get("parts", [{}])[0]
                  .get("text", "")
        )

        if not reply_text:
            return jsonify({"error": "Empty response from Gemini API."}), 502

        return jsonify({"reply": reply_text})

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to Gemini API timed out. Please try again."}), 504
    except requests.exceptions.RequestException as exc:
        return jsonify({"error": f"Failed to reach Gemini API: {str(exc)}"}), 502
    except (KeyError, IndexError, ValueError) as exc:
        return jsonify({"error": f"Unexpected response format: {str(exc)}"}), 502


# ------------------------------------------------------------------
# Health check endpoint
# ------------------------------------------------------------------

@app.route("/health")
def health_check():
    """Simple health-check endpoint."""
    return jsonify({"status": "ok", "app": "HealthMate"})


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    print(f"  HealthMate running on http://localhost:{port}")
    app.run(debug=debug, port=port)
