document.getElementById('analyzePageBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    const resultsList = document.getElementById('resultsList');
    const verdictBox = document.getElementById('verdictBox');
    const verdictText = document.getElementById('verdictText');

    verdictBox.style.display = "none";
    statusDiv.innerText = "Searching for legal documents...";
    statusDiv.style.color = "black";
    resultsList.innerHTML = "";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: findLegalLink,
        });

        const result = injectionResults[0].result;
        
        if (result && result.url && result.url !== tab.url) {
            statusDiv.innerText = `Found ${result.type}. Redirecting...`;
            chrome.tabs.update(tab.id, { url: result.url });
            return;
        }

        statusDiv.innerText = "Extracting unique text content...";
        const scrapeResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                const junk = document.querySelectorAll('script, style, nav, header, footer, noscript, iframe');
                junk.forEach(j => j.remove());

                const rawText = document.body.innerText;
                const lines = rawText.split(/\n|\. /);
                
                const uniqueSet = new Set();
                lines.forEach(line => {
                    const cleanLine = line.replace(/\s+/g, ' ').trim();
                    if (cleanLine.length > 30 && cleanLine.length < 1000) {
                        uniqueSet.add(cleanLine);
                    }
                });
                return Array.from(uniqueSet).join("\n");
            },
        });

        const rawText = scrapeResults[0].result;
        const clauses = rawText.split("\n").filter(s => s.length > 25);

        if (clauses.length === 0) {
            statusDiv.innerText = "No readable text found. Go to the Terms page manually.";
            return;
        }

        statusDiv.innerText = `Analyzing ${clauses.length} clauses...`;
        const aiResponse = await fetch('http://127.0.0.1:5000/predict_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: clauses })
        });
        const riskyClauses = await aiResponse.json();

        verdictBox.style.display = "block";
        verdictText.innerText = "AI is evaluating the risks...";
        
        const vResponse = await fetch('http://127.0.0.1:5000/final_verdict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ risky_clauses: riskyClauses })
        });
        const vData = await vResponse.json();
        verdictText.innerText = vData.verdict;

        if (riskyClauses.length > 0) {
            const displayedClauses = new Set();
            riskyClauses.forEach(item => {
                const cleanText = item.clause.replace(/\s+/g, ' ').trim();
                if (!displayedClauses.has(cleanText)) {
                    displayedClauses.add(cleanText);
                    const li = document.createElement('li');
                    li.className = 'unfair-item';
                    li.innerHTML = `⚠️ ${cleanText}`;
                    
                    li.onclick = async () => {
                        if (li.innerHTML.includes("💡")) return;
                        li.innerHTML += `<div class='explanation-box'>⌛ Thinking...</div>`;
                        const expRes = await fetch('http://127.0.0.1:5000/explain', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clause: cleanText })
                        });
                        const expData = await expRes.json();
                        li.lastChild.innerHTML = `💡 <b>Simple English:</b> ${expData.explanation}`;
                    };
                    resultsList.appendChild(li);
                }
            });
            statusDiv.innerText = `Found ${displayedClauses.size} unique risks. Click for details.`;
        } else {
            statusDiv.innerText = "Scan Complete: No major risks detected.";
            statusDiv.style.color = "green";
        }
    } catch (e) {
        statusDiv.innerText = "Error: Check if app.py is running.";
    }
});

function findLegalLink() {
    const keywords = ['terms', 'tos', 'condition', 'agreement', 'privacy', 'policy', 'legal'];
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
        const text = link.innerText.toLowerCase();
        const href = link.href.toLowerCase();
        if (keywords.some(k => text.includes(k) || href.includes(k))) {
            return { url: link.href, type: link.innerText.trim() || "Legal Link" };
        }
    }
    return null;
}