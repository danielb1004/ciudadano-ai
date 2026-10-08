"""Prepare cloud secrets separately from the versioned deployment files."""
import argparse
import secrets
from pathlib import Path
from urllib.parse import urlsplit

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", required=True, help="Public HTTPS origin with DNS pointing to the server.")
    parser.add_argument("--output", default=".env.cloud")
    args = parser.parse_args()
    origin = urlsplit(args.origin)
    if origin.scheme != "https" or not origin.hostname or origin.username or origin.password or origin.query or origin.fragment or origin.path not in ("", "/") or origin.port not in (None, 443):
        parser.error("Use an HTTPS origin without credentials, path or nonstandard port.")
    output = Path(args.output)
    if output.exists():
        parser.error("The destination already exists; preserve its keys for existing encrypted data.")
    values = {
        "NODE_ENV": "production", "DEPLOYMENT_MODE": "academic", "USE_INFRASTRUCTURE": "true",
        "PUBLIC_ORIGIN": "https://" + origin.hostname, "SITE_ADDRESS": origin.hostname,
        "POSTGRES_USER": "ciudadano", "POSTGRES_DB": "ciudadano_ai",
        "POSTGRES_PASSWORD": secrets.token_hex(24), "JWT_SECRET": secrets.token_hex(48),
        "DATA_ENCRYPTION_KEY": secrets.token_hex(32), "INTERNAL_API_KEY": secrets.token_hex(32),
        "AUDIT_SIGNING_KEY": secrets.token_hex(32), "IDENTITY_HASH_KEY": secrets.token_hex(32),
        "DEFAULT_ADMIN_PASSWORD": secrets.token_urlsafe(32),
        "INSTITUTIONAL_MODE": "mock", "NLP_BACKEND": "beto",
        "BETO_RUNTIME": "onnx", "MODEL_VERSION": "beto-synthetic-v1-onnx-fp32", "LOG_LEVEL": "warn",
    }
    with output.open("x", encoding="utf-8") as stream:
        stream.write("".join(key + "=" + value + "\n" for key, value in values.items()))
    output.chmod(0o600)
    print("Cloud configuration created. Secrets remain in " + str(output) + ".")

if __name__ == "__main__":
    main()
