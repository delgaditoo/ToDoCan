import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type GeminiModel = {
  name?: string
  supportedGenerationMethods?: string[]
}

type GeminiListModelsResponse = {
  models?: GeminiModel[]
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
}

function safeStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return []
  return x
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

function tryParseJsonArray(text: string): string[] {
  const t = (text ?? '').trim()
  if (!t) return []

  try {
    return safeStringArray(JSON.parse(t))
  } catch {}

  const codeBlock = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlock?.[1]) {
    try {
      return safeStringArray(JSON.parse(codeBlock[1]))
    } catch {}
  }

  const bracket = t.match(/\[[\s\S]*\]/)
  if (bracket?.[0]) {
    try {
      return safeStringArray(JSON.parse(bracket[0]))
    } catch {}
  }

  return []
}

async function listGenerateModels(apiKey: string): Promise<string[]> {
  const listRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { method: 'GET' }
  )
  if (!listRes.ok) return []

  const listJson = (await listRes.json()) as GeminiListModelsResponse
  return (listJson.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name)
    .filter(Boolean) as string[]
}

function pickFrom(names: string[], needles: string[]): string | null {
  for (const n of needles) {
    const hit = names.find((x) => x.includes(n))
    if (hit) return hit
  }
  return null
}

async function callGemini(opts: {
  apiKey: string
  modelName: string
  systemInstruction: string
  userPrompt: string
  temperature: number
  maxOutputTokens: number
}) {
  const { apiKey, modelName, systemInstruction, userPrompt, temperature, maxOutputTokens } = opts

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    }),
  })

  const rawText = await res.text()
  const contentType = res.headers.get('content-type') || ''

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      contentType,
      rawText,
      modelName,
      geminiText: '',
      titles: [] as string[],
      geminiJson: null as GeminiGenerateResponse | null,
    }
  }

  let geminiJson: GeminiGenerateResponse | null = null
  try {
    geminiJson = rawText ? (JSON.parse(rawText) as GeminiGenerateResponse) : null
  } catch {
    return {
      ok: false as const,
      status: 502,
      contentType,
      rawText,
      modelName,
      geminiText: '',
      titles: [] as string[],
      geminiJson: null,
    }
  }

  const parts = geminiJson?.candidates?.[0]?.content?.parts ?? []
  const geminiText = parts.map((p) => p.text ?? '').join('').trim()
  const titles = tryParseJsonArray(geminiText)

  return {
    ok: true as const,
    status: 200,
    contentType,
    rawText,
    modelName,
    geminiText,
    titles,
    geminiJson,
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))

    const input = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!input) return NextResponse.json({ error: 'Missing text' }, { status: 400 })

    // Wichtig: Flag kommt vom Frontend (Checkbox beim Generieren)
    const flagged = Boolean(body?.flagged)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })

    const supabase = await createClient()
    const { data: userData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized', detail: authErr?.message }, { status: 401 })
    }
    const userId = userData.user.id

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

    const isAdmin = profile?.role === 'admin'


    const systemInstruction = [
      'You generate realistic, concrete todos from user input.',
      'Infer implied actions when the input is a statement.',
      'Todos must be real-world actions a human can do.',
      'Avoid meta tasks like "clarify", "define success", "list steps", "plan", "schedule time".',
      'Do NOT repeat or paraphrase the input.',
      'Return ONLY a JSON array of strings. No markdown, no explanations.',
      'Each string must start with a verb.',
      'Choose an appropriate number of items based on the input (could be 1 to 7).',
      'If the input yields only one sensible action, output only one item.',
      'CRITICAL: Output the todos in the SAME LANGUAGE as the user input. If mixed, use the dominant language.',
    ].join('\n')

    // Few-shot nur minimal, damit Stil klar ist, ohne Anzahl zu erzwingen
    const userPrompt = [
      'Examples:',
      'Input: "Tomorrow is my dad\'s birthday"',
      'Output: ["Buy a present for dad","Call dad to congratulate"]',
      'Input: "Read a book"',
      'Output: ["Choose a book to read","Read 20 pages"]',
      '',
      `Now generate todos for this input: """${input}"""`,
    ].join('\n')

    const available = await listGenerateModels(apiKey)
    const modelTryOrder = [
      pickFrom(available, ['gemini-2.5-pro', 'gemini-2.0-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']),
      'models/gemini-2.0-flash',
      'models/gemini-1.5-flash',
    ].filter(Boolean) as string[]

    const attempts = [
      { temperature: 0.2, maxOutputTokens: 256 },
      { temperature: 0.35, maxOutputTokens: 256 },
    ]

    let best: Awaited<ReturnType<typeof callGemini>> | null = null

    for (const modelName of modelTryOrder) {
      for (const cfg of attempts) {
        const out = await callGemini({
          apiKey,
          modelName,
          systemInstruction,
          userPrompt,
          temperature: cfg.temperature,
          maxOutputTokens: cfg.maxOutputTokens,
        })
        best = out

        // Hier entscheidest du wie viele du maximal zulässt.
        // Ich cappe nur nach oben, die KI bestimmt die Anzahl.
        const titles = (out.titles ?? [])
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 10)

        // Erfolgskriterium: mindestens 1 brauchbares Todo
        if (titles.length >= 1) {
          const rows = titles.map((title) => ({
            title,
            user_id: userId,
            completed: false,
            flagged, // NICHT mehr immer true
          }))

          const { data: created, error: dbErr } = await supabase.from('todos').insert(rows).select()
          if (dbErr) {
            return NextResponse.json(
              { error: 'DB insert failed', detail: dbErr.message, rows },
              { status: 500 }
            )
          }

          const payload: any = { created: created ?? [], model: modelName }

            if (isAdmin) {
                payload.debug = {
                    geminiText: out.geminiText,
                    candidatesCount: out.geminiJson?.candidates?.length ?? 0,
                    blockReason: out.geminiJson?.promptFeedback?.blockReason ?? null,
                    flaggedUsed: flagged,
                }
            }

            return NextResponse.json(payload, { status: 200 })

        }
      }
    }

    const payload: any = { created: [], model: best?.modelName ?? null }

    if (isAdmin) {
        payload.debug = {
            geminiText: best?.geminiText ?? '',
            candidatesCount: best?.geminiJson?.candidates?.length ?? 0,
            blockReason: best?.geminiJson?.promptFeedback?.blockReason ?? null,
            flaggedUsed: flagged,
            note: 'No valid todo array produced after retries',
        }
    }

    return NextResponse.json(payload, { status: 200 })

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}
