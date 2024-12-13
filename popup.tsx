import { Button, Flex, Input, Space, Spin, message } from "antd"
import Text from "antd/es/typography/Text"
import { useEffect, useState } from "react"
import type { PageInfo } from "~services/page"
import { getPageInfo } from "~services/page"
import type { User } from "~storage/auth"
import { getUser } from "~storage/auth"
import "./popup.css"
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
      console.log(cookies)

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

  const quickSaveUrl = async (url: string) => {
    try {
      const response = await fetch(`${API_URL}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({ item: { url } })
      });
      const data = await response.json();
      setItemId(data.data.id);
      message.success("URL saved successfully!");
      return data.data.id;
    } catch (err) {
      message.error("Failed to save URL");
      throw err;
    }
  }

  const updateItemWithDetails = async (itemId: string, pageData: PageInfo) => {
    try {
      const response = await fetch(`${API_URL}/items`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({ updatedData: pageData, itemId })
      });

      if (!response.ok) {
        message.error("Failed to update page details");
      }
    } catch (err) {
      console.error(err);
    }
  }

  const fetchPageInfo = async () => {
    setLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.id || !tab.url) {
        throw new Error("Invalid tab or URL");
      }

      // Validate URL
      if (!tab.url.startsWith('http')) {
        throw new Error("Invalid URL protocol");
      }

      setPageInfo((prev) => ({
        ...prev,
        url: tab.url
      }));

      // Quick save URL first
      const savedItemId = await quickSaveUrl(tab.url);

      // Then asynchronously parse page details
      const info = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getPageInfo
      });

      const pageData = info[0].result;
      const url = new URL(tab.url);
      const fullPageInfo = {
        ...pageData,
        image: getAbsoluteUrl(url, pageData.image),
        title: tab.title,
        url: tab.url,
        favicon: getAbsoluteUrl(url, tab.favIconUrl)
      };

      setPageInfo(fullPageInfo);
      setSaved(true);

      // Update item with full details
      await updateItemWithDetails(savedItemId, fullPageInfo);
    } catch (err) {
      console.error("Error in fetchPageInfo:", err);
      message.error(`Failed to get page information: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const saveToBackend = (data: PageInfo) => {
    return updateItemWithDetails(itemId, data)

  }



  if (!user) {
    return (
      <Flex justify="center" align="center" className="size-[400px] p-4">
        <Button
          type="primary"
          onClick={() => window.open(`${process.env.PLASMO_PUBLIC_BASE_URL}/sign-in`)}>
          Sign in
        </Button>
      </Flex>
    )
  }

  return (
    <Flex gap="middle" vertical className="w-[400px] p-4 rounded-md">
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: "100%" }}>
          {saved && <Text type="success">Successfully saved!</Text>}
          {pageInfo?.image && (
            <img src={pageInfo.image} style={{ maxWidth: "100%", height: 200, objectFit: "cover" }} />
          )}
          <div>
            <div style={{ marginBottom: 8 }}>
              <label>Title</label>
              <Input
                value={pageInfo?.title}
                onChange={e => setPageInfo(prev => prev ? { ...prev, title: e.target.value } : prev)}
              />
            </div>
            <div>
              <label>Description</label>
              <Input.TextArea
                value={pageInfo?.description}
                rows={3}
                onChange={e => setPageInfo(prev => prev ? { ...prev, description: e.target.value } : prev)}
              />
            </div>
          </div>
          <Button type="primary" onClick={() => saveToBackend(pageInfo)} loading={loading}>
            Update
          </Button>
        </Space>
      </Spin>
    </Flex>
  )
}

export default IndexPopup
