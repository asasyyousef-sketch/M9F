import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Folder,
  FolderPlus,
  Film,
  Music,
  Play,
  Trash2,
  Download,
  Edit2,
  Check,
  X,
  Search,
  List,
  Grid,
  Subtitles,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  RefreshCw,
  FolderInput,
  CheckSquare,
  Square,
  SlidersHorizontal,
  FileVideo,
  FileAudio,
  HardDrive,
  DownloadCloud,
  Loader2,
  ArrowUpDown,
  Laptop,
  Info,
  Layers,
  ChevronDown,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Volume2,
  Clock,
  Tv,
  AlertTriangle,
  FileText,
  MoreVertical
} from "lucide-react";
import { MediaFile, MediaFolder, MediaSubtitleTrack, SubtitleCue } from "../types";
import { exportCuesToSrt, exportCuesToVtt, exportCuesToPlainText } from "../utils/subtitleParser";
import JSZip from "jszip";

export interface MediaExplorerViewProps {
  files: MediaFile[];
  folders: MediaFolder[];
  fileFolderMap: Record<string, string>;
  activeFolderId: string | null;
  currentFile: MediaFile | null;
  loading: boolean;
  uploading?: boolean;
  uploadProgress?: number;
  uploadingFolderName?: string | null;
  uploadingFileName?: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectFile: (file: MediaFile | null, autoPlay?: boolean) => void;
  onOpenCreateFolder: () => void;
  onOpenEditFolder: (folder: MediaFolder) => void;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onMoveFile: (fileId: string, targetFolderId: string | null) => void;
  onBulkMove: (fileIds: string[], targetFolderId: string | null) => void;
  onBulkDelete: (fileIds: string[], folderIds: string[]) => void;
  onDeleteFile: (id: string, e?: React.MouseEvent) => void;
  onStartRename: (file: MediaFile, e?: React.MouseEvent) => void;
  editingId: string | null;
  editTitleText: string;
  setEditTitleText: (val: string) => void;
  onSaveRename: (id: string) => void;
  onUploadClick: () => void;
  onUploadFolderClick?: () => void;
  onOpenYouTubeDownload?: () => void;
  onOpenGradioModalForFile: (file: MediaFile) => void;
  onOpenSubtitleOptionsForFile: (file: MediaFile) => void;
  onRefreshFiles: () => void;
  onToggleSidebar?: () => void;
}

// Global in-memory cache for generated video thumbnails and audio metadata
const videoThumbnailCache: Record<string, string> = {};
const mediaMetadataCache: Record<string, { duration: number; width?: number; height?: number }> = {};

// Helper to resolve media stream URL for inspector and thumbnails
export function resolveMediaFileUrl(file: MediaFile | null | undefined): string {
  if (!file) return "";
  if (file.url && file.url.startsWith("blob:")) return file.url;
  if (file.url && (file.url.startsWith("http://") || file.url.startsWith("https://"))) {
    return `/api/media/stream-proxy?url=${encodeURIComponent(file.url)}`;
  }
  if (file.filename) {
    return `/api/media/stream/${encodeURIComponent(file.filename)}`;
  }
  return file.url || "";
}

export const MediaExplorerView: React.FC<MediaExplorerViewProps> = ({
  files,
  folders,
  fileFolderMap,
  activeFolderId,
  currentFile,
  loading,
  uploading = false,
  uploadProgress = 0,
  uploadingFolderName = null,
  uploadingFileName = null,
  onSelectFolder,
  onSelectFile,
  onOpenCreateFolder,
  onOpenEditFolder,
  onDeleteFolder,
  onMoveFile,
  onBulkMove,
  onBulkDelete,
  onDeleteFile,
  onStartRename,
  editingId,
  editTitleText,
  setEditTitleText,
  onSaveRename,
  onUploadClick,
  onUploadFolderClick,
  onOpenYouTubeDownload,
  onOpenGradioModalForFile,
  onOpenSubtitleOptionsForFile,
  onRefreshFiles,
  onToggleSidebar
}) => {
  // Navigation History
  const [navHistory, setNavHistory] = useState<(string | null)[]>([activeFolderId]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "video" | "audio" | "with_sub" | "no_sub">("all");
  const [sortField, setSortField] = useState<"name" | "date" | "size" | "type" | "subtitles" | "duration">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Dropdown menus states for command bar
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  // View Modes: "details" | "large_grid" | "medium_grid" | "list"
  const [viewMode, setViewMode] = useState<"details" | "large_grid" | "medium_grid" | "list">(() => {
    try {
      return (localStorage.getItem("media_explorer_view_mode") as any) || "details";
    } catch {
      return "details";
    }
  });

  const handleSetViewMode = (mode: "details" | "large_grid" | "medium_grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("media_explorer_view_mode", mode);
    } catch (e) {
      console.error(e);
    }
  };

  // Navigation Sidebar collapsed state (Double Sidebar fix)
  const [isNavSidebarOpen, setIsNavSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("media_explorer_nav_sidebar");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const handleToggleNavSidebar = () => {
    setIsNavSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("media_explorer_nav_sidebar", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [lastSelectedFileId, setLastSelectedFileId] = useState<string | null>(null);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedFileIds(new Set());
        setSelectedFolderIds(new Set());
      }
      return next;
    });
  };

  // Explicitly inspected file or folder (Single click selection for preview pane)
  const [inspectedFile, setInspectedFile] = useState<MediaFile | null>(null);
  const [inspectedFolder, setInspectedFolder] = useState<MediaFolder | null>(null);

  // Preview / Details Pane toggle (Windows 11 Right Side Inspector)
  const [showPreviewPane, setShowPreviewPane] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("media_explorer_preview_pane");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const handleTogglePreviewPane = () => {
    setShowPreviewPane((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("media_explorer_preview_pane", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Preview Pane Active Playing Element & Subtitle Sync
  const previewMediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const [previewDuration, setPreviewDuration] = useState<number>(0);
  const [previewResolution, setPreviewResolution] = useState<{ width: number; height: number } | null>(null);

  // Video Thumbnails state tracker to force re-render when a thumbnail finishes generating
  const [thumbnailVersion, setThumbnailVersion] = useState<number>(0);

  // Custom Delete Confirmation Modal State (Replacing window.confirm)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    type: "single_file" | "single_folder" | "bulk";
    fileId?: string;
    fileName?: string;
    folderId?: string;
    folderName?: string;
    bulkFileIds?: string[];
    bulkFolderIds?: string[];
  }>({
    isOpen: false,
    type: "single_file"
  });

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file?: MediaFile;
    folder?: MediaFolder;
  } | null>(null);

  // Modals for Bulk Operations
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);
  const [showBatchSubtitleModal, setShowBatchSubtitleModal] = useState(false);
  const [isExportingSubtitles, setIsExportingSubtitles] = useState(false);
  const [exportProgressText, setExportProgressText] = useState("");

  // Drag & Drop States
  const [draggedFileIds, setDraggedFileIds] = useState<string[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Active folder object
  const activeFolder = useMemo(() => {
    if (!activeFolderId || activeFolderId === "uncategorized") return null;
    return folders.find((f) => f.id === activeFolderId) || null;
  }, [folders, activeFolderId]);

  // Hierarchical breadcrumbs path from root to current folder
  const folderBreadcrumbs = useMemo(() => {
    if (!activeFolderId || activeFolderId === "uncategorized") return [];
    const path: MediaFolder[] = [];
    let currentId: string | null | undefined = activeFolderId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const found = folders.find((f) => f.id === currentId);
      if (found) {
        path.unshift(found);
        currentId = found.parentId;
      } else {
        break;
      }
    }
    return path;
  }, [activeFolderId, folders]);

  // Helper to format full folder path name for selectors
  const getFolderPathName = (folder: MediaFolder): string => {
    const parts: string[] = [folder.name];
    let curParentId = folder.parentId;
    const visited = new Set<string>();
    while (curParentId && !visited.has(curParentId)) {
      visited.add(curParentId);
      const parent = folders.find((f) => f.id === curParentId);
      if (parent) {
        parts.unshift(parent.name);
        curParentId = parent.parentId;
      } else {
        break;
      }
    }
    return parts.join(" / ");
  };

  // Navigate folder with history tracking
  const navigateToFolder = (folderId: string | null) => {
    if (folderId === activeFolderId) return;
    const newHistory = navHistory.slice(0, historyIndex + 1);
    newHistory.push(folderId);
    setNavHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onSelectFolder(folderId);
    setSelectedFileIds(new Set());
    setSelectedFolderIds(new Set());
    setInspectedFile(null);
    setInspectedFolder(null);
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      onSelectFolder(navHistory[nextIndex]);
      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
      setInspectedFile(null);
      setInspectedFolder(null);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < navHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      onSelectFolder(navHistory[nextIndex]);
      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
      setInspectedFile(null);
      setInspectedFolder(null);
    }
  };

  const handleGoUp = () => {
    if (activeFolderId !== null) {
      if (activeFolderId === "uncategorized") {
        navigateToFolder(null);
        return;
      }
      const cur = folders.find((f) => f.id === activeFolderId);
      navigateToFolder(cur?.parentId || null);
    }
  };

  // Close dropdowns and context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setShowFilterDropdown(false);
      setShowSortDropdown(false);
      setShowViewDropdown(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Generate Video Keyframe Thumbnail (client-side snapshot from video URL)
  const generateVideoThumbnail = (fileId: string, url: string) => {
    if (videoThumbnailCache[fileId]) return;
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 1.2;

    const handleSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          videoThumbnailCache[fileId] = dataUrl;
          if (video.duration) {
            mediaMetadataCache[fileId] = {
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight
            };
          }
          setThumbnailVersion((v) => v + 1);
        }
      } catch (err) {
        console.warn("Failed to extract thumbnail for video", fileId, err);
      } finally {
        video.remove();
      }
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", () => video.remove(), { once: true });
    video.load();
  };

  // Preload video thumbnails when files change
  useEffect(() => {
    const videoFiles = files.filter((f) => f.type === "video");
    videoFiles.slice(0, 15).forEach((vf) => {
      if (!videoThumbnailCache[vf.id]) {
        generateVideoThumbnail(vf.id, resolveMediaFileUrl(vf));
      }
    });
  }, [files]);

  // Filter & Sort Media Files
  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        // Natural File System Folder filtering:
        // Root shows only root files (files not placed in any folder).
        // Folders show only files placed inside that specific folder.
        if (!searchQuery.trim()) {
          if (activeFolderId === null) {
            if (fileFolderMap[file.id]) return false;
          } else if (activeFolderId === "uncategorized") {
            if (fileFolderMap[file.id]) return false;
          } else {
            if (fileFolderMap[file.id] !== activeFolderId) return false;
          }
        } else {
          if (activeFolderId !== null && activeFolderId !== "uncategorized") {
            if (fileFolderMap[file.id] !== activeFolderId) return false;
          }
        }

        // Type filtering
        if (filterType === "video" && file.type !== "video") return false;
        if (filterType === "audio" && file.type !== "audio") return false;
        if (filterType === "with_sub" && (!file.subtitles || file.subtitles.length === 0)) return false;
        if (filterType === "no_sub" && file.subtitles && file.subtitles.length > 0) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = file.title.toLowerCase().includes(q);
          const matchName = file.originalName.toLowerCase().includes(q);
          const matchSub = file.subtitles?.some((s) => s.label.toLowerCase().includes(q) || s.language?.toLowerCase().includes(q));
          return matchTitle || matchName || matchSub;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "name") {
          cmp = a.title.localeCompare(b.title, "ar");
        } else if (sortField === "date") {
          cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        } else if (sortField === "size") {
          cmp = (a.size || 0) - (b.size || 0);
        } else if (sortField === "type") {
          cmp = a.type.localeCompare(b.type);
        } else if (sortField === "subtitles") {
          cmp = (a.subtitles?.length || 0) - (b.subtitles?.length || 0);
        } else if (sortField === "duration") {
          const durA = mediaMetadataCache[a.id]?.duration || 0;
          const durB = mediaMetadataCache[b.id]?.duration || 0;
          cmp = durA - durB;
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });
  }, [files, fileFolderMap, activeFolderId, filterType, searchQuery, sortField, sortDirection, thumbnailVersion]);

  // Displayed Folders (folders belonging to the current directory level or matching search)
  const displayedFolders = useMemo(() => {
    let list: MediaFolder[] = [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = folders.filter((f) => f.name.toLowerCase().includes(q));
    } else if (activeFolderId === null) {
      list = folders.filter((f) => !f.parentId);
    } else if (activeFolderId === "uncategorized") {
      list = [];
    } else {
      list = folders.filter((f) => f.parentId === activeFolderId);
    }

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name, "ar");
      } else if (sortField === "date") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = a.name.localeCompare(b.name, "ar");
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [folders, activeFolderId, searchQuery, sortField, sortDirection]);

  // Format File Size Helper
  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Format Duration Helper
  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}:${remMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Preview Pane Target File (either inspectedFile or currentFile or first in list)
  const previewTargetFile = useMemo(() => {
    if (inspectedFile && files.some((f) => f.id === inspectedFile.id)) {
      return files.find((f) => f.id === inspectedFile.id) || inspectedFile;
    }
    if (selectedFileIds.size === 1) {
      const singleId = Array.from(selectedFileIds)[0];
      return files.find((f) => f.id === singleId) || null;
    }
    if (inspectedFolder || selectedFolderIds.size > 0) {
      return null;
    }
    if (currentFile && filteredFiles.some((f) => f.id === currentFile.id)) return currentFile;
    if (filteredFiles.length > 0) return filteredFiles[0];
    return null;
  }, [inspectedFile, selectedFileIds, inspectedFolder, selectedFolderIds, currentFile, files, filteredFiles]);

  // Preview Pane Target Folder (when a folder is clicked/inspected)
  const previewTargetFolder = useMemo(() => {
    if (inspectedFolder && folders.some((f) => f.id === inspectedFolder.id)) {
      return folders.find((f) => f.id === inspectedFolder.id) || inspectedFolder;
    }
    if (selectedFolderIds.size === 1) {
      const singleId = Array.from(selectedFolderIds)[0];
      return folders.find((f) => f.id === singleId) || null;
    }
    return null;
  }, [inspectedFolder, selectedFolderIds, folders]);

  // Active Subtitle for Preview Mini Player
  const activePreviewSubtitleTrack = useMemo(() => {
    if (!previewTargetFile?.subtitles || previewTargetFile.subtitles.length === 0) return null;
    return previewTargetFile.subtitles[0];
  }, [previewTargetFile]);

  const activePreviewCue = useMemo(() => {
    if (!activePreviewSubtitleTrack || !activePreviewSubtitleTrack.cues) return null;
    return activePreviewSubtitleTrack.cues.find(
      (cue) => previewCurrentTime >= cue.startTime && previewCurrentTime <= cue.endTime
    );
  }, [activePreviewSubtitleTrack, previewCurrentTime]);

  // Click handler for files (Opens directly on single click unless in selection mode)
  const handleClickFile = (file: MediaFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelectionMode || e.ctrlKey || e.metaKey || e.shiftKey) {
      if (!isSelectionMode) setIsSelectionMode(true);
      setInspectedFile(file);
      setInspectedFolder(null);
      handleToggleSelectFile(file.id, e);
    } else {
      // Direct open / playback on single click
      onSelectFile(file, true);
    }
  };

  // Click handler for folders (Navigates directly on single click unless in selection mode)
  const handleClickFolder = (folder: MediaFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelectionMode || e.ctrlKey || e.metaKey || e.shiftKey) {
      if (!isSelectionMode) setIsSelectionMode(true);
      setInspectedFolder(folder);
      setInspectedFile(null);
      setSelectedFolderIds((prev) => {
        const next = new Set(prev);
        if (next.has(folder.id)) next.delete(folder.id);
        else next.add(folder.id);
        return next;
      });
    } else {
      // Direct navigation on single click
      navigateToFolder(folder.id);
    }
  };

  // Toggle multi-select checkbox
  const handleToggleSelectFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastSelectedFileId) {
      const ids = filteredFiles.map((f) => f.id);
      const start = ids.indexOf(lastSelectedFileId);
      const end = ids.indexOf(id);
      if (start !== -1 && end !== -1) {
        const [min, max] = [Math.min(start, end), Math.max(start, end)];
        const range = ids.slice(min, max + 1);
        setSelectedFileIds((prev) => new Set([...prev, ...range]));
        return;
      }
    }

    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastSelectedFileId(id);
  };

  const handleSelectAll = () => {
    if (
      (filteredFiles.length > 0 || displayedFolders.length > 0) &&
      selectedFileIds.size === filteredFiles.length &&
      selectedFolderIds.size === displayedFolders.length
    ) {
      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
      setSelectedFolderIds(new Set(displayedFolders.map((f) => f.id)));
    }
  };

  // Drag and Drop handlers
  const handleFileDragStart = (e: React.DragEvent, fileId: string) => {
    const ids = selectedFileIds.has(fileId) ? Array.from(selectedFileIds) : [fileId];
    setDraggedFileIds(ids);
    e.dataTransfer.setData("text/plain", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    if (draggedFileIds.length > 0) {
      onBulkMove(draggedFileIds, targetFolderId);
      setDraggedFileIds([]);
    }
  };

  // Trigger Custom Delete Confirmation Modal (Replacing window.confirm)
  const triggerDeleteSingleFile = (file: MediaFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirmModal({
      isOpen: true,
      type: "single_file",
      fileId: file.id,
      fileName: file.title
    });
  };

  const triggerDeleteSingleFolder = (folder: MediaFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirmModal({
      isOpen: true,
      type: "single_folder",
      folderId: folder.id,
      folderName: folder.name
    });
  };

  const triggerBulkDelete = () => {
    if (selectedFileIds.size === 0 && selectedFolderIds.size === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      type: "bulk",
      bulkFileIds: Array.from(selectedFileIds),
      bulkFolderIds: Array.from(selectedFolderIds)
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmModal.type === "single_file" && deleteConfirmModal.fileId) {
      onDeleteFile(deleteConfirmModal.fileId);
    } else if (deleteConfirmModal.type === "single_folder" && deleteConfirmModal.folderId && deleteConfirmModal.folderName) {
      onDeleteFolder(deleteConfirmModal.folderId, deleteConfirmModal.folderName);
    } else if (deleteConfirmModal.type === "bulk") {
      onBulkDelete(deleteConfirmModal.bulkFileIds || [], deleteConfirmModal.bulkFolderIds || []);
      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
    }
    setDeleteConfirmModal({ isOpen: false, type: "single_file" });
  };

  // Batch Export Subtitles into ZIP or Consolidated File
  const handleBatchExportSubtitles = async (format: "srt_zip" | "vtt_zip" | "txt_zip" | "consolidated_txt") => {
    const targetFiles = selectedFileIds.size > 0
      ? files.filter((f) => selectedFileIds.has(f.id))
      : filteredFiles;

    const filesWithSubs = targetFiles.filter((f) => f.subtitles && f.subtitles.length > 0);
    if (filesWithSubs.length === 0) {
      return;
    }

    setIsExportingSubtitles(true);
    setExportProgressText("جاري تحضير ملفات الترجمة وتجميعها...");

    try {
      if (format === "consolidated_txt") {
        let fullText = `=== تصدير ترجمات مكتبة الوسائط ===\n`;
        fullText += `تاريخ التصدير: ${new Date().toLocaleString("ar-EG")}\n`;
        fullText += `عدد الملفات: ${filesWithSubs.length}\n\n`;

        filesWithSubs.forEach((file, idx) => {
          fullText += `\n=========================================\n`;
          fullText += `[${idx + 1}] ملف: ${file.title} (${file.type === "video" ? "فيديو" : "صوت"})\n`;
          fullText += `=========================================\n`;

          file.subtitles?.forEach((track) => {
            fullText += `\n--- مسار الترجمة: ${track.label} (${track.language || "de"}) ---\n`;
            fullText += exportCuesToPlainText(track.cues) + "\n";
          });
        });

        const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `مكتبة_الوسائط_تفريغ_شامل_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const zip = new JSZip();
        const rootFolder = zip.folder("Subtitles_Export") || zip;

        filesWithSubs.forEach((file) => {
          const safeTitle = file.title.replace(/[\\/:*?"<>|]/g, "_").trim();
          const fileFolder = rootFolder.folder(safeTitle) || rootFolder;

          file.subtitles?.forEach((track) => {
            const safeTrackName = track.label.replace(/[\\/:*?"<>|]/g, "_").trim();
            let content = "";
            let ext = "srt";

            if (format === "srt_zip") {
              content = exportCuesToSrt(track.cues);
              ext = "srt";
            } else if (format === "vtt_zip") {
              content = exportCuesToVtt(track.cues);
              ext = "vtt";
            } else {
              content = exportCuesToPlainText(track.cues);
              ext = "txt";
            }

            fileFolder.file(`${safeTitle}_${safeTrackName}.${ext}`, content);
          });
        });

        setExportProgressText("جاري إنشاء ملف ZIP المضغوط...");
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ترجمات_الوسائط_${format.split("_")[0].toUpperCase()}_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setShowBatchSubtitleModal(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExportingSubtitles(false);
      setExportProgressText("");
    }
  };

  // Stats
  const totalStorageBytes = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [files]);

  const selectedTotalBytes = useMemo(() => {
    return files
      .filter((f) => selectedFileIds.has(f.id))
      .reduce((acc, f) => acc + (f.size || 0), 0);
  }, [files, selectedFileIds]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] text-slate-900 overflow-hidden select-none font-sans" dir="rtl">
      {/* ======================================================== */}
      {/* 1. TOP NAVIGATION & ADDRESS BREADCRUMB BAR               */}
      {/* ======================================================== */}
      <div className="bg-white border-b border-slate-200/90 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
        {/* Left: Navigation Buttons & Breadcrumbs */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
          {/* Mobile Main App Sidebar Toggle Button */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
              title="القائمة الرئيسية"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}

          {/* Navigation Buttons (Back, Forward, Up, Refresh) */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
            <button
              onClick={handleGoBack}
              disabled={historyIndex === 0}
              className="p-1 rounded-md hover:bg-white text-slate-700 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
              title="الرجوع للخلف"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleGoForward}
              disabled={historyIndex >= navHistory.length - 1}
              className="p-1 rounded-md hover:bg-white text-slate-700 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
              title="التقدم للأمام"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleGoUp}
              disabled={activeFolderId === null}
              className="p-1 rounded-md hover:bg-white text-slate-700 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
              title="المجلد الأعلى"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRefreshFiles}
              className="p-1 rounded-md hover:bg-white text-slate-700 transition-all cursor-pointer"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>

          {/* Interactive Address Breadcrumb Bar */}
          <div className="flex-1 flex items-center bg-slate-50/80 border border-slate-200/90 rounded-lg px-2.5 py-1 text-xs text-slate-700 min-w-0 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => navigateToFolder(null)}
                className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 py-0.5"
                title="الرجوع إلى مكتبة الوسائط الرئيسية"
              >
                <Film className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>مكتبة الوسائط</span>
              </button>

              {folderBreadcrumbs.map((crumb, idx) => {
                const isLast = idx === folderBreadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    <span className="text-slate-300 font-bold select-none shrink-0">/</span>
                    {isLast ? (
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 shrink-0 py-0.5">
                        <Folder className="w-3.5 h-3.5 text-amber-500 fill-current shrink-0" />
                        <span className="truncate max-w-[180px]">{crumb.name}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigateToFolder(crumb.id)}
                        className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 py-0.5"
                        title={`الانتقال إلى ${crumb.name}`}
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-500 fill-current shrink-0" />
                        <span className="truncate max-w-[140px]">{crumb.name}</span>
                      </button>
                    )}
                  </React.Fragment>
                );
              })}

              {activeFolderId === "uncategorized" && (
                <>
                  <span className="text-slate-300 font-bold select-none shrink-0">/</span>
                  <span className="text-xs font-bold text-slate-700 shrink-0 py-0.5">
                    غير مصنفة
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Search Box */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث في الوسائط والترجمات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-8 py-1 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. REFINED COMMAND BAR                                   */}
      {/* ======================================================== */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left Side: Creation & Contextual Operations */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Primary Upload Button */}
          <button
            onClick={onUploadClick}
            disabled={uploading}
            className="px-3 py-1.5 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-75"
            title="رفع مقاطع فيديو أو صوتية جديدة"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>رفع ({uploadProgress}%)...</span>
              </>
            ) : (
              <>
                <Film className="w-3.5 h-3.5" />
                <span>+ رفع وسائط</span>
              </>
            )}
          </button>

          {/* Upload Entire Folder Button (رفع مجلد كامل) */}
          {onUploadFolderClick && (
            <button
              onClick={onUploadFolderClick}
              disabled={uploading}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
              title="رفع مجلد كامل من جهازك بجميع ملفات الفيديو والصوت"
            >
              <FolderInput className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">+ 📁 رفع مجلد</span>
              <span className="sm:hidden">+ مجلد</span>
            </button>
          )}

          {/* YouTube Download & Transcribe Button */}
          {onOpenYouTubeDownload && (
            <button
              onClick={onOpenYouTubeDownload}
              className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="تنزيل وتفريغ مقطع من يوتيوب بالدقة المحددة"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>تنزيل من يوتيوب 🎥⚡</span>
            </button>
          )}

          {/* New Folder Button */}
          <button
            onClick={onOpenCreateFolder}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="إنشاء مجلد تصنيف جديد"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
            <span>+ مجلد جديد</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {/* Selection Mode Toggle Button (زر وضع التحديد) */}
          <button
            onClick={handleToggleSelectionMode}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              isSelectionMode
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
            title={isSelectionMode ? "إيقاف وضع التحديد وإلغاء الاختيارات" : "تفعيل وضع التحديد المتعدد"}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isSelectionMode ? "وضع التحديد: مفعّل" : "وضع التحديد"}</span>
          </button>

          {/* Contextual Actions & Select All (Shown ONLY when Selection Mode is active) */}
          {isSelectionMode && (
            <div className="flex flex-wrap items-center gap-1.5 animate-fadeIn">
              {/* Select All Toggle */}
              <button
                onClick={handleSelectAll}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  (selectedFileIds.size > 0 || selectedFolderIds.size > 0)
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
                title="تحديد كافة العناصر المعروضة"
              >
                {selectedFileIds.size === filteredFiles.length && selectedFolderIds.size === displayedFolders.length && (filteredFiles.length > 0 || displayedFolders.length > 0) ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>تحديد الكل</span>
              </button>

              {(selectedFileIds.size > 0 || selectedFolderIds.size > 0) && (
                <div className="flex items-center gap-1.5 bg-blue-50/90 border border-blue-200 px-2 py-0.5 rounded-lg text-xs animate-fadeIn">
                  <span className="font-black text-blue-800 text-[11px]">
                    محدد: {selectedFileIds.size + selectedFolderIds.size}
                  </span>

                  <div className="h-3 w-px bg-blue-300 mx-0.5" />

                  {/* Bulk Move */}
                  {selectedFileIds.size > 0 && (
                    <button
                      onClick={() => setShowBulkMoveModal(true)}
                      className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                      title="نقل الملفات المحددة إلى مجلد"
                    >
                      <FolderInput className="w-3 h-3 text-amber-600" />
                      <span>نقل</span>
                    </button>
                  )}

                  {/* Bulk Subtitle Exporter */}
                  {selectedFileIds.size > 0 && (
                    <button
                      onClick={() => setShowBatchSubtitleModal(true)}
                      className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                      title="تصدير ترجمات الملفات المحددة"
                    >
                      <DownloadCloud className="w-3 h-3 text-indigo-600" />
                      <span>تصدير</span>
                    </button>
                  )}

                  {/* Bulk Delete */}
                  <button
                    onClick={triggerBulkDelete}
                    className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                    title="حذف العناصر المحددة"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>حذف</span>
                  </button>

                  {/* Clear Selection */}
                  <button
                    onClick={() => {
                      setSelectedFileIds(new Set());
                      setSelectedFolderIds(new Set());
                    }}
                    className="p-1 hover:bg-blue-100 text-blue-600 rounded-md transition-colors cursor-pointer"
                    title="إلغاء التحديد"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Clean Dropdowns for Filter, Sort, View Mode & Inspector */}
        <div className="flex items-center gap-1.5">
          {/* 1. Filter Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterDropdown((p) => !p);
                setShowSortDropdown(false);
                setShowViewDropdown(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType !== "all"
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Film className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {filterType === "all"
                  ? "تصفية: الكل"
                  : filterType === "video"
                  ? "فيديو فقط"
                  : filterType === "audio"
                  ? "صوت فقط"
                  : filterType === "with_sub"
                  ? "مترجمة فقط"
                  : "بدون ترجمة"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showFilterDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 text-xs font-bold text-slate-700 animate-scaleUp"
              >
                <button
                  onClick={() => {
                    setFilterType("all");
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    filterType === "all" ? "text-blue-600 bg-blue-50/50" : ""
                  }`}
                >
                  <span>جميع الوسائط</span>
                  {filterType === "all" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setFilterType("video");
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    filterType === "video" ? "text-blue-600 bg-blue-50/50" : ""
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-blue-500" />
                    <span>مقاطع الفيديو</span>
                  </span>
                  {filterType === "video" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setFilterType("audio");
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    filterType === "audio" ? "text-purple-600 bg-purple-50/50" : ""
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-purple-500" />
                    <span>التسجيلات الصوتية</span>
                  </span>
                  {filterType === "audio" && <Check className="w-3.5 h-3.5 text-purple-600" />}
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => {
                    setFilterType("with_sub");
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    filterType === "with_sub" ? "text-indigo-600 bg-indigo-50/50" : ""
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Subtitles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>تحتوي على ترجمة</span>
                  </span>
                  {filterType === "with_sub" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
                <button
                  onClick={() => {
                    setFilterType("no_sub");
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    filterType === "no_sub" ? "text-slate-900 bg-slate-100" : ""
                  }`}
                >
                  <span>بدون ترجمة</span>
                  {filterType === "no_sub" && <Check className="w-3.5 h-3.5 text-slate-800" />}
                </button>
              </div>
            )}
          </div>

          {/* 2. Sort Dropdown */}
          <div className="relative flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="p-1 hover:bg-slate-100 text-slate-600 rounded-md transition-colors cursor-pointer"
              title={sortDirection === "asc" ? "تصاعدي (A-Z)" : "تنازلي (Z-A)"}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSortDropdown((p) => !p);
                setShowFilterDropdown(false);
                setShowViewDropdown(false);
              }}
              className="px-2 py-0.5 text-slate-700 font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-50 rounded-md"
            >
              <span>
                {sortField === "date"
                  ? "التاريخ"
                  : sortField === "name"
                  ? "الاسم"
                  : sortField === "size"
                  ? "الحجم"
                  : sortField === "type"
                  ? "النوع"
                  : sortField === "duration"
                  ? "المدة"
                  : "الترجمات"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showSortDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 mt-8 w-36 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 text-xs font-bold text-slate-700 animate-scaleUp"
              >
                <button
                  onClick={() => {
                    setSortField("date");
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    sortField === "date" ? "text-blue-600 bg-blue-50/50" : ""
                  }`}
                >
                  <span>تاريخ الإضافة</span>
                  {sortField === "date" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setSortField("name");
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    sortField === "name" ? "text-blue-600 bg-blue-50/50" : ""
                  }`}
                >
                  <span>الاسم أبجدياً</span>
                  {sortField === "name" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setSortField("size");
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    sortField === "size" ? "text-blue-600 bg-blue-50/50" : ""
                  }`}
                >
                  <span>حجم الملف</span>
                  {sortField === "size" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setSortField("duration");
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    sortField === "duration" ? "text-blue-600 bg-blue-50/50" : ""
                  }`}
                >
                  <span>المدة الزمنية</span>
                  {sortField === "duration" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setSortField("subtitles");
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-right flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    sortField === "subtitles" ? "text-blue-600 bg-blue-50/50" : ""
                  }`}
                >
                  <span>عدد مسارات الترجمة</span>
                  {sortField === "subtitles" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              </div>
            )}
          </div>

          {/* 3. View Modes Segmented Control */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => handleSetViewMode("details")}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === "details" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
              }`}
              title="عرض التفاصيل (Details View)"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetViewMode("large_grid")}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === "large_grid" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
              }`}
              title="شبكة البطاقات المصغرة (Grid View)"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetViewMode("list")}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === "list" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
              }`}
              title="قائمة مدمجة (Compact List)"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4. Toggle Inspector Preview Pane */}
          <button
            onClick={handleTogglePreviewPane}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
              showPreviewPane
                ? "bg-blue-50 text-blue-700 border-blue-300 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
            title="لوحة المعاينة والتفاصيل الجانبية"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold hidden lg:inline">معاينة</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MAIN WORKSPACE: FILE VIEWPORT + INSPECTOR */}
      {/* ======================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Files Viewport */}
        <main
          className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto p-3 sm:p-4"
          onClick={() => {
            setSelectedFileIds(new Set());
            setSelectedFolderIds(new Set());
            setInspectedFile(null);
            setInspectedFolder(null);
          }}
        >
          {/* Real-time Upload Progress Banner */}
          {uploading && (
            <div className="mb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl p-3.5 shadow-lg border border-blue-400/30 animate-fadeIn shrink-0">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-xs sm:text-sm">
                        {uploadingFolderName ? `جاري رفع مجلد "${uploadingFolderName}"...` : "جاري رفع ملفات الوسائط..."}
                      </span>
                      <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {uploadProgress}%
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-100 truncate mt-0.5">
                      {uploadingFileName && `الملف: ${uploadingFileName} • `}
                      {uploadingFolderName
                        ? `المجلد المستهدف: 📁 ${uploadingFolderName}`
                        : activeFolder
                        ? `المجلد المستهدف: 📁 ${activeFolder.name}`
                        : "المجلد المستهدف: 📁 المجلد الرئيسي (بدون تصنيف)"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-white/95">{uploadProgress}%</span>
                </div>
              </div>
              {/* Animated Progress Bar */}
              <div className="w-full h-2 bg-black/25 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300 shadow-xs"
                  style={{ width: `${Math.max(6, uploadProgress)}%` }}
                />
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-bold">جاري تحميل المحتويات والوسائط...</p>
            </div>
          ) : filteredFiles.length === 0 && displayedFolders.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl p-6 my-auto">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Film className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {activeFolder ? "هذا المجلد فارغ حالياً" : "لا توجد عناصر مضافة حتى الآن"}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                {activeFolder
                  ? "قم بسحب وإفلات الوسائط داخل هذا المجلد أو انقر على زر الرفع أدناه"
                  : "قم بسحب وإفلات مقاطع الفيديو أو الصوت أو إنشاء مجلد جديد لتنظيم المحتوى"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <button
                  onClick={onUploadClick}
                  disabled={uploading}
                  className="px-4 py-2 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>+ رفع مقطع جديد</span>
                </button>
                {onUploadFolderClick && (
                  <button
                    onClick={onUploadFolderClick}
                    disabled={uploading}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
                  >
                    <FolderInput className="w-3.5 h-3.5 text-blue-600" />
                    <span>+ 📁 رفع مجلد كامل</span>
                  </button>
                )}
                {onOpenYouTubeDownload && (
                  <button
                    onClick={onOpenYouTubeDownload}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>تنزيل وتفريغ من يوتيوب 🎥⚡</span>
                  </button>
                )}
                <button
                  onClick={onOpenCreateFolder}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                  <span>+ إنشاء مجلد</span>
                </button>
              </div>
            </div>
          ) : viewMode === "details" ? (
            /* ======================================================== */
            /* A. UNIFIED DETAILS VIEW (TABLE WITH FOLDERS & FILES)     */
            /* ======================================================== */
            <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-right border-collapse table-fixed">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 select-none">
                  <tr>
                    {isSelectionMode && (
                      <th className="p-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            (filteredFiles.length > 0 || displayedFolders.length > 0) &&
                            selectedFileIds.size === filteredFiles.length &&
                            selectedFolderIds.size === displayedFolders.length
                          }
                          onChange={handleSelectAll}
                          className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="تحديد الكل"
                        />
                      </th>
                    )}
                    <th
                      onClick={() => {
                        setSortField("name");
                        setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
                      }}
                      className="p-2.5 cursor-pointer hover:bg-slate-100 transition-colors w-auto"
                    >
                      <div className="flex items-center gap-1">
                        <span>الاسم والعنصر</span>
                        {sortField === "name" && <ArrowUpDown className="w-3 h-3 text-blue-600" />}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField("type");
                        setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
                      }}
                      className="p-2.5 w-24 cursor-pointer hover:bg-slate-100 transition-colors hidden sm:table-cell"
                    >
                      <div className="flex items-center gap-1">
                        <span>النوع</span>
                        {sortField === "type" && <ArrowUpDown className="w-3 h-3 text-blue-600" />}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField("size");
                        setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
                      }}
                      className="p-2.5 w-24 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>الحجم</span>
                        {sortField === "size" && <ArrowUpDown className="w-3 h-3 text-blue-600" />}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField("date");
                        setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
                      }}
                      className="p-2.5 w-28 cursor-pointer hover:bg-slate-100 transition-colors hidden md:table-cell"
                    >
                      <div className="flex items-center gap-1">
                        <span>تاريخ التعديل</span>
                        {sortField === "date" && <ArrowUpDown className="w-3 h-3 text-blue-600" />}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField("subtitles");
                        setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
                      }}
                      className="p-2.5 w-28 cursor-pointer hover:bg-slate-100 transition-colors hidden lg:table-cell"
                    >
                      <div className="flex items-center gap-1">
                        <span>الترجمات / العناصر</span>
                        {sortField === "subtitles" && <ArrowUpDown className="w-3 h-3 text-blue-600" />}
                      </div>
                    </th>
                    <th className="p-2.5 w-28 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {/* 1. Folders as Table Rows */}
                  {displayedFolders.map((folder) => {
                    const isSelected = selectedFolderIds.has(folder.id);
                    const isInspected = inspectedFolder?.id === folder.id;
                    const isDragOver = dragOverFolderId === folder.id;
                    const folderFilesCount = files.filter((f) => fileFolderMap[f.id] === folder.id).length;
                    const subfoldersCount = folders.filter((f) => f.parentId === folder.id).length;

                    return (
                      <tr
                        key={folder.id}
                        onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                        onDragLeave={handleFolderDragLeave}
                        onDrop={(e) => handleFolderDrop(e, folder.id)}
                        onClick={(e) => handleClickFolder(folder, e)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, folder });
                        }}
                        className={`transition-colors cursor-pointer group ${
                          isDragOver
                            ? "bg-amber-100/90"
                            : isSelected
                            ? "bg-amber-50/90 text-amber-950 font-semibold"
                            : isInspected
                            ? "bg-slate-100/90 font-medium"
                            : "hover:bg-slate-50/80 bg-white"
                        }`}
                        title={`انقر لفتح مجلد ${folder.name}`}
                      >
                        {/* Checkbox (shown only in selection mode) */}
                        {isSelectionMode && (
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedFolderIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(folder.id)) next.delete(folder.id);
                                  else next.add(folder.id);
                                  return next;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-sm text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>
                        )}

                        {/* Folder Name & Icon */}
                        <td className="p-2.5 min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-12 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                              style={{ backgroundColor: `${folder.color || "#f59e0b"}20`, color: folder.color || "#b45309" }}
                            >
                              <Folder className="w-5 h-5 fill-current" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-slate-800 group-hover:text-amber-700 transition-colors" title={folder.name}>
                                {folder.name}
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {folderFilesCount} ملف {subfoldersCount > 0 ? `• ${subfoldersCount} مجلد فرعي` : ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="p-2.5 hidden sm:table-cell">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100/80 text-amber-800 border border-amber-200/60">
                            مجلد ملفات
                          </span>
                        </td>

                        {/* Size */}
                        <td className="p-2.5 font-mono text-slate-400 text-[11px]">—</td>

                        {/* Date */}
                        <td className="p-2.5 text-slate-500 text-[11px] hidden md:table-cell">
                          {folder.createdAt ? new Date(folder.createdAt).toLocaleDateString("ar-EG") : "—"}
                        </td>

                        {/* Subtitles / Items column */}
                        <td className="p-2.5 hidden lg:table-cell">
                          <span className="text-slate-400 text-[10px]">
                            {folderFilesCount + subfoldersCount} عنصر
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToFolder(folder.id);
                              }}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="فتح المجلد"
                            >
                              <Folder className="w-3 h-3 fill-current" />
                              <span className="hidden sm:inline">فتح</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEditFolder(folder);
                              }}
                              className="p-1 hover:bg-amber-50 text-slate-500 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                              title="تعديل المجلد"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => triggerDeleteSingleFolder(folder, e)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="حذف المجلد"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* 2. Media Files as Table Rows */}
                  {filteredFiles.map((file) => {
                    const isSelected = selectedFileIds.has(file.id);
                    const isInspected = previewTargetFile?.id === file.id;
                    const isPlaying = currentFile?.id === file.id;
                    const hasSubtitles = file.subtitles && file.subtitles.length > 0;
                    const assignedFolderId = fileFolderMap[file.id];
                    const assignedFolder = folders.find((f) => f.id === assignedFolderId);
                    const videoThumb = videoThumbnailCache[file.id];

                    return (
                      <tr
                        key={file.id}
                        draggable
                        onDragStart={(e) => handleFileDragStart(e, file.id)}
                        onClick={(e) => handleClickFile(file, e)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, file });
                        }}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? "bg-blue-50/80 text-blue-950 font-semibold"
                            : isInspected
                            ? "bg-slate-100/90 font-medium"
                            : isPlaying
                            ? "bg-indigo-50/60 font-medium"
                            : "hover:bg-slate-50/80 bg-white"
                        }`}
                      >
                        {/* Checkbox (shown only in selection mode) */}
                        {isSelectionMode && (
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelectFile(file.id, e as any)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                        )}

                        {/* File Title & Video Thumbnail / Icon */}
                        <td className="p-2.5 min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Real Thumbnail / Video Frame snapshot */}
                            <div
                              className={`w-12 h-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-2xs overflow-hidden relative border border-slate-200/60 ${
                                file.type === "video" ? "bg-slate-900" : "bg-purple-600"
                              }`}
                            >
                              {file.type === "video" && videoThumb ? (
                                <img
                                  src={videoThumb}
                                  alt={file.title}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : file.type === "video" ? (
                                <Film className="w-4 h-4" />
                              ) : (
                                <Music className="w-4 h-4" />
                              )}

                              {/* Subtle Play Overlay */}
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-3.5 h-3.5 fill-current text-white" />
                              </div>
                            </div>

                            {editingId === file.id ? (
                              <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editTitleText}
                                  onChange={(e) => setEditTitleText(e.target.value)}
                                  className="text-xs px-2 py-0.5 border border-blue-500 rounded bg-white w-full"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") onSaveRename(file.id);
                                  }}
                                />
                                <button onClick={() => onSaveRename(file.id)} className="p-1 text-emerald-600">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="min-w-0 flex-1">
                                <p
                                  className="truncate font-bold text-slate-800 group-hover:text-blue-700 transition-colors"
                                  title={file.title}
                                >
                                  {file.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {assignedFolder && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md"
                                      style={{ backgroundColor: `${assignedFolder.color}15`, color: assignedFolder.color || "#b45309" }}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: assignedFolder.color || "#b45309" }} />
                                      <span>{assignedFolder.name}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Media Type */}
                        <td className="p-2.5 hidden sm:table-cell">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              file.type === "video" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {file.type === "video" ? "فيديو" : "صوت"}
                          </span>
                        </td>

                        {/* Size */}
                        <td className="p-2.5 font-mono text-slate-600 text-[11px]">{formatFileSize(file.size)}</td>

                        {/* Date */}
                        <td className="p-2.5 text-slate-500 text-[11px] hidden md:table-cell">
                          {new Date(file.uploadedAt).toLocaleDateString("ar-EG")}
                        </td>

                        {/* Subtitles count */}
                        <td className="p-2.5 hidden lg:table-cell">
                          {hasSubtitles ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                              <Subtitles className="w-3 h-3" />
                              <span>{file.subtitles?.length} مسار</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">بدون ترجمة</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                            {/* Open in Full Studio Player */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFile(file, true);
                              }}
                              className="px-2 py-1 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="تشغيل في المشغل"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span className="hidden sm:inline">تشغيل</span>
                            </button>

                            {/* AI Transcribe Shortcut */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenGradioModalForFile(file);
                              }}
                              className="p-1 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer"
                              title="تفريغ صوتي بالذكاء الاصطناعي (Gradio STT)"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>

                            {/* Subtitle Options Shortcut */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSubtitleOptionsForFile(file);
                              }}
                              className="p-1 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                              title="إدارة مسارات الترجمة"
                            >
                              <Subtitles className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={(e) => triggerDeleteSingleFile(file, e)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === "large_grid" ? (
            /* ======================================================== */
            /* B. UNIFIED LARGE ICONS GRID (FOLDERS & FILES TOGETHER)   */
            /* ======================================================== */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-3.5">
              {/* 1. Folders in Grid */}
              {displayedFolders.map((folder) => {
                const isSelected = selectedFolderIds.has(folder.id);
                const isInspected = inspectedFolder?.id === folder.id;
                const isDragOver = dragOverFolderId === folder.id;
                const folderFilesCount = files.filter((f) => fileFolderMap[f.id] === folder.id).length;
                const subfoldersCount = folders.filter((f) => f.parentId === folder.id).length;

                return (
                  <div
                    key={folder.id}
                    onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                    onDragLeave={handleFolderDragLeave}
                    onDrop={(e) => handleFolderDrop(e, folder.id)}
                    onClick={(e) => handleClickFolder(folder, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, folder });
                    }}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden select-none ${
                      isDragOver
                        ? "bg-amber-100/90 border-amber-500 ring-2 ring-amber-400 scale-[1.02]"
                        : isSelected
                        ? "bg-amber-50/80 border-amber-400 shadow-md ring-2 ring-amber-500/30"
                        : isInspected
                        ? "bg-slate-100/90 border-slate-300 shadow-xs"
                        : "bg-white border-slate-200/90 hover:border-amber-400 hover:shadow-xs"
                    }`}
                    title={`انقر لفتح مجلد ${folder.name}`}
                  >
                    {/* Top Header: Checkbox (shown only in selection mode) + Folder Badge */}
                    <div className="flex items-center justify-between mb-2">
                      {isSelectionMode ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedFolderIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(folder.id)) next.delete(folder.id);
                              else next.add(folder.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-sm text-amber-600 cursor-pointer"
                        />
                      ) : (
                        <div />
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-200/50">
                        <Folder className="w-3 h-3 fill-current" />
                        <span>مجلد</span>
                      </span>
                    </div>

                    {/* Big Folder Icon Banner */}
                    <div
                      className="w-full h-28 rounded-xl flex flex-col items-center justify-center mb-2.5 transition-all group-hover:scale-[1.02]"
                      style={{ backgroundColor: `${folder.color || "#f59e0b"}15`, color: folder.color || "#b45309" }}
                    >
                      <Folder className="w-14 h-14 fill-current drop-shadow-xs" />
                    </div>

                    {/* Title & Metadata */}
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-amber-700 transition-colors mb-1" title={folder.name}>
                        {folder.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100">
                        <span>{folderFilesCount} ملف {subfoldersCount > 0 ? `• ${subfoldersCount} فرعي` : ""}</span>
                        <span>{folder.createdAt ? new Date(folder.createdAt).toLocaleDateString("ar-EG") : ""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 2. Media Files in Grid */}
              {filteredFiles.map((file) => {
                const isSelected = selectedFileIds.has(file.id);
                const isInspected = previewTargetFile?.id === file.id;
                const isPlaying = currentFile?.id === file.id;
                const hasSubtitles = file.subtitles && file.subtitles.length > 0;
                const assignedFolderId = fileFolderMap[file.id];
                const assignedFolder = folders.find((f) => f.id === assignedFolderId);
                const videoThumb = videoThumbnailCache[file.id];

                return (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => handleFileDragStart(e, file.id)}
                    onClick={(e) => handleClickFile(file, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, file });
                    }}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden select-none ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-400 shadow-md ring-2 ring-blue-500/30"
                        : isInspected
                        ? "bg-slate-100/90 border-slate-300 shadow-xs"
                        : isPlaying
                        ? "bg-indigo-50/50 border-indigo-400 shadow-xs"
                        : "bg-white border-slate-200/70 hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    {/* Top Header: Checkbox (shown only in selection mode) + Badges */}
                    <div className="flex items-center justify-between mb-2">
                      {isSelectionMode ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectFile(file.id, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-sm text-blue-600 cursor-pointer"
                        />
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            file.type === "video" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {file.type === "video" ? "فيديو" : "صوت"}
                        </span>
                        {hasSubtitles && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/70 rounded-md text-[9px] font-bold flex items-center gap-0.5">
                            <Subtitles className="w-2.5 h-2.5" />
                            <span>{file.subtitles?.length}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Media Card Thumbnail Banner with Video Snapshot or Waveform */}
                    <div className="w-full h-28 bg-slate-900 rounded-xl flex items-center justify-center mb-2.5 relative overflow-hidden group-hover:opacity-95 transition-all border border-slate-200/60">
                      {file.type === "video" && videoThumb ? (
                        <img
                          src={videoThumb}
                          alt={file.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : file.type === "video" ? (
                        <Film className="w-10 h-10 text-blue-400 group-hover:scale-110 transition-transform" />
                      ) : (
                        /* Audio Waveform Simulation */
                        <div className="flex items-end justify-center gap-1 h-12 w-full px-6">
                          {[40, 70, 30, 90, 60, 80, 50, 95, 45, 65, 85, 35].map((h, idx) => (
                            <div
                              key={idx}
                              className="w-1.5 bg-purple-400/80 rounded-full"
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-[#0056f6] text-white flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                          <Play className="w-4 h-4 fill-current translate-x-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Title & Metadata */}
                    <div>
                      {editingId === file.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editTitleText}
                            onChange={(e) => setEditTitleText(e.target.value)}
                            className="text-xs px-2 py-0.5 border border-blue-500 rounded bg-white w-full"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onSaveRename(file.id);
                            }}
                          />
                          <button onClick={() => onSaveRename(file.id)} className="p-1 text-emerald-600">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p
                          className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-blue-700 transition-colors mb-1"
                          title={file.title}
                        >
                          {file.title}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100">
                        <span>{formatFileSize(file.size)}</span>
                        {assignedFolder ? (
                          <span
                            className="font-bold truncate max-w-[100px]"
                            style={{ color: assignedFolder.color || "#b45309" }}
                          >
                            📁 {assignedFolder.name}
                          </span>
                        ) : (
                          <span>{new Date(file.uploadedAt).toLocaleDateString("ar-EG")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ======================================================== */
            /* C. UNIFIED COMPACT LIST VIEW (FOLDERS & FILES TOGETHER)  */
            /* ======================================================== */
            <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-xl overflow-hidden bg-white">
              {/* 1. Folders in List */}
              {displayedFolders.map((folder) => {
                const isSelected = selectedFolderIds.has(folder.id);
                const isInspected = inspectedFolder?.id === folder.id;
                const isDragOver = dragOverFolderId === folder.id;
                const folderFilesCount = files.filter((f) => fileFolderMap[f.id] === folder.id).length;
                const subfoldersCount = folders.filter((f) => f.parentId === folder.id).length;

                return (
                  <div
                    key={folder.id}
                    onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                    onDragLeave={handleFolderDragLeave}
                    onDrop={(e) => handleFolderDrop(e, folder.id)}
                    onClick={(e) => handleClickFolder(folder, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, folder });
                    }}
                    className={`p-2 sm:px-3 flex items-center justify-between gap-2.5 transition-colors cursor-pointer group ${
                      isDragOver
                        ? "bg-amber-100/90"
                        : isSelected
                        ? "bg-amber-50 text-amber-900 font-semibold"
                        : isInspected
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedFolderIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(folder.id)) next.delete(folder.id);
                              else next.add(folder.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-sm text-amber-600 cursor-pointer"
                        />
                      )}
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${folder.color || "#f59e0b"}20`, color: folder.color || "#b45309" }}
                      >
                        <Folder className="w-4 h-4 fill-current" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate group-hover:text-amber-700" title={folder.name}>
                          {folder.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        {folderFilesCount} ملف {subfoldersCount > 0 ? `• ${subfoldersCount} مجلد` : ""}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToFolder(folder.id);
                        }}
                        className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold cursor-pointer"
                      >
                        فتح
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 2. Media Files in List */}
              {filteredFiles.map((file) => {
                const isSelected = selectedFileIds.has(file.id);
                const isInspected = previewTargetFile?.id === file.id;
                const isPlaying = currentFile?.id === file.id;

                return (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => handleFileDragStart(e, file.id)}
                    onClick={(e) => handleClickFile(file, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, file });
                    }}
                    className={`p-2 sm:px-3 flex items-center justify-between gap-2.5 transition-colors cursor-pointer group ${
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-semibold"
                        : isInspected
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : isPlaying
                        ? "bg-indigo-50/70 font-semibold"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectFile(file.id, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-sm text-blue-600 cursor-pointer"
                        />
                      )}
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-white ${
                          file.type === "video" ? "bg-blue-600" : "bg-purple-600"
                        }`}
                      >
                        {file.type === "video" ? <Film className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate" title={file.title}>
                        {file.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 shrink-0">
                      <span>{formatFileSize(file.size)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFile(file, true);
                        }}
                        className="px-2 py-1 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-md text-[10px] font-bold cursor-pointer"
                      >
                        تشغيل
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ======================================================== */}
        {/* WINDOWS 11 INSPECTOR / PREVIEW PANE (WITH METADATA & SUBS) */}
        {/* ======================================================== */}
        {showPreviewPane && (
          <aside className="w-80 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 overflow-y-auto hidden xl:flex shadow-xs animate-fadeIn">
            {previewTargetFolder && !previewTargetFile ? (
              /* FOLDER PREVIEW PANE */
              <div className="p-4 space-y-4">
                {/* Header Title */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <p className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 text-amber-500 fill-current" />
                    <span>معاينة وتفاصيل المجلد</span>
                  </p>
                  <button
                    onClick={handleTogglePreviewPane}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title="إغلاق لوحة المعاينة"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Folder Banner */}
                <div
                  className="w-full h-36 rounded-2xl flex flex-col items-center justify-center border shadow-xs transition-all"
                  style={{
                    backgroundColor: `${previewTargetFolder.color || "#f59e0b"}15`,
                    borderColor: `${previewTargetFolder.color || "#f59e0b"}35`,
                    color: previewTargetFolder.color || "#b45309"
                  }}
                >
                  <Folder className="w-16 h-16 fill-current drop-shadow-sm" />
                </div>

                {/* Metadata */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-900 leading-snug break-words">
                    {previewTargetFolder.name}
                  </h4>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">النوع:</span>
                      <span className="font-bold text-amber-800">مجلد ملفات</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">المحتويات:</span>
                      <span className="font-bold font-mono">
                        {files.filter((f) => fileFolderMap[f.id] === previewTargetFolder.id).length} ملف • {folders.filter((f) => f.parentId === previewTargetFolder.id).length} مجلد فرعي
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">الحجم الإجمالي:</span>
                      <span className="font-bold font-mono text-slate-700">
                        {formatFileSize(
                          files
                            .filter((f) => fileFolderMap[f.id] === previewTargetFolder.id)
                            .reduce((acc, curr) => acc + (curr.size || 0), 0)
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">تاريخ الإنشاء:</span>
                      <span className="font-bold">
                        {previewTargetFolder.createdAt
                          ? new Date(previewTargetFolder.createdAt).toLocaleDateString("ar-EG")
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => navigateToFolder(previewTargetFolder.id)}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Folder className="w-3.5 h-3.5 fill-current" />
                    <span>فتح هذا المجلد 📂</span>
                  </button>

                  <button
                    onClick={() => onOpenEditFolder(previewTargetFolder)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل الاسم واللون</span>
                  </button>
                </div>
              </div>
            ) : previewTargetFile ? (
              /* FILE PREVIEW PANE */
              <div className="p-4 space-y-4">
                {/* Header Title */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>معاينة وتفاصيل المقطع</span>
                  </p>
                  <button
                    onClick={handleTogglePreviewPane}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title="إغلاق لوحة المعاينة"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Mini Preview Player with Real-Time Subtitle Synchronization */}
                <div className="w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-md relative group">
                  {previewTargetFile.type === "video" ? (
                    <div className="relative w-full h-44 bg-black flex items-center justify-center">
                      <video
                        ref={previewMediaRef as any}
                        src={resolveMediaFileUrl(previewTargetFile)}
                        controls
                        onTimeUpdate={(e) => {
                          const target = e.currentTarget;
                          setPreviewCurrentTime(target.currentTime);
                        }}
                        onLoadedMetadata={(e) => {
                          const target = e.currentTarget;
                          setPreviewDuration(target.duration || 0);
                          setPreviewResolution({
                            width: target.videoWidth || 0,
                            height: target.videoHeight || 0
                          });
                        }}
                        className="w-full h-full object-contain bg-black"
                      />

                      {/* Live Subtitle Overlay on Video */}
                      {activePreviewCue && (
                        <div className="absolute bottom-10 inset-x-2 pointer-events-none flex justify-center text-center">
                          <span className="bg-black/80 backdrop-blur-xs text-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold leading-relaxed shadow-lg max-w-[95%]">
                            {activePreviewCue.text}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-950 to-slate-900 text-white relative">
                      <div className="w-12 h-12 rounded-full bg-purple-600/30 border border-purple-400/40 flex items-center justify-center mb-1">
                        <Music className="w-6 h-6 text-purple-300" />
                      </div>
                      <audio
                        ref={previewMediaRef as any}
                        src={resolveMediaFileUrl(previewTargetFile)}
                        controls
                        onTimeUpdate={(e) => {
                          const target = e.currentTarget;
                          setPreviewCurrentTime(target.currentTime);
                        }}
                        onLoadedMetadata={(e) => {
                          const target = e.currentTarget;
                          setPreviewDuration(target.duration || 0);
                        }}
                        className="w-full h-8"
                      />

                      {/* Live Subtitle Overlay for Audio */}
                      {activePreviewCue && (
                        <div className="w-full text-center bg-black/60 backdrop-blur-xs text-amber-300 px-2 py-1 rounded-lg text-xs font-bold mt-1">
                          {activePreviewCue.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Complete Extended Metadata Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-900 leading-snug break-words">
                    {previewTargetFile.title}
                  </h4>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">النوع:</span>
                      <span className="font-bold">{previewTargetFile.type === "video" ? "فيديو" : "صوت"}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">الحجم:</span>
                      <span className="font-bold font-mono">{formatFileSize(previewTargetFile.size)}</span>
                    </div>

                    {previewDuration > 0 && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">المدة الزمنية:</span>
                        <span className="font-bold font-mono text-blue-700">{formatDuration(previewDuration)}</span>
                      </div>
                    )}

                    {previewResolution && previewResolution.width > 0 && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">الدقة والأبعاد:</span>
                        <span className="font-bold font-mono text-emerald-700">
                          {previewResolution.width} × {previewResolution.height} (
                          {previewResolution.height >= 1080
                            ? "1080p FHD"
                            : previewResolution.height >= 720
                            ? "720p HD"
                            : "SD"}
                          )
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">تاريخ الرفع:</span>
                      <span className="font-bold">
                        {new Date(previewTargetFile.uploadedAt).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subtitle Tracks Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Subtitles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>مسارات الترجمة ({previewTargetFile.subtitles?.length || 0})</span>
                    </p>
                    <button
                      onClick={() => onOpenSubtitleOptionsForFile(previewTargetFile)}
                      className="text-[11px] text-[#0056f6] font-bold hover:underline cursor-pointer"
                    >
                      إدارة
                    </button>
                  </div>

                  {previewTargetFile.subtitles && previewTargetFile.subtitles.length > 0 ? (
                    <div className="space-y-1.5">
                      {previewTargetFile.subtitles.map((track) => (
                        <div
                          key={track.id}
                          className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs font-bold text-indigo-900"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Subtitles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{track.label}</span>
                          </div>
                          <span className="text-[10px] text-indigo-600 font-mono">
                            {track.cues?.length || 0} جملة
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-slate-400 text-xs border border-dashed border-slate-200">
                      <p>لا توجد ترجمة مرفقة بعد</p>
                      <button
                        onClick={() => onOpenGradioModalForFile(previewTargetFile)}
                        className="mt-1 text-[11px] font-bold text-emerald-600 hover:underline flex items-center justify-center gap-1 w-full cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>تفريغ بالذكاء الاصطناعي الآن</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Direct Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => onSelectFile(previewTargetFile, true)}
                    className="w-full py-2 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>تشغيل في المشغل الكامل ⚡</span>
                  </button>

                  <button
                    onClick={() => onOpenGradioModalForFile(previewTargetFile)}
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تفريغ صوتي بالذكاء الاصطناعي</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-full gap-2">
                <Info className="w-8 h-8 text-slate-300" />
                <p className="font-bold text-slate-600">حدد عنصراً لمعاينته</p>
                <p className="text-[11px]">ستظهر هنا تفاصيل المجلد أو الملف ومسارات الترجمة ومشغل المعاينة</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. WINDOWS 11 STATUS BAR (BOTTOM) */}
      {/* ======================================================== */}
      <footer className="bg-slate-100/95 border-t border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>{displayedFolders.length + filteredFiles.length} عنصراً</span>
          {(selectedFileIds.size > 0 || selectedFolderIds.size > 0) && (
            <>
              <span>•</span>
              <span className="text-blue-600">
                {selectedFileIds.size + selectedFolderIds.size} عنصر محدد {selectedFileIds.size > 0 ? `(${formatFileSize(selectedTotalBytes)})` : ""}
              </span>
            </>
          )}
          <span>•</span>
          <span className="text-slate-400">
            {activeFolder ? `المجلد: ${activeFolder.name}` : "المجلد الرئيسي"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 hidden sm:inline">Windows Media Explorer</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSetViewMode("details")}
              className={`p-0.5 rounded cursor-pointer ${viewMode === "details" ? "text-blue-600" : "text-slate-400"}`}
              title="تفاصيل"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetViewMode("large_grid")}
              className={`p-0.5 rounded cursor-pointer ${viewMode === "large_grid" ? "text-blue-600" : "text-slate-400"}`}
              title="أيقونات"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* 5. RIGHT-CLICK CONTEXT MENU */}
      {/* ======================================================== */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-52 text-xs font-bold text-slate-700 animate-scaleUp"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file && (
            <>
              <button
                onClick={() => {
                  if (contextMenu.file) onSelectFile(contextMenu.file, true);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-blue-50 hover:text-[#0056f6] flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>تشغيل في المشغل</span>
              </button>

              <button
                onClick={() => {
                  if (contextMenu.file) onOpenGradioModalForFile(contextMenu.file);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>تفريغ بالذكاء الاصطناعي</span>
              </button>

              <button
                onClick={() => {
                  if (contextMenu.file) onOpenSubtitleOptionsForFile(contextMenu.file);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 cursor-pointer"
              >
                <Subtitles className="w-3.5 h-3.5 text-indigo-600" />
                <span>إدارة مسارات الترجمة</span>
              </button>

              <div className="h-px bg-slate-100 my-1" />

              <button
                onClick={() => {
                  if (contextMenu.file) {
                    setSelectedFileIds(new Set([contextMenu.file.id]));
                    setShowBulkMoveModal(true);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 cursor-pointer"
              >
                <FolderInput className="w-3.5 h-3.5 text-amber-600" />
                <span>نقل إلى مجلد...</span>
              </button>

              <button
                onClick={(e) => {
                  if (contextMenu.file) onStartRename(contextMenu.file, e);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>إعادة تسمية (F2)</span>
              </button>

              <a
                href={`/api/media/download/${contextMenu.file.id}`}
                onClick={() => setContextMenu(null)}
                className="w-full px-3 py-1.5 text-right hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>تحميل الملف</span>
              </a>

              <div className="h-px bg-slate-100 my-1" />

              <button
                onClick={(e) => {
                  if (contextMenu.file) triggerDeleteSingleFile(contextMenu.file, e);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف نهائي</span>
              </button>
            </>
          )}

          {contextMenu.folder && (
            <>
              <button
                onClick={() => {
                  if (contextMenu.folder) navigateToFolder(contextMenu.folder.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>فتح المجلد</span>
              </button>

              <button
                onClick={() => {
                  if (contextMenu.folder) onOpenEditFolder(contextMenu.folder);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>تعديل الاسم واللون</span>
              </button>

              <div className="h-px bg-slate-100 my-1" />

              <button
                onClick={(e) => {
                  if (contextMenu.folder) triggerDeleteSingleFolder(contextMenu.folder, e);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-right hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف المجلد</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MODAL: BULK MOVE TO FOLDER */}
      {/* ======================================================== */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <FolderInput className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-sm">نقل الملفات إلى مجلد</h3>
              </div>
              <button
                onClick={() => setShowBulkMoveModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-2 max-h-60 overflow-y-auto">
              <p className="text-xs font-bold text-slate-600 mb-2">
                اختر المجلد الهدف لنقل ({selectedFileIds.size}) ملف:
              </p>

              <button
                onClick={() => setTargetMoveFolderId(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  targetMoveFolderId === null ? "bg-blue-50 text-blue-700 border border-blue-200" : "hover:bg-slate-50 text-slate-700 border border-slate-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-600" />
                  <span>المجلد الرئيسي (بدون تصنيف)</span>
                </span>
                {targetMoveFolderId === null && <Check className="w-4 h-4 text-blue-600" />}
              </button>

              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setTargetMoveFolderId(folder.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    targetMoveFolderId === folder.id ? "bg-amber-50 text-amber-900 border border-amber-300" : "hover:bg-slate-50 text-slate-700 border border-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: folder.color || "#f59e0b" }} />
                    <span className="truncate">{getFolderPathName(folder)}</span>
                  </span>
                  {targetMoveFolderId === folder.id && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  onBulkMove(Array.from(selectedFileIds), targetMoveFolderId);
                  setShowBulkMoveModal(false);
                  setSelectedFileIds(new Set());
                }}
                className="flex-1 py-2 bg-[#0056f6] hover:bg-[#0047d1] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                تأكيد النقل
              </button>
              <button
                onClick={() => setShowBulkMoveModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. CUSTOM REFINED DELETE CONFIRMATION MODAL               */}
      {/* ======================================================== */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-scaleUp text-right">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">تأكيد الحذف النهائي</h3>
                <p className="text-xs text-slate-500">
                  {deleteConfirmModal.type === "single_file"
                    ? "حذف ملف وسائط نهائياً من السيرفر"
                    : deleteConfirmModal.type === "single_folder"
                    ? "حذف مجلد التصنيف نهائياً"
                    : `حذف جماعي (${(deleteConfirmModal.bulkFileIds?.length || 0) + (deleteConfirmModal.bulkFolderIds?.length || 0)}) عنصر`}
                </p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3 my-3 text-xs text-rose-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {deleteConfirmModal.type === "single_file"
                    ? `هل أنت متأكد من حذف: "${deleteConfirmModal.fileName}"؟`
                    : deleteConfirmModal.type === "single_folder"
                    ? `هل أنت متأكد من حذف مجلد: "${deleteConfirmModal.folderName}"؟`
                    : `سيتم حذف ${deleteConfirmModal.bulkFileIds?.length || 0} ملف و ${deleteConfirmModal.bulkFolderIds?.length || 0} مجلد نهائياً.`}
                </span>
              </p>
              <p className="text-[11px] text-rose-700 pr-5">
                لا يمكن التراجع عن هذه العملية بعد التأكيد.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                نعم، احذف الآن
              </button>
              <button
                onClick={() => setDeleteConfirmModal({ isOpen: false, type: "single_file" })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. MODAL: BATCH SUBTITLE EXPORTER (LIBRARY-INSPIRED)      */}
      {/* ======================================================== */}
      {showBatchSubtitleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <DownloadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">تصدير الترجمات وتفريغ النصوص</h3>
                  <p className="text-[11px] text-slate-400">تنزيل مسارات الترجمة كملفات ZIP أو ملف تفريغ شامل</p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchSubtitleModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isExportingSubtitles ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-600 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-xs font-bold">{exportProgressText}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700">اختر صيغة التصدير المطلوبة:</p>

                <button
                  onClick={() => handleBatchExportSubtitles("srt_zip")}
                  className="w-full p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 flex items-center justify-between transition-all cursor-pointer text-right group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                      SRT
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                        حزمة ملفات SRT (ZIP مضغوط)
                      </p>
                      <p className="text-[11px] text-slate-400">الصيغة المعيارية لتشغيل الترجمة مع أي مشغل وسائط</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </button>

                <button
                  onClick={() => handleBatchExportSubtitles("vtt_zip")}
                  className="w-full p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 flex items-center justify-between transition-all cursor-pointer text-right group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                      VTT
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                        حزمة ملفات WebVTT (ZIP مضغوط)
                      </p>
                      <p className="text-[11px] text-slate-400">مناسب لمتصفحات الويب والتطبيقات الحديثة</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-teal-600" />
                </button>

                <button
                  onClick={() => handleBatchExportSubtitles("consolidated_txt")}
                  className="w-full p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 flex items-center justify-between transition-all cursor-pointer text-right group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-black text-xs">
                      TXT
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                        ملف نصي شامل لكافة المقاطع (تفريغ واحد)
                      </p>
                      <p className="text-[11px] text-slate-400">يجمع نصوص كافة الدروس والترجمات في مستند نصي واحد للقراءة</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
