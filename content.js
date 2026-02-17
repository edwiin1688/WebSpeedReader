// 監聽來自擴充功能背景或彈出視窗的訊息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // 檢查訊息的動作是否為 "getPageContent"
  if (request.action === "getPageContent") {
    try {
      // 使用 Readability 提取主體內容
      const article = new Readability(document.cloneNode(true)).parse();
      // 如果成功提取，則回傳標題 + 內容；否則回退到原本的 innerText
      const finalContent = article ? `${article.title}\n\n${article.textContent}` : document.body.innerText;
      sendResponse({ content: finalContent });
    } catch (e) {
      console.error("Readability parse error:", e);
      sendResponse({ content: document.body.innerText });
    }
  }
});