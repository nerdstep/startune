import {
  BrainCircuitIcon,
  ExternalLinkIcon,
  FolderGit2Icon,
  KeyRoundIcon,
  OrbitIcon,
  PlayIcon,
  UndoIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { backend, setDemo } from '@/lib/api'
import { sampleLibrary } from '@/lib/demo'
import { derive, useMe } from '@/lib/queries'

import type { AuthError } from '../../worker/auth'
import { GithubIcon } from './github-icon'
import { Logo } from './shell'
import { StarField } from './star-field'

const FEATURES = [
  {
    icon: OrbitIcon,
    text: 'Every star charted by when you starred it, how popular it is and how alive it is today.',
  },
  {
    icon: UndoIcon,
    text: 'Triage cruft and unlisted repos from the keyboard. Every unstar can be undone.',
  },
  {
    icon: FolderGit2Icon,
    text: 'Your own repos: star history, who is starring them, and what is waiting on you.',
  },
  {
    icon: BrainCircuitIcon,
    text: 'Clef on Workers AI suggests a List for each repo, inside your own Cloudflare account.',
  },
]

/**
 * Messages for the codes the OAuth callback passes back (AuthError in worker/auth.ts). Only these
 * are shown: the URL never supplies its own text.
 */
const AUTH_ERRORS: Record<AuthError, string> = {
  denied: 'GitHub sign-in was cancelled.',
  expired: 'Sign-in expired. Please try again.',
  no_token: "GitHub didn't return a token. Please try again.",
  not_allowed:
    "That GitHub account isn't allowed on this StarTune install. Ask the owner to add you to ALLOWED_USERS.",
  no_owner:
    "This StarTune install doesn't have an owner yet. Set ALLOWED_USERS to your GitHub username, then sign in.",
  failed: 'Sign-in failed. Please try again.',
}

function authErrorMessage(code: string | null): string | null {
  if (!code) {
    return null
  }
  return code in AUTH_ERRORS ? AUTH_ERRORS[code as AuthError] : AUTH_ERRORS.failed
}

/** A classic token with the two scopes StarTune needs, pre-filled on GitHub. */
const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=public_repo,read:user&description=StarTune'

function useViewport() {
  const [v, setV] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight })
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return v
}

export function Login() {
  const me = useMe()
  const sample = useMemo(() => derive(sampleLibrary()).stars, [])
  const params = new URLSearchParams(window.location.search)
  const oauth = me.data?.oauthEnabled !== false
  const [showToken, setShowToken] = useState(params.get('auth') === 'token')
  const view = useViewport()
  const wide = view.w >= 1024
  // The field fills the space right of the text column, sized to it so its caption sits under it.
  const inset = Math.min(560, view.w * 0.38)
  const fieldHeight = Math.min(view.h, Math.round((view.w - inset) * 0.78))
  const [token, setToken] = useState('')
  const [error, setError] = useState(() => authErrorMessage(params.get('auth_error')))
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await backend.tokenLogin(token)
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setBusy(false)
    }
  }

  const tokenForm = (
    <form onSubmit={(e) => void submit(e)} className="mt-6 flex flex-col gap-2">
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        A classic token with the <code className="font-mono text-foreground">public_repo</code> and{' '}
        <code className="font-mono text-foreground">read:user</code> scopes.{' '}
        <a
          href={NEW_TOKEN_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground underline underline-offset-4 hover:text-primary"
        >
          Create one on GitHub <ExternalLinkIcon className="size-3" />
        </a>
        . It's encrypted at rest on your own Cloudflare account.
      </p>
      <Button type="submit" disabled={busy || token.length < 20} className="self-start">
        <KeyRoundIcon /> {busy ? 'Signing in…' : 'Sign in with token'}
      </Button>
    </form>
  )

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {wide && (
        <div className="absolute inset-0 flex items-center">
          <StarField stars={sample} ambient height={fieldHeight} insetLeft={inset} />
        </div>
      )}
      <div className="pointer-events-none relative z-10 flex min-h-dvh flex-col px-6 py-6 md:px-12 lg:max-w-xl lg:py-8 *:pointer-events-auto">
        <Logo large />
        {!wide && (
          <div className="-mx-6 mt-5 border-y md:-mx-12">
            <StarField stars={sample} ambient height={280} />
          </div>
        )}
        {/* Top-anchored on wide screens, so opening the token form grows the column downwards. */}
        <div className="my-auto max-w-md py-8 lg:my-0 lg:pt-[clamp(1.5rem,14vh-4rem,7rem)]">
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Bring your stars into focus.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Sort your GitHub stars into Lists, clear out the dead ones, find the gems you forgot
            about, and watch your own repos grow.
          </p>
          {/* Without OAuth, the token form opens in place of its button, ahead of the demo. */}
          {!oauth && showToken && tokenForm}
          <div className={showToken && !oauth ? 'mt-3' : 'mt-6 flex flex-wrap gap-2'}>
            {oauth ? (
              <Button
                size="lg"
                nativeButton={false}
                render={<a href="/auth/login" aria-label="Sign in with GitHub" />}
              >
                <GithubIcon /> Sign in with GitHub
              </Button>
            ) : (
              !showToken && (
                <Button size="lg" onClick={() => setShowToken(true)}>
                  <KeyRoundIcon /> Sign in with a token
                </Button>
              )
            )}
            <Button size="lg" variant="outline" onClick={() => setDemo(true)}>
              <PlayIcon /> Explore with demo data
            </Button>
          </div>
          {oauth && !showToken && (
            <Button
              variant="link"
              size="sm"
              className="mt-2 px-0 text-muted-foreground"
              onClick={() => setShowToken(true)}
            >
              Use a personal access token instead
            </Button>
          )}
          {oauth && showToken && tokenForm}
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
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
        </div>
        {/* Every install shows this page: credit, and a way to the source. */}
        <p className="mt-auto pt-6 text-xs text-muted-foreground">
          <a
            href="https://github.com/nerdstep/startune"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-muted-foreground/40 underline-offset-4 hover:text-foreground hover:decoration-foreground"
          >
            Open source
          </a>{' '}
          by{' '}
          <a
            href="https://github.com/nerdstep"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-muted-foreground/40 underline-offset-4 hover:text-foreground hover:decoration-foreground"
          >
            @nerdstep
          </a>
        </p>
      </div>
    </div>
  )
}
