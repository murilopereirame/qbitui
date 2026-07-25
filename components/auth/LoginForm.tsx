"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [host, setHost] = useState(process.env.NEXT_PUBLIC_DEFAULT_HOST ?? "http://localhost:8080");
  const [apiToken, setApiToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const attemptedAutoLogin = useRef(false);

  const login = useCallback(async (hostValue: string, apiTokenValue: string, persist = true) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: hostValue, apiToken: apiTokenValue }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Login failed");
    }
    if (persist) {
      await window.qbitui?.setCredentials({ host: hostValue, apiToken: apiTokenValue });
    }
    router.push("/dashboard");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (attemptedAutoLogin.current) return;
    attemptedAutoLogin.current = true;

    let cancelled = false;
    async function tryAutoLogin() {
      const creds = await window.qbitui?.getCredentials();
      if (!creds || cancelled) return;
      setHost(creds.host);
      setApiToken(creds.apiToken);
      setLoading(true);
      try {
        await login(creds.host, creds.apiToken, false);
      } catch {
        await window.qbitui?.clearCredentials();
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
  }, [login]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(host, apiToken);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto w-14 h-14 rounded-xl mb-2" />
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
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="qbt_••••••••••••••••••••••••••••"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Find your API token in qBittorrent → Settings → Web UI → API Key
              </p>
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
