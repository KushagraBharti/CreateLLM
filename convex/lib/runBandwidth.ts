import type { Doc } from "../_generated/dataModel";

export type LiveActivityCursor = {
  createdAt: number;
  eventId?: string;
};

function isCountedCompleteStatus(status: Doc<"runParticipants">["status"]) {
  return status === "complete" ? 1 : 0;
}

function isCountedFailedStatus(status: Doc<"runParticipants">["status"]) {
  return status === "failed" ? 1 : 0;
}

export function participantCounterDeltas(
  previousStatus: Doc<"runParticipants">["status"],
  nextStatus: Doc<"runParticipants">["status"],
) {
  return {
    completedDelta: isCountedCompleteStatus(nextStatus) - isCountedCompleteStatus(previousStatus),
    failedDelta: isCountedFailedStatus(nextStatus) - isCountedFailedStatus(previousStatus),
  };
}

function isLiveEventAfterCursor(
  event: Pick<Doc<"runEvents">, "_id" | "createdAt">,
  cursor: LiveActivityCursor,
) {
  if (event.createdAt > cursor.createdAt) {
    return true;
  }
  if (event.createdAt < cursor.createdAt) {
    return false;
  }
  if (!cursor.eventId) {
    return true;
  }
  return String(event._id).localeCompare(cursor.eventId) > 0;
}

function filterLiveActivityEventList<T extends Pick<Doc<"runEvents">, "_id" | "createdAt">>(
  events: T[],
  cursor?: LiveActivityCursor | null,
): T[] {
  const sorted = [...events].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return String(a._id).localeCompare(String(b._id));
  });

  if (!cursor) {
    return sorted;
  }

  return sorted.filter((event) => isLiveEventAfterCursor(event, cursor));
}

export function filterLiveActivityEventsSince(
  events: Array<Pick<Doc<"runEvents">, "_id" | "createdAt">>,
  cursor?: LiveActivityCursor | null,
): Array<Pick<Doc<"runEvents">, "_id" | "createdAt">> {
  return filterLiveActivityEventList(events, cursor);
}
