```mermaid
flowchart LR
 C[Conversation]-->K[(Kafka)]
 P[Profile]-->K; R[Recommendation]-->K; A[Auth]-->K
 K-->AU[Audit consumer]
 K-->DLQ[Dead Letter Topics]
```
