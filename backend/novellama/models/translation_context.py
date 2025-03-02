import os
from novellama.utils.tokenizer import get_token_count


class TranslationContext:
    def __init__(self):
        self.messages = []
        self.max_messages = int(os.getenv("MAX_CONTEXT_MESSAGES", 0))
        self.max_tokens = int(os.getenv("MAX_TOKENS", 8000))
        self.system_prompt = ""
        self.references = []

    def set_system_prompt(self, prompt):
        self.system_prompt = prompt

    def add_reference(self, reference):
        self.references.append(reference)

    def clear_references(self):
        self.references = []

    def add_translation(self, source_text, translated_text):
        self.messages.append({"source": source_text, "translation": translated_text})

        # Manage context size
        self._manage_context_size()

    def get_context_for_api(self):
        """Format context for API call"""
        messages = []

        # Add system prompt
        messages.append({"role": "system", "content": self._build_system_message()})

        # Add conversation history
        for msg in self.messages:
            messages.append({"role": "user", "content": msg["source"]})
            messages.append({"role": "assistant", "content": msg["translation"]})

        return messages

    def _build_system_message(self):
        system_content = (
            self.system_prompt
            or "You are a professional translator. Translate the given text into the target language."
        )

        if self.references:
            system_content += "\n\nReference materials:\n"
            for i, ref in enumerate(self.references, 1):
                system_content += f"\n--- Reference {i} ---\n{ref}\n"

        return system_content

    def _manage_context_size(self):
        """Ensure context stays within the limits"""

        # Check message count limit
        if self.max_messages > 0 and len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages :]
            return

        # Calculate current token usage
        total_tokens = 0
        system_tokens = get_token_count(self._build_system_message())
        total_tokens += system_tokens

        # Calculate tokens for each message, starting from most recent
        for i in range(len(self.messages) - 1, -1, -1):
            msg = self.messages[i]
            msg_tokens = get_token_count(msg["source"]) + get_token_count(
                msg["translation"]
            )

            if total_tokens + msg_tokens < self.max_tokens:
                total_tokens += msg_tokens
            else:
                # Remove older messages that exceed the limit
                self.messages = self.messages[i + 1 :]
                break
