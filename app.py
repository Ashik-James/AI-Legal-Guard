import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq
from transformers import pipeline

load_dotenv()
app = Flask(__name__)
CORS(app)

# 1. SETUP GROQ
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# 2. LOAD CUSTOM MODEL
print("Loading Custom Model...")
try:
    model_path = "./my_policy_guardian_model"
    pipe = pipeline("text-classification", model=model_path, tokenizer=model_path)
    print("✅ Custom AI Ready!")
except Exception as e:
    print(f"⚠️ Using generic fallback. Error: {e}")
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

        results = pipe(texts[:100])
        risky_output = []
        for i, res in enumerate(results):
            # Check for standard risk labels
            is_risky = res['label'] in ['LABEL_1', '1', 'NEGATIVE', 'RISKY']
            # Increased sensitivity to 0.4
            if is_risky and res['score'] > 0.4:
                risky_output.append({"clause": texts[i], "score": float(res['score'])})
        return jsonify(risky_output)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/final_verdict', methods=['POST'])
def final_verdict():
    try:
        data = request.get_json()
        risky = data.get("risky_clauses", [])
        
        if not risky:
            return jsonify({"verdict": "✅ No dangerous clauses were found. This document appears safe to accept for normal use."})

        all_text = "\n".join([f"- {r['clause']}" for r in risky[:15]])
        
        # SMARTER ANALYST PROMPT
        prompt = f"""
        You are a senior legal risk analyst. Evaluate these flagged clauses from a website:
        {all_text}

        1. Explain exactly what the risks are (e.g. they can sell your data, delete your account, or charge you hidden fees).
        2. Give a blunt recommendation: Accept or Reject.
        3. If predatory, use the phrase: 'This is very dangerous and should not be accepted at any cost'.
        
        Keep it under 70 words. Be blunt and direct.
        """
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        return jsonify({"verdict": completion.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"verdict": "Error calculating verdict."}), 500

@app.route('/explain', methods=['POST'])
def explain():
    try:
        clause = request.json.get("clause", "")
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": "Explain why this legal clause is a risk in 1 short sentence for a child."},
                      {"role": "user", "content": f"Clause: {clause}"}]
        )
        return jsonify({"explanation": completion.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"explanation": "AI Error"}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=False, use_reloader=False)