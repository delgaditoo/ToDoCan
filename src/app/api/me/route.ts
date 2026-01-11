import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData?.user) {
    return NextResponse.json({ isAdmin: false }, { status: 200 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  return NextResponse.json({ isAdmin: profile?.role === 'admin' }, { status: 200 })
}
