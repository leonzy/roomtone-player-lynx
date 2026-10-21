import { favoritePlaylistId, radioFavoritePlaylistId } from '../../../core/config/constants.js'
import type { Playlist } from '../../../models/playlist.js'

export interface HomeFavoritesVisibility {
  showFavorites: boolean
  showRadioFavorites: boolean
}

export const DEFAULT_HOME_FAVORITES: HomeFavoritesVisibility = {
  showFavorites: true,
  showRadioFavorites: true,
}

export function parseHomeFavorites(raw: unknown): HomeFavoritesVisibility {
  const value = raw as Partial<HomeFavoritesVisibility> | null
  return {
    showFavorites: typeof value?.showFavorites === 'boolean' ? value.showFavorites : true,
    showRadioFavorites: typeof value?.showRadioFavorites === 'boolean' ? value.showRadioFavorites : true,
  }
}

/** Only home cards are filtered; never change playlist labels or song queries. */
export function isHomePlaylistVisible(playlist: Playlist, config: HomeFavoritesVisibility): boolean {
  if (!playlist.isBuiltIn) return true
  if (String(playlist.id) === favoritePlaylistId) return config.showFavorites
  if (String(playlist.id) === radioFavoritePlaylistId) return config.showRadioFavorites
  return true
}
