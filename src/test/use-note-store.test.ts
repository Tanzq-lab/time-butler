import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UNTITLED_NOTE_TITLE,
  useNoteStore,
} from "@/features/notes/use-note-store";

const { mockNotes } = vi.hoisted(() => ({
  mockNotes: [
    {
      id: 1,
      title: "Alpha",
      content: "First note",
      created_at: "2026-06-20T10:00:00.000Z",
      updated_at: "2026-06-20T10:00:00.000Z",
    },
    {
      id: 2,
      title: "Beta",
      content: "Second note",
      created_at: "2026-06-21T10:00:00.000Z",
      updated_at: "2026-06-21T10:00:00.000Z",
    },
  ],
}));

vi.mock("@/lib/db", () => ({
  getNotes: vi.fn().mockResolvedValue(mockNotes),
  addNote: vi.fn().mockResolvedValue(3),
  updateNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useNoteStore.setState({
    notes: [],
    activeNoteId: null,
    loading: false,
    error: null,
  });
});

describe("useNoteStore", () => {
  it("loads notes and selects the first note", async () => {
    await useNoteStore.getState().loadNotes();

    const state = useNoteStore.getState();
    expect(state.notes).toHaveLength(2);
    expect(state.activeNoteId).toBe(1);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("creates an untitled note and selects it", async () => {
    useNoteStore.setState({ notes: [...mockNotes] });

    const id = await useNoteStore.getState().createNote();

    const state = useNoteStore.getState();
    expect(id).toBe(3);
    expect(state.activeNoteId).toBe(3);
    expect(state.notes.some((note) => note.title === UNTITLED_NOTE_TITLE)).toBe(
      true,
    );
  });

  it("updates note fields optimistically", async () => {
    useNoteStore.setState({ notes: [...mockNotes], activeNoteId: 1 });

    await useNoteStore.getState().updateNote(1, {
      title: "Daily Log",
      content: "Updated content",
    });

    const updated = useNoteStore.getState().notes.find((note) => note.id === 1);
    expect(updated?.title).toBe("Daily Log");
    expect(updated?.content).toBe("Updated content");
  });

  it("deletes the active note and selects the next note", async () => {
    useNoteStore.setState({ notes: [...mockNotes], activeNoteId: 1 });

    await useNoteStore.getState().deleteNote(1);

    const state = useNoteStore.getState();
    expect(state.notes.map((note) => note.id)).toEqual([2]);
    expect(state.activeNoteId).toBe(2);
  });
});
