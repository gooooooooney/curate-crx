import type { User } from "~storage/auth"

// 监听来自主站的登录状态
window.addEventListener("message", async (event) => {
  // 确保消息来自您的主站域名
  if (event.origin !== process.env.PLASMO_PUBLIC_BASE_URL) return

  if (event.data.type === "LOGIN_SUCCESS") {
    const user: User = event.data.user
    // 发送消息给插件背景页面
    await chrome.runtime.sendMessage({
      name: "auth",
      body: { user }
    })
  }
}) 