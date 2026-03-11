(function() {
    const keywords = ['terms', 'privacy', 'policy', 'agreement', 'legal', 'tos'];
    const isLegalPage = keywords.some(k => window.location.href.toLowerCase().includes(k));
    const legalLink = findLegalLink();

    if (legalLink && !isLegalPage) {
        const tab = document.createElement('div');
        tab.id = 'legal-guard-tab';
        tab.innerText = "⚖️ Analyze ToS";
        document.body.appendChild(tab);

        tab.onclick = async () => {
            tab.innerText = "⌛ Scanning...";
            try {
                const res = await fetch('http://127.0.0.1:5000/analyze_url', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ url: legalLink.url })
                });
                const data = await res.json();
                alert(`AI VERDICT:\n\n${data.verdict}`);
                tab.innerText = "⚖️ Analyze ToS";
            } catch (e) {
                alert("Please start app.py first!");
                tab.innerText = "⚠️ Error";
            }
        };
    }
})();

function findLegalLink() {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
        if (['terms of service', 'privacy policy'].some(k => link.innerText.toLowerCase().includes(k))) {
            return { url: link.href };
        }
    }
    return null;
}