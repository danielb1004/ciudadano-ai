import re, unicodedata

def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower().strip()
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", " [email_redacted] ", text)
    text = re.sub(r"(?:\+?57[ .-]?)?3(?:[ .-]?\d){9}\b", " [phone_redacted] ", text)
    text = re.sub(r"\b\d{6,12}\b", " [id_redacted] ", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace("pqrs","peticiones quejas reclamos sugerencias")
    text = re.sub(r"\bced\b","cedula",text)
    return text
