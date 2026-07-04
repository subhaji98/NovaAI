import os
from groq import Groq
from config import Config


class GroqClient:


    def __init__(self):
        if not Config.GROQ_API_KEY:
            raise ValueError(
                "GROQ_API_KEY is not configured. Set it in your environment variables."
            )

        self.client = Groq(api_key=Config.GROQ_API_KEY)

    def stream_chat(self, history, image=None, extra_system_note=None):

        messages = [
            {
                "role": "system",
                "content": Config.SYSTEM_PROMPT
            }
        ]

        if extra_system_note:
            messages.append({
                "role": "system",
                "content": extra_system_note,
            })

        if not history:
            return

        messages.extend(history[:-1])

        last = history[-1]

        if image:
            messages.append({
                "role": last.get("role", "user"),
                "content": [
                    {"type": "text", "text": last.get("content", "")},
                    {"type": "image_url", "image_url": {"url": image}},
                ],
            })
            model = Config.VISION_MODEL_NAME
        else:
            messages.append(last)
            model = Config.MODEL_NAME

        stream = self.client.chat.completions.create(
            model=model,

            messages=messages,

            temperature=0.7,

            max_completion_tokens=2048,

            top_p=1,

            stream=True
        )

        for chunk in stream:

            if (
                chunk.choices
                and chunk.choices[0].delta
                and chunk.choices[0].delta.content
            ):

                yield chunk.choices[0].delta.content