import type { Trip, ParkStatus, UserProfile, TrailCompletionRow, PlantSightingRow, ContentReportInput } from '@/types';
import type { ParkStatusSnapshot } from '@/data/localCache';

// Pure logic for the offline outbox — no React Native or Supabase imports, so
// it can be unit tested directly (see tests/outbox.test.mjs). Persistence
// lives in outbox.ts and the network side effects in AppContext.

interface OpMeta {
  id: string;
  createdAt: string;
  // Times the server actively rejected this op. Network failures don't count:
  // being offline isn't the op's fault.
  attempts: number;
  // Why the last attempt failed, shown in the "waiting to sync" details.
  lastError?: string;
}

export type OutboxOp = OpMeta &
  (
    | { type: 'trip.edit'; trip: Trip }
    // `label` is only for display (the trip itself is already gone locally).
    | { type: 'trip.delete'; tripId: string; label?: string }
    | { type: 'trail.complete'; row: TrailCompletionRow }
    | { type: 'trail.uncomplete'; trailId: string }
    | { type: 'plant.find'; row: PlantSightingRow }
    | { type: 'plant.unfind'; plantId: string }
    | { type: 'park.status'; parkId: string; status: ParkStatus; isFavorite: boolean }
    | { type: 'profile.patch'; patch: Partial<UserProfile> }
    | { type: 'badge.earn'; badges: { badgeId: string; earnedAt: string; progress: number }[] }
    | { type: 'report.submit'; report: ContentReportInput }
  );

export type NewOutboxOp = OutboxOp extends infer O
  ? O extends OutboxOp
    ? Omit<O, keyof OpMeta>
    : never
  : never;

export const MAX_ATTEMPTS = 5;

// Every replayed operation is idempotent (upserts, deletes by key, or
// insert-if-missing), so coalescing here is an optimisation that keeps the
// queue short — never something correctness depends on. A replaced op always
// gets a fresh id, so a flush that is mid-way through executing the old one
// can't accidentally remove the newer version when it finishes.
export function enqueueOp(ops: OutboxOp[], op: NewOutboxOp, meta: { id: string; createdAt: string }): OutboxOp[] {
  const next: OutboxOp = { ...op, id: meta.id, createdAt: meta.createdAt, attempts: 0 } as OutboxOp;

  switch (next.type) {
    case 'trip.edit': {
      const tripId = next.trip.id;
      // A trip queued for deletion can't be edited back into existence.
      if (ops.some((o) => o.type === 'trip.delete' && o.tripId === tripId)) return ops;
      return [...ops.filter((o) => !(o.type === 'trip.edit' && o.trip.id === tripId)), next];
    }
    case 'trip.delete': {
      if (ops.some((o) => o.type === 'trip.delete' && o.tripId === next.tripId)) return ops;
      return [...ops.filter((o) => !(o.type === 'trip.edit' && o.trip.id === next.tripId)), next];
    }
    case 'park.status':
      return [...ops.filter((o) => !(o.type === 'park.status' && o.parkId === next.parkId)), next];
    case 'profile.patch': {
      const existing = ops.find((o) => o.type === 'profile.patch');
      const merged: OutboxOp =
        existing && existing.type === 'profile.patch' ? { ...next, patch: { ...existing.patch, ...next.patch } } : next;
      return [...ops.filter((o) => o.type !== 'profile.patch'), merged];
    }
    case 'trail.complete':
    case 'trail.uncomplete': {
      const trailId = next.type === 'trail.complete' ? next.row.trail_id : next.trailId;
      const lastForTrail = [...ops]
        .reverse()
        .find((o) => (o.type === 'trail.complete' && o.row.trail_id === trailId) || (o.type === 'trail.uncomplete' && o.trailId === trailId));
      return lastForTrail && lastForTrail.type === next.type ? ops : [...ops, next];
    }
    case 'plant.find':
    case 'plant.unfind': {
      const plantId = next.type === 'plant.find' ? next.row.plant_id : next.plantId;
      const lastForPlant = [...ops]
        .reverse()
        .find((o) => (o.type === 'plant.find' && o.row.plant_id === plantId) || (o.type === 'plant.unfind' && o.plantId === plantId));
      return lastForPlant && lastForPlant.type === next.type ? ops : [...ops, next];
    }
    case 'report.submit': {
      const r = next.report;
      const duplicate = ops.some(
        (o) => o.type === 'report.submit' && o.report.entryId === r.entryId && o.report.reason === r.reason
      );
      return duplicate ? ops : [...ops, next];
    }
    default:
      return [...ops, next];
  }
}

// Supabase calls mostly resolve with an `error` instead of throwing, and a
// dropped connection looks different from a server that said no. Only the
// former should leave the op queued for later without counting against it.
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown; status?: unknown; statusCode?: unknown };
  const status = Number(e.status ?? e.statusCode);
  if (Number.isFinite(status) && status >= 500) return true;
  // Postgres / PostgREST rejections always carry a code (constraint, RLS...).
  if (typeof e.code === 'string' && e.code !== '') return false;
  const message = String(e.message ?? '').toLowerCase();
  return /network|failed to fetch|fetch failed|load failed|timeout|timed out|connection|offline|internet|econn|enotfound/.test(
    message
  );
}

// A short, human description of a queued change for the "waiting to sync"
// list. Names are looked up by the caller so this stays free of app data.
export interface DescribeLookup {
  parkName: (parkId: string) => string;
  trailName: (trailId: string) => string;
  plantName: (plantId: string) => string;
  badgeName: (badgeId: string) => string;
}

export interface ChangeDescription {
  title: string;
  detail?: string;
}

// One row in the "waiting to sync" list.
export interface PendingChange extends ChangeDescription {
  id: string;
  error?: string;
}

const STATUS_LABEL: Record<string, string> = { visited: 'Visited', planned: 'Planned', notVisited: 'Not visited' };

export function describeOp(op: OutboxOp, lookup: DescribeLookup): ChangeDescription {
  switch (op.type) {
    case 'trip.edit':
      return { title: 'Trip changes', detail: `${lookup.parkName(op.trip.parkId)} · ${op.trip.startDate}` };
    case 'trip.delete':
      return { title: 'Delete trip', detail: op.label };
    case 'trail.complete':
      return { title: 'Mark trail done', detail: op.row.name };
    case 'trail.uncomplete':
      return { title: 'Unmark trail', detail: lookup.trailName(op.trailId) };
    case 'plant.find':
      return { title: 'Mark plant found', detail: op.row.name };
    case 'plant.unfind':
      return { title: 'Unmark plant', detail: lookup.plantName(op.plantId) };
    case 'park.status':
      return {
        title: 'Park update',
        detail: `${lookup.parkName(op.parkId)} · ${STATUS_LABEL[op.status] ?? op.status}${op.isFavorite ? ' · Bucket list' : ''}`,
      };
    case 'profile.patch':
      return { title: 'Profile update', detail: Object.keys(op.patch).join(', ') };
    case 'badge.earn':
      return { title: 'Badge earned', detail: op.badges.map((b) => lookup.badgeName(b.badgeId)).join(', ') };
    case 'report.submit':
      return { title: 'Report', detail: op.report.entryName };
  }
}

// ---------------------------------------------------------------------------
// Overlays: re-apply still-queued local changes on top of freshly fetched
// server data, so a load that finishes while ops are still waiting doesn't
// briefly show the change as undone.
// ---------------------------------------------------------------------------

export function overlayTrips(fetched: Trip[], ops: OutboxOp[]): Trip[] {
  const deleted = new Set<string>();
  const edits = new Map<string, Trip>();
  for (const op of ops) {
    if (op.type === 'trip.delete') deleted.add(op.tripId);
    if (op.type === 'trip.edit') edits.set(op.trip.id, op.trip);
  }
  return fetched.filter((t) => !deleted.has(t.id)).map((t) => edits.get(t.id) ?? t);
}

export function overlayParkStatus(rows: ParkStatusSnapshot[], ops: OutboxOp[]): ParkStatusSnapshot[] {
  const byId = new Map(rows.map((r) => [r.parkId, r]));
  for (const op of ops) {
    if (op.type === 'park.status') byId.set(op.parkId, { parkId: op.parkId, status: op.status, isFavorite: op.isFavorite });
  }
  return [...byId.values()];
}

export function overlayTrailCompletions(rows: TrailCompletionRow[], ops: OutboxOp[]): TrailCompletionRow[] {
  let result = rows;
  for (const op of ops) {
    if (op.type === 'trail.complete') {
      const exists = result.some((r) => r.trail_id === op.row.trail_id && r.trip_id === null);
      if (!exists) result = [...result, op.row];
    }
    if (op.type === 'trail.uncomplete') {
      result = result.filter((r) => !(r.trail_id === op.trailId && r.trip_id === null));
    }
  }
  return result;
}

export function overlayPlantSightings(rows: PlantSightingRow[], ops: OutboxOp[]): PlantSightingRow[] {
  let result = rows;
  for (const op of ops) {
    if (op.type === 'plant.find') {
      const exists = result.some((r) => r.plant_id === op.row.plant_id && r.trip_id === null);
      if (!exists) result = [...result, op.row];
    }
    if (op.type === 'plant.unfind') {
      result = result.filter((r) => !(r.plant_id === op.plantId && r.trip_id === null));
    }
  }
  return result;
}

export function overlayProfile(profile: UserProfile, ops: OutboxOp[]): UserProfile {
  return ops.reduce((acc, op) => (op.type === 'profile.patch' ? { ...acc, ...op.patch } : acc), profile);
}
