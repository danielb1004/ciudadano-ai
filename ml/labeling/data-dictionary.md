| Campo | Tipo | Regla |
|---|---|---|
| `text` | string | Texto anonimizado |
| `intent` | enum | Una de las cinco categorías |
| `reviewer` | string | Identificador pseudónimo |
| `reviewStatus` | enum | pending/agreed/adjudicated |
| `source` | string | Procedencia autorizada |
| `consentVersion` | string | Versión del consentimiento |

## Campos del material sintético

| Campo | Valor/uso |
|---|---|
| sample_id | Identificador local syn-XXXX |
| is_synthetic | true |
| source | synthetic:handwritten-templates-v1 |
| consent | not_applicable |
| reviewer | Vacío; no hay revisión humana |
| reviewStatus | not_human_reviewed |
| template_family | Plantilla que debe permanecer en una sola partición |
| procedure / city | Contexto textual; no representa residencia real |
