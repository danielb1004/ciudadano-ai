import sys
sys.path.insert(0, "services/nlp-service")
from app.main import classify_text
def test_demo_contract(): assert classify_text("necesito sacar duplicado")[0] == "SOLICITUD_TRAMITE"
