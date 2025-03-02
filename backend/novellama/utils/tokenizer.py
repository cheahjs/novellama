import tiktoken
import os

def get_token_count(text, model_name=None):
    """Count tokens for a string using tiktoken"""
    if model_name is None:
        model_name = os.getenv("MODEL_NAME", "gpt-3.5-turbo")
        
    try:
        encoding = tiktoken.encoding_for_model(model_name)
    except KeyError:
        encoding = tiktoken.get_encoding("o200k_base")
        
    token_count = len(encoding.encode(text))
    return token_count
