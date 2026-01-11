import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  const { data: todos } = await supabase
    .from('todos')
    .select('id,title,completed,flagged,created_at,user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="rounded-xl border p-4">
        <h2 className="text-lg font-medium mb-3">Latest Todos</h2>

        <div className="space-y-2">
          {(todos ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-4 border rounded-lg p-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.title}</div>
                <div className="text-sm text-muted-foreground">
                  {t.user_id} · {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-sm">
                {t.completed ? 'done' : 'open'} · {t.flagged ? 'flagged' : 'normal'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
