import cssText from "data-text:~/contents/style.css"
import { Button, Textarea, Input, NextUIProvider, Spinner, Alert, Card, CardHeader, CardBody, Image, Link } from "@nextui-org/react"
import { useEffect, useState } from "react"
import type { PageInfo } from "~services/page"
import { getPageInfo } from "~services/page"
import type { User } from "~storage/auth"
import { getUser } from "~storage/auth"
import type { PlasmoGetStyle } from "plasmo"
import { MessageType } from "~messages/types"

// 添加全局标记，用于检查脚本是否已加载
declare global {
    interface Window {
        __SAVE_PAGE_LOADED__: boolean;
    }
}

window.__SAVE_PAGE_LOADED__ = true;

// 导出getStyle以注入样式到Shadow DOM
export const getStyle: PlasmoGetStyle = () => {
    const style = document.createElement("style")
    style.textContent = cssText
    return style
}

// 配置注入位置
export const getInlineAnchor = async () => {
    return document.body
}

// 完整实现getAbsoluteUrl函数
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

    // 处相对路径
    return `${url.origin}/${relativeUrl}`;
}

function SavePageContent() {
    const API_URL = `${process.env.PLASMO_PUBLIC_BASE_URL}/api/v3`
    const [user, setUser] = useState<User | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [itemId, setItemId] = useState<string | null>(null)
    const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [saved, setSaved] = useState(false)
    const [deleted, setDeleted] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    // 保持原有的useEffect和函数逻辑不变
    useEffect(() => {
        setError(null)
        checkAuth()
    }, [])

    // useEffect(() => {
    //     if (user) {
    //         fetchPageInfo()
    //     }
    // }, [user])

    // 添加消息监听
    useEffect(() => {
        const messageListener = async (message) => {
            if (message.type === MessageType.TOGGLE_SAVE_UI) {
                setIsOpen(true);
                if (user) {
                    await fetchPageInfo();
                }
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);
        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, [user]);

    // 修改点击外部关闭的处理函数
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // 检查点击事件的路径中是否包含我们的组件
            const path = event.composedPath();
            const container = document.querySelector('plasmo-csui').shadowRoot.querySelector('.save-page-container');

            if (container && !path.includes(container) && isOpen) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            // 使用 capture 和 passive 选项来确保事件能被正确捕获
            document.addEventListener('click', handleClickOutside, { capture: true, passive: true });
            return () => {
                document.removeEventListener('click', handleClickOutside, { capture: true });
            };
        }
    }, [isOpen]);

    const checkAuth = async () => {
        setLoading(true);
        try {
            const domain = process.env.PLASMO_PUBLIC_BASE_URL;

            const response = await chrome.runtime.sendMessage({
                type: MessageType.GET_SESSION_COOKIE
            });

            const cookie = response.cookie;
            if (!cookie?.value) {
                window.open(`${domain}/sign-in`, "_blank");
                return;
            }

            const userData = await getUser();
            if (userData) {
                setUser(userData);
            }
        } catch (err) {
            console.error("Auth check failed:", err);
            setError("Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    const makeRequest = async (method: string, endpoint: string, body: any) => {
        const response = await chrome.runtime.sendMessage({
            type: MessageType.API_REQUEST,
            data: {
                url: `${API_URL}${endpoint}`,
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${user?.token}`,
                },
                body
            }
        });

        if (!response.success) {
            throw new Error(response.error);
        }

        return response.data;
    };

    const quickSaveUrl = async (url: string) => {
        try {
            const data = await makeRequest("POST", "/items", {
                item: {
                    url,
                    title: document.title,
                    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
                }
            });

            setItemId(data.data.id);
            setError(null);
            return data.data.id;
        } catch (err) {
            console.error("QuickSave Error:", err);
            setError(`Failed to save URL: ${err.message}`);
            throw err;
        }
    };

    const updateItemWithDetails = async (itemId: string, pageData: PageInfo) => {
        try {
            await makeRequest("PUT", "/items", {
                updatedData: pageData,
                itemId
            });
        } catch (err) {
            console.error("Update Error:", err);
            setError(`Failed to update item: ${err.message}`);
            throw err;
        }
    };

    const fetchPageInfo = async () => {
        setLoading(true);
        try {
            const url = window.location.href;

            if (!url.startsWith('http')) {
                throw new Error("Invalid URL protocol");
            }

            setPageInfo((prev) => ({
                ...prev,
                url: url
            }));

            // Quick save URL first
            const savedItemId = await quickSaveUrl(url);

            // Get page info directly since we're in content script
            const pageData = await getPageInfo();

            const urlObj = new URL(url);
            const fullPageInfo = {
                ...pageData,
                image: getAbsoluteUrl(urlObj, pageData.image),
                title: document.title,
                url: url,
                favicon: getAbsoluteUrl(urlObj, document.querySelector('link[rel="icon"]')?.getAttribute('href') || '')
            };

            setPageInfo(fullPageInfo);
            setSaved(true);

            // Update item with full details
            await updateItemWithDetails(savedItemId, fullPageInfo);
        } catch (err) {
            console.error("Error in fetchPageInfo:", err);
            setError(`Failed to get page information: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const saveToBackend = async (data: PageInfo) => {
        if (!itemId) {
            setError("No item ID found");
            return;
        }
        setLoading(true);
        try {
            await updateItemWithDetails(itemId, data);
            setSaved(true);
        } catch (err) {
            setError("Failed to save changes");
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async () => {
        if (!itemId) {
            setError("No item ID found");
            return;
        }
        setLoading(true);
        try {
            await makeRequest("DELETE", `/items/delete`, {
                itemIds: [itemId]
            });
            setSaved(false);
            setItemId(null);
            setError(null);
            setDeleted(true);
            setTimeout(() => {
                setDeleted(false);
                setIsOpen(false);

            }, 4000);
        } catch (err) {
            console.error("Delete Error:", err);
            setError(`Failed to delete item: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <NextUIProvider>
            <div className="fixed rounded-xl top-4 right-4 z-50 save-page-container light">
                {isOpen && (
                    <Card className="w-96 p-2 rounded-xl relative">
                        <CardHeader >
                            {error && <Alert color="danger" title="Error" description={error} />}
                            {saved && <Alert
                                color="success"
                                title="Successfully saved!"
                                endContent={(
                                    <Button
                                        color="success"
                                        size="sm"
                                        variant="flat"
                                        as={Link}
                                        href={`${process.env.PLASMO_PUBLIC_BASE_URL}/items`}
                                        target="_blank"
                                    >
                                        View
                                    </Button>
                                )}

                            />}
                            {
                                deleted && <Alert
                                    color="danger"
                                    title="Deleted"
                                    description="Item has been deleted."
                                />
                            }
                        </CardHeader>
                        <CardBody>
                            {user ? (
                                <div className="flex flex-col gap-2">
                                    {pageInfo?.image && (
                                        <Image
                                            src={pageInfo.image}
                                            width={200}
                                            height={200}
                                            isBlurred
                                            removeWrapper
                                            className="rounded-md w-full object-cover"
                                            alt="Page Image"
                                        />
                                    )}
                                    <div>
                                        <div style={{ marginBottom: 8 }}>
                                            <Input
                                                size="sm"
                                                variant="bordered"
                                                placeholder="Title"
                                                label="Title"
                                                value={pageInfo?.title}
                                                onChange={e => setPageInfo(prev =>
                                                    prev ? { ...prev, title: e.target.value } : prev
                                                )}
                                            />
                                        </div>
                                        <div>
                                            <Textarea
                                                size="sm"
                                                variant="bordered"
                                                placeholder="Description"
                                                label="Description"
                                                value={pageInfo?.description}
                                                rows={2}
                                                onChange={e => setPageInfo(prev =>
                                                    prev ? { ...prev, description: e.target.value } : prev
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            size="sm"
                                            color="danger"
                                            variant="solid"
                                            isDisabled={!itemId || loading}
                                            onPress={deleteItem}
                                        >
                                            Delete
                                        </Button>
                                        <Button
                                            variant="solid"
                                            size="sm"
                                            color="primary"
                                            onPress={() => saveToBackend(pageInfo)}
                                            isDisabled={loading || !pageInfo}
                                        >
                                            Update
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <Button
                                        variant="solid"
                                        color="primary"
                                        onPress={() => window.open(`${process.env.PLASMO_PUBLIC_BASE_URL}/sign-in`)}
                                    >
                                        Sign in
                                    </Button>
                                </div>
                            )}
                            {loading && <Spinner className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />}
                        </CardBody>
                    </Card>
                )}
            </div>
        </NextUIProvider>
    );
}

export default SavePageContent 