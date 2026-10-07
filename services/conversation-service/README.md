# Conversation service

Orquesta el grafo LangGraph (`receive_message` → sanitización → contexto → intención → entidades → confianza → perfil/recomendación → validación → persistencia/eventos). Expone conversación versionada y usa fallback seguro si PLN o recomendaciones fallan.
