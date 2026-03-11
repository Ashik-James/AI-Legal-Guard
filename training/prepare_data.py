# prepare_data.py (Final Version with Strict 0/1 Filtering)

from datasets import load_dataset
import pandas as pd
import os

def create_dataset_files():
    """
    Downloads the Unfair ToS dataset, iterates through every row,
    and explicitly keeps ONLY the rows where the label is exactly 0 or 1.
    This guarantees a 100% clean dataset for training.
    """
    print("Downloading the Unfair ToS dataset from LEX_GLUE...")
    
    try:
        dataset = load_dataset("lex_glue", "unfair_tos")
    except Exception as e:
        print(f"Error downloading dataset: {e}")
        return

    print("Dataset downloaded successfully.")

    train_set = dataset['train']
    validation_set = dataset['validation']
    
    # --- THIS IS THE FINAL, GUARANTEED CLEANING METHOD ---
    print("\nStrictly filtering data for labels 0 and 1...")
    
    # --- Process Training Data ---
    clean_train_texts = []
    clean_train_labels = []
    for item in train_set:
        labels_list = item['labels']
        # Check 1: Is it a non-empty list?
        if isinstance(labels_list, list) and len(labels_list) > 0:
            label = labels_list[0]
            # Check 2: Is the label explicitly 0 or 1?
            if label in [0, 1]:
                clean_train_texts.append(item['text'])
                clean_train_labels.append(label)
    
    # --- Process Validation Data ---
    clean_val_texts = []
    clean_val_labels = []
    for item in validation_set:
        labels_list = item['labels']
        if isinstance(labels_list, list) and len(labels_list) > 0:
            label = labels_list[0]
            if label in [0, 1]:
                clean_val_texts.append(item['text'])
                clean_val_labels.append(label)

    print("Data cleaning and filtering complete.")
    print(f"  - Kept {len(clean_train_texts)} valid rows for training.")
    print(f"  - Kept {len(clean_val_texts)} valid rows for validation.")

    # --- Create DataFrames from the 100% clean lists ---
    train_df = pd.DataFrame({'text': clean_train_texts, 'label': clean_train_labels})
    validation_df = pd.DataFrame({'text': clean_val_texts, 'label': clean_val_labels})

    # --- Save the clean files ---
    
    if not os.path.exists('data'):
        os.makedirs('data')

    train_csv_path = 'data/train.csv'
    validation_csv_path = 'data/validation.csv'

    train_df.to_csv(train_csv_path, index=False)
    validation_df.to_csv(validation_csv_path, index=False)

    print(f"\nSuccessfully created GUARANTEED CLEAN dataset files:")
    print(f"  - Training data saved to: {train_csv_path} ({len(train_df)} rows)")
    print(f"  - Validation data saved to: {validation_csv_path} ({len(validation_df)} rows)")
    print("\nYou are now ready for fine-tuning!")


if __name__ == '__main__':
    create_dataset_files()