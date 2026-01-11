import { NextResponse } from "next/server"

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 })
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models?key=" +
    encodeURIComponent(apiKey)

  const res = await fetch(url, { method: "GET" })
  const raw = await res.text()

  // raw zurückgeben, damit du alles siehst (auch wenn Google irgendwas komisches liefert)
  let json: any = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    return NextResponse.json(
      { ok: false, status: res.status, contentType: res.headers.get("content-type"), raw },
      { status: 200 }
    )
  }

  // Nur die Modelle rausfiltern, die generateContent unterstützen
  const models = (json?.models ?? []).map((m: any) => ({
    name: m?.name,
    baseModelId: m?.baseModelId,
    supportedGenerationMethods: m?.supportedGenerationMethods,
  }))

  const generateContentModels = models.filter((m: any) =>
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes("generateContent")
  )

  return NextResponse.json(
    {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
      generateContentModels,
      // optional: komplettliste
      // models,
    },
    { status: 200 }
  )
}
