import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  Upload,
  Film,
  Music,
  Trash2,
  Download,
  Edit2,
  Check,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Repeat,
  Maximize2,
  Menu,
  ArrowRight,
  Search,
  FileVideo,
  FileAudio,
  HardDrive,
  List,
  Grid,
  Loader2,
  Clock,
  Sparkles,
  AlertCircle,
  Subtitles,
  FileText,
  Copy,
  Plus,
  Settings2,
  Languages,
  Eye,
  EyeOff,
  ChevronDown,
  Wand2,
  Sliders,
  CheckCheck,
  Mic,
  Server,
  Expand,
  Shrink,
  Tv,
  Layers,
  Split,
  BookOpen,
  Bot
} from "lucide-react";
import { MediaFile, MediaSubtitleTrack, SubtitleCue } from "../types";
import {
  parseSubtitleContent,
  formatSecondsToTime,
  exportCuesToSrt,
  exportCuesToVtt,
  exportCuesToPlainText
} from "../utils/subtitleParser";
import { GradioTranscriberModal } from "./GradioTranscriberModal";
import { ALL_AVAILABLE_MODELS, AIModelOption } from "./AICorrectorWorkspace";

interface MediaPlayerWorkspaceProps {
  onToggleSidebar?: () => void;
  onBackToLibrary?: () => void;
}

export const MediaPlayerWorkspace: React.FC<MediaPlayerWorkspaceProps> = ({
  onToggleSidebar,
  onBackToLibrary
}) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active playing media
  const [currentFile, setCurrentFile] = useState<MediaFile | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Subtitle States
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [secondaryTrackId, setSecondaryTrackId] = useState<string | null>(null);
  const [showDualSubtitles, setShowDualSubtitles] = useState<boolean>(true);
  const [showSubtitlesOverlay, setShowSubtitlesOverlay] = useState<boolean>(true);
  const [showTranscriptPanel, setShowTranscriptPanel] = useState<boolean>(true);
  const [autoScrollTranscript, setAutoScrollTranscript] = useState<boolean>(true);
  const [subtitleFontSize, setSubtitleFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [subtitleStyle, setSubtitleStyle] = useState<"black" | "transparent" | "yellow" | "outline">("black");
  const [subtitleSearchQuery, setSubtitleSearchQuery] = useState<string>("");

  // Immersive Theater Mode (Video huge, minimal bottom controls, side drawer for scrolling cues with toggle)
  const [isImmersiveMode, setIsImmersiveMode] = useState<boolean>(false);
  const [showImmersiveSideDrawer, setShowImmersiveSideDrawer] = useState<boolean>(true);

  // Gemini Subtitle Translation state
  const [isTranslatingTrack, setIsTranslatingTrack] = useState<boolean>(false);
  const [showTranslateModal, setShowTranslateModal] = useState<boolean>(false);
  const [translateTargetLang, setTranslateTargetLang] = useState<string>("ar");

  // Subtitle Modals
  const [showSubtitleUploadModal, setShowSubtitleUploadModal] = useState<boolean>(false);
  const [showGradioModal, setShowGradioModal] = useState<boolean>(false);
  const [subtitleUploadMode, setSubtitleUploadMode] = useState<"file" | "paste" | "ai" | "gradio">("gradio");
  const [pastedSubtitleText, setPastedSubtitleText] = useState<string>("");
  const [subtitleTrackLabel, setSubtitleTrackLabel] = useState<string>("");
  const [aiSubtitleLang, setAiSubtitleLang] = useState<string>("ar");
  const [aiPromptHint, setAiPromptHint] = useState<string>("");
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);

  // Selected AI Model (Same models as in AI Corrector / قسم صحح)
  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("media_player_selected_ai_model") ||
        localStorage.getItem("ai_corrector_selected_model") ||
        "gemini-3.6-flash"
      );
    }
    return "gemini-3.6-flash";
  });

  const handleSelectAiModel = (m: string) => {
    setSelectedAiModel(m);
    try {
      localStorage.setItem("media_player_selected_ai_model", m);
    } catch (e) {
      console.error("Failed to save AI model preference:", e);
    }
  };

  // Timeline states for smooth YouTube-like scrubbing and zero-pop audio
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverCueText, setHoverCueText] = useState<string | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  // Edit / Add Cue Modal
  const [editingCue, setEditingCue] = useState<SubtitleCue | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);

  // Filters and UI states
  const [filterType, setFilterType] = useState<"all" | "video" | "audio">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Editing file title
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState<string>("");

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleFileInputRef = useRef<HTMLInputElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const activeCueRef = useRef<HTMLDivElement | null>(null);

  // Fetch files from server
  const fetchMediaFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media/files");
      if (!res.ok) throw new Error("فشل في جلب قائمة الملفات");
      const data = await res.json();
      const loadedFiles: MediaFile[] = data.files || [];
      setFiles(loadedFiles);

      // Keep currentFile synchronized if already chosen
      if (currentFile) {
        const updatedCurrent = loadedFiles.find((f) => f.id === currentFile.id);
        if (updatedCurrent) {
          setCurrentFile(updatedCurrent);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء تحميل الملفات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  // Set active and secondary subtitle tracks when currentFile changes
  useEffect(() => {
    if (currentFile?.subtitles && currentFile.subtitles.length > 0) {
      // Default to first track if not selected or current not in list
      if (!activeTrackId || !currentFile.subtitles.some(t => t.id === activeTrackId)) {
        setActiveTrackId(currentFile.subtitles[0].id);
      }
      // If there is a second track, automatically set it as secondary track (e.g. Arabic translation + German original)
      if (currentFile.subtitles.length > 1 && (!secondaryTrackId || !currentFile.subtitles.some(t => t.id === secondaryTrackId))) {
        const otherTrack = currentFile.subtitles.find(t => t.id !== (activeTrackId || currentFile.subtitles![0].id));
        if (otherTrack) {
          setSecondaryTrackId(otherTrack.id);
        }
      }
    } else {
      setActiveTrackId(null);
      setSecondaryTrackId(null);
    }
  }, [currentFile]);

  // Active Subtitle Track (Primary) and Cues
  const activeTrack = useMemo(() => {
    if (!currentFile?.subtitles || !activeTrackId) return null;
    return currentFile.subtitles.find((t) => t.id === activeTrackId) || null;
  }, [currentFile, activeTrackId]);

  const activeCues = useMemo(() => {
    return activeTrack?.cues || [];
  }, [activeTrack]);

  // Current active Cue matching current time for Primary Track
  const currentCue = useMemo(() => {
    if (!activeCues || activeCues.length === 0) return null;
    return activeCues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    ) || null;
  }, [activeCues, currentTime]);

  // Secondary Subtitle Track (For Dual Subtitles / الترجمة المزدوجة)
  const secondaryTrack = useMemo(() => {
    if (!currentFile?.subtitles || !secondaryTrackId || secondaryTrackId === activeTrackId) return null;
    return currentFile.subtitles.find((t) => t.id === secondaryTrackId) || null;
  }, [currentFile, secondaryTrackId, activeTrackId]);

  const secondaryCues = useMemo(() => {
    return secondaryTrack?.cues || [];
  }, [secondaryTrack]);

  // Current active Cue for Secondary Track
  const currentSecondaryCue = useMemo(() => {
    if (!secondaryCues || secondaryCues.length === 0) return null;
    return secondaryCues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    ) || null;
  }, [secondaryCues, currentTime]);

  // Auto-scroll transcript to active cue (smooth like YouTube)
  useEffect(() => {
    if (autoScrollTranscript && activeCueRef.current && transcriptContainerRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [currentCue, autoScrollTranscript]);

  // Translate Subtitle Track with Gemini AI
  const handleTranslateTrackWithGemini = async (targetLang = "ar") => {
    if (!currentFile || !activeTrack) {
      setErrorMsg("يرجى اختيار مسار ترجمة أصلي أولاً لترجمته");
      return;
    }

    setIsTranslatingTrack(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/media/${currentFile.id}/translate-subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: activeTrack.id,
          targetLanguage: targetLang,
          sourceLanguage: activeTrack.language || "de",
          selectedModel: selectedAiModel
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشلت ترجمة المسار عبر Gemini AI");
      }

      const data = await res.json();
      setSuccessMsg(data.message || `تم إنشاء الترجمة العربية بنجاح وتفعيل الترجمة المزدوجة! 🇸🇦⚡`);

      if (data.file) {
        setCurrentFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
      }

      // Automatically set the new translated track as secondary track for dual subtitles!
      if (data.track) {
        setSecondaryTrackId(data.track.id);
        setShowDualSubtitles(true);
      }
      setShowTranslateModal(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء ترجمة مسار الترجمة بالذكاء الاصطناعي");
    } finally {
      setIsTranslatingTrack(false);
    }
  };

  // Upload handler for Media Files
  const handleUploadFiles = (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append("files", fileList[i]);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          setSuccessMsg(res.message || "تم رفع الملف بنجاح!");
          fetchMediaFiles();
          if (res.files && res.files.length > 0) {
            setCurrentFile(res.files[0]);
            setIsPlaying(true);
          }
        } catch {
          fetchMediaFiles();
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          setErrorMsg(errRes.error || "فشل رفع الملف");
        } catch {
          setErrorMsg("حدث خطأ أثناء رفع الملف إلى السيرفر");
        }
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setErrorMsg("حدث خطأ في الاتصال بالسيرفر أثناء الرفع");
    };

    xhr.send(formData);
  };

  // Subtitle File Upload / Parse Handler
  const handleSubtitleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentFile) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setErrorMsg("ملف الترجمة فارغ");
        return;
      }

      const parsedCues = parseSubtitleContent(text);
      if (parsedCues.length === 0) {
        setErrorMsg("تعذر قراءة مقاطع الترجمة من هذا الملف. تأكد من أنه بصيغة SRT أو VTT صحيحة.");
        return;
      }

      const defaultLabel = file.name.replace(/\.[^/.]+$/, "") || "ترجمة مرفوعة";
      await saveSubtitleTrackToServer(currentFile.id, defaultLabel, parsedCues, "uploaded");
      setShowSubtitleUploadModal(false);
      setPastedSubtitleText("");
    };

    reader.onerror = () => {
      setErrorMsg("حدث خطأ أثناء قراءة ملف الترجمة");
    };

    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // Subtitle Text Paste Handler
  const handleSavePastedSubtitles = async () => {
    if (!currentFile || !pastedSubtitleText.trim()) return;

    const parsedCues = parseSubtitleContent(pastedSubtitleText);
    if (parsedCues.length === 0) {
      setErrorMsg("تعذر استخراج المقاطع الزمنية من النص. تأكد من كتابة الوقت بتنسيق SRT مثل 00:00:01 --> 00:00:04");
      return;
    }

    const label = subtitleTrackLabel.trim() || `ترجمة يدوية (${parsedCues.length} جملة)`;
    await saveSubtitleTrackToServer(currentFile.id, label, parsedCues, "manual");
    setShowSubtitleUploadModal(false);
    setPastedSubtitleText("");
    setSubtitleTrackLabel("");
  };

  // AI Generate Subtitles
  const handleGenerateAiSubtitles = async () => {
    if (!currentFile) return;
    setIsAiGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/media/${currentFile.id}/generate-subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: aiSubtitleLang,
          promptHint: aiPromptHint.trim(),
          fullText: pastedSubtitleText.trim(),
          selectedModel: selectedAiModel
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل توليد الترجمة بالذكاء الاصطناعي");
      }

      const data = await res.json();
      setSuccessMsg("تم توليد الترجمة الذكية بنجاح وربطها بالمقطع! ⚡");
      
      // Update state
      if (data.file) {
        setCurrentFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
      }
      if (data.track) {
        setActiveTrackId(data.track.id);
      }
      setShowSubtitleUploadModal(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء توليد الترجمة بالذكاء الاصطناعي");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Save Subtitle Track to Server
  const saveSubtitleTrackToServer = async (
    mediaId: string,
    label: string,
    cues: SubtitleCue[],
    source: "uploaded" | "ai" | "manual"
  ) => {
    try {
      const res = await fetch(`/api/media/${mediaId}/subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, cues, source })
      });

      if (!res.ok) throw new Error("فشل حفظ ملف الترجمة على السيرفر");
      const data = await res.json();

      setSuccessMsg(`تمت إضافة مسار الترجمة "${label}" بنجاح! (${cues.length} مقطع)`);
      if (data.file) {
        setCurrentFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
      }
      if (data.track) {
        setActiveTrackId(data.track.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ الترجمة");
    }
  };

  // Delete Subtitle Track
  const handleDeleteSubtitleTrack = async (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentFile) return;
    if (!window.confirm("هل تريد حذف مسار الترجمة هذا نهائياً؟")) return;

    try {
      const res = await fetch(`/api/media/${currentFile.id}/subtitles/${trackId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("فشل حذف مسار الترجمة");
      const data = await res.json();

      setSuccessMsg("تم حذف مسار الترجمة بنجاح");
      if (data.file) {
        setCurrentFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
        if (activeTrackId === trackId) {
          const remaining = data.file.subtitles || [];
          setActiveTrackId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء حذف الترجمة");
    }
  };

  // Add new Cue at current timestamp
  const handleAddNewCueAtCurrentTime = () => {
    if (!currentFile || !activeTrack) {
      setShowSubtitleUploadModal(true);
      return;
    }

    const start = Math.floor(currentTime * 10) / 10;
    const newCue: SubtitleCue = {
      id: `cue-${Date.now()}`,
      startTime: start,
      endTime: start + 3,
      text: "اكتب نص الترجمة هنا..."
    };

    const updatedCues = [...activeTrack.cues, newCue].sort((a, b) => a.startTime - b.startTime);
    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual");
    setEditingCue(newCue);
  };

  // Save edited cue
  const handleSaveEditedCue = () => {
    if (!editingCue || !currentFile || !activeTrack) return;

    const updatedCues = activeTrack.cues
      .map(c => (c.id === editingCue.id ? editingCue : c))
      .sort((a, b) => a.startTime - b.startTime);

    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual");
    setEditingCue(null);
  };

  // Delete single cue
  const handleDeleteCue = (cueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentFile || !activeTrack) return;

    const updatedCues = activeTrack.cues.filter(c => c.id !== cueId);
    saveSubtitleTrackToServer(currentFile.id, activeTrack.label, updatedCues, "manual");
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const firstFile = e.dataTransfer.files[0];
      const ext = firstFile.name.split(".").pop()?.toLowerCase();

      // If user dropped an SRT or VTT file and we have active media, upload as subtitle!
      if (["srt", "vtt", "txt", "sbv", "sub"].includes(ext || "") && currentFile) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const content = evt.target?.result as string;
          const parsed = parseSubtitleContent(content);
          if (parsed.length > 0) {
            await saveSubtitleTrackToServer(
              currentFile.id,
              firstFile.name.replace(/\.[^/.]+$/, ""),
              parsed,
              "uploaded"
            );
          }
        };
        reader.readAsText(firstFile);
        return;
      }

      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Delete media file
  const handleDeleteFile = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("هل أنت متأكد من حذف هذا الملف نهائياً من السيرفر؟")) {
      return;
    }

    try {
      const res = await fetch(`/api/media/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل في حذف الملف");

      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (currentFile?.id === id) {
        setCurrentFile(null);
        setIsPlaying(false);
      }
      setSuccessMsg("تم حذف الملف بنجاح");
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء الحذف");
    }
  };

  // Rename media file
  const handleStartRename = (file: MediaFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(file.id);
    setEditTitleText(file.title);
  };

  const handleSaveRename = async (id: string) => {
    if (!editTitleText.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const res = await fetch(`/api/media/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitleText.trim() })
      });
      if (!res.ok) throw new Error("فشل تعديل الاسم");

      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, title: editTitleText.trim() } : f))
      );
      if (currentFile?.id === id) {
        setCurrentFile((prev) => (prev ? { ...prev, title: editTitleText.trim() } : null));
      }
      setEditingId(null);
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء تعديل الاسم");
    }
  };

  // Media Player element getter & control handlers
  const getMediaElement = () => (currentFile?.type === "video" ? videoRef.current : audioRef.current);

  const togglePlay = () => {
    const el = getMediaElement();
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play().catch(console.error);
    }
  };

  // Zero-Pop Anti-Glitch Seeking Engine
  // Prevent loud speaker/headphone popping by micro-attenuating audio amplitude during timestamp repositioning
  const handleSeek = (newTime: number) => {
    const el = getMediaElement();
    if (!el) return;
    const totalDuration = duration || el.duration || 0;
    const boundedTime = Math.max(0, Math.min(newTime, totalDuration > 0 ? totalDuration : Infinity));

    const currentVol = isMuted ? 0 : volume;
    const needsAntiPop = !isMuted && currentVol > 0.02 && !el.paused;

    if (needsAntiPop) {
      // Instantly drop volume to prevent audio buffer discontinuity crackle
      el.volume = 0.001;
      el.currentTime = boundedTime;
      setCurrentTime(boundedTime);

      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
      fadeTimeoutRef.current = window.setTimeout(() => {
        if (el && !isMuted) {
          el.volume = currentVol;
        }
      }, 40);
    } else {
      el.currentTime = boundedTime;
      setCurrentTime(boundedTime);
    }
  };

  // Calculate precise time from pointer event relative to timeline LTR width
  const calculateTimeFromEvent = (e: MouseEvent | TouchEvent | React.MouseEvent | React.PointerEvent | PointerEvent) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;

    let clientX = 0;
    if ("clientX" in e && typeof e.clientX === "number") {
      clientX = e.clientX;
    } else if ("touches" in e && (e as TouchEvent).touches.length > 0) {
      clientX = (e as TouchEvent).touches[0].clientX;
    }

    // Force strictly LTR calculation: 0 = Left edge, 1 = Right edge
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const totalDuration = duration || getMediaElement()?.duration || 0;
    return fraction * totalDuration;
  };

  // Smooth YouTube-like Drag & Scrub pointer handler
  const handlePointerDownTimeline = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!progressBarRef.current) return;
    setIsScrubbing(true);

    const targetTime = calculateTimeFromEvent(e);
    handleSeek(targetTime);

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const newTime = calculateTimeFromEvent(ev);
      handleSeek(newTime);
    };

    const onPointerUp = (ev: PointerEvent) => {
      ev.preventDefault();
      setIsScrubbing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });
  };

  // Timeline hover position & tooltip
  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalDuration = duration || getMediaElement()?.duration || 0;
    const calculatedTime = fraction * totalDuration;

    setHoverPosition(fraction * 100);
    setHoverTime(calculatedTime);

    // Find cue text at this hover time
    const cueAtTime = activeCues.find(c => calculatedTime >= c.startTime && calculatedTime <= c.endTime);
    setHoverCueText(cueAtTime?.text || null);
  };

  const handleTimelinePointerLeave = () => {
    if (!isScrubbing) {
      setHoverPosition(null);
      setHoverTime(null);
      setHoverCueText(null);
    }
  };

  const skipSeconds = (seconds: number) => {
    const el = getMediaElement();
    if (!el) return;
    const totalDuration = duration || el.duration || Infinity;
    const target = Math.min(Math.max(0, el.currentTime + seconds), totalDuration);
    handleSeek(target);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (videoRef.current) videoRef.current.muted = nextMute;
    if (audioRef.current) audioRef.current.muted = nextMute;
  };

  const handleVolumeChange = (newVol: number) => {
    const clampedVol = Math.max(0, Math.min(1, newVol));
    setVolume(clampedVol);
    setIsMuted(clampedVol === 0);
    if (videoRef.current) videoRef.current.volume = clampedVol;
    if (audioRef.current) audioRef.current.volume = clampedVol;
  };

  const handleToggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen().catch(console.error);
      }
    }
  };

  // Play next or previous track in list
  const handleNextTrack = () => {
    if (!currentFile || filteredFiles.length <= 1) return;
    const currentIndex = filteredFiles.findIndex((f) => f.id === currentFile.id);
    const nextIndex = (currentIndex + 1) % filteredFiles.length;
    setCurrentFile(filteredFiles[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrevTrack = () => {
    if (!currentFile || filteredFiles.length <= 1) return;
    const currentIndex = filteredFiles.findIndex((f) => f.id === currentFile.id);
    const prevIndex = (currentIndex - 1 + filteredFiles.length) % filteredFiles.length;
    setCurrentFile(filteredFiles[prevIndex]);
    setIsPlaying(true);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Filtered files for Library view
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesType =
        filterType === "all" ||
        (filterType === "video" && f.type === "video") ||
        (filterType === "audio" && f.type === "audio");

      const matchesSearch =
        searchQuery.trim() === "" ||
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.originalName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [files, filterType, searchQuery]);

  // Filtered Subtitle Cues for search
  const filteredCues = useMemo(() => {
    if (!subtitleSearchQuery.trim()) return activeCues;
    return activeCues.filter((c) =>
      c.text.toLowerCase().includes(subtitleSearchQuery.toLowerCase())
    );
  }, [activeCues, subtitleSearchQuery]);

  // Statistics
  const totalVideos = useMemo(() => files.filter((f) => f.type === "video").length, [files]);
  const totalAudios = useMemo(() => files.filter((f) => f.type === "audio").length, [files]);
  const totalSize = useMemo(() => files.reduce((acc, f) => acc + (f.size || 0), 0), [files]);

  // Sync media element events and buffer indicator
  useEffect(() => {
    const el = currentFile?.type === "video" ? videoRef.current : audioRef.current;
    if (!el) return;

    el.playbackRate = playbackRate;
    el.loop = isLooping;
    el.volume = volume;
    el.muted = isMuted;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      if (isPlaying) {
        el.play().catch(console.error);
      }
    };
    const onProgress = () => {
      if (el && el.buffered.length > 0 && (duration > 0 || el.duration > 0)) {
        const totalDur = duration || el.duration;
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        setBufferedPercent(Math.min(100, (bufferedEnd / totalDur) * 100));
      }
    };
    const onEnded = () => {
      if (!isLooping) {
        setIsPlaying(false);
      }
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("progress", onProgress);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("ended", onEnded);
    };
  }, [currentFile, playbackRate, isLooping, volume, isMuted, isPlaying, duration]);

  // Keyboard Shortcuts (Space, K, J, L, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Numbers 0-9, C, M, F, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in input or textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        skipSeconds(-10);
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        skipSeconds(10);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        skipSeconds(-5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        skipSeconds(5);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.05));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.05));
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const num = parseInt(e.key, 10);
        const totalDur = duration || getMediaElement()?.duration || 0;
        if (totalDur > 0) {
          handleSeek((num / 10) * totalDur);
        }
      } else if (e.key === "c" || e.key === "C") {
        setShowSubtitlesOverlay(prev => !prev);
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        handleToggleFullscreen();
      } else if (e.key === "Escape") {
        if (isImmersiveMode) {
          setIsImmersiveMode(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isMuted, volume, duration, currentFile, isImmersiveMode]);

  // Copy full transcript text
  const handleCopyTranscript = () => {
    if (!activeCues || activeCues.length === 0) return;
    const text = exportCuesToPlainText(activeCues);
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Download Subtitle File (.srt or .vtt)
  const handleDownloadSubtitles = (format: "srt" | "vtt" | "txt") => {
    if (!activeCues || activeCues.length === 0 || !currentFile) return;

    let content = "";
    let mimeType = "text/plain";
    let ext = format;

    if (format === "srt") {
      content = exportCuesToSrt(activeCues);
      mimeType = "application/x-subrip";
    } else if (format === "vtt") {
      content = exportCuesToVtt(activeCues);
      mimeType = "text/vtt";
    } else {
      content = exportCuesToPlainText(activeCues);
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentFile.title || "subtitles"}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Subtitle styling classes
  const subtitleStyleClass = useMemo(() => {
    switch (subtitleStyle) {
      case "yellow":
        return "bg-black/90 text-yellow-300 border border-yellow-500/30";
      case "transparent":
        return "bg-slate-900/60 backdrop-blur-md text-white border border-white/10";
      case "outline":
        return "bg-transparent text-white font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-stroke";
      case "black":
      default:
        return "bg-black/85 text-white border border-slate-700/50 shadow-2xl";
    }
  }, [subtitleStyle]);

  const subtitleFontSizeClass = useMemo(() => {
    switch (subtitleFontSize) {
      case "sm":
        return "text-xs sm:text-sm py-1 px-3";
      case "lg":
        return "text-base sm:text-xl py-2 px-5";
      case "xl":
        return "text-lg sm:text-2xl py-2.5 px-6";
      case "md":
      default:
        return "text-sm sm:text-base py-1.5 px-4";
    }
  }, [subtitleFontSize]);

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 text-slate-800 font-sans"
      dir="rtl"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mp4,.webm,.mkv,.mov,.avi,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      <input
        ref={subtitleFileInputRef}
        type="file"
        accept=".srt,.vtt,.txt,.sbv,.sub"
        className="hidden"
        onChange={handleSubtitleFileSelect}
      />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {onBackToLibrary && (
            <button
              onClick={onBackToLibrary}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-[#0056f6] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="العودة للمكتبة"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">المكتبة</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  مشغل الوسائط والترجمة الذكية 🎬
                </h1>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                  <Subtitles className="w-3 h-3" />
                  <span>دعم SRT / VTT</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                مشغل فيديو وصوت تفاعلي مع ترجمة متزامنة، تفريغ نصي مثل يوتيوب، وتحكم كامل
              </p>
            </div>
          </div>
        </div>

        {/* Upload Button & Stats */}
        <div className="flex items-center gap-2.5">
          <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 bg-slate-100/80 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-600" />
              <span>{totalVideos} فيديو</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-violet-600" />
              <span>{totalAudios} صوتيات</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatFileSize(totalSize)}</span>
            </div>
          </div>

          {currentFile && (
            <button
              onClick={() => setShowSubtitleUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              title="إضافة أو رفع ترجمة للمقطع الحالي"
            >
              <Subtitles className="w-4 h-4" />
              <span>رفع ترجمة (SRT/VTT) 📜</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الرفع ({uploadProgress}%)...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>رفع وسائط 📤</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5">
        {/* Notifications */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between text-xs font-semibold animate-fadeIn shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="p-1 hover:bg-rose-100 rounded-lg text-rose-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs font-semibold animate-fadeIn shadow-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* ACTIVE MEDIA & SUBTITLES WORKSPACE (Like YouTube Player) */}
        {/* ======================================================== */}
        {currentFile && (
          <section
            className={
              isImmersiveMode
                ? "fixed inset-0 z-50 bg-black flex flex-col h-screen w-screen p-3 sm:p-4 overflow-hidden text-white animate-fadeIn"
                : "bg-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-2xl border border-slate-800 overflow-hidden"
            }
          >
            {/* Top Bar of Active Media */}
            <div
              className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-3 shrink-0 ${
                isImmersiveMode ? "bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800" : ""
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    currentFile.type === "video"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  }`}
                >
                  {currentFile.type === "video" ? "🎬 فيديو" : "🎵 صوت"}
                </span>

                {isImmersiveMode && (
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-lg bg-linear-to-r from-purple-600/40 to-blue-600/40 border border-purple-500/40 text-purple-200 text-[11px] font-black">
                    📺 وضع التكبير السينمائي
                  </span>
                )}

                {editingId === currentFile.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editTitleText}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-hidden focus:border-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRename(currentFile.id)}
                      className="p-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-white cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 truncate">
                    <h2 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                      {currentFile.title}
                    </h2>
                    {!isImmersiveMode && (
                      <button
                        onClick={(e) => handleStartRename(currentFile, e)}
                        className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                        title="تعديل الاسم"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Subtitle Track Selector & Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Primary Subtitle Track Pill Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                  <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-400 text-[11px]">الترجمة 1:</span>
                  <select
                    value={activeTrackId || ""}
                    onChange={(e) => setActiveTrackId(e.target.value || null)}
                    className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="" className="bg-slate-800 text-slate-400">
                      إيقاف الترجمة (Off)
                    </option>
                    {currentFile.subtitles?.map((track) => (
                      <option key={track.id} value={track.id} className="bg-slate-800 text-white">
                        {track.label} ({track.cues.length} مقطع)
                      </option>
                    ))}
                  </select>

                  {activeTrack && !isImmersiveMode && (
                    <button
                      onClick={(e) => handleDeleteSubtitleTrack(activeTrack.id, e)}
                      className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors cursor-pointer mr-1"
                      title="حذف هذا المسار"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Secondary Subtitle Track Pill Dropdown (Dual Subtitles / ترجمة مزدوجة) */}
                {currentFile.subtitles && currentFile.subtitles.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-800/90 border border-emerald-500/40 rounded-xl px-2.5 py-1 text-xs">
                    <Split className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px] font-bold">الترجمة 2:</span>
                    <select
                      value={secondaryTrackId || ""}
                      onChange={(e) => {
                        setSecondaryTrackId(e.target.value || null);
                        if (e.target.value) setShowDualSubtitles(true);
                      }}
                      className="bg-transparent text-emerald-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="" className="bg-slate-800 text-slate-400">
                        بدون ترجمة ثانوية
                      </option>
                      {currentFile.subtitles?.map((track) => (
                        <option key={track.id} value={track.id} className="bg-slate-800 text-white">
                          {track.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setShowDualSubtitles(!showDualSubtitles)}
                      className={`p-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        showDualSubtitles ? "bg-emerald-600/40 text-emerald-300" : "bg-slate-750 text-slate-400"
                      }`}
                      title={showDualSubtitles ? "إخفاء الترجمة المزدوجة" : "إظهار الترجمة المزدوجة"}
                    >
                      {showDualSubtitles ? "مزدوجة ✓" : "مفردة"}
                    </button>
                  </div>
                )}

                {/* Gemini AI Subtitle Translation Button (ترجمة المسار الحالي للعربية) */}
                {activeTrack && (
                  <button
                    onClick={() => setShowTranslateModal(true)}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                    title="ترجمة هذا المسار إلى العربية فوراً عبر Gemini لعمل ترجمة مزدوجة (ألماني + عربي)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>ترجمة للعربية (Gemini) 🇸🇦</span>
                  </button>
                )}

                {!isImmersiveMode && (
                  <button
                    onClick={() => setShowSubtitleUploadModal(true)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    title="رفع أو كتابة ترجمة يدوية"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">إضافة ترجمة</span>
                  </button>
                )}

                {/* Gradio Local STT Server Button */}
                <button
                  onClick={() => setShowGradioModal(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
                  title="تفريغ صوتي ألماني عبر سيرفر Gradio المحلي (192.168.0.159:7861)"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>تفريغ Gradio 🇩🇪</span>
                </button>

                {/* Immersive Theater Mode Button / Exit Button */}
                {isImmersiveMode ? (
                  <button
                    onClick={() => setIsImmersiveMode(false)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center gap-1.5 border border-purple-400"
                    title="الخروج من وضع التكبير (Esc)"
                  >
                    <Shrink className="w-3.5 h-3.5" />
                    <span>خروج من التكبير (Esc)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsImmersiveMode(true)}
                    className="px-3 py-1.5 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    title="وضع تكبير الشاشة الأقصى (فيديو كبير + تحكم مبسط + لوحة جانبية متحركة)"
                  >
                    <Expand className="w-3.5 h-3.5" />
                    <span>وضع التكبير السينمائي 📺</span>
                  </button>
                )}

                {/* Toggle Transcript View Button */}
                <button
                  onClick={() => setShowTranscriptPanel(!showTranscriptPanel)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    showTranscriptPanel
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                  title={isImmersiveMode ? "إظهار / إخفاء النافذة الجانبية للجمل للتكبير الكلي" : "لوحة التفريغ النصي والترجمة مثل اليوتيوب"}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showTranscriptPanel ? (isImmersiveMode ? "إخفاء لوحة الجمل" : "إخفاء التفريغ") : (isImmersiveMode ? "إظهار لوحة الجمل" : "تفريغ اليوتيوب")}</span>
                </button>

                {!isImmersiveMode && (
                  <>
                    <a
                      href={`/api/media/download/${currentFile.id}`}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="تحميل المقطع الأصلي"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    <button
                      onClick={() => {
                        setCurrentFile(null);
                        setIsPlaying(false);
                      }}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="إغلاق المشغل"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Split Grid / Flex: Player View + Transcript Panel */}
            <div
              className={
                isImmersiveMode
                  ? "flex-1 flex overflow-hidden gap-3.5 min-h-0 relative"
                  : "grid grid-cols-1 lg:grid-cols-12 gap-5"
              }
            >
              {/* Media Player Column */}
              <div
                className={
                  isImmersiveMode
                    ? "flex-1 flex flex-col min-w-0 min-h-0 space-y-2.5 justify-between"
                    : `${showTranscriptPanel ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-12"} space-y-4`
                }
              >
                {/* VIDEO OR AUDIO STAGE */}
                <div
                  className={
                    isImmersiveMode
                      ? "flex-1 relative rounded-2xl bg-black overflow-hidden flex items-center justify-center min-h-0 group border border-slate-800/80 shadow-2xl"
                      : "relative rounded-2xl bg-black overflow-hidden flex items-center justify-center min-h-[260px] sm:min-h-[380px] group border border-slate-800 shadow-inner"
                  }
                >
                  {currentFile.type === "video" ? (
                    <>
                      <video
                        ref={videoRef}
                        src={`/api/media/stream/${currentFile.filename}`}
                        className={
                          isImmersiveMode
                            ? "w-full h-full object-contain cursor-pointer"
                            : "w-full max-h-[500px] object-contain cursor-pointer"
                        }
                        playsInline
                        onClick={togglePlay}
                      />

                      {/* Video Subtitles Overlay (Supports Dual Subtitles: German + Arabic) */}
                      {showSubtitlesOverlay && (currentCue || (showDualSubtitles && currentSecondaryCue)) && (
                        <div
                          className={`absolute ${
                            isImmersiveMode ? "bottom-12" : "bottom-8"
                          } inset-x-0 flex flex-col items-center justify-center gap-2 px-4 pointer-events-none z-20 transition-all duration-150 animate-fadeIn`}
                        >
                          {/* Primary Subtitle (German / Original) */}
                          {currentCue && (
                            <div
                              className={`max-w-[90%] text-center rounded-2xl transition-all leading-relaxed font-sans shadow-2xl ${subtitleStyleClass} ${
                                isImmersiveMode ? "text-base sm:text-xl md:text-2xl font-bold px-5 py-2.5" : subtitleFontSizeClass
                              }`}
                            >
                              <span className="font-bold">{currentCue.text}</span>
                            </div>
                          )}

                          {/* Secondary Subtitle (Arabic / Translated with Gemini) */}
                          {showDualSubtitles && currentSecondaryCue && (
                            <div
                              className={`max-w-[90%] text-center rounded-2xl transition-all leading-relaxed font-sans shadow-2xl bg-emerald-950/90 text-emerald-200 border border-emerald-500/60 font-bold ${
                                isImmersiveMode
                                  ? "text-sm sm:text-base md:text-lg px-4 py-1.5"
                                  : "text-sm px-3.5 py-1"
                              }`}
                            >
                              <span>{currentSecondaryCue.text}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Audio Aesthetic Stage */
                    <div
                      className={`w-full ${
                        isImmersiveMode ? "h-full justify-center" : "py-10"
                      } px-6 flex flex-col items-center justify-center gap-5 relative bg-linear-to-b from-slate-900 via-slate-900/90 to-slate-950`}
                    >
                      <audio
                        ref={audioRef}
                        src={`/api/media/stream/${currentFile.filename}`}
                      />

                      {/* Rotating Vinyl Record Graphic */}
                      <div
                        className={`${
                          isImmersiveMode ? "w-36 h-36" : "w-32 h-32"
                        } rounded-full border-4 border-slate-700/80 bg-linear-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-xl shadow-purple-500/20 transition-transform ${
                          isPlaying ? "animate-spin" : ""
                        }`}
                        style={{ animationDuration: "8s" }}
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-purple-300">
                          <Music className="w-6 h-6" />
                        </div>
                      </div>

                      <div className="text-center">
                        <p className="font-bold text-slate-100 text-base">{currentFile.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{currentFile.originalName}</p>
                      </div>

                      {/* Audio Karaoke Subtitle Box (Supports Dual Subtitles) */}
                      {showSubtitlesOverlay && (
                        <div className="w-full max-w-lg mt-2 min-h-[64px] flex flex-col items-center justify-center gap-2">
                          {currentCue || (showDualSubtitles && currentSecondaryCue) ? (
                            <>
                              {currentCue && (
                                <div
                                  className={`text-center rounded-2xl transition-all leading-relaxed font-sans shadow-lg ${subtitleStyleClass} ${
                                    isImmersiveMode ? "text-lg font-bold px-4 py-2" : subtitleFontSizeClass
                                  }`}
                                >
                                  <span className="font-bold">{currentCue.text}</span>
                                </div>
                              )}
                              {showDualSubtitles && currentSecondaryCue && (
                                <div className="text-center rounded-2xl transition-all leading-relaxed font-sans shadow-lg bg-emerald-950/85 text-emerald-200 border border-emerald-500/50 px-4 py-1.5 text-sm font-bold">
                                  <span>{currentSecondaryCue.text}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-slate-500 italic bg-slate-800/40 px-4 py-2 rounded-xl border border-slate-800">
                              {activeTrack ? "جاري انتظار مقطع الترجمة التالي..." : "لا توجد ترجمة نشطة (اضغط على إضافة ترجمة بالأعلى)"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Player Timeline & Controls Bar */}
                <div
                  className={`bg-slate-800/90 border border-slate-700/80 rounded-2xl ${
                    isImmersiveMode ? "p-3 space-y-2.5" : "p-4 space-y-3.5"
                  }`}
                >
                  {/* High-Precision YouTube-Grade Timeline */}
                  <div className="space-y-1 select-none" dir="ltr">
                    <div
                      ref={progressBarRef}
                      onPointerDown={handlePointerDownTimeline}
                      onPointerMove={handleTimelinePointerMove}
                      onPointerLeave={handleTimelinePointerLeave}
                      className="w-full h-2.5 hover:h-3.5 bg-slate-700/70 rounded-full cursor-pointer transition-all relative group flex items-center touch-none py-1"
                    >
                      {/* 1. Buffered Stream Track */}
                      <div
                        className="h-full bg-slate-500/40 rounded-full absolute left-0 top-0 pointer-events-none transition-all duration-300"
                        style={{ width: `${bufferedPercent}%` }}
                      />

                      {/* 2. Hover Ghost Preview Track */}
                      {hoverPosition !== null && (
                        <div
                          className="h-full bg-white/20 rounded-full absolute left-0 top-0 pointer-events-none"
                          style={{ width: `${hoverPosition}%` }}
                        />
                      )}

                      {/* 3. Subtitle Cue Tick Markers on Timeline */}
                      {duration > 0 &&
                        activeCues.map((cue) => {
                          const cuePercent = (cue.startTime / duration) * 100;
                          return (
                            <div
                              key={cue.id}
                              style={{ left: `${cuePercent}%` }}
                              className="w-[2px] h-full bg-amber-400/60 absolute top-0 pointer-events-none z-10 rounded-full"
                              title={cue.text}
                            />
                          );
                        })}

                      {/* 4. Active Played Progress Track */}
                      <div
                        className="h-full bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full absolute left-0 top-0 shadow-sm pointer-events-none"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />

                      {/* 5. Scrubber Handle / Thumb (Scales on hover or active scrubbing) */}
                      <div
                        className={`w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow-lg shadow-black/60 absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-transform duration-100 ${
                          isScrubbing
                            ? "scale-125 ring-4 ring-indigo-500/30"
                            : "scale-0 group-hover:scale-100"
                        }`}
                        style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />

                      {/* 6. Hover Timestamp Tooltip Preview */}
                      {hoverPosition !== null && hoverTime !== null && (
                        <div
                          style={{ left: `${Math.max(6, Math.min(94, hoverPosition))}%` }}
                          className="absolute -top-11 -translate-x-1/2 px-2.5 py-1 bg-slate-950/95 border border-slate-700 text-white rounded-lg shadow-2xl flex flex-col items-center pointer-events-none z-30 whitespace-nowrap animate-fadeIn"
                        >
                          <span className="font-mono text-xs font-bold text-blue-300">
                            {formatSecondsToTime(hoverTime)}
                          </span>
                          {hoverCueText && (
                            <span className="text-[10px] text-slate-300 max-w-[180px] truncate mt-0.5 font-medium">
                              {hoverCueText}
                            </span>
                          )}
                          <div className="w-2 h-2 bg-slate-950 rotate-45 border-r border-b border-slate-700 absolute -bottom-1" />
                        </div>
                      )}
                    </div>

                    {/* Timeline Info Bar (Time elapsed / Duration + Scrubbing indicator) */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold">{formatSecondsToTime(currentTime)}</span>
                        {isScrubbing && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-sans font-bold animate-pulse">
                            تمرير مباشر
                          </span>
                        )}
                      </div>
                      <span>{formatSecondsToTime(duration)}</span>
                    </div>
                  </div>

                  {/* Primary Controls Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {/* Left: Speed, Loop & Subtitle Appearance */}
                    <div className="flex items-center gap-2">
                      {/* CC Toggle Button */}
                      <button
                        onClick={() => setShowSubtitlesOverlay(!showSubtitlesOverlay)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                          showSubtitlesOverlay
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-700/80 text-slate-400 border-slate-600 hover:text-white"
                        }`}
                        title={showSubtitlesOverlay ? "إخفاء شريط الترجمة (C)" : "إظهار شريط الترجمة (C)"}
                      >
                        <Subtitles className="w-4 h-4" />
                        <span>CC</span>
                      </button>

                      {/* Subtitle Font Size / Style Toggle */}
                      {showSubtitlesOverlay && (
                        <div className="flex items-center bg-slate-700/80 border border-slate-600/70 rounded-xl p-1 text-xs">
                          <button
                            onClick={() =>
                              setSubtitleFontSize((prev) =>
                                prev === "sm" ? "md" : prev === "md" ? "lg" : prev === "lg" ? "xl" : "sm"
                              )
                            }
                            className="px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                            title="تغيير حجم خط الترجمة"
                          >
                            خط: {subtitleFontSize.toUpperCase()}
                          </button>
                          <span className="text-slate-500">|</span>
                          <button
                            onClick={() =>
                              setSubtitleStyle((prev) =>
                                prev === "black"
                                  ? "yellow"
                                  : prev === "yellow"
                                  ? "transparent"
                                  : prev === "transparent"
                                  ? "outline"
                                  : "black"
                              )
                            }
                            className="px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                            title="تغيير ستايل الترجمة"
                          >
                            🎨
                          </button>
                        </div>
                      )}

                      {/* Speed selector */}
                      <div className="flex items-center bg-slate-700/80 border border-slate-600/70 rounded-xl p-1 text-xs">
                        {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              playbackRate === speed
                                ? "bg-blue-600 text-white"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setIsLooping(!isLooping)}
                        className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isLooping ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                        }`}
                        title={isLooping ? "إلغاء التكرار" : "تكرار المقطع"}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Center: Skip & Play Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrevTrack}
                        disabled={filteredFiles.length <= 1}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
                        title="المقطع السابق"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => skipSeconds(-5)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-0.5"
                        title="تراجع 5 ثواني (J)"
                      >
                        <span className="text-[10px] font-mono">5-</span>
                      </button>

                      <button
                        onClick={togglePlay}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transition-transform active:scale-95 cursor-pointer"
                        title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6 fill-current" />
                        ) : (
                          <Play className="w-6 h-6 fill-current translate-x-[-1px]" />
                        )}
                      </button>

                      <button
                        onClick={() => skipSeconds(5)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-0.5"
                        title="تقديم 5 ثواني (L)"
                      >
                        <span className="text-[10px] font-mono">+5</span>
                      </button>

                      <button
                        onClick={handleNextTrack}
                        disabled={filteredFiles.length <= 1}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
                        title="المقطع التالي"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Right: Volume & Fullscreen */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-700/80 px-2.5 py-1.5 rounded-xl border border-slate-600/70">
                        <button
                          onClick={toggleMute}
                          className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="كتم الصوت (M)"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-14 sm:w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      {currentFile.type === "video" && (
                        <button
                          onClick={handleToggleFullscreen}
                          className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                          title="ملء الشاشة (F)"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* YOUTUBE-STYLE INTERACTIVE TRANSCRIPT / SUBTITLE PANEL */}
              {/* ======================================================== */}
              {showTranscriptPanel && (
                <div
                  className={
                    isImmersiveMode
                      ? "w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full z-20 shrink-0 shadow-2xl overflow-hidden animate-slideLeft"
                      : "lg:col-span-5 xl:col-span-4 bg-slate-800/90 border border-slate-700/90 rounded-2xl flex flex-col h-[480px] lg:h-[580px] overflow-hidden shadow-lg animate-fadeIn"
                  }
                >
                  {/* Panel Header */}
                  <div className="p-3 border-b border-slate-700/80 bg-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-black text-slate-100">
                        الجمل والتفريغ ({activeCues.length} مقطع)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Auto-scroll toggle */}
                      <button
                        onClick={() => setAutoScrollTranscript(!autoScrollTranscript)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          autoScrollTranscript
                            ? "bg-blue-600/30 text-blue-400 border border-blue-500/40"
                            : "bg-slate-700 text-slate-400"
                        }`}
                        title={autoScrollTranscript ? "إيقاف التمرير التلقائي" : "تفعيل التمرير التلقائي مع الصوت"}
                      >
                        {autoScrollTranscript ? "تمرير تلقائي ⚡" : "تمرير يدوي"}
                      </button>

                      {/* Copy full text */}
                      <button
                        onClick={handleCopyTranscript}
                        disabled={activeCues.length === 0}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                        title="نسخ النص كاملاً"
                      >
                        {copiedTranscript ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Export Subtitle Dropdown */}
                      <div className="relative group">
                        <button
                          disabled={activeCues.length === 0}
                          className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                          title="تصدير وتحميل ملف الترجمة"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute left-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl p-1.5 shadow-xl hidden group-hover:flex flex-col gap-1 z-30 min-w-[110px]">
                          <button
                            onClick={() => handleDownloadSubtitles("srt")}
                            className="px-2 py-1 text-right text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-lg"
                          >
                            تحميل (.SRT)
                          </button>
                          <button
                            onClick={() => handleDownloadSubtitles("vtt")}
                            className="px-2 py-1 text-right text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-lg"
                          >
                            تحميل (.VTT)
                          </button>
                          <button
                            onClick={() => handleDownloadSubtitles("txt")}
                            className="px-2 py-1 text-right text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-lg"
                          >
                            تحميل نصي (.TXT)
                          </button>
                        </div>
                      </div>

                      {isImmersiveMode && (
                        <button
                          onClick={() => setShowTranscriptPanel(false)}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer ml-1"
                          title="إغلاق اللوحة الجانبية للتكبير الكلي"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search inside Subtitles */}
                  <div className="p-2.5 border-b border-slate-700/60 bg-slate-850">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="ابحث في نص الترجمة..."
                        value={subtitleSearchQuery}
                        onChange={(e) => setSubtitleSearchQuery(e.target.value)}
                        className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                      />
                      {subtitleSearchQuery && (
                        <button
                          onClick={() => setSubtitleSearchQuery("")}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cues List */}
                  <div
                    ref={transcriptContainerRef}
                    className="flex-1 overflow-y-auto p-2 space-y-1.5"
                  >
                    {activeCues.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3">
                        <Subtitles className="w-10 h-10 text-slate-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-300">لا يوجد ملف ترجمة لهذا المقطع بعد</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            يمكنك استخدام سيرفر التفريغ الألماني المحلي (Gradio) أو رفع ملف ترجمة جاهز
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <button
                            onClick={() => setShowGradioModal(true)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>تفريغ Gradio 🇩🇪</span>
                          </button>
                          <button
                            onClick={() => setShowSubtitleUploadModal(true)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            + إضافة ترجمة يدوية
                          </button>
                        </div>
                      </div>
                    ) : (
                      filteredCues.map((cue) => {
                        const isCurrent = currentCue?.id === cue.id;
                        // Find matching secondary cue (Gemini Arabic translation)
                        const matchingSec = secondaryCues.find(
                          (sc) =>
                            (sc.startTime >= cue.startTime - 0.5 && sc.startTime <= cue.endTime + 0.5) ||
                            (sc.endTime >= cue.startTime - 0.5 && sc.endTime <= cue.endTime + 0.5) ||
                            (cue.startTime >= sc.startTime - 0.5 && cue.startTime <= sc.endTime + 0.5)
                        );

                        return (
                          <div
                            key={cue.id}
                            ref={isCurrent ? activeCueRef : null}
                            onClick={() => handleSeek(cue.startTime)}
                            className={`p-2.5 rounded-xl transition-all duration-150 flex items-start gap-2.5 cursor-pointer group ${
                              isCurrent
                                ? "bg-blue-600/30 border border-blue-500/70 text-white shadow-md ring-1 ring-blue-500/30"
                                : "hover:bg-slate-800 text-slate-300 hover:text-white"
                            }`}
                          >
                            {/* Timestamp Badge (Click to jump) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSeek(cue.startTime);
                              }}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0 transition-colors cursor-pointer ${
                                isCurrent
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-950 text-blue-400 group-hover:bg-blue-950"
                              }`}
                              title="اضغط للانتقال لهذا التوقيت"
                            >
                              {formatSecondsToTime(cue.startTime)}
                            </button>

                            {/* Text Content */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className={`text-xs leading-relaxed font-sans ${isCurrent ? "font-bold text-white" : ""}`}>
                                {cue.text}
                              </p>
                              {showDualSubtitles && matchingSec && (
                                <p className="text-[11px] text-emerald-300 font-semibold border-t border-slate-700/60 pt-1">
                                  {matchingSec.text}
                                </p>
                              )}
                            </div>

                            {/* Cue Edit/Delete Tools on Hover */}
                            {!isImmersiveMode && (
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCue(cue);
                                  }}
                                  className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md cursor-pointer"
                                  title="تعديل هذا المقطع"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteCue(cue.id, e)}
                                  className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-md cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Panel Footer / Quick Add Cue at time */}
                  {!isImmersiveMode && (
                    <div className="p-2.5 border-t border-slate-700/80 bg-slate-800 flex items-center justify-between shrink-0">
                      <button
                        onClick={handleAddNewCueAtCurrentTime}
                        className="w-full py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-400" />
                        <span>إضافة سطر عند التوقيت الحالي ({formatSecondsToTime(currentTime)})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* UPLOAD & DROPZONE AREA */}
        {/* ======================================================== */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-[#0056f6] bg-blue-50/70 scale-[1.005]"
              : "border-slate-300 hover:border-blue-400 bg-white/70 hover:bg-white"
          }`}
        >
          <div className="max-w-md mx-auto flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              اسحب وأفلت أي ملف صوتي، فيديو، أو ملف ترجمة (SRT/VTT) هنا
            </p>
            <p className="text-xs text-slate-500">
              يدعم MP4, WebM, MKV, MOV, MP3, WAV, M4A وملفات SRT / VTT المتزامنة
            </p>

            {uploading && (
              <div className="w-full mt-3">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1 font-bold">
                  <span>جاري رفع الملف إلى السيرفر...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0056f6] transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* MEDIA LIBRARY & PLAYLIST SECTION */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
          {/* Section Bar: Filters & Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterType === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                الكل ({files.length})
              </button>
              <button
                onClick={() => setFilterType("video")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "video"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>فيديو ({totalVideos})</span>
              </button>
              <button
                onClick={() => setFilterType("audio")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "audio"
                    ? "bg-white text-purple-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>صوت ({totalAudios})</span>
              </button>
            </div>

            {/* Search and Layout Toggle */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث في الملفات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#0056f6] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowGradioModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="تفريغ أي ملف صوتي أو فيديو بسيرفر Gradio الألماني المحلي"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>تفريغ Gradio 🇩🇪</span>
              </button>

              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "grid" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                  title="عرض شبكي"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "list" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                  title="عرض قائمة"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Files List / Grid View */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">جاري جلب الملفات من السيرفر...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Film className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">لا توجد ملفات مرفوعة حالياً</p>
                <p className="text-xs text-slate-500 mt-1">
                  قم برفع أول ملف صوتي أو فيديو لبدء التشغيل وإضافة الترجمات المتزامنة
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                + رفع ملف الآن
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const isSelected = currentFile?.id === file.id;
                const hasSubtitles = file.subtitles && file.subtitles.length > 0;

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      setCurrentFile(file);
                      setIsPlaying(true);
                    }}
                    className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between cursor-pointer group relative overflow-hidden ${
                      isSelected
                        ? "bg-blue-50/50 border-blue-400 shadow-md ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-md"
                    }`}
                  >
                    {/* Top Type Badge & Action Menu */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            file.type === "video"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {file.type === "video" ? (
                            <>
                              <FileVideo className="w-3 h-3" />
                              <span>فيديو</span>
                            </>
                          ) : (
                            <>
                              <FileAudio className="w-3 h-3" />
                              <span>صوت</span>
                            </>
                          )}
                        </span>

                        {hasSubtitles && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold flex items-center gap-0.5">
                            <Subtitles className="w-3 h-3" />
                            <span>ترجمة ({file.subtitles?.length})</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(file, e)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
                          title="تعديل الاسم"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`/api/media/download/${file.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
                          title="تحميل"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Media Preview Box */}
                    <div className="w-full h-32 bg-slate-100 rounded-xl flex items-center justify-center mb-3 relative overflow-hidden group-hover:bg-slate-200/70 transition-colors">
                      {file.type === "video" ? (
                        <Film className="w-10 h-10 text-blue-400 group-hover:scale-110 transition-transform" />
                      ) : (
                        <Music className="w-10 h-10 text-purple-400 group-hover:scale-110 transition-transform" />
                      )}

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-11 h-11 rounded-full bg-[#0056f6] text-white flex items-center justify-center shadow-md">
                          <Play className="w-5 h-5 fill-current translate-x-[-1px]" />
                        </div>
                      </div>

                      {isSelected && isPlaying && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 bg-white rounded-full" />
                          <span>يعمل الآن</span>
                        </div>
                      )}
                    </div>

                    {/* Title & Metadata */}
                    <div>
                      {editingId === file.id ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitleText}
                            onChange={(e) => setEditTitleText(e.target.value)}
                            className="w-full text-xs px-2 py-1 border border-blue-400 rounded-lg bg-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(file.id)}
                            className="p-1 text-emerald-600"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <p
                          className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-[#0056f6] transition-colors"
                          title={file.title}
                        >
                          {file.title}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-100 font-mono">
                        <span>{formatFileSize(file.size)}</span>
                        <span>{new Date(file.uploadedAt).toLocaleDateString("ar-EG")}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
              {filteredFiles.map((file) => {
                const isSelected = currentFile?.id === file.id;
                const hasSubtitles = file.subtitles && file.subtitles.length > 0;

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      setCurrentFile(file);
                      setIsPlaying(true);
                    }}
                    className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/60 font-semibold"
                        : "hover:bg-slate-50 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          file.type === "video"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-purple-100 text-purple-600"
                        }`}
                      >
                        {file.type === "video" ? (
                          <Film className="w-4 h-4" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        {editingId === file.id ? (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editTitleText}
                              onChange={(e) => setEditTitleText(e.target.value)}
                              className="text-xs px-2 py-1 border border-blue-400 rounded-lg bg-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(file.id)}
                              className="p-1 text-emerald-600"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-xs truncate ${
                                isSelected ? "text-blue-700 font-bold" : "text-slate-800"
                              }`}
                            >
                              {file.title}
                            </p>
                            {hasSubtitles && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">
                                SRT ✓
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 truncate">
                          {file.originalName} • {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected && isPlaying && (
                        <span className="hidden sm:inline-flex px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold animate-pulse">
                          مشغل الآن ⚡
                        </span>
                      )}

                      <button
                        onClick={(e) => handleStartRename(file, e)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="تعديل الاسم"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={`/api/media/download/${file.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="تحميل الملف"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={(e) => handleDeleteFile(file.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ======================================================== */}
      {/* MODAL: SUBTITLE UPLOADER & AI GENERATOR */}
      {/* ======================================================== */}
      {showSubtitleUploadModal && currentFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Subtitles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">إضافة ترجمة للمقطع</h3>
                  <p className="text-xs text-slate-500">{currentFile.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSubtitleUploadModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-2xl text-[11px] font-bold my-4">
              <button
                onClick={() => {
                  setShowSubtitleUploadModal(false);
                  setShowGradioModal(true);
                }}
                className="py-2 rounded-xl transition-all flex items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-xs"
              >
                <Mic className="w-3 h-3" />
                <span>Gradio 🇩🇪</span>
              </button>
              <button
                onClick={() => setSubtitleUploadMode("file")}
                className={`py-2 rounded-xl transition-all ${
                  subtitleUploadMode === "file" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                ملف SRT 📁
              </button>
              <button
                onClick={() => setSubtitleUploadMode("paste")}
                className={`py-2 rounded-xl transition-all ${
                  subtitleUploadMode === "paste" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                لصق نص ✍️
              </button>
              <button
                onClick={() => setSubtitleUploadMode("ai")}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                  subtitleUploadMode === "ai" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600"
                }`}
              >
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>AI Gemini</span>
              </button>
            </div>

            {/* TAB 1: FILE UPLOAD */}
            {subtitleUploadMode === "file" && (
              <div className="space-y-4">
                <div
                  onClick={() => subtitleFileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl p-8 text-center cursor-pointer transition-colors"
                >
                  <Subtitles className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-800">
                    اضغط هنا لاختيار ملف ترجمة من جهازك
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم ملفات .SRT, .VTT, .SBV, .TXT
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: PASTE / MANUAL SRT TEXT */}
            {subtitleUploadMode === "paste" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم مسار الترجمة:
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: العربية (مترجم) أو English"
                    value={subtitleTrackLabel}
                    onChange={(e) => setSubtitleTrackLabel(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    محتوى ملف الترجمة (تنسيق SRT / VTT أو مقاطع زمنية):
                  </label>
                  <textarea
                    rows={7}
                    placeholder={`1\n00:00:01,000 --> 00:00:04,500\nمرحباً بكم في هذا المقطع التعليمي.\n\n2\n00:00:05,000 --> 00:00:08,200\nسنتعلم اليوم كيفية نطق هذه الكلمات.`}
                    value={pastedSubtitleText}
                    onChange={(e) => setPastedSubtitleText(e.target.value)}
                    className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden resize-none"
                  />
                </div>

                <button
                  onClick={handleSavePastedSubtitles}
                  disabled={!pastedSubtitleText.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  حفظ الترجمة وتطبيقها 💾
                </button>
              </div>
            )}

            {/* TAB 3: AI GEMINI GENERATOR */}
            {subtitleUploadMode === "ai" && (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                  يقوم الذكاء الاصطناعي بتوليد مقاطع ترجمة زمنية متزامنة (SRT Cues) بدقة للمقطع بناءً على محتواه وملاحظاتك!
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5 text-indigo-600" />
                      <span>نموذج الذكاء الاصطناعي (AI Model):</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      {selectedAiModel}
                    </span>
                  </label>
                  <select
                    value={selectedAiModel}
                    onChange={(e) => handleSelectAiModel(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <optgroup label="⚡ نماذج فائقة وموصى بها">
                      {ALL_AVAILABLE_MODELS.filter(m => !m.group || m.group === "general").map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.name} - ({m.desc})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🚀 نماذج الحصة اليومية العالية (500 RPD)">
                      {ALL_AVAILABLE_MODELS.filter(m => m.group === "high_quota").map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.name} - ({m.desc})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    لغة الترجمة المطلوبة:
                  </label>
                  <select
                    value={aiSubtitleLang}
                    onChange={(e) => setAiSubtitleLang(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-hidden"
                  >
                    <option value="ar">العربية (Arabic)</option>
                    <option value="en">الإنجليزية (English)</option>
                    <option value="fr">الفرنسية (Français)</option>
                    <option value="de">الألمانية (Deutsch)</option>
                    <option value="es">الإسبانية (Español)</option>
                    <option value="tr">التركية (Türkçe)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات أو نص مساعد (اختياري):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="يمكنك تزويد موضوع المقطع أو النص الكامل لتوليد التوقيتات بدقة..."
                    value={aiPromptHint}
                    onChange={(e) => setAiPromptHint(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden resize-none"
                  />
                </div>

                <button
                  onClick={handleGenerateAiSubtitles}
                  disabled={isAiGenerating}
                  className="w-full py-2.5 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري توليد الترجمة الزمنية بالذكاء الاصطناعي...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>توليد الترجمة الذكية الآن ⚡</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT INDIVIDUAL CUE */}
      {/* ======================================================== */}
      {editingCue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-slate-900 text-sm">تعديل مقطع الترجمة</h3>
              <button
                onClick={() => setEditingCue(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    وقت البداية (ثواني):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingCue.startTime}
                    onChange={(e) =>
                      setEditingCue({ ...editingCue, startTime: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    وقت النهاية (ثواني):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingCue.endTime}
                    onChange={(e) =>
                      setEditingCue({ ...editingCue, endTime: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نص الترجمة:
                </label>
                <textarea
                  rows={3}
                  value={editingCue.text}
                  onChange={(e) => setEditingCue({ ...editingCue, text: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl resize-none focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveEditedCue}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
                >
                  حفظ التعديل ✓
                </button>
                <button
                  onClick={() => setEditingCue(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: GEMINI SUBTITLE TRANSLATION (DUAL SUBTITLES) */}
      {/* ======================================================== */}
      {showTranslateModal && activeTrack && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">ترجمة مسار الترجمة بالذكاء الاصطناعي (Gemini)</h3>
                  <p className="text-[11px] text-slate-400">لإنشاء ترجمة مزدوجة (ألماني + عربي) بالتوقيت الدقيق</p>
                </div>
              </div>
              <button
                onClick={() => setShowTranslateModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 space-y-1">
                <p className="text-xs text-slate-400">المسار المصدر المختار للترجمة:</p>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Subtitles className="w-4 h-4 text-indigo-400" />
                  <span>{activeTrack.label}</span>
                  <span className="text-[11px] text-slate-400">({activeTrack.cues.length} مقطع زمني)</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span>نموذج الذكاء الاصطناعي (AI Model):</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    {selectedAiModel}
                  </span>
                </label>
                <select
                  value={selectedAiModel}
                  onChange={(e) => handleSelectAiModel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <optgroup label="⚡ نماذج فائقة وموصى بها (Gemini / Groq)">
                    {ALL_AVAILABLE_MODELS.filter(m => !m.group || m.group === "general").map((m) => (
                      <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                        {m.name} - ({m.desc})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🚀 نماذج الحصة اليومية العالية (500 RPD)">
                    {ALL_AVAILABLE_MODELS.filter(m => m.group === "high_quota").map((m) => (
                      <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                        {m.name} - ({m.desc})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اختر لغة الترجمة الهدف:
                </label>
                <select
                  value={translateTargetLang}
                  onChange={(e) => setTranslateTargetLang(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="ar">🇸🇦 العربية (Arabic) - موصى بها للترجمة المزدوجة</option>
                  <option value="en">🇬🇧 الإنجليزية (English)</option>
                  <option value="de">🇩🇪 الألمانية (German)</option>
                  <option value="fr">🇫🇷 الفرنسية (French)</option>
                  <option value="es">🇪🇸 الإسبانية (Spanish)</option>
                  <option value="tr">🇹🇷 التركية (Turkish)</option>
                </select>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 text-xs text-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Split className="w-4 h-4 text-emerald-400" />
                  <span>ميزة الترجمة المزدوجة التلقائية:</span>
                </p>
                <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                  سيقوم مودل Gemini بترجمة جميع مقاطع التوقيت مع المحافظة على التزامن بالمللي ثانية، وسيقوم المشغل تلقائياً بعرض النصين معاً (الأصلي الألماني والترجمة العربية تحت بعض).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleTranslateTrackWithGemini(translateTargetLang)}
                  disabled={isTranslatingTrack}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isTranslatingTrack ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الترجمة عبر Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>بدء الترجمة وحفظ المسار ⚡</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowTranslateModal(false)}
                  disabled={isTranslatingTrack}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LOCAL GRADIO SPEECH-TO-TEXT GERMAN SERVER */}
      {/* ======================================================== */}
      <GradioTranscriberModal
        isOpen={showGradioModal}
        onClose={() => setShowGradioModal(false)}
        currentFile={currentFile}
        onSubtitlesGenerated={async (trackLabel, cues, rawSrt) => {
          if (currentFile) {
            await saveSubtitleTrackToServer(currentFile.id, trackLabel, cues, "ai");
            setShowGradioModal(false);
          }
        }}
      />
    </div>
  );
};
