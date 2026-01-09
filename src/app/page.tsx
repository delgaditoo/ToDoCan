'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'

import { createClient } from '../lib/supabase/client'
import { Button } from '../components/ui/button'

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClient()
  const { resolvedTheme, setTheme } = useTheme()
  const [rotation, setRotation] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        router.replace('/app')
      }
    }
    void checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLogoClick = () => {
    if (!mounted) return
    setRotation(prev => prev + 360)
    window.setTimeout(() => {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }, 120)
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center space-y-8">
        <button
          type="button"
          onClick={onLogoClick}
          className="mx-auto flex items-center justify-center gap-4 p-2 rounded-xl"
          aria-label="Toggle theme"
        >
          <motion.div
            whileHover={{ scale: 1.12 }}
            animate={{ rotate: rotation }}
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            className="flex items-center justify-center"
          >
            <Image src="/todocan.svg" alt="Todocan Logo" width={72} height={72} priority />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">TODOCAN</h1>
        </button>
        <p className="text-lg md:text-xl text-muted-foreground">
          The only ToDoApp you will ever need
        </p>
        <div className="flex justify-center">
          <Button
            asChild
            size="lg"
            className="
              px-6
              rounded-md
              text-sm font-medium
              bg-[hsl(var(--button-background))]
              text-[hsl(var(--button-foreground))]
              transition-[background-color,color,border-color] duration-75
              border-b-4
              border-b-[hsl(var(--button-border))]
              active:border-b-0
            "
          >     
            <Link href="/login?mode=signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
