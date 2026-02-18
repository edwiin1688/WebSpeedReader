let currentLanguage = 'zh'; // 預設語言為繁體中文
let currentStyle = 'normal'; // 預設總結風格為標準摘要
let currentModel = 'openai/gpt-oss-20b'; // 預設模型
let summarizing = false; // 標記是否正在進行總結
let i18n = {}; // 多語系翻譯資料

// 從 _locales/{lang}/messages.json 載入多語系翻譯
async function loadLocales() {
  try {
    // 語言代碼映射 (zh → zh_TW)
    const langMap = {
      'zh': 'zh_TW',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es'
    };
    const localeCode = langMap[currentLanguage] || 'en';
    const url = chrome.runtime.getURL(`locales/${localeCode}/messages.json`);
    const response = await fetch(url);
    const data = await response.json();
    // 將載入的語言資料存入 i18n[currentLanguage]
    i18n[currentLanguage] = data;
  } catch (e) {
    console.error('Failed to load locale file:', e);
  }
}

// 取得翻譯文字的輔助函式
// path 例如 'ui.summarize', 'alerts.alertKey'
function t(path) {
  const lang = i18n[currentLanguage] || i18n['en'] || {};
  const fallback = i18n['en'] || {};
  const keys = path.split('.');
  let val = lang;
  let fb = fallback;
  for (const k of keys) {
    val = val?.[k];
    fb = fb?.[k];
  }
  return val ?? fb ?? path;
}



document.addEventListener('DOMContentLoaded', async function () {
  // 載入多語系翻譯
  await loadLocales();
  // 獲取 DOM 元素
  const languageSelect = document.getElementById('language-select');
  const styleSelect = document.getElementById('style-select');
  const modelSelect = document.getElementById('model-select'); // 新增
  const summarizeBtn = document.getElementById('summarize-btn');
  const copyBtn = document.getElementById('copy-btn');
  const ttsBtn = document.getElementById('tts-btn'); // 新增 TTS 按鈕
  const historyBtn = document.getElementById('history-btn');
  const clearSummaryBtn = document.getElementById('clear-summary-btn'); // 新增
  const customPromptArea = document.getElementById('custom-prompt-area'); // 新增
  const customPromptInput = document.getElementById('custom-prompt'); // 新增

  const messageDiv = document.getElementById('message');
  const summaryDiv = document.getElementById('summary');
  const apiKeyInput = document.getElementById('api-key');
  const apiKeyHint = document.getElementById('api-key-hint');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const maxTokensInput = document.getElementById('max-tokens'); // 新增 Max Tokens
  const loadingDiv = document.getElementById('loading');
  const loadingText = document.getElementById('loading-text');

  // 歷史紀錄相關 DOM
  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');
  const closeHistoryBtn = document.getElementById('close-history');
  const historyTitle = document.getElementById('history-title');
  const exportHistoryBtn = document.getElementById('export-history');
  const clearHistoryBtn = document.getElementById('clear-history');

  // 統計相關 DOM
  const statsDiv = document.getElementById('stats');
  const statsText = document.getElementById('stats-text');

  // 主題切換相關 DOM
  const themeToggle = document.getElementById('theme-toggle');
  const textColorPicker = document.getElementById('text-color-picker');
  const bgColorPicker = document.getElementById('bg-color-picker');

  // 進階設定相關 DOM
  const advancedSummary = document.getElementById('advanced-summary');
  const aiModelLabel = document.querySelector('label[for="model-select"]');
  const apiKeyLabel = document.querySelector('label[for="api-key"]');
  const maxTokensLabel = document.querySelector('label[for="max-tokens"]');

  let rawSummary = ''; // 儲存原始 Markdown 文本

  // 顯示版本號
  const versionNumber = document.getElementById('version-number');
  if (versionNumber) {
    versionNumber.textContent = chrome.runtime.getManifest().version;
  }

  // 載入之前的狀態
  chrome.storage.local.get(['language', 'summary', 'apiKey', 'style', 'pendingSelection', 'pendingTitle', 'theme', 'model', 'textColor', 'customBgColor', 'customPrompt'], async function (result) {
    console.log("🔍 [Popup] Storage 載入完成:", JSON.stringify(result, null, 2)); // Debug Log (可選)
    // 處理字體顏色
    if (result.textColor) {
      document.documentElement.style.setProperty('--text-color', result.textColor);
      textColorPicker.value = result.textColor;
    }
    // 處理自定義背景色
    if (result.customBgColor) {
      document.documentElement.style.setProperty('--bg-color', result.customBgColor);
      bgColorPicker.value = result.customBgColor;
    }
    // 處理主題
    let themeToUse = result.theme;
    if (!themeToUse) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        themeToUse = 'dark';
      } else {
        themeToUse = 'light';
      }
    }
    document.documentElement.setAttribute('data-theme', themeToUse);

    // 設定 picker 預設值 (如果沒有自定義)
    if (!result.textColor) {
      textColorPicker.value = themeToUse === 'dark' ? '#e0e0e0' : '#333333';
    }
    if (!result.customBgColor) {
      bgColorPicker.value = themeToUse === 'dark' ? '#1e1e1e' : '#ffffff';
    }

    // 優先初始化 API Key 與語言
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      updateApiKeyHint(result.apiKey);
    }
    updateLanguage();

    if (result.language) {
      currentLanguage = result.language; // 設定當前語言
      languageSelect.value = currentLanguage; // 更新語言選擇器的值
    }
    if (result.style) {
      currentStyle = result.style; // 設定當前風格
      styleSelect.value = currentStyle; // 更新風格選擇器的值
      // 如果預設就是 custom，顯示輸入框
      if (currentStyle === 'custom') {
        customPromptArea.style.display = 'block';
      }
    }
    if (result.customPrompt) {
      customPromptInput.value = result.customPrompt;
    }
    if (result.model) {
      currentModel = result.model; // 設定當前模型
      modelSelect.value = currentModel; // 更新模型選擇器的值
    }
    if (result.maxTokens) {
      maxTokensInput.value = result.maxTokens;
    }

    // 如果有背景選取的內容，優先處理
    // 如果有背景選取的內容，優先處理
    if (result.pendingSelection) {
      // 來自右鍵選單的內容
      const selectedText = result.pendingSelection;
      const selectedTitle = result.pendingTitle || t('ui.selectedContentSummary');
      // 清除 pending，避免和下一次開啟衝突
      chrome.storage.local.remove(['pendingSelection', 'pendingTitle']);
      // 自動觸發總結
      summarize(selectedText, selectedTitle);
    } else if (result.summary) {
      // 只有當前頁面 URL 與緩存的 summaryUrl 相符時，才顯示緩存
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab && currentTab.url === result.summaryUrl) {
        rawSummary = result.summary;
        summaryDiv.innerHTML = marked.parse(rawSummary); // 顯示之前的總結（渲染後）
        // 顯示統計（如果有的話）
        if (result.savedStats) {
          statsText.textContent = result.savedStats;
          statsDiv.classList.remove('hidden');
        }
      } else {
        // 如果 URL 不匹配，清除舊的摘要顯示
        chrome.storage.local.remove(['summary', 'summaryUrl', 'savedStats']);
        summaryDiv.innerHTML = '';
        statsDiv.classList.add('hidden');
      }
    }
  });

  // 更新 API Key 提示（最後三碼）
  function updateApiKeyHint(val) {
    if (val && val.length > 3) {
      apiKeyHint.textContent = '...' + val.slice(-3);
    } else {
      apiKeyHint.textContent = '';
    }
  }

  // API Key 輸入監聽
  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', function () {
      updateApiKeyHint(this.value);
    });
  }

  // 語言選擇器變更事件
  if (languageSelect) {
    languageSelect.addEventListener('change', async function () {
      currentLanguage = this.value; // 更新當前語言
      chrome.storage.local.set({ language: currentLanguage }); // 保存語言設定
      await loadLocales(); // 重新載入對應語言檔案
      updateLanguage(); // 更新語言相關的 UI 文本
    });
  }

  // PDF 手動上傳事件


  // 風格選擇器變更事件
  styleSelect.addEventListener('change', function () {
    currentStyle = this.value; // 更新當前風格
    chrome.storage.local.set({ style: currentStyle }); // 保存風格設定

    // 自定義指令顯示控制
    if (currentStyle === 'custom') {
      customPromptArea.style.display = 'block';
      customPromptInput.focus();
    } else {
      customPromptArea.style.display = 'none';
    }

    updateLanguage(); // 更新相關 UI (如果需要)
  });

  // 自定義指令輸入保存
  customPromptInput.addEventListener('input', function () {
    chrome.storage.local.set({ customPrompt: this.value });
  });

  // 模型選擇器變更事件
  modelSelect.addEventListener('change', function () {
    currentModel = this.value; // 更新當前模型
    chrome.storage.local.set({ model: currentModel }); // 保存模型設定
  });

  // Max Tokens 輸入保存
  maxTokensInput.addEventListener('input', function () {
    chrome.storage.local.set({ maxTokens: parseInt(this.value, 10) });
  });

  // 總結按鈕點擊事件
  if (summarizeBtn) {
    summarizeBtn.addEventListener('click', summarize);
  }

  // 清除按鈕點擊事件
  if (clearSummaryBtn) {
    clearSummaryBtn.addEventListener('click', function () {
      rawSummary = '';
      summaryDiv.innerHTML = ''; // 清空總結區域
      chrome.storage.local.remove('summary'); // 移除保存的總結
    });
  }

  // 複製按鈕點擊事件
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      const textToCopy = rawSummary;
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy).then(() => {
        // 視覺反饋
        const originalTitle = copyBtn.getAttribute('title');
        copyBtn.setAttribute('title', currentLanguage === 'zh' ? '已複製！' : 'Copied!');
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.setAttribute('title', originalTitle);
          copyBtn.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    });
  }

  // TTS 語音朗讀邏輯
  let isSpeaking = false;
  const synth = window.speechSynthesis;
  // 語言代碼映射表 (Map ISO 639-1 to BCP 47)
  const langMap = {
    'zh': 'zh-TW', // 繁體中文預設台灣口音
    'en': 'en-US',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'es': 'es-ES'
  };

  ttsBtn.addEventListener('click', function () {
    if (isSpeaking) {
      stopSpeak();
    } else {
      // 從 DOM 獲取純文字內容 (去除 Markdown 符號)
      // 使用 summaryDiv.innerText 而不是 rawSummary，因為 innerText 是已經渲染好的文字，讀起來比較順
      const textToRead = summaryDiv.innerText;
      if (!textToRead) return;

      speak(textToRead, langMap[currentLanguage] || 'en-US');
    }
  });

  function speak(text, lang) {
    if (synth.speaking) {
      console.error('speechSynthesis.speaking');
      return;
    }

    const utterThis = new SpeechSynthesisUtterance(text);
    utterThis.lang = lang;
    utterThis.rate = 1.0; // 語速
    utterThis.pitch = 1.0; // 音調

    utterThis.onstart = function () {
      isSpeaking = true;
      ttsBtn.classList.add('speaking');
      // 切換圖示為「停止」 (可選)
    };

    utterThis.onend = function () {
      isSpeaking = false;
      ttsBtn.classList.remove('speaking');
    };

    utterThis.onerror = function (event) {
      console.error('SpeechSynthesisUtterance.onerror', event);
      isSpeaking = false;
      ttsBtn.classList.remove('speaking');
    };

    synth.speak(utterThis);
  }

  function stopSpeak() {
    if (synth.speaking) {
      synth.cancel();
    }
    isSpeaking = false;
    ttsBtn.classList.remove('speaking');
  }

  // 當 Popup 關閉時停止朗讀，避免背景持續有聲音
  window.addEventListener('unload', function () {
    stopSpeak();
  });

  // 歷史紀錄按鈕點擊事件
  if (historyBtn && historyPanel) {
    historyBtn.addEventListener('click', function () {
      historyPanel.classList.toggle('hidden');
      if (!historyPanel.classList.contains('hidden')) {
        renderHistory();
      }
    });
  }

  // 關閉歷史紀錄
  if (closeHistoryBtn && historyPanel) {
    closeHistoryBtn.addEventListener('click', function () {
      historyPanel.classList.add('hidden');
    });
  }

  // 字體顏色切換事件
  if (textColorPicker) {
    textColorPicker.addEventListener('input', function () {
      const newColor = this.value;
      document.documentElement.style.setProperty('--text-color', newColor);
      chrome.storage.local.set({ textColor: newColor });
    });
  }

  // 背景色切換事件
  if (bgColorPicker) {
    bgColorPicker.addEventListener('input', function () {
      const newColor = this.value;
      document.documentElement.style.setProperty('--bg-color', newColor);
      chrome.storage.local.set({ customBgColor: newColor });
    });
  }

  // 匯出歷史紀錄
  if (exportHistoryBtn) {
    exportHistoryBtn.addEventListener('click', function () {
      chrome.storage.local.get(['history'], function (result) {
        const history = result.history || [];
        if (history.length === 0) {
          alert(t('alerts.noExportHistory'));
          return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `webspeedreader_history_${new Date().getTime()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      });
    });
  }

  // 清空歷史紀錄
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', function () {
      if (confirm(t('alerts.confirmClear'))) {
        chrome.storage.local.set({ history: [] }, function () {
          renderHistory();
        });
      }
    });
  }

  // 主題切換事件
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      chrome.storage.local.set({ theme: newTheme });

      // 切換主題時，重置所有自定義顏色，以免混淆
      chrome.storage.local.remove(['textColor', 'customBgColor', 'accentColor']);
      document.documentElement.style.removeProperty('--text-color');
      document.documentElement.style.removeProperty('--bg-color');
      document.documentElement.style.removeProperty('--accent-color');

      // 重置選擇器的顯示值
      if (textColorPicker) textColorPicker.value = newTheme === 'dark' ? '#e0e0e0' : '#333333';
      if (bgColorPicker) bgColorPicker.value = newTheme === 'dark' ? '#1e1e1e' : '#ffffff';
    });
  }

  // 保存 groq API Key 按鈕點擊事件
  if (saveApiKeyBtn && apiKeyInput) {
    saveApiKeyBtn.addEventListener('click', function () {
      const apiKey = apiKeyInput.value.trim(); // 獲取並修剪 groq API Key
      if (apiKey) {
        chrome.storage.local.set({ apiKey: apiKey }); // 保存 groq API Key
        alert(t('alerts.keySaved')); // 顯示保存成功訊息
      }
    });
  }

  // 更新語言相關的 UI 文本
  function updateLanguage() {
    const styles = t('styles');

    // 設定頁面標題
    document.title = t('ui.appTitle');

    // 按鈕文字
    if (summarizeBtn) summarizeBtn.textContent = t('ui.summarize');
    if (historyBtn) historyBtn.textContent = t('ui.history');
    if (clearSummaryBtn) clearSummaryBtn.textContent = t('ui.clear');
    if (saveApiKeyBtn) saveApiKeyBtn.textContent = t('ui.save');
    if (messageDiv) messageDiv.textContent = t('ui.message');
    if (loadingText) loadingText.textContent = t('ui.loading');
    if (historyTitle) historyTitle.textContent = t('ui.historyTitle');

    // Title 屬性
    if (themeToggle) themeToggle.setAttribute('title', t('ui.themeToggle'));
    if (textColorPicker) textColorPicker.setAttribute('title', t('ui.customTextColor'));
    if (bgColorPicker) bgColorPicker.setAttribute('title', t('ui.customBgColor'));
    if (copyBtn) copyBtn.setAttribute('title', t('ui.copyMarkdown'));
    if (ttsBtn) ttsBtn.setAttribute('title', t('ui.readAloud'));
    if (exportHistoryBtn) exportHistoryBtn.setAttribute('title', t('ui.exportHistory'));
    if (clearHistoryBtn) clearHistoryBtn.setAttribute('title', t('ui.clearHistory'));

    // 進階設定
    if (advancedSummary) {
      advancedSummary.textContent = t('ui.advancedSettings');
    }
    if (aiModelLabel) {
      aiModelLabel.textContent = t('ui.aiModel');
    }
    if (apiKeyLabel) {
      apiKeyLabel.textContent = t('ui.apiKey');
    }
    if (maxTokensLabel) {
      maxTokensLabel.textContent = t('ui.maxTokens');
    }

    // Placeholder
    if (styleSelect && Array.isArray(styles) && styles.length >= 4) {
      styleSelect.options[0].text = styles[0];
      styleSelect.options[1].text = styles[1];
      styleSelect.options[2].text = styles[2];
      styleSelect.options[3].text = styles[3];
    }
    customPromptInput.placeholder = t('ui.promptPlaceholder');
    maxTokensInput.placeholder = t('ui.maxTokensPlaceholder');
    apiKeyInput.placeholder = 'Groq API Key';
  }

  // 總結功能 (支援傳入特定內容)
  async function summarize(forcedContent = null, forcedTitle = null) {
    if (summarizing) return; // 如果正在總結，則返回
    summarizing = true; // 標記為正在總結
    summarizeBtn.disabled = true; // 禁用總結按鈕
    summaryDiv.innerHTML = ''; // 清空之前的總結
    statsDiv.classList.add('hidden'); // 隱藏統計
    rawSummary = ''; // 重置原始文本

    try {
      let pageContent = "";
      let tabTitle = "";
      let tabUrl = "";

      if (forcedContent) {
        pageContent = forcedContent;
        tabTitle = forcedTitle || t('ui.selectedContent');
        tabUrl = ""; // 選取內容可能無 URL 或不重要
      } else {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
          throw new Error("無法獲取當前頁面資訊。");
        }
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
          alert("此頁面受瀏覽器安全限制，無法執行擴充功能腳本。");
          summarizing = false;
          summarizeBtn.disabled = false;
          return;
        }

        tabTitle = tab.title;
        tabUrl = tab.url;


        // 確認內容腳本已加載
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['readability.js', 'content.js']
        });

        // 向內容腳本發送訊息以獲取頁面內容
        const pageContentResponse = await chrome.tabs.sendMessage(tab.id, { action: "getPageContent" });

        if (!pageContentResponse) {
          throw new Error("無法連接到頁面腳本，請嘗試重新整理頁面。");
        }
        pageContent = pageContentResponse.content;
      }

      // 獲取保存的 groq API Key
      const apiKey = await new Promise((resolve) => {
        chrome.storage.local.get('apiKey', function (result) {
          resolve(result.apiKey);
        });
      });

      if (!apiKey) {
        alert(t('alerts.alertKey')); // 提示設置 groq API Key
        summarizing = false; // 重置總結狀態
        summarizeBtn.disabled = false; // 啟用總結按鈕
        return;
      }

      // 根據語言與風格生成提示文本
      // 根據語言與風格生成提示文本
      let prompt = '';

      if (currentStyle === 'custom') {
        // 自定義模式：優先使用使用者輸入的指令
        const userCustomPrompt = customPromptInput.value.trim();
        if (userCustomPrompt) {
          prompt = userCustomPrompt + "\n\n";
        } else {
          // 如果使用者沒輸入，給一個預設的通用提示
          prompt = t('prompts.defaultCustom');
        }
      } else {
        // 標準模式 (Concise, Normal, Detailed)
        prompt = t('prompts.languagePrefix');

        // 取得對應風格的 prompt
        const styleKey = ['concise', 'detailed', 'normal'].includes(currentStyle) ? currentStyle : 'normal';
        prompt += t(`prompts.${styleKey}`);
      }

      prompt += pageContent;

      // 向 API 發送請求以獲取總結
      // 獲取設定的 max_tokens，若無則不傳（使用模型預設）
      const maxTokens = parseInt(maxTokensInput.value, 10);
      const requestPayload = {
        model: currentModel,
        messages: [{ role: "user", content: prompt }],
        stream: true
      };
      if (maxTokens && maxTokens > 0) {
        requestPayload.max_tokens = maxTokens;
      }

      const apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      const reader = apiResponse.body.getReader();
      const decoder = new TextDecoder("utf-8");
      loadingDiv.classList.remove('hidden'); // 顯示載入動畫

      // 逐行讀取 API 響應
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        const parsedLines = lines
          .map(line => line.replace(/^data: /, '').trim())
          .filter(line => line !== '' && line !== '[DONE]')
          .map(line => {
            try { return JSON.parse(line); } catch (e) { return null; }
          })
          .filter(line => line !== null);

        // 更新總結區域的內容
        for (const parsedLine of parsedLines) {
          const { choices } = parsedLine;
          const { delta } = choices[0];
          const { content } = delta;
          if (content) {
            loadingDiv.classList.add('hidden'); // 開始收到內容後，隱藏載入動畫
            rawSummary += content;
            summaryDiv.innerHTML = marked.parse(rawSummary);
          }
        }
      }



      // 計算並顯示統計資訊
      const originalText = String(pageContent || "");
      const originalLen = originalText.length;
      const summaryLen = rawSummary.length;

      if (originalLen > 0) {
        if (summaryLen > originalLen) {
          // 內容反而變多了
          statsText.textContent = t('stats.expanded')
            .replace('{original}', originalLen)
            .replace('{summary}', summaryLen);
        } else {
          const savedPercent = Math.round(((originalLen - summaryLen) / originalLen) * 100);
          statsText.textContent = t('stats.saved')
            .replace('{percent}', savedPercent)
            .replace('{original}', originalLen)
            .replace('{summary}', summaryLen);
        }
        statsDiv.classList.remove('hidden');
      }

      // 保存總結結果與當前 URL (防止跨頁顯示錯誤)
      chrome.storage.local.set({
        summary: rawSummary,
        summaryUrl: tabUrl,
        savedStats: statsText.textContent
      });

      // 儲存到歷史紀錄
      saveToHistory(rawSummary, tabTitle, tabUrl);
    } catch (error) {
      console.error('Error:', error);
      summaryDiv.textContent = t('errors.summarizeError'); // 顯示錯誤訊息
    } finally {
      summarizing = false; // 重置總結狀態
      summarizeBtn.disabled = false; // 啟用總結按鈕
      loadingDiv.classList.add('hidden'); // 確保隱藏載入動畫
    }
  }

  // 儲存到歷史紀錄 (最多 10 筆)
  function saveToHistory(summary, title, url) {
    chrome.storage.local.get(['history'], function (result) {
      let history = result.history || [];
      const newEntry = {
        summary: summary,
        title: title,
        url: url,
        date: new Date().toLocaleString(),
        timestamp: Date.now()
      };
      // 避免重複儲存相同的內容 (以內容或是 URL/標題組合判斷)
      history = history.filter(item => item.summary !== summary);
      history.unshift(newEntry);
      if (history.length > 10) {
        history.pop();
      }
      chrome.storage.local.set({ history: history });
    });
  }

  // 渲染歷史紀錄清單
  function renderHistory() {
    chrome.storage.local.get(['history'], function (result) {
      const history = result.history || [];
      historyList.innerHTML = '';
      if (history.length === 0) {
        historyList.innerHTML = `<div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">${t('alerts.noHistory')}</div>`;
        return;
      }

      history.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';
        itemDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1; overflow: hidden;">
              <div class="history-item-title">${item.title}</div>
              <div class="history-item-meta">
                <span>${item.date}</span>
              </div>
            </div>
            <button class="delete-item-btn" data-index="${index}" title="${t('ui.delete')}" style="background:none; border:none; padding: 4px; cursor: pointer; opacity: 0.5;">✕</button>
          </div>
        `;

        // 點擊載入歷史
        itemDiv.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-item-btn')) return;
          rawSummary = item.summary;
          summaryDiv.innerHTML = marked.parse(rawSummary);
          chrome.storage.local.set({ summary: rawSummary });
          historyPanel.classList.add('hidden');
          // 滾動到頂部
          window.scrollTo(0, 0);
        });

        // 單筆刪除邏輯
        const deleteBtn = itemDiv.querySelector('.delete-item-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetIndex = parseInt(deleteBtn.getAttribute('data-index'));
          const newHistory = [...history];
          newHistory.splice(targetIndex, 1);
          chrome.storage.local.set({ history: newHistory }, function () {
            renderHistory();
          });
        });

        historyList.appendChild(itemDiv);
      });
    });
  }
});