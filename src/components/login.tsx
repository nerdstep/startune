import { BrainCircuitIcon, KeyRoundIcon, OrbitIcon, PlayIcon, UndoIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GithubIcon } from "./github-icon";
import { StarField } from "./star-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { backend, setDemo } from "@/lib/api";
import { sampleLibrary } from "@/lib/demo";
import { derive, useMe } from "@/lib/queries";
import { Logo } from "./shell";

const FEATURES = [
  { icon: OrbitIcon, text: "Every star charted by when you starred it, how popular it is and how alive it is today." },
  { icon: UndoIcon, text: "Triage cruft and unlisted repos from the keyboard. Every unstar can be undone." },
  { icon: BrainCircuitIcon, text: "Clef on Workers AI suggests a List for each repo, inside your own Cloudflare account." },
];

function useViewport() {
  const [v, setV] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight });
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  return v;
}

export function Login() {
  const me = useMe();
  const sky = useMemo(() => derive(sampleLibrary()).stars, []);
  const params = new URLSearchParams(window.location.search);
  const oauth = me.data?.oauthEnabled !== false;
  const [showToken, setShowToken] = useState(params.get("auth") === "token");
  const view = useViewport();
  const wide = view.w >= 1024;
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
    <div className="relative min-h-dvh overflow-hidden">
      {wide && (
        <div className="absolute inset-0">
          <StarField stars={sky} ambient height={view.h} insetLeft={Math.min(640, view.w * 0.42)} />
        </div>
      )}
      <div className="pointer-events-none relative z-10 flex min-h-dvh flex-col px-6 py-6 md:px-12 lg:max-w-xl lg:py-10 [&>*]:pointer-events-auto">
        <Logo />
        {!wide && (
          <div className="-mx-6 mt-5 border-y md:-mx-12">
            <StarField stars={sky} ambient height={260} />
          </div>
        )}
        <div className="my-auto max-w-md py-8">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Tune your stars.</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Sort your GitHub stars into Lists, clear out the dead ones, see what's taking off, and find the gems you forgot about.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {oauth ? (
              <Button size="lg" nativeButton={false} render={<a href="/auth/login" />}>
                <GithubIcon /> Sign in with GitHub
              </Button>
            ) : null}
            <Button size="lg" variant={oauth ? "outline" : "default"} onClick={() => setDemo(true)}>
              <PlayIcon /> Explore with demo data
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <ul className="mt-8 divide-y border-y text-sm">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 py-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          {showToken ? (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-2">
              <label htmlFor="pat" className="text-sm font-medium">
                Personal access token
              </label>
              <Input
                id="pat"
                type="password"
                placeholder="ghp_… or github_pat_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                A classic token needs the <code className="font-mono text-foreground">public_repo</code> and{" "}
                <code className="font-mono text-foreground">read:user</code> scopes. It's encrypted at rest on your own Cloudflare account.
              </p>
              <Button type="submit" variant="outline" disabled={busy || token.length < 20}>
                <KeyRoundIcon /> {busy ? "Signing in…" : "Sign in with token"}
              </Button>
            </form>
          ) : (
            <Button variant="ghost" className="mt-4 -ml-3" onClick={() => setShowToken(true)}>
              <KeyRoundIcon /> {oauth ? "Use a personal access token instead" : "Sign in with a personal access token"}
            </Button>
          )}
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          Self-hosted on your Cloudflare account. The demo and the sky on this page use generated sample data.
        </p>
      </div>
    </div>
  );
}
