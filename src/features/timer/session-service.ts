import {
  startSession as dbStartSession,
  finishSession as dbFinishSession,
  updateSessionReflection as dbUpdateSessionReflection,
  updateSessionAttribution as dbUpdateSessionAttribution,
  abandonSession as dbAbandonSession,
  addSession,
  recordAppEvent,
} from "@/lib/db";

export const SessionService = {
  async start(
    activeTaskId: number | null,
    phase: string,
    categoryId?: number | null,
    intention?: string | null,
  ): Promise<number> {
    const sessionId = await dbStartSession(activeTaskId, phase, categoryId, intention);
    void recordAppEvent({
      eventName: "timer_session_started",
      route: "/",
      entityType: "session",
      entityId: sessionId,
      metadata: {
        phase,
        hasTask: activeTaskId != null,
        hasCategory: categoryId != null,
        hasIntention: Boolean(intention?.trim()),
      },
    });
    return sessionId;
  },

  async finish(
    sessionId: number,
    durationSec?: number,
    mood?: string,
    notes?: string,
    completed = true,
  ): Promise<void> {
    await dbFinishSession(sessionId, durationSec, mood, notes, completed);
    void recordAppEvent({
      eventName: "timer_session_finished",
      route: "/",
      entityType: "session",
      entityId: sessionId,
      metadata: {
        durationSec: durationSec ?? null,
        completed,
        hasMood: Boolean(mood),
        hasNotes: Boolean(notes?.trim()),
      },
    });
  },

  async updateReflection(
    sessionId: number,
    mood?: string,
    notes?: string,
  ): Promise<void> {
    await dbUpdateSessionReflection(sessionId, mood, notes);
    void recordAppEvent({
      eventName: "timer_session_reflection_updated",
      route: "/",
      entityType: "session",
      entityId: sessionId,
      metadata: {
        hasMood: Boolean(mood),
        hasNotes: Boolean(notes?.trim()),
      },
    });
  },

  async updateAttribution(
    sessionId: number,
    taskId: number | null,
    categoryId?: number | null,
    intention?: string | null,
  ): Promise<void> {
    await dbUpdateSessionAttribution(sessionId, taskId, categoryId, intention);
    void recordAppEvent({
      eventName: "timer_session_attribution_updated",
      route: "/",
      entityType: "session",
      entityId: sessionId,
      metadata: {
        hasTask: taskId != null,
        hasCategory: categoryId != null,
        hasIntention: Boolean(intention?.trim()),
      },
    });
  },

  async abandon(sessionId: number): Promise<void> {
    await dbAbandonSession(sessionId);
    void recordAppEvent({
      eventName: "timer_session_abandoned",
      route: "/",
      entityType: "session",
      entityId: sessionId,
    });
  },

  async recordSkip(
    activeTaskId: number | null,
    phase: string,
    elapsedSec: number,
    completed: boolean,
  ): Promise<number> {
    const sessionId = await addSession(activeTaskId, phase, elapsedSec, completed);
    void recordAppEvent({
      eventName: "timer_session_skipped",
      route: "/",
      entityType: "session",
      entityId: sessionId,
      metadata: {
        phase,
        elapsedSec,
        completed,
        hasTask: activeTaskId != null,
      },
    });
    return sessionId;
  },
};
