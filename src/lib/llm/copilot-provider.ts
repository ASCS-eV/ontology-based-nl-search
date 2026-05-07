import { CopilotClient, approveAll, type CopilotSession } from '@github/copilot-sdk'

let client: CopilotClient | null = null

/**
 * Get or create the shared CopilotClient.
 * The client is reused, but sessions are created per-request.
 */
async function getClient(): Promise<CopilotClient> {
  if (client) return client

  client = new CopilotClient()
  await client.start()
  return client
}

/**
 * Generate text using the Copilot CLI as LLM provider.
 * Creates a fresh session per request to avoid cross-query context contamination.
 */
export async function generateWithCopilot(
  systemPrompt: string,
  userPrompt: string,
  modelId: string
): Promise<string> {
  const c = await getClient()

  const session: CopilotSession = await c.createSession({
    model: modelId,
    onPermissionRequest: approveAll,
    systemMessage: {
      mode: 'replace',
      content: systemPrompt,
    },
  })

  try {
    const response = await session.sendAndWait({ prompt: userPrompt })
    return response?.data?.content ?? ''
  } finally {
    await session.disconnect()
  }
}

/**
 * Clean up the Copilot client on process exit.
 */
export async function disposeCopilotClient(): Promise<void> {
  if (client) {
    await client.stop()
    client = null
  }
}
