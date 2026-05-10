document.getElementById('analyzePageBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    const resultsList = document.getElementById('resultsList');
    const verdictBox = document.getElementById('verdictBox');
    const verdictText = document.getElementById('verdictText');

    // Reset UI
    if(verdictBox) verdictBox.style.display = "none";
    statusDiv.innerText = "Initializing scan...";
    statusDiv.style.color = "black";
    resultsList.innerHTML = "";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab.url.toLowerCase();

    // 1. Check if current page is already a legal document
    const legalKeywords = ['terms', 'tos', 'condition', 'agreement', 'privacy', 'policy', 'legal'];
    const alreadyOnLegalPage = legalKeywords.some(k => currentUrl.includes(k));

    try {
        // 2. AUTO-FIND LEGAL LINK
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: findLegalLink,
        });

        const foundLinkResult = injectionResults[0].result;

        // 3. SMART REDIRECT LOGIC
        if (foundLinkResult && foundLinkResult.url) {
            const normalizedFound = normalizeUrl(foundLinkResult.url);
            const normalizedCurrent = normalizeUrl(tab.url);

            // Only redirect if we are NOT on a legal page and the URL is actually different
            if (!alreadyOnLegalPage && normalizedFound !== normalizedCurrent) {
                statusDiv.innerText = `Found ${foundLinkResult.type}. Redirecting...`;
                chrome.tabs.update(tab.id, { url: foundLinkResult.url });
                return; 
            }
        }

        // 4. DIRECT SCRAPER (Non-destructive, grabs all visible text)
        statusDiv.innerText = "Extracting text content...";
        const scrapeResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                // We grab the text directly from the live body. 
                // This is safe because we ARE NOT calling .remove() on the live site.
                const rawText = document.body.innerText;
                const lines = rawText.split(/\n/);
                
                const uniqueSet = new Set();
                lines.forEach(line => {
                    // Clean symbols like ">" and fix spacing
                    let clean = line.replace(/>/g, '').replace(/\s+/g, ' ').trim();
                    
                    // Lower threshold to catch short legal lines
                    if (clean.length > 12 && clean.length < 2000) {
                        uniqueSet.add(clean);
                    }
                });
                return Array.from(uniqueSet).join("\n");
            },
        });

        const rawTextFromScraper = scrapeResults[0].result;
        const clauses = rawTextFromScraper.split("\n").filter(s => s.trim().length > 10);

        if (clauses.length === 0) {
            statusDiv.innerText = "No readable text found. If this is a homepage, the Auto-Finder may have failed.";
            return;
        }

        // 5. RUN AI RISK SCAN
        statusDiv.innerText = `Analyzing ${clauses.length} clauses...`;
        const aiResponse = await fetch('http://127.0.0.1:5000/predict_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: clauses })
        });
        const riskyClauses = await aiResponse.json();

        // 6. SHOW VERDICT (ALWAYS)
        verdictBox.style.display = "block";
        verdictText.innerText = "AI is evaluating the final verdict...";
        
        const vResponse = await fetch('http://127.0.0.1:5000/final_verdict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ risky_clauses: riskyClauses })
        });
        const vData = await vResponse.json();
        verdictText.innerText = vData.verdict;

        // 7. DISPLAY RESULTS
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
                        const original = li.innerHTML;
                        li.innerHTML = `${original}<div class='explanation-box'>⌛ Thinking...</div>`;
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
            statusDiv.innerText = `Scan Complete: Found ${displayedClauses.size} unique risks.`;
        } else {
            statusDiv.innerText = "Scan Complete: This document looks safe!";
            statusDiv.style.color = "green";
        }
    } catch (e) {
        statusDiv.innerText = "Error: Check if app.py is running.";
        console.error(e);
    }
});

function normalizeUrl(url) {
    try {
        let u = new URL(url);
        return (u.host + u.pathname).toLowerCase().replace(/\/$/, "");
    } catch (e) {
        return url.toLowerCase().replace(/\/$/, "");
    }
}

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
