

export interface PageInfo {
  title: string
  description: string
  favicon: string
  image: string
  url: string
}

export const getPageInfo = async () => {
  try {
    const info = {
      description: "",
      image: "",
    }

    // 获取 meta description
    const metaDesc = document.querySelector('meta[name="description"]')
    const ogDesc = document.querySelector('meta[property="og:description"]')
    info.description = metaDesc?.getAttribute("content") || 
                      ogDesc?.getAttribute("content") || ""
    

    // 获取 favicon
    // const favicon = document.querySelector('link[rel="icon"]') ||
    //   document.querySelector('link[rel="shortcut icon"]')
    // info.favicon = favicon?.getAttribute("href") || ""

    // 获取图片
    const ogImage = document.querySelector('meta[property="og:image"]')
    if (ogImage) {
      info.image = ogImage.getAttribute("content") || ""
    } else {
      // 查找页面中合适的图片
      const images = Array.from(document.getElementsByTagName("img"))
      const suitableImage = images.find(img => {
        const { width, height } = img.getBoundingClientRect()
        return width >= 200 && height >= 200 && Math.abs(width - height) < 100
      })
      info.image = suitableImage?.src || ""
    }

    return info
  } catch (err) {
    console.error("Error in getPageInfo:", err)
    throw err // Re-throw to handle in popup
  }
} 