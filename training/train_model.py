# train_model.py (Final Version with Explicit Label Mapping)

import torch
from torch.utils.data import Dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import os # Import os for environment variable

# --- THIS IS THE CRUCIAL DEBUGGING STEP ---
# This forces PyTorch to report errors from the GPU immediately,
# giving a much more accurate traceback if the error persists.
os.environ['CUDA_LAUNCH_BLOCKING'] = "1"

# --- (Custom Dataset Class is the same) ---
class PolicyClausesDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len=256):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_len = max_len
    def __len__(self):
        return len(self.texts)
    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = int(self.labels[idx])
        encoding = self.tokenizer(
            text,
            max_length=256,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

# --- (Loading Data with Pandas is the same) ---
print("Loading dataset from local CSV files...")
train_df = pd.read_csv('train.csv')
val_df = pd.read_csv('validation.csv')
print("Dataset loaded successfully.")

# --- (Tokenizer and Dataset creation is the same) ---
model_name = "distilbert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
train_dataset = PolicyClausesDataset(texts=train_df.text.to_list(), labels=train_df.label.to_list(), tokenizer=tokenizer)
val_dataset = PolicyClausesDataset(texts=val_df.text.to_list(), labels=val_df.label.to_list(), tokenizer=tokenizer)

# --- THIS IS THE KEY FIX ---
# We explicitly tell the model how to map labels to IDs.
# This prevents any confusion if the labels are not perfectly 0 and 1.
model = AutoModelForSequenceClassification.from_pretrained(
    model_name,
    num_labels=2,
    id2label={0: "SAFE", 1: "UNFAIR"}, # Map integer ID to a string label
    label2id={"SAFE": 0, "UNFAIR": 1}   # Map string label back to an integer ID
)

# --- (TrainingArguments and compute_metrics are the same) ---
training_args = TrainingArguments(
    output_dir="./results", report_to="none", num_train_epochs=5,
    per_device_train_batch_size=16, per_device_eval_batch_size=32,
    warmup_steps=50, weight_decay=0.01, logging_dir="./logs",
    logging_steps=10, eval_strategy="epoch", save_strategy="epoch",
    load_best_model_at_end=True
)

def compute_metrics(pred):
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='binary', zero_division=0)
    acc = accuracy_score(labels, preds)
    return {'accuracy': acc, 'f1': f1, 'precision': precision, 'recall': recall}

# --- (Trainer is the same) ---
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    compute_metrics=compute_metrics,
)


print("\n--- Starting the Fine-Tuning Process on DistilBERT ---")
trainer.train()
print("--- Fine-Tuning Complete ---")

# --- (Saving model is the same) ---
final_model_path = "./my_policy_guardian_model"
trainer.save_model(final_model_path)
print(f"\nYour specialized model has been saved to: {final_model_path}")