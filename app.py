import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq
from transformers import pipeline
import requests
from bs4 import BeautifulSoup

# 1. SETUP
load_dotenv()
app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

# 2. LOAD CUSTOM MODEL
print("Loading Custom Policy Guardian Model...")
try:
    model_path = "./my_policy_guardian_model"
    pipe = pipeline("text-classification", model=model_path, tokenizer=model_path)
    print("✅ Custom AI Brain Ready!")
except Exception as e:
    print(f"⚠️ Custom model folder not found, using generic. Error: {e}")
    pipe = pipeline("text-classification", model="distilbert-base-uncased-finetuned-sst-2-english")

@app.route('/', methods=['GET'])
def home():
    return "<h1>Legal AI Server is Active</h1>"

@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    try:
        data = request.get_json()
        texts = data.get("texts", [])
        if not texts: return jsonify([])

        texts = [t for t in texts if len(t) > 20]
        results = pipe(texts[:100])
        
        risky_output = []
        for i, res in enumerate(results):
            is_risky = res['label'] in ['LABEL_1', '1', 'NEGATIVE', 'RISKY']
            if is_risky and res['score'] > 0.5:
                risky_output.append({"clause": texts[i], "score": float(res['score'])})
        
        return jsonify(risky_output)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/final_verdict', methods=['POST'])
def final_verdict():
    try:
        data = request.get_json()
        risky_clauses = data.get("risky_clauses", [])
        
        if not risky_clauses:
            return jsonify({"verdict": "✅ The terms look standard and safe. No aggressive data-slurping or unfair termination clauses were detected."})

        all_text = "\n".join([r['clause'] for r in risky_clauses[:15]])
        
        # UPGRADED PROMPT FOR EXPLAINABLE VERDICT
        prompt = f"""
        You are a senior legal risk analyst. Analyze these risky clauses found in a website's terms:
        {all_text}

        Task:
        1. Summarize the specific risks found (e.g. loss of privacy, unfair account deletion, or hidden fees).
        2. Give a blunt recommendation: Accept or Reject.
        3. If the terms are predatory, you MUST use the phrase: 'This is very dangerous and should not be accepted at any cost'.
        
        Keep it under 70 words. Be direct and honest.
        """
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5
        )
        return jsonify({"verdict": completion.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"verdict": "Error calculating detailed verdict."}), 500

@app.route('/explain', methods=['POST'])
def explain():
    try:
        clause = request.json.get("clause", "")
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": "Explain this legal risk in 1 short sentence for a child."},
                      {"role": "user", "content": f"Clause: {clause}"}]
        )
        return jsonify({"explanation": completion.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"explanation": "AI is busy."}), 500

@app.route('/analyze_url', methods=['POST'])
def analyze_url():
    try:
        url = request.json.get("url")
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        for s in soup(['script', 'style', 'nav', 'footer']): s.decompose()
        text = soup.get_text().split('\n')
        clauses = [line.strip() for line in text if len(line.strip()) > 30][:50]
        results = pipe(clauses)
        risky = [clauses[i] for i, r in enumerate(results) if r['label'] in ['LABEL_1', '1', 'NEGATIVE']]
        prompt = f"Should I accept these terms? Blunt verdict:\n" + "\n".join(risky)
        completion = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "user", "content": prompt}])
        return jsonify({"verdict": completion.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)