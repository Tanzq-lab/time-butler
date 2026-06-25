import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FileText,
  Loader2,
  NotebookText,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  UNTITLED_NOTE_TITLE,
  useNoteStore,
} from "@/features/notes/use-note-store";

type SaveState = "idle" | "saving" | "saved";

const MarkdownNoteEditor = lazy(() => import("./markdown-note-editor"));

function normalizeTitle(title: string): string {
  return title.trim() || UNTITLED_NOTE_TITLE;
}

function formatNoteTime(value: string): string {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSnippet(content: string): string {
  const snippet = content.replace(/\s+/g, " ").trim();
  return snippet || "空白记录";
}

export function NotesWorkspace() {
  const notes = useNoteStore((s) => s.notes);
  const activeNoteId = useNoteStore((s) => s.activeNoteId);
  const loading = useNoteStore((s) => s.loading);
  const error = useNoteStore((s) => s.error);
  const loadNotes = useNoteStore((s) => s.loadNotes);
  const selectNote = useNoteStore((s) => s.selectNote);
  const createNote = useNoteStore((s) => s.createNote);
  const updateNote = useNoteStore((s) => s.updateNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);

  const [searchQuery, setSearchQuery] = useState("");
  const [draftNoteId, setDraftNoteId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  );

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return notes;

    return notes.filter((note) => {
      const title = note.title.toLocaleLowerCase();
      const content = note.content.toLocaleLowerCase();
      return title.includes(query) || content.includes(query);
    });
  }, [notes, searchQuery]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (!activeNote) {
      setDraftNoteId(null);
      setDraftTitle("");
      setDraftContent("");
      setSaveState("idle");
      return;
    }

    setDraftNoteId(activeNote.id);
    setDraftTitle(activeNote.title);
    setDraftContent(activeNote.content);
    setSaveState("saved");
  }, [activeNote?.id]);

  const persistDraft = useCallback(async () => {
    if (draftNoteId === null) return;

    const savedNote = notes.find((note) => note.id === draftNoteId);
    if (!savedNote) return;

    const nextTitle = normalizeTitle(draftTitle);
    const hasTitleChange = nextTitle !== savedNote.title;
    const hasContentChange = draftContent !== savedNote.content;
    if (!hasTitleChange && !hasContentChange) return;

    setSaveState("saving");
    await updateNote(draftNoteId, {
      ...(hasTitleChange ? { title: nextTitle } : {}),
      ...(hasContentChange ? { content: draftContent } : {}),
    });
    setSaveState("saved");
  }, [draftContent, draftNoteId, draftTitle, notes, updateNote]);

  useEffect(() => {
    if (draftNoteId === null) return;

    const savedNote = notes.find((note) => note.id === draftNoteId);
    if (!savedNote) return;

    const nextTitle = normalizeTitle(draftTitle);
    const hasPendingChanges =
      nextTitle !== savedNote.title || draftContent !== savedNote.content;
    if (!hasPendingChanges) return;

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draftContent, draftNoteId, draftTitle, notes, persistDraft]);

  const handleCreateNote = async () => {
    await persistDraft();
    setSearchQuery("");
    await createNote();
  };

  const handleSelectNote = async (id: number) => {
    if (id === activeNoteId) return;
    await persistDraft();
    selectNote(id);
  };

  const handleDeleteNote = async (id: number, title: string) => {
    if (!window.confirm(`删除「${title}」？`)) return;
    await deleteNote(id);
  };

  const saveLabel =
    saveState === "saving" ? "保存中" : saveState === "saved" ? "已保存" : "";

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)]">
      <div className="mb-6 md:mb-8">
        <p className="text-[10px] font-bold text-sahara-text-muted uppercase tracking-[0.2em] mb-1">
          记录
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-serif text-2xl md:text-4xl text-sahara-text">
            写记录
          </h1>
          <Button
            variant="solid"
            intent="sahara"
            size="sm"
            shape="rounded-full"
            onClick={handleCreateNote}
            className="gap-1.5 px-4 shadow-lg shadow-sahara-primary/20 text-[10px] sm:text-xs font-bold tracking-widest uppercase"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">新建</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 md:gap-5">
        <aside className="lg:w-80 xl:w-[22rem] shrink-0 bg-sahara-surface border border-sahara-border/20 rounded-2xl overflow-hidden flex flex-col min-h-64 lg:min-h-0 shadow-sm shadow-sahara-primary/5">
          <div className="p-3 border-b border-sahara-border/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sahara-text-muted" />
              <input
                type="text"
                placeholder="搜索记录..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full h-10 bg-sahara-bg/50 border border-sahara-border/20 rounded-full pl-9 pr-4 text-sm text-sahara-text placeholder:text-sahara-text-muted/50 outline-none focus:border-sahara-primary/40 focus:ring-2 focus:ring-sahara-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="h-full min-h-40 flex items-center justify-center text-sahara-text-muted">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : filteredNotes.length > 0 ? (
              <div className="space-y-1">
                {filteredNotes.map((note) => {
                  const active = note.id === activeNoteId;
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => void handleSelectNote(note.id)}
                      className={cn(
                        "group w-full text-left rounded-xl px-3 py-2.5 transition-colors cursor-pointer",
                        active
                          ? "bg-sahara-primary-light text-sahara-primary"
                          : "text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <FileText
                          className={cn(
                            "size-4 shrink-0 mt-0.5",
                            active
                              ? "text-sahara-primary"
                              : "text-sahara-text-muted",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold">
                              {note.title}
                            </span>
                            <span className="ml-auto shrink-0 text-[10px] font-semibold text-sahara-text-muted tabular-nums">
                              {formatNoteTime(note.updated_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-sahara-text-muted truncate">
                            {getSnippet(note.content)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-full min-h-40 flex flex-col items-center justify-center text-center px-6">
                <NotebookText className="size-10 text-sahara-border mb-3" />
                <p className="text-sm font-bold text-sahara-text-muted">
                  没有记录
                </p>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-[30rem] bg-sahara-surface border border-sahara-border/20 rounded-2xl overflow-hidden shadow-sm shadow-sahara-primary/5">
          {activeNote ? (
            <div className="h-full flex flex-col">
              <div className="px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-4 border-b border-sahara-border/20">
                <input
                  aria-label="记录标题"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => {
                    if (!draftTitle.trim()) setDraftTitle(UNTITLED_NOTE_TITLE);
                    void persistDraft();
                  }}
                  className="w-full bg-transparent font-serif text-3xl md:text-5xl leading-tight text-sahara-text placeholder:text-sahara-text-muted/40 outline-none"
                  placeholder={UNTITLED_NOTE_TITLE}
                />

                <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-wider text-sahara-text-muted">
                  <div className="flex items-center gap-2 min-w-0">
                    <Save className="size-3.5 shrink-0" />
                    <span>{saveLabel}</span>
                  </div>
                  <Button
                    variant="ghost"
                    intent="red"
                    size="icon"
                    shape="rounded-full"
                    aria-label="删除记录"
                    title="删除记录"
                    onClick={() =>
                      void handleDeleteNote(activeNote.id, activeNote.title)
                    }
                    className="shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 notes-markdown-editor">
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center text-sahara-text-muted">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                  }
                >
                  <MarkdownNoteEditor
                    value={draftContent}
                    onChange={setDraftContent}
                    onBlur={() => void persistDraft()}
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[30rem] flex flex-col items-center justify-center text-center px-6">
              <NotebookText className="size-12 text-sahara-border mb-4" />
              <p className="text-sm font-bold text-sahara-text-muted">
                选择或新建一条记录
              </p>
              {error && (
                <p className="mt-2 text-xs text-red-500 max-w-sm">{error}</p>
              )}
              <Button
                variant="outline"
                intent="sahara"
                size="sm"
                shape="rounded-full"
                onClick={handleCreateNote}
                className="mt-5 gap-1.5"
              >
                <Plus className="size-4" />
                新建记录
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
