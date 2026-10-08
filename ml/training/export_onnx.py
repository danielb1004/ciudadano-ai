"""Export the trained BETO to an INT8 CPU runtime; validate numerical parity."""
import argparse
import hashlib
import json
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="ml/models/beto-synthetic-v1")
    args = parser.parse_args()
    directory = Path(args.model)
    import numpy as np
    import torch
    import onnxruntime as ort
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    from onnxruntime.quantization import QuantType, quantize_dynamic
    configuration = json.loads((directory / "training-config.json").read_text(encoding="utf-8"))
    if configuration.get("status") != "trained":
        raise ValueError("A completed trained checkpoint is required.")
    tokenizer = AutoTokenizer.from_pretrained(directory, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        directory, local_files_only=True, attn_implementation="eager").cpu().eval()
    torch.set_num_threads(2)
    class Logits(torch.nn.Module):
        def __init__(self, classifier):
            super().__init__()
            self.classifier = classifier
        def forward(self, input_ids, attention_mask, token_type_ids):
            return self.classifier(input_ids=input_ids, attention_mask=attention_mask,
                                   token_type_ids=token_type_ids).logits
    examples = ["Necesito sacar el pasaporte en BogotÃ¡", "La pÃ¡gina del RUT no carga"]
    tokens = tokenizer(examples, return_tensors="pt", padding=True, truncation=True,
                       max_length=configuration.get("maxLength", 128))
    fp32, int8 = directory / "model.onnx", directory / "model.int8.onnx"
    names = ["input_ids", "attention_mask", "token_type_ids"]
    torch.onnx.export(
        Logits(model).eval(), tuple(tokens[name] for name in names), str(fp32),
        input_names=names, output_names=["logits"], opset_version=17,
        dynamic_axes={**{name: {0: "batch", 1: "sequence"} for name in names},
                      "logits": {0: "batch"}}, dynamo=False)
    quantize_dynamic(str(fp32), str(int8), per_channel=True,
                     weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul", "Gemm"],
                     extra_options={"MatMulConstBOnly": True})
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    session = ort.InferenceSession(str(fp32), sess_options=options, providers=["CPUExecutionProvider"])
    model.eval()
    with torch.inference_mode():
        expected = model(**tokens).logits.numpy()
    actual = session.run(None, {name: tokens[name].numpy() for name in names})[0]
    if not np.allclose(actual, expected, rtol=1e-3, atol=1e-3):
        raise ValueError("FP32 ONNX export does not match the original checkpoint.")
    # INT8 quality is measured on the fixed held-out split after deployment.
    manifest = {
        "runtime": "onnx", "quantization": "none", "opset": 17,
        "selectedArtifact": "model.onnx", "int8Approved": False,
        "academic": configuration["dataset"].get("academic", False),
        "labels": configuration["labels"], "maxLength": configuration.get("maxLength", 128),
        "onnxruntimeVersion": ort.__version__, "fp32ParityMaxError": float(np.max(np.abs(actual - expected))),
        "files": {p.name: {"bytes": p.stat().st_size,
                          "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in (fp32, int8)},
    }
    (directory / "runtime-config.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
