# AI Legal Guard ⚖️

An automated legal assistant that finds Terms of Service, identifies risky clauses using a fine-tuned DistilBERT model, and provides a blunt AI verdict.

## 🚀 Features
- **Auto-Scan:** Automatically finds legal links on any homepage.
- **Deep Scraper:** Non-destructive text extraction for modern websites.
- **Local AI:** Real-time risk detection via fine-tuned NLP.
- **AI Verdict:** High-level summary and recommendation via Groq (Llama 3).

## 🛠️ Setup
1. Clone the repo.
2. Install dependencies: `pip install -r requirements.txt`.
3. Create a `.env` file in the root and add your `GROQ_API_KEY=your_key_here`.
4. Run the backend: `python app.py`.
5. Load the extension in Chrome: `chrome://extensions` -> `Load unpacked`.