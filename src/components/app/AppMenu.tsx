import { useState } from "react";
import { Menu, Database, Github, FileArchive, Home, LogOut, Star, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DATABASES } from "@/lib/ghighais";

export type Repo = { fullName: string; private: boolean; branch: string };

type Props = {
  disabled?: boolean;
  dbTokens: Record<string, string>;
  onDbToken: (id: string, value: string) => void;
  ghToken: string;
  onGhToken: (value: string) => void;
  repos: Repo[];
  loadingRepos: boolean;
  onLoadRepos: () => void;
  pushing: boolean;
  onPush: (repo: string) => void;
  onSaveZip: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export function AppMenu(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" disabled={props.disabled} className="gap-2">
          <Menu className="size-4" />
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Menu GHIGHAIS AI</SheetTitle>
          <SheetDescription>Database, GitHub, dan pengaturan aplikasi.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              props.onHome();
              setOpen(false);
            }}
          >
            <Home className="size-4" /> Beranda
          </Button>

          <Separator />

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="db">
              <AccordionTrigger className="gap-2">
                <span className="flex items-center gap-2">
                  <Database className="size-4" /> Pilihan Database (11)
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                {DATABASES.map((db) => (
                  <div key={db.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{db.name}</span>
                      {db.recommended ? (
                        <Badge className="gap-1 bg-accent text-accent-foreground">
                          <Star className="size-3" /> Rekomendasi
                        </Badge>
                      ) : null}
                    </div>
                    <Input
                      type="password"
                      placeholder={db.hint}
                      value={props.dbTokens[db.id] ?? ""}
                      onChange={(e) => props.onDbToken(db.id, e.target.value)}
                    />
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="github">
              <AccordionTrigger className="gap-2">
                <span className="flex items-center gap-2">
                  <Github className="size-4" /> Push ke GitHub
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <Input
                  type="password"
                  placeholder="GitHub Personal Access Token"
                  value={props.ghToken}
                  onChange={(e) => props.onGhToken(e.target.value)}
                />
                <Button
                  className="w-full gap-2"
                  variant="secondary"
                  onClick={props.onLoadRepos}
                  disabled={props.loadingRepos || !props.ghToken}
                >
                  {props.loadingRepos ? <Loader2 className="size-4 animate-spin" /> : null}
                  Tampilkan Repository
                </Button>
                <div className="space-y-2">
                  {props.repos.map((repo) => (
                    <div
                      key={repo.fullName}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{repo.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {repo.private ? "private" : "public"} · {repo.branch}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={props.pushing}
                        onClick={() => props.onPush(repo.fullName)}
                      >
                        Push
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator />

          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              props.onSaveZip();
              setOpen(false);
            }}
          >
            <FileArchive className="size-4" /> Simpan ke ZIP
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive"
            onClick={() => {
              props.onLogout();
              setOpen(false);
            }}
          >
            <LogOut className="size-4" /> Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
