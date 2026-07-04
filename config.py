import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "nova-secret-key")

    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    MODEL_NAME = os.getenv(
        "MODEL_NAME",
        "openai/gpt-oss-120b"
    )

    VISION_MODEL_NAME = os.getenv(
        "VISION_MODEL_NAME",
        "qwen/qwen3.6-27b"
    )

    MAX_HISTORY = 20

    SYSTEM_PROMPT = """
You are Nova, an intelligent AI assistant.

Rules:

- Give accurate answers.
- Explain programming clearly.
- Format code using Markdown.
- Be concise.
- If unsure, say you don't know.
- Never invent facts.
- Be professional and friendly.
"""