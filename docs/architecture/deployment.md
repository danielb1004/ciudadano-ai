```mermaid
flowchart TB
 I[Ingress TLS 1.3]-->K[Kong]
 K-->N1[Node services x2..n]
 K-->NLP[NLP pods]
 N1-->R[(Redis)]
 N1-->PG[(PostgreSQL/PV)]
 N1-->KF[(Kafka)]
```
