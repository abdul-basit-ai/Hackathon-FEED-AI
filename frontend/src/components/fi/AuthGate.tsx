import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { BarChart3, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthClient } from "@/services/auth";
import { isDemoMode } from "@/services/feedintelApi";

export function AuthGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const previousUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (isDemoMode) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      const client = getAuthClient();
      if (!client) { setConfigured(false); setLoading(false); return; }
      const update = (next: Session | null) => {
        if (!active) return;
        if (previousUser.current !== next?.user.id) { qc.clear(); previousUser.current = next?.user.id; }
        setSession(next); setLoading(false);
      };
      const { data } = client.auth.onAuthStateChange((_event, next) => update(next));
      unsubscribe = () => data.subscription.unsubscribe();
      client.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) setError("Your session expired. Please sign in again.");
        update(data.session);
      }).catch(() => { if (active) { setLoading(false); setError("Unable to restore your session. Please sign in."); } });
    } catch { setLoading(false); setConfigured(false); }
    return () => { active = false; unsubscribe?.(); };
  }, [qc]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const client = getAuthClient();
      if (!client) throw new Error("Sign-in is not configured.");
      const { error } = await client.auth.signInWithPassword({ email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") });
      if (error) setError("Sign-in failed. Check your email and password, then try again.");
    } catch { setError("Unable to reach sign-in. Please try again."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setError("");
    try {
      const { error } = await getAuthClient()!.auth.signOut({ scope: "local" });
      if (error) throw error;
      qc.clear(); setSession(null);
    } catch { setError("Unable to sign out. Please try again."); }
  }

  if (isDemoMode) return children;
  if (loading) return <div className="grid min-h-screen place-items-center bg-background" role="status"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Restoring your session…</span></div>;
  if (session) return <>
    <div className="no-print flex items-center justify-end gap-3 border-b bg-card px-4 py-2 text-xs">
      <span className="truncate text-muted-foreground">{session.user.email}</span>
      {error && <span role="alert" className="text-destructive">{error}</span>}
      <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
    </div>
    {children}
  </>;
  return <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-card">
      <div className="mb-6 flex items-center gap-3"><div className="rounded-lg bg-primary p-2 text-primary-foreground"><BarChart3 /></div><span className="font-display text-xl font-bold">Signal Spy</span></div>
      <h1 className="text-2xl font-semibold">Sign in to your workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">Use the approved demo account to analyze videos and reopen saved reports.</p>
      {!configured ? <p role="alert" className="mt-6 rounded-lg border border-warning/40 bg-demo p-4 text-sm">Sign-in is not configured for this app. Ask the workspace owner to complete setup.</p> :
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" required maxLength={254} /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in</Button>
        </form>}
      <p className="mt-5 text-xs text-muted-foreground">Your password is sent only to Supabase authentication. No API keys are needed here.</p>
    </div>
  </div>;
}
