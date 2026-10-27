import React, { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, Search, ChevronRight, Info, Pencil, Check } from "lucide-react";
import { InteractiveBook, BookPage, BookPageMedia, MediaFile } from "../types";
import { fetchBooksFromServer, uploadBookToServer, deleteBookFromServer } from "../utils/bookStorage";

interface BookReaderWorkspaceProps {
  onPlayMediaInStudio?: (file: Partial<MediaFile>) => void;
  onBackToMediaExplorer?: () => void;
}

export const BookReaderWorkspace: React.FC<BookReaderWorkspaceProps> = ({
  onPlayMediaInStudio,
  onBackToMediaExplorer
}) => {
  // Books list loaded from server
  const [books, setBooks] = useState<InteractiveBook[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBook, setSelectedBook] = useState<InteractiveBook | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Hidden upload input and upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load books from server on mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async (retries = 2) => {
    setLoading(true);
    try {
      const serverBooks = await fetchBooksFromServer();
      if (serverBooks.length > 0 || retries <= 0) {
        setBooks(serverBooks);
      } else {
        setTimeout(() => loadBooks(retries - 1), 1000);
      }
    } catch (e) {
      console.error("Error loading books from server:", e);
      if (retries > 0) {
        setTimeout(() => loadBooks(retries - 1), 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle uploading files/ZIP to server
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const filesArray = Array.from(fileList);
      const newBook = await uploadBookToServer(filesArray.length === 1 ? filesArray[0] : filesArray, "", (pct) => {
        setUploadProgress(pct);
      });

      // Reload books from server to ensure complete persistence
      const updatedList = await fetchBooksFromServer();
      setBooks(updatedList);

      // Open newly uploaded book
      setSelectedBook(newBook);
      setCurrentPageIndex(0);
    } catch (err: any) {
      setUploadError(err?.message || "فشل رفع واستخراج الكتاب على السيرفر");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete book from server
  const handleDeleteBook = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteBookFromServer(id);
      const updated = await fetchBooksFromServer();
      setBooks(updated);
      if (selectedBook?.id === id) {
        setSelectedBook(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Active page calculation
  const activePage: BookPage | undefined = selectedBook?.pages?.[currentPageIndex];

  // Previous and next pages for 3-page carousel
  const prevPage: BookPage | undefined =
    selectedBook && currentPageIndex > 0 ? selectedBook.pages[currentPageIndex - 1] : undefined;

  const nextPage: BookPage | undefined =
    selectedBook && currentPageIndex < selectedBook.pages.length - 1
      ? selectedBook.pages[currentPageIndex + 1]
      : undefined;

  // Media tracks for current page
  const pageTracks: BookPageMedia[] = useMemo(() => {
    if (!selectedBook) return [];
    if (activePage && activePage.media && activePage.media.length > 0) {
      return activePage.media;
    }
    // Fallback: If no page-specific media, return book's allMedia
    return selectedBook.allMedia || [];
  }, [selectedBook, activePage]);

  // Play media directly in studio player (مشغل الوسائط)
  const handlePlayTrack = (media: BookPageMedia) => {
    if (onPlayMediaInStudio) {
      onPlayMediaInStudio({
        id: `book-media-${media.id}`,
        title: media.title,
        type: media.type,
        url: media.url || "",
        originalName: media.fileName,
        filename: media.fileName,
        mimeType: media.type === "video" ? "video/mp4" : "audio/mpeg",
        size: 1024 * 1024 * 2,
        uploadedAt: new Date().toISOString()
      });
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (selectedBook && currentPageIndex < selectedBook.pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  // =========================================================================
  // VIEW 2: BOOK READER VIEW (EXACTLY MATCHING image_100aa631.png)
  // =========================================================================
  if (selectedBook) {
    return (
      <div className="w-full h-full bg-white text-slate-900 flex flex-col font-sans select-none overflow-y-auto" dir="ltr">
        {/* Top Header: Back Arrow + "Book" on left, Search on right */}
        <div className="h-14 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedBook(null)}
              className="p-1 text-slate-900 hover:text-slate-600 cursor-pointer transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
            <span className="text-xl font-bold tracking-tight text-slate-900">Book</span>
          </div>

          <button className="p-1 text-slate-900 hover:text-slate-600 cursor-pointer transition-colors">
            <Search className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Centered Book Subtitle */}
        <div className="text-center text-sm font-medium text-slate-900 py-1 px-4">
          {selectedBook.title}
        </div>

        {/* 3-Page Carousel Display */}
        <div className="relative w-full flex items-center justify-center overflow-hidden py-3 px-2 sm:px-6">
          <div className="flex items-center justify-center gap-4 sm:gap-8 max-w-4xl w-full">
            {/* Left Page (Previous) */}
            <div
              onClick={handlePrevPage}
              className={`w-1/4 sm:w-1/3 aspect-[3/4] max-h-[290px] rounded-sm overflow-hidden shadow-md border border-slate-200 transition-all cursor-pointer ${
                prevPage ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {prevPage?.pageImage ? (
                <img
                  src={prevPage.pageImage}
                  alt={`Page ${prevPage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                />
              ) : (
                <div className="w-full h-full bg-white border border-dashed border-slate-300" />
              )}
            </div>

            {/* Center Active Page */}
            <div className="w-1/2 sm:w-2/5 aspect-[3/4] max-h-[360px] rounded-sm overflow-hidden shadow-xl border border-slate-200 bg-white z-10 transition-transform">
              {activePage?.pageImage ? (
                <img
                  src={activePage.pageImage}
                  alt={`Page ${activePage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center text-slate-400 text-xs">
                  Page {activePage?.pageNumber || currentPageIndex + 1}
                </div>
              )}
            </div>

            {/* Right Page (Next) */}
            <div
              onClick={handleNextPage}
              className={`w-1/4 sm:w-1/3 aspect-[3/4] max-h-[290px] rounded-sm overflow-hidden shadow-md border border-slate-200 transition-all cursor-pointer ${
                nextPage ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {nextPage?.pageImage ? (
                <img
                  src={nextPage.pageImage}
                  alt={`Page ${nextPage.pageNumber}`}
                  className="w-full h-full object-contain bg-white"
                />
              ) : (
                <div className="w-full h-full bg-white border border-dashed border-slate-300" />
              )}
            </div>
          </div>
        </div>

        {/* Page Number indicator centered below carousel */}
        <div className="text-center text-sm font-normal text-slate-400 py-1">
          {activePage?.displayLabel || activePage?.pageNumber || currentPageIndex + 1}
        </div>

        {/* Tracks List (Exactly matching image_100aa631.png) */}
        <div className="flex-1 w-full border-t border-slate-200 divide-y divide-slate-200 bg-white">
          {pageTracks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No tracks for this page
            </div>
          ) : (
            pageTracks.map((media) => (
              <div
                key={media.id}
                onClick={() => handlePlayTrack(media)}
                className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              >
                {/* Left Track Info */}
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-base font-semibold text-slate-900 truncate">
                    {media.title}
                  </span>
                  <span className="text-sm text-slate-400 capitalize mt-0.5">
                    {media.type === "video" ? "Video" : "Audio"}
                  </span>
                </div>

                {/* Right Action: Solid Blue Play Triangle or Video Icon */}
                <div className="shrink-0 pl-2">
                  {media.type === "video" ? (
                    <svg className="w-6 h-6 fill-[#007aff] text-[#007aff]" viewBox="0 0 24 24">
                      <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5l4 2.5V7l-4 2.5V8a2 2 0 0 0-2-2H4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 fill-[#007aff] text-[#007aff]" viewBox="0 0 24 24">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: MY BOOKS LIBRARY (EXACTLY MATCHING image_0f369acc.png)
  // =========================================================================
  return (
    <div className="w-full h-full bg-white text-slate-900 flex flex-col font-sans select-none overflow-y-auto" dir="ltr">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed,video/*,audio/*,.pdf,.mkv,.mp4,.mp3,.m4a"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Header: "My Books" on left, Edit Pencil on right */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Books</h1>

        <button
          onClick={() => setIsEditMode((e) => !e)}
          className="p-2 text-slate-800 hover:text-slate-600 cursor-pointer transition-colors"
          title="Edit Books"
        >
          {isEditMode ? <Check className="w-5 h-5 text-blue-600" /> : <Pencil className="w-5 h-5 stroke-[2.2]" />}
        </button>
      </div>

      {/* Uploading progress notification if active */}
      {uploading && (
        <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs font-semibold text-blue-700">
          <span>Uploading and extracting book to server...</span>
          <span className="font-bold">{uploadProgress}%</span>
        </div>
      )}

      {/* Upload error banner if any */}
      {uploadError && (
        <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="underline ml-2">Dismiss</button>
        </div>
      )}

      {/* "Add Book" Section (Matching image_0f369acc.png) */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className="p-4 flex items-center gap-4 border-b border-gray-200 cursor-pointer hover:bg-slate-50/60 transition-colors"
      >
        {/* Blue Scan Frame with Plus Icon */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#007aff] rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
          <svg className="w-14 h-14 text-white stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3M16 20h3a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="9" x2="12" y2="15" strokeLinecap="round" />
            <line x1="9" y1="12" x2="15" y2="12" strokeLinecap="round" />
          </svg>
        </div>

        {/* Blue Text "Add Book" */}
        <span className="text-base font-bold text-[#007aff]">Add Book</span>
      </div>

      {/* Books List (Matching image_0f369acc.png rows) */}
      <div className="flex-1 divide-y divide-gray-200">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Loading books from server...
          </div>
        ) : books.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No books yet. Click "Add Book" to upload one.
          </div>
        ) : (
          books.map((book) => (
            <div
              key={book.id}
              onClick={() => {
                setSelectedBook(book);
                // Default to page with media if available, or first page
                const mediaIdx = book.pages.findIndex((p) => p.media && p.media.length > 0);
                setCurrentPageIndex(mediaIdx >= 0 ? mediaIdx : 0);
              }}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
            >
              {/* Left: Book Cover + Title & Subtitle */}
              <div className="flex items-center gap-4 min-w-0 pr-2">
                {/* Book Cover Thumbnail */}
                <div className="w-16 h-22 sm:w-20 sm:h-26 rounded-xs overflow-hidden shadow-xs border border-gray-100 shrink-0 bg-slate-100 flex items-center justify-center">
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">Book</span>
                  )}
                </div>

                {/* Title & Subtitle */}
                <div className="flex flex-col min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {book.title}
                  </h3>
                  <span className="text-sm font-normal text-slate-400 truncate mt-0.5">
                    {book.subtitle || "Kurs- und Arbeitsbuch"}
                  </span>
                </div>
              </div>

              {/* Right: Chevron > at top and Info (i) at bottom */}
              <div className="flex flex-col items-end justify-between h-20 shrink-0 pl-2">
                {isEditMode ? (
                  <button
                    onClick={(e) => handleDeleteBook(e, book.id)}
                    className="p-1 text-rose-500 hover:text-rose-700 text-xs font-bold"
                  >
                    Delete
                  </button>
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <Info className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
