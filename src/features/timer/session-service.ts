import {
  startSession as dbStartSession,
  finishSession as dbFinishSession,
  updateSessionReflection as dbUpdateSessionReflection,
  abandonSession as dbAbandonSession,
  addSession,
} from "@/lib/db";

export const SessionService = {
  async start(
    activeTaskId: number | null,
    phase: string,
    categoryId?: number | null,
    intention?: string | null,
  ): Promise<number> {
    return dbStartSession(activeTaskId, phase, categoryId, intention);
  },

  async finish(
    sessionId: number,
    durationSec?: number,
    mood?: string,
    notes?: string,
    completed = true,
  ): Promise<void> {
    await dbFinishSession(sessionId, durationSec, mood, notes, completed);
  },

  async updateReflection(
    sessionId: number,
    mood?: string,
    notes?: string,
  ): Promise<void> {
    await dbUpdateSessionReflection(sessionId, mood, notes);
  },

  async abandon(sessionId: number): Promise<void> {
    await dbAbandonSession(sessionId);
  },

  async recordSkip(
    activeTaskId: number | null,
    phase: string,
    elapsedSec: number,
    completed: boolean,
  ): Promise<void> {
    await addSession(activeTaskId, phase, elapsedSec, completed);
  },
};
