"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [host, setHost] = useState(process.env.NEXT_PUBLIC_DEFAULT_HOST ?? "http://localhost:8080");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const attemptedAutoLogin = useRef(false);

  async function login(hostValue: string, usernameValue: string, passwordValue: string, persist = true) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: hostValue, username: usernameValue, password: passwordValue }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Login failed");
    }
    if (persist) {
      await window.qbitui?.setCredentials({ host: hostValue, username: usernameValue, password: passwordValue });
    }
    router.push("/dashboard");
    router.refresh();
  }

  useEffect(() => {
    if (attemptedAutoLogin.current) return;
    attemptedAutoLogin.current = true;

    let cancelled = false;
    async function tryAutoLogin() {
      const creds = await window.qbitui?.getCredentials();
      if (!creds || cancelled) return;
      setHost(creds.host);
      setUsername(creds.username);
      setPassword(creds.password);
      setLoading(true);
      try {
        await login(creds.host, creds.username, creds.password, false);
      } catch {
        if (!cancelled) {
          setError("Saved login failed. Please sign in again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void tryAutoLogin();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(host, username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error — check your connection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-2">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">qbitUI</CardTitle>
          <CardDescription>Connect to your qBittorrent instance</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="host">Host URL</Label>
              <Input
                id="host"
                type="url"
                placeholder="http://localhost:8080"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
