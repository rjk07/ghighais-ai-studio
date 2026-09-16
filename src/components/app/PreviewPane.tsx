import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  MousePointerSquareDashed,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { EDITOR_SCRIPT } from "@/lib/preview-editor";

type Selection = {
  tag: string;
  text: string;
  color: string;
  background: string;
  fontSize: number;
  width: number;
  height: number;
};

type Props = {
  code: string;
  editMode: boolean;
  onToggleEdit: (value: boolean) => void;
  onApply: (html: string) => void;
  onRuntimeError?: (message: string) => void;
};

const ERROR_REPORTER = `
window.addEventListener("error", function (e) {
  parent.postMessage({ source: "ghighais-preview", type: "error", message: (e.message || "Error") + " @" + (e.lineno || 0) }, "*");
});
window.addEventListener("unhandledrejection", function (e) {
  parent.postMessage({ source: "ghighais-preview", type: "error", message: "Promise: " + ((e.reason && e.reason.message) || e.reason) }, "*");
});
`;

function rgbToHex(value: string, fallback: string) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return fallback;
  return (
    "#" +
    [match[1], match[2], match[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function PreviewPane({ code, editMode, onToggleEdit, onApply }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  const srcDoc = useMemo(
    () => (editMode ? `${code}\n<script>${EDITOR_SCRIPT}</script>` : code),
    [code, editMode],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { source?: string; type?: string; info?: Selection; html?: string };
      if (data?.source !== "ghighais-preview") return;
      if (data.type === "selection") setSelection(data.info ?? null);
      if (data.type === "applied" && data.html) {
        onApply(data.html);
        setSelection(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onApply]);

  useEffect(() => {
    if (!editMode) setSelection(null);
  }, [editMode]);

  function send(type: string, payload: Record<string, unknown> = {}) {
    frameRef.current?.contentWindow?.postMessage(
      { source: "ghighais-parent", type, ...payload },
      "*",
    );
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-accent" />
          <h2 className="font-display text-sm font-semibold">Preview</h2>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <Button size="sm" className="gap-2" onClick={() => send("apply")}>
              <Check className="size-4" /> Terapkan
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={editMode ? "destructive" : "secondary"}
            className="gap-2"
            onClick={() => onToggleEdit(!editMode)}
          >
            <Pencil className="size-4" /> {editMode ? "Keluar Edit" : "Mode Edit"}
          </Button>
        </div>
      </div>

      {editMode ? (
        <div className="space-y-3 border-b border-border bg-secondary/40 px-4 py-3">
          {selection ? (
            <>
              <p className="text-xs text-muted-foreground">
                Terpilih: <span className="font-mono text-primary">&lt;{selection.tag}&gt;</span>
              </p>
              {selection.text ? (
                <div className="space-y-1">
                  <Label className="text-xs">Teks</Label>
                  <Input
                    defaultValue={selection.text}
                    onChange={(e) => send("text", { value: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Warna teks</Label>
                  <Input
                    type="color"
                    className="h-9 p-1"
                    defaultValue={rgbToHex(selection.color, "#ffffff")}
                    onChange={(e) => send("color", { value: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Warna latar</Label>
                  <Input
                    type="color"
                    className="h-9 p-1"
                    defaultValue={rgbToHex(selection.background, "#000000")}
                    onChange={(e) => send("background", { value: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ukuran font: {selection.fontSize}px</Label>
                <Slider
                  defaultValue={[selection.fontSize]}
                  min={8}
                  max={96}
                  step={1}
                  onValueChange={([v]) => send("fontSize", { value: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Lebar (px)</Label>
                  <Input
                    type="number"
                    defaultValue={selection.width}
                    onChange={(e) => send("width", { value: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tinggi (px)</Label>
                  <Input
                    type="number"
                    defaultValue={selection.height}
                    onChange={(e) => send("height", { value: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="icon" variant="secondary" onClick={() => send("move", { dy: -8 })}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon" variant="secondary" onClick={() => send("move", { dy: 8 })}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="icon" variant="secondary" onClick={() => send("move", { dx: -8 })}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Button size="icon" variant="secondary" onClick={() => send("move", { dx: 8 })}>
                  <ArrowRight className="size-4" />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => send("editable")}>
                  Edit langsung
                </Button>
                <Button size="sm" variant="destructive" className="gap-1" onClick={() => send("delete")}>
                  <Trash2 className="size-4" /> Hapus
                </Button>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MousePointerSquareDashed className="size-4" />
              Klik elemen pada preview untuk mengeditnya. Geser dengan drag.
            </p>
          )}
        </div>
      ) : null}

      <iframe
        ref={frameRef}
        title="Preview aplikasi"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms allow-modals"
        className="min-h-[420px] w-full flex-1 bg-white"
      />
    </div>
  );
}
