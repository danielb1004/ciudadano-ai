"""Fine-tune BETO; evaluate the held-out test set once after model selection.
API reference: https://huggingface.co/docs/transformers/v4.46.2/en/main_classes/trainer
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"services/nlp-service/app"))
from preprocessing import normalize

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--splits", default="ml/datasets/splits")
    parser.add_argument("--output-dir", default="ml/models/beto-intents-v1")
    parser.add_argument("--base-model", default="dccuchile/bert-base-spanish-wwm-cased")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--max-length", type=int, default=128)
    parser.add_argument("--trainable-layers", type=int, default=12)
    parser.add_argument("--save-only-model", action="store_true")
    parser.add_argument("--cpu-threads", type=int, default=4)
    args = parser.parse_args()
    if not 0 <= args.trainable_layers <= 12 or not 16 <= args.max_length <= 512:
        parser.error("trainable-layers debe estar entre 0 y 12; max-length, entre 16 y 512.")
    splits, output = Path(args.splits), Path(args.output_dir)
    manifest = json.loads((splits / "manifest.json").read_text(encoding="utf-8"))
    labels = manifest["classes"]
    configuration = {"baseModel": args.base_model, "seed": manifest["seed"], "labels": labels, "dataset": manifest, "status": "prepared", "epochs": args.epochs, "batchSize": args.batch_size, "maxLength": args.max_length, "trainableLayers": args.trainable_layers, "saveOnlyModel": args.save_only_model}
    output.mkdir(parents=True, exist_ok=True)
    (output / "training-config.json").write_text(json.dumps(configuration, indent=2), encoding="utf-8")
    if args.prepare_only:
        print("Configuración preparada. No se entrenó ni se generaron métricas.")
        return
    import numpy as np
    import pandas as pd
    import torch
    from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer, EarlyStoppingCallback, DataCollatorWithPadding, set_seed
    set_seed(manifest["seed"])
    torch.set_num_threads(args.cpu_threads)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    label2id = {label: i for i, label in enumerate(labels)}
    class TextDataset(torch.utils.data.Dataset):
        def __init__(self, frame):
            self.encodings = tokenizer([normalize(text) for text in frame.text], truncation=True, max_length=args.max_length)
            self.labels = [label2id[label] for label in frame.intent]
        def __len__(self):
            return len(self.labels)
        def __getitem__(self, i):
            return {**{key: value[i] for key, value in self.encodings.items()}, "labels": self.labels[i]}
    frames = {name: pd.read_csv(splits / f"{name}.csv") for name in ("train", "validation", "test")}
    datasets = {name: TextDataset(frame) for name, frame in frames.items()}
    model = AutoModelForSequenceClassification.from_pretrained(args.base_model, num_labels=len(labels), label2id=label2id, id2label={i: label for label, i in label2id.items()})
    if args.trainable_layers < 12:
        for parameter in model.bert.embeddings.parameters(): parameter.requires_grad = False
        for layer in model.bert.encoder.layer[:12-args.trainable_layers]:
            for parameter in layer.parameters(): parameter.requires_grad = False
    configuration["device"] = "cuda" if torch.cuda.is_available() else "cpu"
    configuration["trainableParameters"] = sum(p.numel() for p in model.parameters() if p.requires_grad)
    configuration["totalParameters"] = sum(p.numel() for p in model.parameters())
    configuration["torchVersion"] = torch.__version__
    (output / "training-config.json").write_text(json.dumps(configuration, indent=2), encoding="utf-8")
    print(json.dumps({"device": configuration["device"], "trainableParameters": configuration["trainableParameters"], "totalParameters": configuration["totalParameters"]}), flush=True)
    def compute_metrics(prediction):
        predicted = np.argmax(prediction.predictions, axis=-1)
        return {"f1_macro": f1_score(prediction.label_ids, predicted, average="macro", zero_division=0)}
    training = TrainingArguments(output_dir=str(output / "checkpoints"), seed=manifest["seed"], data_seed=manifest["seed"], num_train_epochs=args.epochs, learning_rate=2e-5, weight_decay=.01, per_device_train_batch_size=args.batch_size, per_device_eval_batch_size=args.batch_size, eval_strategy="epoch", save_strategy="epoch", load_best_model_at_end=True, metric_for_best_model="f1_macro", greater_is_better=True, save_total_limit=2, save_only_model=args.save_only_model, logging_steps=25, report_to=[], use_cpu=not torch.cuda.is_available())
    trainer = Trainer(model=model, args=training, train_dataset=datasets["train"], eval_dataset=datasets["validation"], data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=compute_metrics, callbacks=[EarlyStoppingCallback(early_stopping_patience=2)])
    trainer.train()
    trainer.save_model(str(output))
    tokenizer.save_pretrained(str(output))
    prediction = trainer.predict(datasets["test"])
    predicted = [labels[i] for i in np.argmax(prediction.predictions, axis=-1)]
    actual = frames["test"].intent.tolist()
    results = {"model": "BETO", "academic": manifest["academic"], "dataset": manifest, "sampleCount": len(actual), "accuracy": accuracy_score(actual, predicted), "f1Macro": f1_score(actual, predicted, labels=labels, average="macro", zero_division=0), "f1Micro": f1_score(actual, predicted, average="micro", zero_division=0), "perCategory": classification_report(actual, predicted, labels=labels, output_dict=True, zero_division=0), "confusionMatrix": confusion_matrix(actual, predicted, labels=labels).tolist(), "labels": labels}
    (output / "test-metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    configuration["status"] = "trained"
    configuration["completedEpochs"] = trainer.state.epoch
    configuration["bestValidationF1"] = trainer.state.best_metric
    configuration["selectedCheckpoint"] = trainer.state.best_model_checkpoint
    (output / "training-config.json").write_text(json.dumps(configuration, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
if __name__ == "__main__":
    main()
