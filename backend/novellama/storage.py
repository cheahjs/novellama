import json
import os
from pathlib import Path

class StorageManager:
    def __init__(self, base_dir="data"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)

    def _get_session_file(self, session_id):
        return self.base_dir / f"{session_id}.json"

    def save_session(self, session_id, data):
        """Save session data to file"""
        file_path = self._get_session_file(session_id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_session(self, session_id):
        """Load session data from file"""
        file_path = self._get_session_file(session_id)
        if not file_path.exists():
            return {
                "systemPrompt": "",
                "references": [],
                "translations": []
            }

        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
