import type { User } from "~storage/auth"

// 监听来自网站的登录消息
window.addEventListener("message", async (event) => {
  // 确保消息来自您的网站域名
  if (event.origin !== "http://localhost:3000") return

  if (event.data.type === "LOGIN_SUCCESS") {
    const user: User = event.data.user
    // 发送消息给插件背景页面
    await chrome.runtime.sendMessage({
      name: "auth",
      body: { user }
    })
  }
}) 