'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useState } from 'react'

export default function ThemeLogo() {
  const { resolvedTheme, setTheme } = useTheme()
  const [spin, setSpin] = useState(false)

  const onClick = () => {
    setSpin(true)
    setTimeout(() => setSpin(false), 380)
    setTimeout(() => {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }, 160)
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.12 }}
      animate={spin ? { rotate: 360 } : { rotate: 0 }}
      transition={spin ? { duration: 0.32, ease: 'easeInOut' } : { type: 'spring', stiffness: 260, damping: 18 }}
      className="p-1 rounded-xl"
      aria-label="Toggle theme"
    >
      <Image src="/todocan.svg" alt="Todocan Logo" width={40} height={40} priority />
    </motion.button>
  )
}
