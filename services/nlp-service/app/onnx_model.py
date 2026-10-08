"""BETO inference from a locally verified INT8 ONNX checkpoint."""
import hashlib
import json
from pathlib import Path

class BetoOnnx:
    def __init__(self, directory, threads=2):
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer
        self.np = np
        directory = Path(directory)
        config = json.loads((directory / "runtime-config.json").read_text(encoding="utf-8"))
        if config.get("runtime") != "onnx":
            raise ValueError("Invalid runtime manifest.")
        filename = config.get("selectedArtifact", "model.int8.onnx")
        if filename not in ("model.onnx", "model.int8.onnx"):
            raise ValueError("Unexpected ONNX artifact.")
        artifact = directory / filename
        checksum = hashlib.sha256()
        with artifact.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                checksum.update(chunk)
        if checksum.hexdigest() != config["files"][artifact.name]["sha256"]:
            raise ValueError("ONNX artifact checksum mismatch.")
        self.labels = config["labels"]
        self.max_length = int(config["maxLength"])
        self.tokenizer = Tokenizer.from_file(str(directory / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=self.max_length)
        self.tokenizer.enable_padding(pad_id=self.tokenizer.token_to_id("[PAD]"), pad_token="[PAD]")
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, threads)
        options.inter_op_num_threads = 1
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(str(artifact), sess_options=options, providers=["CPUExecutionProvider"])
        self.inputs = {item.name for item in self.session.get_inputs()}
        if not self.inputs.issubset({"input_ids", "attention_mask", "token_type_ids"}):
            raise ValueError("Unexpected ONNX input contract.")
        self.predict(["Necesito información sobre el pasaporte"])

    def predict(self, texts):
        encoded = self.tokenizer.encode_batch(texts)
        data = {
            "input_ids": self.np.asarray([entry.ids for entry in encoded], dtype=self.np.int64),
            "attention_mask": self.np.asarray([entry.attention_mask for entry in encoded], dtype=self.np.int64),
            "token_type_ids": self.np.asarray([entry.type_ids for entry in encoded], dtype=self.np.int64),
        }
        logits = self.session.run(None, {name: data[name] for name in self.inputs})[0]
        logits -= logits.max(axis=1, keepdims=True)
        probabilities = self.np.exp(logits)
        probabilities /= probabilities.sum(axis=1, keepdims=True)
        return [(self.labels[int(row.argmax())], float(row.max())) for row in probabilities]
