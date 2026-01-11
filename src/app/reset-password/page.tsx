import { Suspense } from "react"
import { Loader } from "lucide-react"
import ResetPasswordClient from "./reset-password-client"

export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}
