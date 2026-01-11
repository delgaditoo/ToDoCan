'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  useEffect(() => {
    // Supabase hängt die Recovery-Infos an die URL.
    // Je nach Setup kommt es als ?code=... oder als Hash.
    // Wir lassen die Page einfach rendern und zeigen eine klare Fehlermeldung,
    // wenn updateUser scheitert.
    setReady(true)
  }, [searchParams])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.')
      return
    }
    if (password !== password2) {
      setMessage('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Password updated. Redirecting…')
      window.setTimeout(() => {
        router.replace('/app')
        router.refresh()
      }, 600)
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) return null

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a strong password and confirm it.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw1">New password</Label>
              <Input
                id="pw1"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pw2">Confirm new password</Label>
              <Input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="
                w-full
                bg-[hsl(var(--button-background))]
                text-[hsl(var(--button-foreground))]
                transition-[background-color,color,border-color] duration-75
                border-b-4 border-b-[hsl(var(--button-border))]
                active:border-b-0
              "
            >
              {submitting ? <Loader className="h-5 w-5 animate-spin" /> : 'Update password'}
            </Button>
          </form>

          {message && <p className="text-sm text-center text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
