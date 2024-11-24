import { Button, Input, Space, message } from "antd"
import Text from "antd/es/typography/Text"
import { useEffect, useState } from "react"
import type { PageInfo } from "~services/page"
import { getPageInfo } from "~services/page"
import type { User } from "~storage/auth"
import { getUser } from "~storage/auth"

function getAbsoluteUrl(url: URL, relativeUrl: string): string {
  if (!relativeUrl) return '';
  
  // 如果已经是绝对路径，直接返回
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  
  // 如果是以 // 开头的协议相对路径
  if (relativeUrl.startsWith('//')) {
    return url.protocol + relativeUrl;
  }
  
  // 如果是以 / 开头的绝对路径
  if (relativeUrl.startsWith('/')) {
    return `${url.origin}${relativeUrl}`;
  }
  
  // 处理相对路径
  return `${url.origin}/${relativeUrl}`;
}

function IndexPopup() {

  const API_URL = `${process.env.PLASMO_PUBLIC_BASE_URL}/api/v3`
  const [user, setUser] = useState<User | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      fetchPageInfo()
    }
  }, [user])

  const checkAuth = async () => {
    setLoading(true)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const domain = process.env.PLASMO_PUBLIC_BASE_URL

      const cookies = await chrome.cookies.get({
        url: domain,
        name: "__session"
      })

      if (!cookies?.value) {
        window.open(`${domain}/sign-in`, "_blank")
        window.close()
        return
      }

      const userData = await getUser()
      if (userData) {
        setUser(userData)
      }
    } catch (err) {
      console.error("Auth check failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPageInfo = async () => {
    setLoading(true)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab.id) {
        throw new Error("No tab id found")
      }

      if (!tab.url) {
        throw new Error("No URL found")
      }

      // 检查是否是有效的 URL
      if (!tab.url.startsWith('http')) {
        throw new Error("Invalid URL protocol")
      }

      const info = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getPageInfo
      })

      
      const pageData = info[0].result
      const url = new URL(tab.url)
      const pageInfo = {
        ...pageData,
        image: getAbsoluteUrl(url, pageData.image),
        title: tab.title,
        url: tab.url,
        favicon: getAbsoluteUrl(url, tab.favIconUrl)
      };
      setPageInfo(pageInfo)
      if (!saved) {
        const res = await saveToBackend(pageInfo)
        if (res) {
          setSaved(true)
        }
      }
    } catch (err) {
      console.error("Error in fetchPageInfo:", err)
      message.error(`获取页面信息失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveToBackend = (data: PageInfo) => {
    return fetch(`${API_URL}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user.token}`
      },
      body: JSON.stringify({ item: data })
    })
      .then(res => res.json())
      .then(res => {
        setItemId(res.data.id)
        message.success("保存成功")
        return true
      })
      .catch(err => {
        message.error("保存失败")
        return false
      })

  }

  const handleUpdate = async () => {
    if (!pageInfo || !user) return
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/items`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({ updatedData: pageInfo, id: itemId })
      })

      if (response.ok) {
        message.success("更新成功")
      } else {
        message.error("更新失败")
      }
    } catch (err) {
      message.error("更新失败")
    }
    setLoading(false)
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>
  }

  if (!user) {
    return (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => window.open(`${process.env.PLASMO_PUBLIC_BASE_URL}/sign-in`)}>
          请先登录
        </Button>
      </div>
    )
  }

  return (
    <div style={{ width: 400, padding: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        {saved && <Text type="success">已成功收藏!</Text>}
        {pageInfo?.image && (
          <img src={pageInfo.image} style={{ maxWidth: "100%", height: 200, objectFit: "cover" }} />
        )}
        <div>
          <div style={{ marginBottom: 8 }}>
            <label>标题</label>
            <Input
              value={pageInfo?.title}
              onChange={e => setPageInfo(prev => prev ? { ...prev, title: e.target.value } : prev)}
            />
          </div>
          <div>
            <label>描述</label>
            <Input.TextArea
              value={pageInfo?.description}
              rows={3}
              onChange={e => setPageInfo(prev => prev ? { ...prev, description: e.target.value } : prev)}
            />
          </div>
        </div>
        <Button type="primary" onClick={() => saveToBackend(pageInfo)} loading={loading}>
          确定
        </Button>
      </Space>
    </div>
  )
}

export default IndexPopup
