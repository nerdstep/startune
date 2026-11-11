import { KeyRoundIcon, PlayIcon } from "lucide-react";
import { GithubIcon } from "./github-icon";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { backend, setDemo } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { Logo } from "./shell";

export function Login() {
  const me = useMe();
  const params = new URLSearchParams(window.location.search);
  const [showToken, setShowToken] = useState(params.get("auth") === "token" || me.data?.oauthEnabled === false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(params.get("auth_error"));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await backend.tokenLogin(token);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo className="mb-8 scale-150" />
          <h1 className="neon-text text-4xl font-bold tracking-tight md:text-5xl">Tune your stars.</h1>
          <p className="mt-3 max-w-sm text-muted-foreground">
            Sort your GitHub stars into Lists, clear out the dead ones, see what's taking off, and find the gems you forgot about.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3">
            {me.data?.oauthEnabled !== false && (
              <Button size="lg" nativeButton={false} render={<a href="/auth/login" />}>
                <GithubIcon /> Sign in with GitHub
              </Button>
            )}
            {showToken ? (
              <form onSubmit={submit} className="flex flex-col gap-2">
                <Input type="password" placeholder="ghp_… or github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
                <p className="text-xs text-muted-foreground">
                  A classic token needs the <code className="text-primary">public_repo</code> and <code className="text-primary">read:user</code> scopes. It's encrypted at rest on your own Cloudflare account.
                </p>
                <Button type="submit" variant="outline" disabled={busy || token.length < 20}>
                  <KeyRoundIcon /> Sign in with token
                </Button>
              </form>
            ) : (
              <Button variant="ghost" onClick={() => setShowToken(true)}>
                <KeyRoundIcon /> Use a personal access token
              </Button>
            )}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-neon-red">{error}</p>}
            <div className="my-1 h-px bg-border" />
            <Button variant="magenta" onClick={() => setDemo(true)}>
              <PlayIcon /> Explore with demo data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
