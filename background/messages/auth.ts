import type { PlasmoMessaging } from "@plasmohq/messaging"
import { setUser } from "~storage/auth"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { user } = req.body
    await setUser(user)
    res.send({ success: true })
  } catch (error) {
    res.send({ success: false, error })
  }
}

export default handler 