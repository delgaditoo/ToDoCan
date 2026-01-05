'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Checkbox } from '../components/ui/checkbox'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'

type Todo = {
  id: string
  title: string
  completed: boolean
  created_at: string
  user_id: string
}

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  const router = useRouter()
  const supabase = createClient()

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

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

      setUser(u)
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
      setTodos(prev => [data[0] as Todo, ...prev])
      setNewTodo('')
    }
  }

  const toggleTodo = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from('todos')
      .update({ completed: !completed })
      .eq('id', id)

    if (error) {
      console.error('Error updating todo:', error)
      return
    }

    setTodos(prev =>
      prev.map(todo => (todo.id === id ? { ...todo, completed: !completed } : todo))
    )
  }

  const deleteTodo = async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id)

    if (error) {
      console.error('Error deleting todo:', error)
      return
    }

    setTodos(prev => prev.filter(todo => todo.id !== id))
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const onLogoClick = () => {
    if (!mounted) return
    setRotation(prev => prev + 360)
    window.setTimeout(() => {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }, 120)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
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

          <h1 className="text-3xl font-bold">ToDoCan</h1>
          <Button onClick={signOut} variant="outline">
            Sign Out
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add New Todo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addTodo} className="flex gap-2">
              <Input
                type="text"
                placeholder="What needs to be done?"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {todos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No todos yet. Add one above to get started!
              </CardContent>
            </Card>
          ) : (
            todos.map((todo) => (
              <Card key={todo.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
                    />
                    <span className={`flex-1 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {todo.title}
                    </span>
                    <Button onClick={() => deleteTodo(todo.id)} variant="destructive" size="sm" className="text-black dark:text-white">
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
