(function() {
    const keywords = ['terms', 'privacy', 'policy', 'legal'];
    const text = document.body.innerText.toLowerCase();
    if (keywords.some(k => text.includes(k))) {
        chrome.runtime.sendMessage({ type: "legalDetected" });
    }
})();