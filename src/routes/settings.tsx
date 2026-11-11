import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuitIcon, DownloadIcon, LogOutIcon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react";
import { PageHeader } from "@/components/bits";
import { SyncButton } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { backend, setDemo } from "@/lib/api";
import { useDerived, useMe, useStar } from "@/lib/queries";
import { ago } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const me = useMe();
  const { data } = useDerived();
  const star = useStar();
  const recent = data?.library.recentlyUnstarred ?? [];
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Signed in as @{me.data?.user?.login}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <SyncButton />
            <Button variant="outline" size="sm" onClick={() => void backend.exportBackup()}>
              <DownloadIcon /> Export backup (JSON)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (backend.demo) return setDemo(false);
                await backend.logout();
                window.location.assign("/");
              }}
            >
              <LogOutIcon /> {backend.demo ? "Leave demo" : "Sign out"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuitIcon className="size-4 text-neon-violet" /> AI model
              </CardTitle>
              <CardDescription>
                Using <code className="text-primary">@cf/cloudflare/{me.data?.aiModel}</code> on Workers AI. Set <code>CLEF_MODEL</code> to <code>clef</code> for the larger model.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4 shrink-0 text-neon-lime" />
            Your GitHub token is encrypted with AES-GCM in your own D1 database. Repo metadata is sent to Workers AI only when you run Clef.
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Recently unstarred</CardTitle>
              <CardDescription>Star them again to undo. Lists are restored too; the original star date can't be.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.slice(0, 50).map((u) => (
                  <li key={u.repoId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{u.fullName}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{ago(u.unstarredAt)}</span>
                    <Button size="sm" variant="outline" onClick={() => star.mutate([u.repoId])}>
                      <RotateCcwIcon /> Restar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
