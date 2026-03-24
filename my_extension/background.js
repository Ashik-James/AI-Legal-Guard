chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.type === "legalDetected") {
    chrome.action.setBadgeText({ text: "!", tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000", tabId: sender.tab.id });
  }
});