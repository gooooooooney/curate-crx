import { Storage } from "@plasmohq/storage"

export const storage = new Storage({
  area: "local" // 使用local storage以保持长期存储
})

export interface User {
  id: string
  token: string
}

export const getUser = async (): Promise<User | null> => {
  return await storage.get("user")
}

export const setUser = async (user: User) => {
  await storage.set("user", user)
}

export const clearUser = async () => {
  await storage.remove("user")
} 