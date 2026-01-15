'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {DndContext, DragEndEvent, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter, DragOverlay} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  position: number
  created_at: string
  user_id: string
}

const sortTodos = (arr: Todo[]) =>
  [...arr].sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
    const ap = (a as any).position ?? 0
    const bp = (b as any).position ?? 0
    if (ap !== bp) return ap - bp
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

function AiToggle({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  const MOVE = 'translate-x-[60px]'
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
              'border-b-4 border-b-[hsl(var(--button-border))]'
            )
          : cn('bg-background text-foreground', 'border border-[hsl(var(--border))]', 'border-b-4 border-b-[#888f9b]')
      )}
    >
      <span className={cn('absolute inset-0 z-0 flex items-center', enabled ? 'justify-start pl-2.5' : 'justify-end pr-2.5')}>
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

function FlagButton({
  active,
  disabled,
  onToggle,
  label,
}: {
  active: boolean
  disabled?: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'p-2 -m-2 rounded-md',
        'transition-transform duration-150',
        'hover:scale-110 active:scale-95',
        'disabled:opacity-100 disabled:cursor-not-allowed'
      )}
    >
      <Flag className={cn('h-5 w-5', active ? 'text-red-500 fill-red-500/20' : 'text-muted-foreground')} />
    </button>
  )
}

function SortableTodoRow({
  todo,
  children,
}: {
  todo: Todo
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

export default function AppPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [newFlagged, setNewFlagged] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }))

  const [aiPowered, setAiPowered] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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

  const isFlaggedId = (id: string) => {
  const t = todos.find((x) => x.id === id)
  return Boolean(t?.flagged)}

  const onDragStart = (e: DragStartEvent) => {
  setActiveId(String(e.active.id))}

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)

    const active = String(e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (!over || active === over) return

    const activeFlag = isFlaggedId(active)
    const overFlag = isFlaggedId(over)

    // ✅ DEIN WUNSCH:
    // Cross-group Drop wird ignoriert -> snap back
    if (activeFlag !== overFlag) return

    setTodos((prev) => {
      const sorted = sortTodos(prev)

      const group = sorted.filter((t) => t.flagged === activeFlag)
      const rest = sorted.filter((t) => t.flagged !== activeFlag)

      const oldIndex = group.findIndex((t) => t.id === active)
      const newIndex = group.findIndex((t) => t.id === over)
      if (oldIndex === -1 || newIndex === -1) return prev

      const moved = arrayMove(group, oldIndex, newIndex).map((t, i) => ({ ...t, position: i }))

      // flagged-first hard
      return activeFlag ? [...moved, ...rest] : [...rest, ...moved]
    })
  }

  const router = useRouter()
  const supabase = createClient()

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [rotation, setRotation] = useState(0)

  // pro Todo: letzte gewünschte Flag-State + laufender Request Schutz
  const desiredFlagRef = useRef<Record<string, boolean>>({})
  const inFlightRef = useRef<Record<string, boolean>>({})

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

    const list = (data as Todo[]) || []
    // desired state initialisieren
    const nextDesired: Record<string, boolean> = {}
    for (const t of list) nextDesired[t.id] = t.flagged
    desiredFlagRef.current = { ...desiredFlagRef.current, ...nextDesired }

    setTodos(list)
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
      desiredFlagRef.current[created.id] = created.flagged
      setTodos((prev) => sortTodos([created, ...prev]))
      setNewTodo('')
      setNewFlagged(false)
    }
  }

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

      setAiDebug({
        at: stamp,
        status: res.status,
        ok: res.ok,
        contentType,
        raw,
        parsed,
      })

      if (!res.ok) return

      const created = Array.isArray(parsed?.created) ? (parsed.created as Todo[]) : []
      if (created.length === 0) return

      for (const t of created) desiredFlagRef.current[t.id] = t.flagged
      setTodos((prev) => sortTodos([...created, ...prev]))

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
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)))

    const { error } = await supabase.from('todos').update({ completed: !completed }).eq('id', id)

    if (error) {
      console.error('Error updating todo:', error)
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)))
    }
  }

  const deleteTodo = async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) {
      console.error('Error deleting todo:', error)
      return
    }
    delete desiredFlagRef.current[id]
    delete inFlightRef.current[id]
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  // Knackpunkt: spam-klicks müssen sofort UI togglen und am Ende DB auf "letzten Wunsch" bringen.
  const toggleFlag = (todo: Todo) => {
    const id = todo.id
    const currentDesired = desiredFlagRef.current[id] ?? todo.flagged
    const nextDesired = !currentDesired

    // 1) sofort UI (optimistic) + sofort re-sort
    desiredFlagRef.current[id] = nextDesired
    setTodos((prev) => sortTodos(prev.map((t) => (t.id === id ? { ...t, flagged: nextDesired } : t))))

    // 2) wenn schon ein request läuft, NICHT noch einen starten. Der laufende request zieht danach nach.
    if (inFlightRef.current[id]) return

    // 3) worker: immer wieder DB auf desired setzen, bis es passt
    const sync = async () => {
      inFlightRef.current[id] = true
      try {
        // loop: falls während request erneut geklickt wurde, kommt danach ein weiterer update
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const target = desiredFlagRef.current[id]
          if (typeof target !== 'boolean') return

          const { error } = await supabase.from('todos').update({ flagged: target }).eq('id', id)
          if (error) {
            console.error('Flag update failed:', error)
            // bei error: UI nicht zurückspringen lassen. User sieht seinen Wunsch sofort.
            // du könntest hier toasten, aber kein rollback.
            return
          }

          // wenn in der Zwischenzeit nicht weiter geklickt wurde, sind wir fertig
          const still = desiredFlagRef.current[id]
          if (still === target) return
          // sonst loop nochmal und setze neuesten Wunsch
        }
      } finally {
        inFlightRef.current[id] = false
      }
    }

    void sync()
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

  const visibleTodos = useMemo(() => sortTodos(todos), [todos])

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
          <div className="flex items-center gap-3 mr-4 sm:mr-0">
            <motion.button
              type="button"
              onClick={onLogoClick}
              whileHover={{ scale: 1.12 }}
              animate={{ rotate: rotation }}
              transition={{ duration: 0.32, ease: 'easeInOut' }}
              className="p-1 rounded-xl"
              aria-label="Toggle theme"
            >
              <Image src="/todocan.svg" alt="Todocan Logo" width={40} height={40} priority  className="h-11 w-11 sm:h-10 sm:w-10"/>
            </motion.button>
            <h1 className="text-2xl md:text-3xl font-bold whitespace-nowrap">ToDoCan</h1>
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
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word">{aiDebug?.raw || '(empty)'}</pre>
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
                <div className="flex w-full flex-nowrap items-center gap-2 rounded-lg bg-card py-2">
                  <div className="relative flex-1 min-w-0">
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
                        onToggle={() => setNewFlagged((p) => !p)}
                        label={newFlagged ? 'Unflag new todo' : 'Flag new todo as priority'}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={aiPowered && aiLoading}
                    aria-busy={aiPowered && aiLoading}
                    className="
                      h-9 px-4 rounded-md text-sm font-medium
                      bg-[hsl(var(--button-background))]
                      text-[hsl(var(--button-foreground))]
                      transition-[background-color,color,border-color] duration-75
                      border-b-4 border-b-[hsl(var(--button-border))]
                      active:border-b-0
                      shrink-0
                      disabled:opacity-100
                    "
                  >
                    {aiPowered ? (
                      aiLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader className="h-4 w-4 animate-spin" />
                          Generating
                        </span>
                      ) : (
                        'Generate'
                      )
                    ) : (
                      'Add'
                    )}
                  </Button>
                </div>

                {aiPowered && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">AI mode:</span>{' '}
                    type a prompt, click to generate Todos. ToDoCan AI can make mistakes, check important info.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              <div className="space-y-2">
                {visibleTodos.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No todos yet. Add one above to get started!
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* flagged group */}
                    <SortableContext
                      items={visibleTodos.filter((t) => t.flagged).map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {visibleTodos
                        .filter((t) => t.flagged)
                        .map((todo) => (
                          <SortableTodoRow key={todo.id} todo={todo}>
                            {/* DEIN bisheriges motion.div + Card */}
                            <motion.div
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
                                        onToggle={() => toggleFlag(todo)}
                                        label={todo.flagged ? 'Unflag todo' : 'Flag todo as priority'}
                                      />

                                      <Button onClick={() => void deleteTodo(todo.id)} size="sm" className="hover:scale-110">
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          </SortableTodoRow>
                        ))}
                    </SortableContext>

                    {/* unflagged group */}
                    <SortableContext
                      items={visibleTodos.filter((t) => !t.flagged).map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {visibleTodos
                        .filter((t) => !t.flagged)
                        .map((todo) => (
                          <SortableTodoRow key={todo.id} todo={todo}>
                            <motion.div
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
                                        onToggle={() => toggleFlag(todo)}
                                        label={todo.flagged ? 'Unflag todo' : 'Flag todo as priority'}
                                      />

                                      <Button onClick={() => void deleteTodo(todo.id)} size="sm" className="hover:scale-110">
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          </SortableTodoRow>
                        ))}
                    </SortableContext>
                  </>
                )}
              </div>

              {/* Smooth snap-back beim forbidden drop */}
              <DragOverlay>
                {activeId ? (
                  <div className="pointer-events-none">
                    <Card>
                      <CardContent className="py-4">
                        <div className="text-sm font-medium">
                          {todos.find((t) => t.id === activeId)?.title ?? ''}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
        </div>
      </main>

      <footer className="w-full border-t border-border/60 py-4 bg-background/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">ToDoCan © 2026 All rights reserved</div>
      </footer>
    </div>
  )
}
