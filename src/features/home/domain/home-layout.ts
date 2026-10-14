export const HOME_LAYOUTS = ['adaptive', 'carousel', 'grid', 'list'] as const
export type HomeLayout = typeof HOME_LAYOUTS[number]
export const HOME_COLUMNS = [0, 2, 3, 4, 5, 6] as const
export const HOME_ROWS = [1, 2, 3, 4, 0] as const
export const HOME_MAX_ITEMS = 200
export interface HomeConfig { layout: HomeLayout; columns: number; rows: number; showRadios: boolean }
export const DEFAULT_HOME_CONFIG: HomeConfig = { layout: 'adaptive', columns: 0, rows: 2, showRadios: true }

export function coerceHomeConfig(raw: unknown): HomeConfig {
  const value = raw && typeof raw === 'object' ? raw as Partial<HomeConfig> : {}
  return {
    showRadios: typeof value.showRadios === 'boolean' ? value.showRadios : true,
    layout: HOME_LAYOUTS.includes(value.layout as HomeLayout) ? value.layout! : 'adaptive',
    columns: HOME_COLUMNS.includes(value.columns as typeof HOME_COLUMNS[number]) ? value.columns! : 0,
    rows: HOME_ROWS.includes(value.rows as typeof HOME_ROWS[number]) ? value.rows! : 2,
  }
}

export function resolveHomeLayout(layout: HomeLayout, wide: boolean): Exclude<HomeLayout, 'adaptive'> {
  return layout === 'adaptive' ? (wide ? 'grid' : 'carousel') : layout
}

/** Measure the section's available width, including bento half-width sections. */
export function homeGridColumns(width: number, requested: number, autoColumns: number): number {
  const fit = Math.max(1, Math.floor((Math.max(0, width - 24) + 12) / (120 + 12)))
  return Math.min(requested || autoColumns, fit)
}

export function homeItemLimit(config: HomeConfig, columns: number, wide: boolean): number {
  const layout = resolveHomeLayout(config.layout, wide)
  return layout === 'carousel' ? 30 : layout === 'list' || config.rows === 0
    ? HOME_MAX_ITEMS : columns * config.rows
}
