from flask import Flask, render_template, request, jsonify
from deep_translator import GoogleTranslator
from langdetect import detect, DetectorFactory
from langdetect.lang_detect_exception import LangDetectException

# Make langdetect deterministic
DetectorFactory.seed = 42

app = Flask(__name__)

# Supported languages map (ISO -> readable name)
LANG_MAP = {
    "af": "Afrikaans","ar": "Arabic","bn": "Bengali","bg": "Bulgarian","ca": "Catalan",
    "zh-CN": "Chinese (Simplified)","zh-TW": "Chinese (Traditional)","hr": "Croatian",
    "cs": "Czech","da": "Danish","nl": "Dutch","en": "English","et": "Estonian",
    "fi": "Finnish","fr": "French","de": "German","el": "Greek","gu": "Gujarati",
    "he": "Hebrew","hi": "Hindi","hu": "Hungarian","id": "Indonesian","it": "Italian",
    "ja": "Japanese","kn": "Kannada","ko": "Korean","lv": "Latvian","lt": "Lithuanian",
    "ms": "Malay","ml": "Malayalam","mr": "Marathi","ne": "Nepali","no": "Norwegian",
    "fa": "Persian","pl": "Polish","pt": "Portuguese","pa": "Punjabi","ro": "Romanian",
    "ru": "Russian","sr": "Serbian","sk": "Slovak","sl": "Slovenian","es": "Spanish",
    "sv": "Swedish","ta": "Tamil","te": "Telugu","th": "Thai","tr": "Turkish",
    "uk": "Ukrainian","ur": "Urdu","vi": "Vietnamese"
}

@app.route("/")
def index():
    return render_template("index.html")

@app.get("/api/languages")
def api_languages():
    """Return a list of supported languages."""
    return jsonify({"languages": [{"code": c, "name": n} for c, n in LANG_MAP.items()]})

@app.post("/api/translate")
def api_translate():
    """
    JSON body: { text, source, target }
    - source can be 'auto' (or empty) to auto-detect with langdetect
    - target must be an ISO code present in LANG_MAP
    """
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    source = (data.get("source") or "auto").strip()
    target = (data.get("target") or "en").strip()

    if not text:
        return jsonify({"ok": False, "error": "Text is required."}), 400
    if target not in LANG_MAP:
        return jsonify({"ok": False, "error": "Unsupported target language."}), 400

    detected_source = None
    # Auto detect if requested or invalid source
    if source == "auto" or source not in LANG_MAP:
        try:
            detected_source = detect(text)
            # Normalize special cases to GoogleTranslator codes
            if detected_source == "zh-cn":
                detected_source = "zh-CN"
            if detected_source == "zh-tw":
                detected_source = "zh-TW"
            # if detection not in our map, fall back to auto mode for translator
            if detected_source not in LANG_MAP:
                detected_source = None
        except LangDetectException:
            detected_source = None

    src_for_translator = detected_source if detected_source else (source if source in LANG_MAP else "auto")

    try:
        translated = GoogleTranslator(source=src_for_translator, target=target).translate(text)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Translation failed: {e}"}), 500

    return jsonify({
        "ok": True,
        "text": text,
        "translated": translated,
        "source": source,
        "detected_source": detected_source,
        "target": target
    })

if __name__ == "__main__":
    app.run(debug=True)
