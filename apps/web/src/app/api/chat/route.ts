import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText } from 'ai'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: any[] }

  try {
    const result = streamText({
      model: openrouter('meta-llama/llama-3.1-8b-instruct:free'),
      messages,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Error in chat API:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}