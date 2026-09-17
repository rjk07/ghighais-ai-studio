import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Github, Loader2, Sparkles, Wand2, Bot, Paperclip, X } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AppMenu, type Repo } from "@/components/app/AppMenu";
import { PreviewPane } from "@/components/app/PreviewPane";
import { CodeEditor } from "@/components/app/CodeEditor";
import { STARTER_CODE, stripFences } from "@/lib/ghighais";
import {
  applyMedia,
  fileToAsset,
  mediaInstruction,
  type MediaAsset,
} from "@/lib/media";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GHIGHAIS AI — Generator Aplikasi dari Prompt" },
      {
        name: "description",
        content:
          "GHIGHAIS AI: tulis prompt, dapatkan kode tanpa error, edit preview langsung, push ke GitHub, dan simpan ke ZIP.",
      },
      { property: "og:title", content: "GHIGHAIS AI — Generator Aplikasi dari Prompt" },
      {
        property: "og:description",
        content: "Buat aplikasi dari prompt, edit preview visual, push GitHub, simpan ZIP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Logo() {
  return (
    <div
      className="flex size-9 items-center justify-center rounded-xl"
      style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }}
    >
      <Bot className="size-5 text-primary-foreground" />
    </div>
  );
}

function Index() {
  const [user, setUser] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [prompt, setPrompt] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [code, setCode] = useState(STARTER_CODE);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [dbTokens, setDbTokens] = useState<Record<string, string>>({});
  const [ghToken, setGhToken] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const fixingRef = useRef(false);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const mediaRef = useRef<MediaAsset[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  async function handleMediaPick(files: FileList | null) {
    if (!files?.length) return;
    try {
      const assets = await Promise.all(Array.from(files).map(fileToAsset));
      setMedia((prev) => [...prev, ...assets].slice(0, 8));
      toast.success(`${assets.length} media siap dipakai di aplikasi`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  useEffect(() => {
    setUser(localStorage.getItem("ghighais:user"));
    const saved = localStorage.getItem("ghighais:code");
    if (saved !== null) setCode(saved);
    setPrompt(localStorage.getItem("ghighais:prompt") ?? "");
    setGithubUrl(localStorage.getItem("ghighais:github-url") ?? "");
    const tokens = localStorage.getItem("ghighais:db");
    if (tokens) {
      try {
        setDbTokens(JSON.parse(tokens) as Record<string, string>);
      } catch {
        localStorage.removeItem("ghighais:db");
      }
    }
    const gh = localStorage.getItem("ghighais:gh");
    if (gh) setGhToken(gh);
    const chat = localStorage.getItem("ghighais:chat");
    if (chat) {
      try {
        setHistory(JSON.parse(chat) as Array<{ role: "user" | "assistant"; text: string }>);
      } catch {
        localStorage.removeItem("ghighais:chat");
      }
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("ghighais:code", code);
  }, [code, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("ghighais:prompt", prompt);
  }, [prompt, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("ghighais:github-url", githubUrl);
  }, [githubUrl, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("ghighais:gh", ghToken);
  }, [ghToken, storageReady]);

  useEffect(() => {
    historyRef.current = history;
    if (!storageReady) return;
    localStorage.setItem("ghighais:chat", JSON.stringify(history.slice(-20)));
  }, [history, storageReady]);

  const runGenerate = useCallback(
    async (instruction: string, base: string, options?: { track?: string }) => {
      setGenerating(true);
      setProgress(3);
      const priorHistory = historyRef.current;
      // Kirim kode dengan media kembali menjadi placeholder supaya ringan.
      const compactBase = mediaRef.current.reduce(
        (acc, asset, i) => acc.split(asset.dataUrl).join(`__MEDIA_${i + 1}__`),
        base,
      );
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: instruction,
            currentCode: base,
            history: priorHistory,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(await res.text().catch(() => "Gagal menghubungi AI"));
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setProgress(Math.min(97, Math.round((acc.length / 4500) * 100)));
          if (acc.length > 200) setCode(applyMedia(stripFences(acc), mediaRef.current));
        }
        const final = applyMedia(stripFences(acc), mediaRef.current);
        if (!final.toLowerCase().includes("<html")) {
          throw new Error("Hasil AI tidak lengkap, coba ulangi prompt");
        }
        setCode(final);
        setProgress(100);
        if (options?.track) {
          setHistory((prev) =>
            [
              ...prev,
              { role: "user" as const, text: options.track as string },
              { role: "assistant" as const, text: "Dokumen aplikasi diperbarui sesuai permintaan." },
            ].slice(-20),
          );
        }
        return true;
      } catch (error) {
        toast.error((error as Error).message);
        setProgress(0);
        return false;
      } finally {
        setGenerating(false);
        setTimeout(() => setProgress(0), 1500);
      }
    },
    [],
  );

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Tulis instruksi dulu ya");
      return;
    }
    const instruction = prompt.trim();
    const ok = await runGenerate(instruction, code, { track: instruction });
    if (ok) {
      setPrompt("");
      toast.success("Kode berhasil dibuat — lanjutkan dengan prompt berikutnya");
    }
  }

  const handleRuntimeError = useCallback(
    async (message: string) => {
      if (fixingRef.current || generating) return;
      fixingRef.current = true;
      toast.info("Error terdeteksi, AI sedang memperbaiki…");
      await runGenerate(
        `The document has a runtime error: "${message}". Fix it completely and return the full corrected document with identical design and features.`,
        code,
      );
      setTimeout(() => (fixingRef.current = false), 4000);
    },
    [code, generating, runGenerate],
  );

  async function handleImport() {
    if (!githubUrl.trim()) return;
    setImporting(true);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", url: githubUrl, token: ghToken || undefined }),
      });
      const data = (await res.json()) as {
        error?: string;
        content?: string;
        entry?: string;
        files?: string[];
        sources?: string;
        repo?: string;
      };
      if (!res.ok) throw new Error(data.error || "Gagal membuka repository");
      const isFullPage =
        (data.content ?? "").toLowerCase().includes("</html>") &&
        (data.entry ?? "").toLowerCase().endsWith(".html");
      if (isFullPage) {
        setCode(data.content as string);
        toast.success(`Repo dibuka: ${data.entry} (${data.files?.length ?? 0} file)`);
        setHistory((prev) =>
          [
            ...prev,
            { role: "user" as const, text: `Buka aplikasi dari repo ${data.repo ?? githubUrl}` },
            { role: "assistant" as const, text: "Aplikasi dari repo ditampilkan di preview." },
          ].slice(-20),
        );
        return;
      }
      if (!data.sources) {
        toast.error("Tidak ada file yang bisa ditampilkan");
        return;
      }
      setImporting(false);
      toast.info("Menyusun aplikasi dari isi repository…");
      const ok = await runGenerate(
        `Build a single working HTML document that faithfully reproduces the app in this GitHub repository (${data.repo ?? githubUrl}). Keep its pages, layout, styling, texts and interactions. Convert any framework code into plain HTML/CSS/JS in one file.\n\nRepository files:\n${data.sources.slice(0, 60000)}`,
        "",
        { track: `Buka dan jalankan aplikasi dari repo ${data.repo ?? githubUrl}` },
      );
      if (ok) toast.success("Aplikasi dari repo berhasil ditampilkan");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function handleLoadRepos() {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repos", token: ghToken }),
      });
      const data = (await res.json()) as { repos?: Repo[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal memuat repository");
      setRepos(data.repos ?? []);
      localStorage.setItem("ghighais:gh", ghToken);
      toast.success(`${data.repos?.length ?? 0} repository ditemukan`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoadingRepos(false);
    }
  }

  async function handlePush(repo: string) {
    setPushing(true);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", token: ghToken, repo, content: code }),
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok) throw new Error(data.error || "Gagal push");
      toast.success(`Berhasil push ke ${repo}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPushing(false);
    }
  }

  async function handleZip() {
    const zip = new JSZip();
    zip.file("index.html", code);
    zip.file("README.md", "# Dibuat dengan GHIGHAIS AI\n");
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ghighais-ai.zip";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ZIP tersimpan");
  }

  function handleReset() {
    setPrompt("");
    setGithubUrl("");
    setCode("");
    setHistory([]);
    localStorage.setItem("ghighais:chat", "[]");
    setEditMode(false);
    localStorage.setItem("ghighais:prompt", "");
    localStorage.setItem("ghighais:github-url", "");
    localStorage.setItem("ghighais:code", "");
    toast.success("Halaman berhasil dikosongkan");
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Toaster position="top-center" />
        <div className="panel w-full max-w-sm space-y-4 p-6 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="brand-text font-display text-2xl font-bold">GHIGHAIS AI</h1>
          <p className="text-sm text-muted-foreground">Masuk untuk mulai membuat aplikasi.</p>
          <Input
            placeholder="Nama kamu"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={() => {
              const name = nameInput.trim() || "Pengguna";
              localStorage.setItem("ghighais:user", name);
              setUser(name);
            }}
          >
            Masuk
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="brand-text font-display text-lg font-bold tracking-tight">
              GHIGHAIS AI
            </span>
          </div>
          <AppMenu
            disabled={editMode}
            dbTokens={dbTokens}
            onDbToken={(id, value) => {
              const next = { ...dbTokens, [id]: value };
              setDbTokens(next);
              localStorage.setItem("ghighais:db", JSON.stringify(next));
            }}
            ghToken={ghToken}
            onGhToken={setGhToken}
            repos={repos}
            loadingRepos={loadingRepos}
            onLoadRepos={handleLoadRepos}
            pushing={pushing}
            onPush={handlePush}
            onSaveZip={handleZip}
            onReset={handleReset}
            onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            onLogout={() => {
              localStorage.removeItem("ghighais:user");
              setUser(null);
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="panel space-y-4 p-5" style={{ backgroundImage: "var(--gradient-hero)" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h1 className="font-display text-xl font-bold">Beranda</h1>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              Prompt unlimited · gratis
            </span>
          </div>

          {history.length ? (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border bg-background/50 p-3">
              {history.map((item, i) => (
                <div
                  key={`${i}-${item.text.slice(0, 12)}`}
                  className={
                    item.role === "user"
                      ? "ml-auto max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-xs"
                      : "mr-auto max-w-[85%] rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                  }
                >
                  {item.text}
                </div>
              ))}
            </div>
          ) : null}

          <Textarea
            rows={4}
            placeholder={
              history.length
                ? "Lanjutkan: misalnya tambahkan halaman kontak dan ubah warna tombol"
                : "Contoh: buatkan landing page toko kopi dengan menu, galeri, dan form pemesanan"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={editMode}
            className="font-body"
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="gap-2 sm:w-48"
              onClick={handleGenerate}
              disabled={generating || editMode}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Generate
            </Button>
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Tempel URL GitHub repo…"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                disabled={editMode}
              />
              <Button
                variant="secondary"
                className="gap-2"
                onClick={handleImport}
                disabled={importing || editMode}
              >
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Github className="size-4" />
                )}
                Buka
              </Button>
            </div>
          </div>

          {progress > 0 ? (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Proses generate {progress}%</p>
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel flex h-full flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="size-2.5 rounded-full bg-primary" />
              <h2 className="font-display text-sm font-semibold">Coding</h2>
            </div>
            <CodeEditor
              value={code}
              onChange={setCode}
              disabled={editMode}
            />
          </div>

          <PreviewPane
            code={code}
            editMode={editMode}
            onToggleEdit={setEditMode}
            onApply={(html) => {
              setCode(html);
              toast.success("Perubahan preview diterapkan ke coding");
            }}
            onRuntimeError={handleRuntimeError}
          />
        </div>
      </main>
    </div>
  );
}
