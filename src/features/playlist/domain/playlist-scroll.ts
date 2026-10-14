export interface VisibleCell { itemKey?: string; index?: number; top?: number; bottom?: number }

export interface RowBounds { top: number; bottom: number }

/** Actual row geometry avoids Web's asynchronously updated visible-cell cache. */
export async function firstVisibleRowByBounds(count: number, viewport: RowBounds,
  read: (index: number) => Promise<RowBounds | undefined>): Promise<number | undefined> {
  let low = 0
  let high = count - 1
  let candidate: number | undefined
  let candidateBounds: RowBounds | undefined
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const bounds = await read(middle)
    if (!bounds || !Number.isFinite(bounds.top) || !Number.isFinite(bounds.bottom)) return undefined
    if (bounds.bottom > viewport.top) {
      candidate = middle
      candidateBounds = bounds
      high = middle - 1
    } else low = middle + 1
  }
  return candidateBounds && candidateBounds.top < viewport.bottom ? candidate : undefined
}

/** web-elements returns a viewport-relative array; native hosts wrap list-relative cells. */
export function normalizeVisibleCells(payload: unknown, viewportTop = 0): VisibleCell[] {
  const cells = Array.isArray(payload) ? payload as VisibleCell[]
    : (payload as { attachedCells?: VisibleCell[] } | null)?.attachedCells ?? []
  return cells.map(cell => ({ ...cell, top: Number(cell.top) - viewportTop, bottom: Number(cell.bottom) - viewportTop }))
}

export function firstVisibleSongIndex(cells: readonly VisibleCell[], songIds: readonly number[]): number | undefined {
  const candidates = cells.filter(cell => Number(cell.bottom) > 0 && Number.isFinite(cell.top))
    .sort((a, b) => Number(a.top) - Number(b.top))
  for (const cell of candidates) {
    const index = songIds.findIndex(id => String(id) === cell.itemKey)
    if (index >= 0) return index
  }
  return undefined
}

export function playlistIndexFromRatio(ratio: number, total: number): number {
  if (!Number.isFinite(ratio) || total <= 1) return 0
  return Math.round(Math.max(0, Math.min(1, ratio)) * (total - 1))
}
