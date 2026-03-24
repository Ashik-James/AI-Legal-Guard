document.getElementById('analyzePageBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    const resultsList = document.getElementById('resultsList');
    const verdictBox = document.getElementById('verdictBox');
    const verdictText = document.getElementById('verdictText');

    if(verdictBox) verdictBox.style.display = "none";
    statusDiv.innerText = "Searching for legal link...";
    statusDiv.style.color = "black";
    resultsList.innerHTML = "";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
        // 1. AUTO-FIND LEGAL LINK
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: findLegalLink,
        });

        const result = injectionResults[0].result;
        
        // 2. REDIRECT IF ON HOME PAGE
        if (result && result.url && result.url !== tab.url) {
            statusDiv.innerText = `Found ${result.type}. Redirecting...`;
            chrome.tabs.update(tab.id, { url: result.url });
            return;
        }

        // 3. THE "CLONE & CLEAN" SCRAPER (Reads everything, breaks nothing)
        statusDiv.innerText = "Extracting text content...";
        const scrapeResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                // We CLONE the body so we can delete junk without breaking the real site
                const bodyClone = document.body.cloneNode(true);
                
                // Remove elements that definitely aren't legal terms from the CLONE
                const junk = bodyClone.querySelectorAll('script, style, nav, header, footer, noscript, iframe, svg, img');
                junk.forEach(j => j.remove());

                const rawText = bodyClone.innerText;
                const lines = rawText.split(/\n/);
                
                const uniqueSet = new Set();
                lines.forEach(line => {
                    // Clean symbols like ">" and fix spacing
                    let clean = line.replace(/>/g, '').replace(/\s+/g, ' ').trim();
                    
                    // Lower threshold to 12 characters to catch things like "IP Address" or "No Refunds"
                    if (clean.length > 12 && clean.length < 2000) {
                        uniqueSet.add(clean);
                    }
                });
                return Array.from(uniqueSet).join("\n");
            },
        });

        const rawText = scrapeResults[0].result;
        const clauses = rawText.split("\n").filter(s => s.length > 10);

        if (clauses.length === 0) {
            statusDiv.innerText = "No readable text found. Please highlight text manually.";
            return;
        }

        // 4. RUN AI RISK SCAN
        statusDiv.innerText = `Analyzing ${clauses.length} clauses...`;
        const aiResponse = await fetch('http://127.0.0.1:5000/predict_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: clauses })
        });
        const riskyClauses = await aiResponse.json();

        // 5. GET DETAILED VERDICT
        verdictBox.style.display = "block";
        verdictText.innerText = "AI is evaluating the final verdict...";
        
        const vResponse = await fetch('http://127.0.0.1:5000/final_verdict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ risky_clauses: riskyClauses })
        });
        const vData = await vResponse.json();
        verdictText.innerText = vData.verdict;

        // 6. DISPLAY RESULTS (Deduplicated)
        if (riskyClauses.length > 0) {
            const displayedClauses = new Set();
            riskyClauses.forEach(item => {
                const cleanText = item.clause.trim();
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
            statusDiv.innerText = "No major risks found. Standard terms.";
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