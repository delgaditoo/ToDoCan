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
  created_at: string
  user_id: string
}

export default function AppPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [newFlagged, setNewFlagged] = useState(false)
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [typed, setTyped] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [rotation, setRotation] = useState(0)

  // Typewriter intern (keine Re-Renders)
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

  useEffect(() => {
    setMounted(true)
    const storedFlags = localStorage.getItem('todocan-flags')
    if (storedFlags) {
      try {
        setFlags(JSON.parse(storedFlags))
      } catch {
        setFlags({})
      }
    }
  }, [])

  // persist flags whenever they change (keeps UI update immediate, storage async)
  useEffect(() => {
    localStorage.setItem('todocan-flags', JSON.stringify(flags))
  }, [flags])

  // Typewriter: stabil, rotiert garantiert durch alle Placeholder
  useEffect(() => {
    const TICK_MS = 70
    const TYPE_EVERY = 1 // alle 2 Ticks ein Zeichen tippen (langsamer)
    const DELETE_EVERY = 1 // alle 1 Tick ein Zeichen löschen
    const HOLD_TICKS = 18 // wie lange nach komplettem Tippen stehen bleiben

    let tickCount = 0

    const id = window.setInterval(() => {
      // wenn User tippt: Typewriter pausieren und Text ausblenden
      if (newTodo.trim().length > 0) {
        if (typed !== '') setTyped('')
        // Zustand so lassen, damit beim Leeren sauber weitergeht
        return
      }

      const full = placeholderOptions[idxRef.current]
      tickCount += 1

      if (!deletingRef.current) {
        // typing
        if (charRef.current < full.length) {
          if (tickCount % TYPE_EVERY === 0) {
            charRef.current += 1
            setTyped(full.slice(0, charRef.current))
          }
        } else {
          // hold
          holdTicksRef.current += 1
          if (holdTicksRef.current >= HOLD_TICKS) {
            deletingRef.current = true
            holdTicksRef.current = 0
          }
        }
      } else {
        // deleting
        if (charRef.current > 0) {
          if (tickCount % DELETE_EVERY === 0) {
            charRef.current -= 1
            setTyped(full.slice(0, charRef.current))
          }
        } else {
          // next
          deletingRef.current = false
          idxRef.current = (idxRef.current + 1) % placeholderOptions.length
          // vorbereiten
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

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTodos = async (userId: string) => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching todos:', error)
      setTodos([])
      return
    }

    setTodos((data as Todo[]) || [])
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim() || !user) return

    const { data, error } = await supabase
      .from('todos')
      .insert([{ title: newTodo.trim(), user_id: user.id }])
      .select()

    if (error) {
      console.error('Error adding todo:', error)
      return
    }

    if (data?.[0]) {
      const created = data[0] as Todo
      setTodos((prev) => [created, ...prev])
      setFlags((prev) => ({ ...prev, [created.id]: newFlagged }))
      setNewTodo('')
      setNewFlagged(false)
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
    setFlags((prev) => {
      const { [id]: _, ...rest } = prev
      localStorage.setItem('todocan-flags', JSON.stringify(rest))
      return rest
    })
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

  const toggleFlag = (id: string) => {
    setFlags((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const sortedTodos = useMemo(() => {
    return [...todos].sort((a, b) => {
      const fa = !!flags[a.id]
      const fb = !!flags[b.id]
      if (fa !== fb) return fa ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [todos, flags])

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
    return <Loader className="min-h-screen flex items-center justify-center bg-background animate-spin text-muted-foreground" />
  }

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
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-xl font-semibold">Add New Todo</h2>

              <form onSubmit={addTodo} className="w-full">
                <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-card py-2">
                  <div className="relative flex-1 min-w-55">
                    <Input
                      type="text"
                      value={newTodo}
                      onChange={(e) => setNewTodo(e.target.value)}
                      className="flex-1 placeholder-transparent pr-12"
                    />

                    {newTodo.trim().length === 0 && (
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
                    className="
                      h-9 px-4 rounded-md text-sm font-medium
                      bg-[hsl(var(--button-background))]
                      text-[hsl(var(--button-foreground))]
                      transition-[background-color,color,border-color] duration-75
                      border-b-4 border-b-[hsl(var(--button-border))]
                      active:border-b-0
                    "
                  >
                    Add
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <motion.div layout className="space-y-2">
            {sortedTodos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No todos yet. Add one above to get started!
                </CardContent>
              </Card>
            ) : (
              sortedTodos.map((todo) => (
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
                        <span className={`flex-1 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {todo.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <FlagButton
                            active={!!flags[todo.id]}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFlag(todo.id)
                            }}
                            label={flags[todo.id] ? 'Unflag todo' : 'Flag todo as priority'}
                          />
                          <Button onClick={() => deleteTodo(todo.id)} variant="destructive" size="sm" className="hover:scale-110">
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
