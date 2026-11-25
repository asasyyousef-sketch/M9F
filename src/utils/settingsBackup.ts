import { SECONDARY_SECTIONS_STORAGE_KEY } from "./sidebarSections";

export interface SettingsBackupPayload {
  app: "M9F-Settings";
  version: 1;
  exportedAt: string;
  includesApiKeys: boolean;
  settingsCount: number;
  settings: Record<string, string>;
}

const API_KEY_STORAGE_KEYS = new Set<string>([
  "settings_gemini_api_key",
  "settings_groq_api_key",
  "settings_pixabay_key",
  "gemini_api_key",
  "GEMINI_API_KEY",
  "groq_api_key",
  "custom_api_key",
  "user_gemini_key",
]);

const EXACT_SETTINGS_KEYS = new Set<string>([
  SECONDARY_SECTIONS_STORAGE_KEY,
  "sidebar_collapsed",
  "challenge_question_source",
  "challenge_seconds",
  "challenge_target",
  "ai_corrector_selected_model",
  "ai_corrector_quick_access_models",
  "ai_corrector_button_models",
  "ai_corrector_target_level",
  "ai_corrector_speech_rate",
  "ai_corrector_voice_uri",
  "ai_corrector_auto_speak",
  "ai_corrector_auto_slide_interval",
  "ai_corrector_enable_persona_correction",
  "ai_corrector_active_persona_id",
  "ai_corrector_personas",
  "ai_instruction_presets",
  "shadowing_language",
  "shadowing_playback_speed",
  "shadowing_voice_id",
  "shadowing_voice_provider",
  "shadowing_ai_target_lang",
  "shadowing_ai_translation_model",
  "shadowing_ai_custom_prompt",
  "app_notes_baseline_offset",
  "app_notes_font",
  "app_notes_proofread_lang",
  "app_notes_proofread_model",
  "notes_tts_speech_rate",
  "notes_tts_voice_model",
  "german_verbs_ai_model",
  "german_verbs_voice_uri",
  "media_explorer_nav_sidebar",
  "media_explorer_view_mode",
  "media_player_is_muted",
  "media_player_selected_ai_model",
  "media_player_show_cue_timestamps",
  "media_player_show_dual_subtitles",
  "media_player_show_primary_subtitle",
  "media_player_show_subtitles_overlay",
  "media_player_sub_primary_style",
  "media_player_sub_secondary_style",
  "media_player_voice_clarifier",
  "media_player_volume",
  "media_translate_custom_prompt",
  "piper_custom_saved_models",
  "gradio_api_url",
  "gradio_local_stt_url",
]);

const SETTINGS_PREFIXES = ["settings_", "spoken_challenge_"];

const EXCLUDED_KEYS_OR_PREFIXES = [
  "app_auth_token",
  "cached_",
  "trash_",
  "active_folder_id",
  "auto_images_",
  "card_audio_",
  "review_chat_history_",
  "interactive_book_last_page_",
  "media_file_folder_map",
  "media_player_folders",
  "media_player_sub_tracks_",
  "media_player_last_played_file_id",
  "stats_",
  "__test_diag",
  "workspace_clipboard",
  "study_search_history",
  "recent_images",
  "temp_item_preview_style",
];

export function isApiKeyStorageKey(key: string): boolean {
  return API_KEY_STORAGE_KEYS.has(key);
}

export function isExportableSettingKey(key: string, includeApiKeys: boolean = false): boolean {
  if (!key) return false;
  if (EXCLUDED_KEYS_OR_PREFIXES.some((ex) => key === ex || key.startsWith(ex))) {
    return false;
  }
  if (isApiKeyStorageKey(key)) {
    return includeApiKeys;
  }
  if (EXACT_SETTINGS_KEYS.has(key)) {
    return true;
  }
  return SETTINGS_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function collectLocalSettingsSnapshot(options?: {
  includeApiKeys?: boolean;
  overrides?: Record<string, string>;
}): SettingsBackupPayload {
  const includeApiKeys = Boolean(options?.includeApiKeys);
  const settings: Record<string, string> = {};

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isExportableSettingKey(k, includeApiKeys)) {
      keys.push(k);
    }
  }

  if (options?.overrides) {
    for (const k of Object.keys(options.overrides)) {
      if (isExportableSettingKey(k, includeApiKeys) && !keys.includes(k)) {
        keys.push(k);
      }
    }
  }

  keys.sort();
  for (const k of keys) {
    if (options?.overrides && Object.prototype.hasOwnProperty.call(options.overrides, k)) {
      settings[k] = options.overrides[k];
    } else {
      const val = localStorage.getItem(k);
      if (val !== null) {
        settings[k] = val;
      }
    }
  }

  return {
    app: "M9F-Settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    includesApiKeys: includeApiKeys,
    settingsCount: Object.keys(settings).length,
    settings,
  };
}

export function countStoredSettings(includeApiKeys: boolean = false): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isExportableSettingKey(k, includeApiKeys)) {
      count++;
    }
  }
  return count;
}

export function importLocalSettingsSnapshot(
  rawJson: string,
  options?: { allowApiKeys?: boolean }
): { importedCount: number; skippedCount: number; includesApiKeys: boolean } {
  const allowApiKeys = options?.allowApiKeys ?? true;
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("صيغة ملف JSON غير صالحة.");
  }

  const rawSettings =
    parsed.settings && typeof parsed.settings === "object" && !Array.isArray(parsed.settings)
      ? (parsed.settings as Record<string, unknown>)
      : (parsed as Record<string, unknown>);

  let importedCount = 0;
  let skippedCount = 0;
  let includesApiKeys = false;

  for (const [key, rawVal] of Object.entries(rawSettings)) {
    // Skip envelope metadata if importing a flat object
    if (
      parsed.settings === undefined &&
      (key === "app" || key === "version" || key === "exportedAt" || key === "includesApiKeys" || key === "settingsCount")
    ) {
      continue;
    }

    if (!isExportableSettingKey(key, allowApiKeys)) {
      skippedCount++;
      continue;
    }

    if (rawVal === null || rawVal === undefined) {
      skippedCount++;
      continue;
    }

    const stringValue =
      typeof rawVal === "string"
        ? rawVal
        : typeof rawVal === "number" || typeof rawVal === "boolean"
        ? String(rawVal)
        : JSON.stringify(rawVal);

    localStorage.setItem(key, stringValue);
    importedCount++;
    if (isApiKeyStorageKey(key) && stringValue.trim()) {
      includesApiKeys = true;
    }
  }

  if (importedCount === 0) {
    throw new Error("لم يتم العثور على إعدادات صالحة للاستيراد داخل النص أو الملف.");
  }

  // Apply scale immediately if imported
  const importedScale = parseInt(localStorage.getItem("settings_site_scale") || "", 10);
  if (!isNaN(importedScale) && importedScale >= 60 && importedScale <= 150) {
    const baseFontSize = 12.65;
    document.documentElement.style.fontSize = `${baseFontSize * (importedScale / 100)}px`;
  }

  window.dispatchEvent(new Event("app_settings_changed"));

  return { importedCount, skippedCount, includesApiKeys };
}
