export type SecondarySectionKey = "corrector" | "media" | "notes" | "shadowing";

export interface SecondarySectionsVisibility {
  corrector: boolean;
  media: boolean;
  notes: boolean;
  shadowing: boolean;
}

export const DEFAULT_SECONDARY_SECTIONS: SecondarySectionsVisibility = {
  corrector: false,
  media: false,
  notes: false,
  shadowing: false,
};

export const SECONDARY_SECTIONS_STORAGE_KEY = "settings_sidebar_secondary_sections";

export function loadSecondarySectionsVisibility(): SecondarySectionsVisibility {
  try {
    const raw = localStorage.getItem(SECONDARY_SECTIONS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SECONDARY_SECTIONS };
    const parsed = JSON.parse(raw);
    return {
      corrector: Boolean(parsed?.corrector),
      media: Boolean(parsed?.media),
      notes: Boolean(parsed?.notes),
      shadowing: Boolean(parsed?.shadowing),
    };
  } catch {
    return { ...DEFAULT_SECONDARY_SECTIONS };
  }
}

export function saveSecondarySectionsVisibility(next: SecondarySectionsVisibility): void {
  try {
    localStorage.setItem(SECONDARY_SECTIONS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("app_settings_changed"));
  } catch {}
}
