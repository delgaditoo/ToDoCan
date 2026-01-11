'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Flag, Loader } from 'lucide-react'

import { createClient } from '../../lib/supabase/client'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card, CardContent } from '../../components/ui/card'
import { Checkbox } from '../../components/ui/checkbox'
import { cn } from '../../lib/supabase/utils'

type Todo = {
  id: string
  title: string
  completed: boolean
  flagged: boolean
  created_at: string
  user_id: string
}

function AiToggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: (next: boolean) => void
}) {
  const MOVE = 'translate-x-[60px]' // w-24, px-1.5, thumb w-6

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className={cn(
        'relative h-9 w-24 px-1.5 rounded-md overflow-hidden',
        'text-sm font-medium',
        'transition-[background-color,color,border-color] duration-75',
        enabled
          ? cn(
              'bg-[hsl(var(--button-background))]',
              'text-[hsl(var(--button-foreground))]',
              'border-b-4 border-b-[hsl(var(--button-border))]',
            )
          : cn(
              'bg-background text-foreground',
              'border border-[hsl(var(--border))]',
              'border-b-4 border-b-[#888f9b]'
            )
      )}
    >
      <span
        className={cn(
          'absolute inset-0 z-0 flex items-center',
          enabled ? 'justify-start pl-2.5' : 'justify-end pr-2.5'
        )}
      >
        {enabled ? 'AI' : 'No AI'}
      </span>

      <span
        className={cn(
          'absolute left-1.5 top-1/2 -translate-y-1/2 z-10',
          'h-6 w-6 rounded-md shadow',
          'bg-[hsl(var(--foreground))]',
          'transition-transform duration-200 ease-in-out will-change-transform',
          enabled ? MOVE : 'translate-x-0'
        )}
      />
    </button>
  )
}

export default function AppPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [newFlagged, setNewFlagged] = useState(false)

  const [aiPowered, setAiPowered] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Debug: wird im UI angezeigt + console
  const [aiDebugOpen, setAiDebugOpen] = useState(true)
  const [aiDebug, setAiDebug] = useState<{
    at: string
    status: number | null
    ok: boolean | null
    contentType: string | null
    raw: string
    parsed: any
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [typed, setTyped] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [rotation, setRotation] = useState(0)

  // Typewriter intern
  const idxRef = useRef(0)
  const charRef = useRef(0)
  const deletingRef = useRef(false)
  const holdTicksRef = useRef(0)

  const placeholderOptions = useMemo(
    () => [
      'What needs to be done?',
      'Go to the gym!',
      "Plan tomorrow's tasks...",
      'Call mom tonight!',
      'Walk the dog...',
      'Buy groceries!',
      'Read a book!',
      'Finish homework!',
      'Meditate for 10 minutes!',
      'Clean the house!',
    ],
    []
  )

  useEffect(() => setMounted(true), [])

  // Typewriter: pausiert sobald User tippt
  useEffect(() => {
    const TICK_MS = 70
    const TYPE_EVERY = 1
    const DELETE_EVERY = 1
    const HOLD_TICKS = 18

    let tickCount = 0

    const id = window.setInterval(() => {
      if (newTodo.trim().length > 0) {
        if (typed !== '') setTyped('')
        return
      }

      const full = placeholderOptions[idxRef.current]
      tickCount += 1

      if (!deletingRef.current) {
        if (charRef.current < full.length) {
          if (tickCount % TYPE_EVERY === 0) {
            charRef.current += 1
            setTyped(full.slice(0, charRef.current))
          }
        } else {
          holdTicksRef.current += 1
          if (holdTicksRef.current >= HOLD_TICKS) {
            deletingRef.current = true
            holdTicksRef.current = 0
          }
        }
      } else {
        if (charRef.current > 0) {
          if (tickCount % DELETE_EVERY === 0) {
            charRef.current -= 1
            setTyped(full.slice(0, charRef.current))
          }
        } else {
          deletingRef.current = false
          idxRef.current = (idxRef.current + 1) % placeholderOptions.length
          charRef.current = 0
          holdTicksRef.current = 0
        }
      }
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [newTodo, placeholderOptions, typed])

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error) {
        console.error('Auth error:', error)
        router.push('/login')
        return
      }

      const u = data?.user
      if (!u) {
        router.push('/login')
        return
      }

      setUser({ id: u.id })
      await fetchTodos(u.id)
      setLoading(false)
    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d?.isAdmin)))
      .catch(() => setIsAdmin(false))
  }, [])

  const fetchTodos = async (userId: string) => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('flagged', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching todos:', error)
      setTodos([])
      return
    }

    setTodos((data as Todo[]) || [])
  }

  const addTodo = async () => {
    if (!newTodo.trim() || !user) return

    const { data, error } = await supabase
      .from('todos')
      .insert([{ title: newTodo.trim(), user_id: user.id, flagged: newFlagged }])
      .select()

    if (error) {
      console.error('Error adding todo:', error)
      return
    }

    if (data?.[0]) {
      const created = data[0] as Todo
      setTodos((prev) => [created, ...prev])
      setNewTodo('')
      setNewFlagged(false)
    }
  }

  // AI: nimmt newTodo als Prompt, und erstellt mehrere Todos
  const aiToTodos = async () => {
    if (!user) return
    const text = newTodo.trim()
    if (!text) return

    setAiLoading(true)

    const stamp = new Date().toISOString()
    setAiDebug({
      at: stamp,
      status: null,
      ok: null,
      contentType: null,
      raw: '',
      parsed: null,
    })

    try {
      const res = await fetch('/api/todos/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, flagged: newFlagged }),
      })

      const contentType = res.headers.get('content-type')
      const raw = await res.text()

      let parsed: any = null
      try {
        parsed = raw ? JSON.parse(raw) : null
      } catch {
        parsed = null
      }

      const snapshot = {
        at: stamp,
        status: res.status,
        ok: res.ok,
        contentType,
        raw,
        parsed,
      }
      setAiDebug(snapshot)

      console.groupCollapsed('[AI] /api/todos/ai', res.status)
      console.log('content-type:', contentType)
      console.log('raw:', raw)
      console.log('parsed:', parsed)
      console.groupEnd()

      if (!res.ok) return

      const created = Array.isArray(parsed?.created) ? (parsed.created as Todo[]) : []
      if (created.length === 0) return

      setTodos((prev) => [...created, ...prev])

      // AI Todos: Input reset, Flag reset (AI flagged muss im Backend passieren)
      setNewTodo('')
      setNewFlagged(false)
    } catch (e) {
      console.error('[AI] fetch crashed:', e)
      setAiDebug((prev) => ({
        at: prev?.at ?? stamp,
        status: -1,
        ok: false,
        contentType: null,
        raw: String(e),
        parsed: null,
      }))
    } finally {
      setAiLoading(false)
    }
  }

  const toggleTodo = async (id: string, completed: boolean) => {
    const { error } = await supabase.from('todos').update({ completed: !completed }).eq('id', id)

    if (error) {
      console.error('Error updating todo:', error)
      return
    }

    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)))
  }

  const deleteTodo = async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id)

    if (error) {
      console.error('Error deleting todo:', error)
      return
    }

    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  const toggleFlag = async (todo: Todo) => {
    const next = !todo.flagged

    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, flagged: next } : t)))

    const { error } = await supabase.from('todos').update({ flagged: next }).eq('id', todo.id)

    if (error) {
      console.error(error)
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, flagged: !next } : t)))
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const onLogoClick = () => {
    if (!mounted) return
    setRotation((prev) => prev + 360)
    window.setTimeout(() => {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }, 120)
  }

  const FlagButton = ({
    active,
    onClick,
    label,
  }: {
    active: boolean
    onClick: (e: React.MouseEvent) => void
    label: string
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick(e)
      }}
      aria-pressed={active}
      aria-label={label}
      style={{ transition: 'transform 150ms ease' }}
      className={cn(
        'h-6 w-6 rounded-md flex items-center justify-center bg-transparent transition-transform duration-150',
        'hover:scale-110',
        active ? 'text-red-500' : 'text-muted-foreground'
      )}
    >
      <Flag className={cn('h-4 w-4', active ? 'fill-red-500/20 text-red-500' : '')} />
    </button>
  )

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const showPlaceholder = newTodo.trim().length === 0

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={onLogoClick}
              whileHover={{ scale: 1.12 }}
              animate={{ rotate: rotation }}
              transition={{ duration: 0.32, ease: 'easeInOut' }}
              className="p-1 rounded-xl"
              aria-label="Toggle theme"
            >
              <Image src="/todocan.svg" alt="Todocan Logo" width={40} height={40} priority />
            </motion.button>
            <h1 className="text-2xl md:text-3xl font-bold">ToDoCan</h1>
          </div>

          <div className="flex items-center gap-3">
            <AiToggle
              enabled={aiPowered}
              onChange={(next) => {
                setAiPowered(next)
                setAiDebug(null)
                setAiLoading(false)
                setAiDebugOpen(false)
              }}
            />

            <Button
              onClick={signOut}
              className="
                h-9 px-4 rounded-md text-sm font-medium
                bg-[hsl(var(--button-background))]
                text-[hsl(var(--button-foreground))]
                transition-[background-color,color,border-color] duration-75
                border-b-4 border-b-[hsl(var(--button-border))]
                active:border-b-0
              "
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Add New Todo</h2>
                {aiPowered && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAiDebugOpen((p) => !p)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {aiDebugOpen ? 'Hide AI debug' : 'Show AI debug'}
                  </button>
                )}
              </div>

              {aiPowered && isAdmin && aiDebugOpen && (
                <div className="rounded-md border border-border bg-card p-3 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">AI Debug</span>
                    <span className="text-muted-foreground">Status:</span>
                    <span>{aiDebug?.status ?? '-'}</span>
                    <span className="text-muted-foreground">OK:</span>
                    <span>{aiDebug?.ok === null ? '-' : String(aiDebug?.ok)}</span>
                    <span className="text-muted-foreground">CT:</span>
                    <span className="truncate max-w-55">{aiDebug?.contentType ?? '-'}</span>
                  </div>

                  <div className="mt-2">
                    <div className="text-muted-foreground mb-1">Raw response</div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word">
                      {aiDebug?.raw || '(empty)'}
                    </pre>
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (aiPowered) void aiToTodos()
                  else void addTodo()
                }}
                className="w-full"
              >
                <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-card py-2">
                  <div className="relative flex-1 min-w-55">
                    <Input
                      type="text"
                      value={newTodo}
                      onChange={(e) => setNewTodo(e.target.value)}
                      className="flex-1 placeholder-transparent pr-12"
                    />

                    {showPlaceholder && (
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        {typed}
                        <span className="inline-block w-[1ch] animate-pulse">|</span>
                      </span>
                    )}

                    <div className="absolute inset-y-0 right-2 flex items-center">
                      <FlagButton
                        active={newFlagged}
                        onClick={() => setNewFlagged((p) => !p)}
                        label={newFlagged ? 'Unflag new todo' : 'Flag new todo as priority'}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={aiPowered && aiLoading}
                    className="
                      h-9 px-4 rounded-md text-sm font-medium
                      bg-[hsl(var(--button-background))]
                      text-[hsl(var(--button-foreground))]
                      transition-[background-color,color,border-color] duration-75
                      border-b-4 border-b-[hsl(var(--button-border))]
                      active:border-b-0
                    "
                  >
                    {aiPowered ? (aiLoading ? 'Generating...' : 'Generate') : 'Add'}
                  </Button>
                </div>

                {aiPowered && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    AI mode: type a prompt, click to generate Todos. ToDoCan AI can make mistakes, check important info.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <motion.div layout className="space-y-2">
            {todos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No todos yet. Add one above to get started!
                </CardContent>
              </Card>
            ) : (
              todos.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                >
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={todo.completed}
                          onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
                          className="h-6 w-6"
                        />
                        <span className={cn('flex-1', todo.completed ? 'line-through text-muted-foreground' : '')}>
                          {todo.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <FlagButton
                            active={todo.flagged}
                            onClick={(e) => {
                              e.stopPropagation()
                              void toggleFlag(todo)
                            }}
                            label={todo.flagged ? 'Unflag todo' : 'Flag todo as priority'}
                          />
                          <Button
                            onClick={() => void deleteTodo(todo.id)}
                            variant="destructive"
                            size="sm"
                            className="hover:scale-110"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        </div>
      </main>

      <footer className="w-full border-t border-border/60 py-4 bg-background/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          ToDoCan © 2026 All rights reserved
        </div>
      </footer>
    </div>
  )
}
