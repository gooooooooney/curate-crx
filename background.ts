import { MessageType } from "~messages/types"

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  
  try {
    // 检查脚本是否已注入
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return window.__SAVE_PAGE_LOADED__;
      }
    });
  } catch {
    // 如果脚本未注入，则注入
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["contents/save-page.js"]
    });
  }

  // 发送消息触发UI显示
  await chrome.tabs.sendMessage(tab.id, { type: MessageType.TOGGLE_SAVE_UI });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-page") {
    // 先保存,然后打开popup
    chrome.action.openPopup()
  }
})

// 添加消息处理器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MessageType.GET_SESSION_COOKIE) {
    const domain = process.env.PLASMO_PUBLIC_BASE_URL;
    chrome.cookies.get({
      url: domain,
      name: "__session"
    }).then(cookie => {
      sendResponse({ cookie });
    });
    return true;
  }

  if (message.type === MessageType.API_REQUEST) {
    const { url, method, headers, body } = message.data;
    
    fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    .then(response => response.json())
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true;
  }
}); 