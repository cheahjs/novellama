import os
import requests
from dotenv import load_dotenv

load_dotenv()


class TranslationAPI:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.api_base = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
        self.model_name = os.getenv("MODEL_NAME", "gpt-3.5-turbo")

    def translate_text(self, messages):
        """Translate text using the configured LLM API"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        data = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.3,  # Lower temperature for more consistent translations
        }

        response = requests.post(
            f"{self.api_base}/chat/completions", headers=headers, json=data
        )

        if response.status_code != 200:
            raise Exception(f"API error: {response.status_code} - {response.text}")

        result = response.json()
        translated_text = result["choices"][0]["message"]["content"]

        return translated_text
