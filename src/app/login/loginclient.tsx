"use client"

import React, { useEffect, useMemo, useState } from "react"
import { createClient } from "../../lib/supabase/client"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader } from "lucide-react"

type MsgKind = "info" | "error" | "success"

export default function LoginClient() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // getrennte loading states
  const [oauthLoading, setOauthLoading] = useState(false) // nur Google
  const [authLoading, setAuthLoading] = useState(false) // nur Email SignIn/SignUp/Reset

  const [message, setMessage] = useState<{ kind: MsgKind; text: string } | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setIsSignUp(searchParams.get("mode") === "signup")
  }, [searchParams])

  const PrimaryButtonClasses = `
    bg-[hsl(var(--button-background))]
    text-[hsl(var(--button-foreground))]
    transition-[background-color,color,border-color] duration-75
    border-b-4 border-b-[hsl(var(--button-border))]
    active:border-b-0
  `

  const signInWithGoogle = async () => {
    if (oauthLoading) return
    setOauthLoading(true)
    setMessage(null)

    try {
      const origin = window.location.origin
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=/app`,
        },
      })
      if (error) throw error
      // OAuth redirect übernimmt, kein router.push hier nötig
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Google sign-in failed" })
      setOauthLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (authLoading) return

    setAuthLoading(true)
    setMessage(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }

      router.push("/app")
      router.refresh()
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Auth failed" })
    } finally {
      setAuthLoading(false)
    }
  }

  const sendReset = async () => {
    if (authLoading) return

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setMessage({ kind: "error", text: "Enter your email first." })
      return
    }

    setAuthLoading(true)
    setMessage(null)

    try {
      const origin = window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/reset-password`,
      })
      if (error) throw error

      setMessage({ kind: "success", text: "Password reset email sent. Check your inbox." })
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Failed to send reset email" })
    } finally {
      setAuthLoading(false)
    }
  }

  const anyLoading = oauthLoading || authLoading

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? "Sign Up" : "Sign In"}</CardTitle>
          <CardDescription>
            {isSignUp ? "Create an account to get started" : "Welcome back! Please sign in to continue"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            type="button"
            className={`w-full ${PrimaryButtonClasses}`}
            onClick={signInWithGoogle}
            aria-busy={oauthLoading}
          >
            {oauthLoading ? <Loader className="h-5 w-5 animate-spin" /> : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>

                {!isSignUp && (
                  <button
                    type="button"
                    onClick={sendReset}
                    disabled={authLoading}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Forgot your password?
                  </button>
                )}
              </div>

              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>

            <Button type="submit" className={`w-full ${PrimaryButtonClasses}`} aria-busy={authLoading}>
              {authLoading ? <Loader className="h-5 w-5 animate-spin" /> : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>

          {message && (
            <p
              className={
                message.kind === "error"
                  ? "text-sm text-center text-red-500"
                  : message.kind === "success"
                    ? "text-sm text-center text-green-500"
                    : "text-sm text-center text-muted-foreground"
              }
            >
              {message.text}
            </p>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                if (anyLoading) return
                setIsSignUp((p) => !p)
                setMessage(null)
              }}
              disabled={anyLoading}
              className="text-sm text-blue-600 hover:underline"
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
