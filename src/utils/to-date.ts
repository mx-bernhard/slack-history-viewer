export function toDate(ts: string): Date;
export function toDate(ts: null): null;
export function toDate(ts: string | null): Date | null {
  return ts != null ? new Date(parseFloat(ts) * 1000) : null;
}
