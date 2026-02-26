"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  FolderIcon,
  DocumentIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  PlusIcon,
  DocumentArrowUpIcon,
  PencilSquareIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { HERO_IMAGES } from "@/lib/images";
import {
  loadFromStorage,
  saveToStorage,
  saveFileBlob,
  getFileBlob,
  deleteFileBlob,
  type StoredFolder,
  type StoredDocument,
} from "@/lib/documentPackStorage";

const ACCEPT_TYPES = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface Folder {
  id: string;
  name: string;
  createdAt: Date;
}

interface DocumentItem {
  id: string;
  name: string;
  folderId: string;
  dateAdded: Date;
  size?: string;
  file?: File;
  sizeBytes?: number;
  mimeType?: string;
}

export default function DocumentPackPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null);
  const [viewDocUrl, setViewDocUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;
  const docsInFolder = currentFolderId
    ? documents.filter((d) => d.folderId === currentFolderId)
    : [];

  const totalSizeBytes = documents.reduce(
    (sum, d) => sum + (d.file?.size ?? d.sizeBytes ?? 0),
    0
  );

  // Load from storage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      const restoredFolders: Folder[] = stored.folders.map((f) => ({
        id: f.id,
        name: f.name,
        createdAt: new Date(f.createdAt),
      }));
      setFolders(restoredFolders);
      // Load document metadata and blobs from IndexedDB
      const restoreDocs = async () => {
        const docs: DocumentItem[] = await Promise.all(
          stored.documents.map(async (d) => {
            const base: DocumentItem = {
              id: d.id,
              name: d.name,
              folderId: d.folderId,
              dateAdded: new Date(d.dateAdded),
              size: d.size,
              sizeBytes: d.sizeBytes,
              mimeType: d.mimeType,
            };
            if (d.hasFile) {
              const blob = await getFileBlob(d.id);
              if (blob) {
                base.file = new File([blob], d.name, {
                  type: d.mimeType || blob.type,
                });
              }
            }
            return base;
          })
        );
        setDocuments(docs);
        setIsHydrated(true);
      };
      restoreDocs();
    } else {
      setIsHydrated(true);
    }
  }, []);

  // Persist whenever folders or documents change (skip initial mount)
  useEffect(() => {
    if (!isHydrated) return;
    const storedFolders: StoredFolder[] = folders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt.toISOString(),
    }));
    const storedDocs: StoredDocument[] = documents.map((d) => ({
      id: d.id,
      name: d.name,
      folderId: d.folderId,
      dateAdded: d.dateAdded.toISOString(),
      size: d.size ?? "0 B",
      sizeBytes: d.file?.size ?? d.sizeBytes ?? 0,
      mimeType: d.file?.type ?? d.mimeType,
      hasFile: !!d.file,
    }));
    saveToStorage({ folders: storedFolders, documents: storedDocs });
  }, [isHydrated, folders, documents]);

  const createFolder = () => {
    if (newFolderName.trim()) {
      const id = `folder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setFolders([
        ...folders,
        { id, name: newFolderName.trim(), createdAt: new Date() },
      ]);
      setNewFolderName("");
      setShowCreateFolder(false);
      setCurrentFolderId(id); // Enter the new folder
    }
  };

  const renameFolder = () => {
    if (editingFolderId && editingFolderName.trim()) {
      setFolders(
        folders.map((f) =>
          f.id === editingFolderId ? { ...f, name: editingFolderName.trim() } : f
        )
      );
      setEditingFolderId(null);
      setEditingFolderName("");
    }
  };

  const deleteFolder = (id: string) => {
    const docsToRemove = documents.filter((d) => d.folderId === id);
    setFolders(folders.filter((f) => f.id !== id));
    setDocuments(documents.filter((d) => d.folderId !== id));
    if (currentFolderId === id) setCurrentFolderId(null);
    docsToRemove.forEach((d) =>
      deleteFileBlob(d.id).catch((e) =>
        console.warn("[DocumentPack] Failed to delete blob:", e)
      )
    );
  };

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!currentFolderId) return;
      const fileArray = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || f.type === "application/pdf"
      );
      if (fileArray.length === 0) return;
      const newDocs: DocumentItem[] = fileArray.map((f) => ({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: f.name,
        folderId: currentFolderId,
        dateAdded: new Date(),
        size: formatSize(f.size),
        file: f,
        sizeBytes: f.size,
        mimeType: f.type,
      }));
      setDocuments((prev) => [...prev, ...newDocs]);
      // Persist file blobs to IndexedDB (async, non-blocking)
      for (let i = 0; i < newDocs.length; i++) {
        saveFileBlob(newDocs[i].id, fileArray[i]).catch((e) =>
          console.warn("[DocumentPack] Failed to persist file:", e)
        );
      }
    },
    [currentFolderId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentFolderId) setIsDragging(true);
  }, [currentFolderId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) setIsDragging(false);
  }, []);

  const addDocument = () => {
    if (newDocName.trim() && currentFolderId) {
      setDocuments([
        ...documents,
        {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: newDocName.trim(),
          folderId: currentFolderId,
          dateAdded: new Date(),
          size: "0 B",
        },
      ]);
      setNewDocName("");
      setShowAddDoc(false);
    }
  };

  const renameDocument = () => {
    if (editingDocId && editingDocName.trim()) {
      setDocuments(
        documents.map((d) =>
          d.id === editingDocId ? { ...d, name: editingDocName.trim() } : d
        )
      );
      setEditingDocId(null);
      setEditingDocName("");
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
    setEditingDocId(null);
    if (viewDoc?.id === id) closeViewer();
    deleteFileBlob(id).catch((e) =>
      console.warn("[DocumentPack] Failed to delete blob:", e)
    );
  };

  const viewDocument = (doc: DocumentItem) => {
    if (!doc.file) return;
    const url = URL.createObjectURL(doc.file);
    if (doc.file.type === "application/pdf") {
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      setViewDocUrl(url);
      setViewDoc(doc);
    }
  };

  const closeViewer = () => {
    if (viewDocUrl) URL.revokeObjectURL(viewDocUrl);
    setViewDocUrl(null);
    setViewDoc(null);
  };

  const downloadDocument = (doc: DocumentItem) => {
    if (doc.file) {
      const url = URL.createObjectURL(doc.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([`Placeholder: ${doc.name}`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.name}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold text-white">Document Pack Organizer</h1>
          <p className="text-sm text-white/90 mt-1">
            Create folders, then upload documents. Rename, view, and download as needed.
          </p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_TYPES}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {!isHydrated && (
          <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
            Loading your documents…
          </div>
        )}
        {isHydrated && (
        <>
        <div className="mb-6">
          <Link
            href="/tools/case-tools"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] hover:underline"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Case Tools
          </Link>
        </div>

        {/* Stats — Apple Files style */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 text-center">
            <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
              {folders.length}
            </p>
            <p className="text-xs font-medium text-[var(--text-secondary)] mt-0.5">Folders</p>
          </div>
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 text-center">
            <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
              {documents.length}
            </p>
            <p className="text-xs font-medium text-[var(--text-secondary)] mt-0.5">Documents</p>
          </div>
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 text-center">
            <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
              {formatSize(totalSizeBytes)}
            </p>
            <p className="text-xs font-medium text-[var(--text-secondary)] mt-0.5">Total Size</p>
          </div>
        </div>

        {/* Content card — Apple-style list with drill-down */}
        <div
          className={`rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] overflow-hidden shadow-sm relative transition-all ${
            isDragging ? "ring-2 ring-[var(--uscis-blue)] ring-offset-2" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3 border-b border-[var(--border-color)]">
            {currentFolder ? currentFolder.name : "Folders"}
          </h3>

          {!currentFolderId ? (
            /* Root: Folders only — tap to enter */
            <div className="divide-y divide-[var(--border-color)]">
              {folders.length === 0 ? (
                <div className="px-5 py-12 text-center relative overflow-hidden min-h-[160px]">
                  <div className="absolute inset-0 opacity-[0.05]">
                    <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="600px" />
                  </div>
                  <div className="relative">
                    <FolderIcon className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-3" />
                    <p className="text-[var(--text-secondary)] font-medium">No folders yet</p>
                    <p className="text-sm text-[var(--text-tertiary)] mt-1">
                      Create a folder first, then upload documents into it.
                    </p>
                  </div>
                </div>
              ) : (
                folders.map((folder) => {
                  const docCount = documents.filter((d) => d.folderId === folder.id).length;
                  return (
                    <div
                      key={folder.id}
                      className="flex items-center group"
                    >
                      <button
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="flex-1 flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-surface-alt)]/50 active:bg-[var(--bg-surface-alt)] transition-colors text-left min-w-0"
                      >
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <FolderIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingFolderId === folder.id ? (
                            <input
                              type="text"
                              value={editingFolderName}
                              onChange={(e) => setEditingFolderName(e.target.value)}
                              onBlur={renameFolder}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renameFolder();
                                if (e.key === "Escape") {
                                  setEditingFolderId(null);
                                  setEditingFolderName("");
                                }
                              }}
                              className="w-full text-sm font-medium bg-transparent border-b border-[var(--uscis-blue)] outline-none"
                              autoFocus
                            />
                          ) : (
                            <>
                              <p className="font-medium text-[var(--text-primary)] truncate">
                                {folder.name}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                {docCount} item{docCount !== 1 ? "s" : ""}
                              </p>
                            </>
                          )}
                        </div>
                        {editingFolderId !== folder.id && (
                          <ChevronRightIcon className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
                        )}
                      </button>
                      {editingFolderId !== folder.id && (
                        <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                            }}
                            className="p-2 rounded-lg hover:bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]"
                            title="Rename"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFolder(folder.id);
                            }}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Create folder — only at root */}
              <button
                onClick={() => setShowCreateFolder(true)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-surface-alt)]/50 active:bg-[var(--bg-surface-alt)] transition-colors text-left border-t border-[var(--border-color)]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] border border-dashed border-[var(--border-color)] flex items-center justify-center flex-shrink-0">
                  <PlusIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>
                <p className="font-medium text-[var(--text-primary)]">Create folder</p>
              </button>
            </div>
          ) : (
            /* Inside folder: Files + Upload only here */
            <div className="divide-y divide-[var(--border-color)]">
              {/* Back to folders */}
              <button
                onClick={() => setCurrentFolderId(null)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-surface-alt)]/50 active:bg-[var(--bg-surface-alt)] transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center flex-shrink-0">
                  <ArrowLeftIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                </div>
                <p className="font-medium text-[var(--text-primary)]">Back to Folders</p>
              </button>

              {docsInFolder.length === 0 ? (
                <div
                  className="px-5 py-12 text-center cursor-pointer hover:bg-[var(--bg-surface-alt)]/30 transition-colors relative overflow-hidden min-h-[160px]"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                >
                  <div className="absolute inset-0 opacity-[0.05]">
                    <Image src={HERO_IMAGES.handsDocuments} alt="" fill className="object-cover" sizes="600px" />
                  </div>
                  <div className="relative">
                  <DocumentIcon className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-3" />
                  <p className="text-[var(--text-secondary)] font-medium">No documents yet</p>
                  <p className="text-sm text-[var(--text-tertiary)] mt-1 mb-4">
                    Add documents to this folder
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--uscis-blue)] text-white text-sm font-medium hover:bg-[var(--uscis-blue-dark)] transition-colors"
                  >
                    <DocumentArrowUpIcon className="w-4 h-4" />
                    Upload document
                  </button>
                  </div>
                </div>
              ) : (
                docsInFolder.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg-surface-alt)]/30 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <DocumentIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingDocId === doc.id ? (
                        <input
                          type="text"
                          value={editingDocName}
                          onChange={(e) => setEditingDocName(e.target.value)}
                          onBlur={renameDocument}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameDocument();
                            if (e.key === "Escape") {
                              setEditingDocId(null);
                              setEditingDocName("");
                            }
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="font-medium text-[var(--text-primary)] truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {doc.dateAdded.toLocaleDateString()}
                            {doc.size && doc.size !== "0 B" && ` • ${doc.size}`}
                            {!doc.file && " • Placeholder"}
                          </p>
                        </>
                      )}
                    </div>
                    {editingDocId !== doc.id && (
                      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingDocId(doc.id);
                            setEditingDocName(doc.name);
                          }}
                          className="p-2 rounded-lg hover:bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]"
                          title="Rename"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => viewDocument(doc)}
                          disabled={!doc.file}
                          className={`p-2 rounded-lg hover:bg-[var(--bg-surface-alt)] ${
                            doc.file
                              ? "text-[var(--text-primary)]"
                              : "text-[var(--text-tertiary)] opacity-50 cursor-not-allowed"
                          }`}
                          title={doc.file ? "View" : "No file to view"}
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadDocument(doc)}
                          className="p-2 rounded-lg hover:bg-[var(--bg-surface-alt)] text-[var(--text-primary)]"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeDocument(doc.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                          title="Remove"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Add/Upload document — only when inside folder */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-surface-alt)]/50 active:bg-[var(--bg-surface-alt)] transition-colors text-left border-t border-[var(--border-color)]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] border border-dashed border-[var(--border-color)] flex items-center justify-center flex-shrink-0">
                  <DocumentArrowUpIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>
                <p className="font-medium text-[var(--text-primary)]">Upload document</p>
              </button>
              <button
                onClick={() => setShowAddDoc(true)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-surface-alt)]/50 active:bg-[var(--bg-surface-alt)] transition-colors text-left border-t border-[var(--border-color)]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] border border-dashed border-[var(--border-color)] flex items-center justify-center flex-shrink-0">
                  <PlusIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
                </div>
                <p className="font-medium text-[var(--text-secondary)]">Add placeholder</p>
              </button>
            </div>
          )}

          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--uscis-blue)]/10 rounded-2xl pointer-events-none z-10">
              <p className="text-lg font-semibold text-[var(--text-primary)]">Drop files to upload</p>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Create folder modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[var(--border-color)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">New folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] mb-4"
              onKeyDown={(e) => e.key === "Enter" && createFolder()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateFolder(false);
                  setNewFolderName("");
                }}
                className="flex-1 py-3 rounded-xl font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 py-3 rounded-xl font-medium bg-[var(--uscis-blue)] text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add placeholder modal — only when inside folder */}
      {showAddDoc && currentFolderId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[var(--border-color)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Add placeholder</h3>
            <input
              type="text"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              placeholder="e.g., Marriage Certificate (to upload later)"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] mb-4"
              onKeyDown={(e) => e.key === "Enter" && addDocument()}
              autoFocus
            />
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Adding to <strong>{currentFolder?.name}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddDoc(false);
                  setNewDocName("");
                }}
                className="flex-1 py-3 rounded-xl font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addDocument}
                disabled={!newDocName.trim()}
                className="flex-1 py-3 rounded-xl font-medium bg-[var(--uscis-blue)] text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View image modal */}
      {viewDoc?.file && viewDoc.file.type.startsWith("image/") && viewDocUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeViewer}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewDocUrl}
              alt={viewDoc.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-white font-medium truncate">{viewDoc.name}</p>
              <button
                onClick={closeViewer}
                className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
