import json
import logging
import re

from flask import (
    Flask,
    Response,
    jsonify,
    render_template,
    request,
)

from flask_cors import CORS

from config import Config
from services.groq_client import GroqClient
from services.image_search import search_commons_image


app = Flask(__name__)
app.config.from_object(Config)

CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

logger = logging.getLogger("nova")

groq = GroqClient()

IMAGE_INTENT_RE = re.compile(r"\b(image|photo|picture|pic)s?\b", re.IGNORECASE)
IMAGE_SUBJECT_RE = re.compile(r"\bof\s+(.+)", re.IGNORECASE)


def wants_image(text):
    return bool(text) and bool(IMAGE_INTENT_RE.search(text))


def extract_image_query(text):
    match = IMAGE_SUBJECT_RE.search(text)
    subject = match.group(1) if match else text
    return subject.strip(" ?.!\"'")


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "model": Config.MODEL_NAME
        }
    )


@app.route("/api/chat", methods=["POST"])
def chat():

    try:

        data = request.get_json(force=True)

        history = data.get("history", [])

        image = data.get("image")

        if not isinstance(history, list):

            return jsonify(
                {
                    "error": "History must be a list."
                }
            ), 400

        history = history[-Config.MAX_HISTORY:]

    except Exception as e:

        logger.exception(e)

        return jsonify(
            {
                "error": "Invalid request."
            }
        ), 400

    # Only look for a real image if the user didn't already attach their own.
    image_result = None
    last_user_text = ""
    if not image and history and history[-1].get("role") == "user":
        last_user_text = history[-1].get("content", "") or ""
        if isinstance(last_user_text, str) and wants_image(last_user_text):
            image_result = search_commons_image(
                extract_image_query(last_user_text)
            )

    def generate():

        full_reply = ""
        extra_note = None

        try:

            if image_result:
                caption = image_result["title"]
                attribution = "Wikimedia Commons"
                if image_result.get("artist"):
                    attribution += f" — {image_result['artist']}"

                img_md = (
                    f"![{caption}]({image_result['url']})\n\n"
                    f"*Source: {attribution}*\n\n"
                )

                full_reply += img_md

                yield (
                    f"data: {json.dumps({'token': img_md})}\n\n"
                )

                extra_note = (
                    f"A real photo of '{image_result['title']}' has already been "
                    "shown to the user above, retrieved from Wikimedia Commons. "
                    "Do NOT include any image links, markdown images, or made-up "
                    "URLs in your reply. Just add a brief 1-2 sentence caption or "
                    "interesting fact about it."
                )

            elif wants_image(last_user_text):
                extra_note = (
                    "The user asked to see an image, but no real photo could be "
                    "found for this request. Politely explain that you can't "
                    "display images directly here, and suggest they search "
                    "Google Images, Unsplash, or Wikimedia Commons instead. Do "
                    "NOT invent any image links, markdown images, or fake URLs."
                )

            for token in groq.stream_chat(
                history, image=image, extra_system_note=extra_note
            ):

                full_reply += token

                yield (
                    f"data: {json.dumps({'token': token})}\n\n"
                )

            yield (
                f"data: {json.dumps({'done': True})}\n\n"
            )

            logger.info("Reply generated successfully.")

        except Exception as e:

            logger.exception(e)

            yield (
                f"data: {json.dumps({'error': str(e)})}\n\n"
            )

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.errorhandler(404)
def not_found(error):
    return jsonify(
        {
            "error": "Page not found."
        }
    ), 404


@app.errorhandler(500)
def internal(error):
    return jsonify(
        {
            "error": "Internal server error."
        }
    ), 500


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
    )