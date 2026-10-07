import sys
sys.path.insert(0,"services/nlp-service")
from app.main import classify_text
def predict(text: str) -> str: return classify_text(text)[0]
