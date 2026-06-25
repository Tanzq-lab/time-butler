import { create } from "zustand";
import type { Note } from "@/lib/db";
import {
  getNotes,
  addNote as dbAddNote,
  updateNote as dbUpdateNote,
  deleteNote as dbDeleteNote,
} from "@/lib/db";

export const UNTITLED_NOTE_TITLE = "未命名记录";

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const titleOrder = a.title.localeCompare(b.title, "zh-Hans", {
      numeric: true,
      sensitivity: "base",
    });
    if (titleOrder !== 0) return titleOrder;
    return b.created_at.localeCompare(a.created_at);
  });
}

function nextUntitledTitle(notes: Note[]): string {
  const titles = new Set(notes.map((note) => note.title));
  if (!titles.has(UNTITLED_NOTE_TITLE)) return UNTITLED_NOTE_TITLE;

  let index = 2;
  while (titles.has(`${UNTITLED_NOTE_TITLE} ${index}`)) index += 1;
  return `${UNTITLED_NOTE_TITLE} ${index}`;
}

interface NoteStore {
  notes: Note[];
  activeNoteId: number | null;
  loading: boolean;
  error: string | null;
  loadNotes: () => Promise<void>;
  selectNote: (id: number | null) => void;
  createNote: () => Promise<number | null>;
  updateNote: (
    id: number,
    fields: Partial<Pick<Note, "title" | "content">>,
  ) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  activeNoteId: null,
  loading: false,
  error: null,

  loadNotes: async () => {
    set({ loading: true, error: null });
    try {
      const notes = await getNotes();
      const activeNoteId = notes.some((note) => note.id === get().activeNoteId)
        ? get().activeNoteId
        : notes[0]?.id ?? null;
      set({ notes, activeNoteId, loading: false, error: null });
    } catch (err) {
      console.error("[NoteStore] Failed to load notes:", err);
      set({ loading: false, error: String(err) });
    }
  },

  selectNote: (id) => set({ activeNoteId: id }),

  createNote: async () => {
    try {
      const title = nextUntitledTitle(get().notes);
      const id = await dbAddNote(title);
      const now = new Date().toISOString();
      const note: Note = {
        id,
        title,
        content: "",
        created_at: now,
        updated_at: now,
      };
      set((state) => ({
        notes: sortNotes([note, ...state.notes]),
        activeNoteId: id,
        error: null,
      }));
      return id;
    } catch (err) {
      console.error("[NoteStore] Failed to create note:", err);
      set({ error: String(err) });
      return null;
    }
  },

  updateNote: async (id, fields) => {
    try {
      await dbUpdateNote(id, fields);
      const updatedAt = new Date().toISOString();
      set((state) => ({
        notes: sortNotes(
          state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  ...fields,
                  updated_at: updatedAt,
                }
              : note,
          ),
        ),
        error: null,
      }));
    } catch (err) {
      console.error("[NoteStore] Failed to update note:", err);
      set({ error: String(err) });
    }
  },

  deleteNote: async (id) => {
    try {
      await dbDeleteNote(id);
      set((state) => {
        const nextNotes = state.notes.filter((note) => note.id !== id);
        const nextActiveNoteId =
          state.activeNoteId === id
            ? nextNotes[0]?.id ?? null
            : state.activeNoteId;
        return {
          notes: nextNotes,
          activeNoteId: nextActiveNoteId,
          error: null,
        };
      });
    } catch (err) {
      console.error("[NoteStore] Failed to delete note:", err);
      set({ error: String(err) });
    }
  },
}));
