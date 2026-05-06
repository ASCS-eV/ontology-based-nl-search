import { CopilotClient, approveAll, type CopilotSession } from '@github/copilot-sdk'

let client: CopilotClient | null = null
let session: CopilotSession | null = null

/**
 * Get or create a persistent CopilotClient + session.
 * The SDK handles all auth internally via the Copilot CLI.
 */
async function getSession(modelId: string, systemPrompt: string): Promise<CopilotSession> {
  if (session) return session

  if (!client) {
    client = new CopilotClient()
    await client.start()
  }

  session = await client.createSession({
    model: modelId,
    onPermissionRequest: approveAll,
    systemMessage: {
      mode: 'replace',
      content: systemPrompt,
    },
  })

  return session
}

/**
 * Generate text using the Copilot CLI as LLM provider.
 * Uses @github/copilot-sdk which handles enterprise OAuth auth internally.
 */
export async function generateWithCopilot(
  systemPrompt: string,
  userPrompt: string,
  modelId: string,
): Promise<string> {
  const s = await getSession(modelId, systemPrompt)

  const response = await s.sendAndWait({ prompt: userPrompt })

  return response?.data?.content ?? ''
}

/**
 * Clean up the Copilot client on process exit.
 */
export async function disposeCopilotClient(): Promise<void> {
  if (session) {
    await session.disconnect()
    session = null
  }
  if (client) {
    await client.stop()
    client = null
  }
}
