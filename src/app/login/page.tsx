import { Suspense } from "react"
import LoginClient from "././loginclient"

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <LoginClient />
    </Suspense>
  )
}
