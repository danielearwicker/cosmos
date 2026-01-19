import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf";
import { useStorage } from "../../encrypted-storage/Storage";
import { EncryptedPDFSource } from "./EncryptedPDFSource";
import type { VaultItem, VaultAction } from "./reducer";

// Set up the worker using CDN
pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// Helper function to determine if text should be light or dark based on background
function getContrastColor(hexColor: string): string {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000" : "#fff";
}

export interface PDFViewerProps {
    item: VaultItem;
    dispatch: (action: VaultAction) => void;
    onClose: () => void;
    allTags: string[];
    tagColors: Readonly<Record<string, string>>;
}

export function PDFViewer({ item, dispatch, onClose, allTags, tagColors }: PDFViewerProps) {
    const storage = useStorage();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(item.currentPage ?? 1);
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingPage, setLoadingPage] = useState(false);
    const [chunksLoaded, setChunksLoaded] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [error, setError] = useState<string | null>(null);
    const sourceRef = useRef<EncryptedPDFSource | null>(null);
    const [pageInput, setPageInput] = useState("");
    const [editingPage, setEditingPage] = useState(false);
    const [addingTag, setAddingTag] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const tagInputRef = useRef<HTMLInputElement>(null);

    // Load the PDF document with progressive/range loading
    useEffect(() => {
        let cancelled = false;
        let pdfDocument: PDFDocumentProxy | null = null;

        async function loadPDF() {
            try {
                setLoading(true);
                setError(null);

                // Get the backend client
                const blobConnectionString = storage.blobConnectionString;
                const encryptionKey = storage.encryptionKey;

                const { azureBackend } = await import(
                    "../../encrypted-storage/azureBackend"
                );

                const settingsJson = localStorage.getItem("storage-settings");
                const settings = settingsJson ? JSON.parse(settingsJson) : {};
                const user = settings.user || "";

                const client = azureBackend(
                    blobConnectionString,
                    `${user}-${item.id}`
                );

                const source = new EncryptedPDFSource(
                    client,
                    encryptionKey,
                    (loaded, total) => {
                        if (!cancelled) {
                            setChunksLoaded(loaded);
                            setTotalChunks(total);
                        }
                    }
                );
                sourceRef.current = source;

                const length = await source.initialize();
                setTotalChunks(Math.ceil(length / (1024 * 1024))); // Approximate chunks

                if (cancelled) return;

                // Create a PDFDataRangeTransport for progressive loading
                const transport = new pdfjsLib.PDFDataRangeTransport(length, null);

                // Handle range requests from PDF.js
                transport.requestDataRange = (begin: number, end: number) => {
                    if (cancelled) return;

                    source.read(begin, end - begin).then((data) => {
                        if (!cancelled) {
                            transport.onDataRange(begin, data);
                        }
                    }).catch((err) => {
                        console.error("Error loading PDF range:", err);
                    });
                };

                // Start loading the document
                const loadingTask = pdfjsLib.getDocument({
                    range: transport,
                    length,
                });

                pdfDocument = await loadingTask.promise;

                if (cancelled) {
                    pdfDocument.destroy();
                    return;
                }

                setPdfDoc(pdfDocument);
                setNumPages(pdfDocument.numPages);
                setLoading(false);
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                    setLoading(false);
                }
            }
        }

        loadPDF();

        return () => {
            cancelled = true;
            if (pdfDocument) {
                pdfDocument.destroy();
            }
            if (sourceRef.current) {
                sourceRef.current.clearCache();
            }
        };
    }, [item.id, storage]);

    // Render the current page
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;

        let cancelled = false;

        async function renderPage() {
            setLoadingPage(true);
            try {
                const page = await pdfDoc!.getPage(currentPage);
                if (cancelled) return;

                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current!;
                const context = canvas.getContext("2d")!;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport,
                }).promise;
            } finally {
                if (!cancelled) {
                    setLoadingPage(false);
                }
            }
        }

        renderPage();

        return () => {
            cancelled = true;
        };
    }, [pdfDoc, currentPage, scale]);

    // Save current page to metadata when it changes
    useEffect(() => {
        if (currentPage !== item.currentPage) {
            dispatch({
                type: "ITEM_SET_CURRENT_PAGE",
                id: item.id,
                page: currentPage,
            });
        }
    }, [currentPage, item.id, item.currentPage, dispatch]);

    const goToPrevPage = useCallback(() => {
        setCurrentPage((p) => Math.max(1, p - 1));
    }, []);

    const goToNextPage = useCallback(() => {
        setCurrentPage((p) => Math.min(numPages, p + 1));
    }, [numPages]);

    const zoomIn = useCallback(() => {
        setScale((s) => Math.min(3, s + 0.25));
    }, []);

    const zoomOut = useCallback(() => {
        setScale((s) => Math.max(0.5, s - 0.25));
    }, []);

    const startEditingPage = useCallback(() => {
        setPageInput(String(currentPage));
        setEditingPage(true);
    }, [currentPage]);

    const commitPageInput = useCallback(() => {
        const page = parseInt(pageInput, 10);
        if (!isNaN(page) && page >= 1 && page <= numPages) {
            setCurrentPage(page);
        }
        setEditingPage(false);
    }, [pageInput, numPages]);

    const handlePageInputKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            commitPageInput();
        } else if (e.key === "Escape") {
            setEditingPage(false);
        }
        e.stopPropagation();
    }, [commitPageInput]);

    // Tag management
    const suggestedTags = useMemo(() => {
        const term = tagInput.toLowerCase().trim();
        return allTags.filter(
            (t) => !item.tags.includes(t) && (!term || t.includes(term))
        );
    }, [allTags, item.tags, tagInput]);

    const showCreateOption =
        tagInput.trim() &&
        !suggestedTags.includes(tagInput.toLowerCase().trim()) &&
        !item.tags.includes(tagInput.toLowerCase().trim());

    function removeTag(tag: string) {
        dispatch({ type: "ITEM_TAG_REMOVE", id: item.id, tag });
    }

    function openTagDropdown() {
        setTagInput("");
        setAddingTag(true);
        setTimeout(() => tagInputRef.current?.focus(), 0);
    }

    function addTag(tag: string) {
        dispatch({ type: "ITEM_TAG_ADD", id: item.id, tag });
        setAddingTag(false);
        setTagInput("");
    }

    function handleTagKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            const trimmed = tagInput.toLowerCase().trim();
            if (trimmed) {
                addTag(trimmed);
            }
        } else if (e.key === "Escape") {
            setAddingTag(false);
        }
        e.stopPropagation();
    }

    // Keyboard navigation
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            switch (e.key) {
                case "ArrowLeft":
                case "PageUp":
                    goToPrevPage();
                    break;
                case "ArrowRight":
                case "PageDown":
                case " ":
                    goToNextPage();
                    break;
                case "Escape":
                    onClose();
                    break;
                case "+":
                case "=":
                    zoomIn();
                    break;
                case "-":
                    zoomOut();
                    break;
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goToPrevPage, goToNextPage, zoomIn, zoomOut, onClose]);

    if (error) {
        return (
            <div className="pdf-viewer">
                <div className="pdf-toolbar">
                    <button onClick={onClose}>Close</button>
                    <span className="pdf-title">{item.name}</span>
                </div>
                <div className="pdf-error">Error loading PDF: {error}</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="pdf-viewer">
                <div className="pdf-toolbar">
                    <button onClick={onClose}>Close</button>
                    <span className="pdf-title">{item.name}</span>
                </div>
                <div className="pdf-loading">
                    <div className="pdf-loading-text">
                        Loading PDF structure...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pdf-viewer">
            <div className="pdf-toolbar">
                <button onClick={onClose}>Close</button>
                <span className="pdf-title">{item.name}</span>
                <div className="pdf-nav">
                    <button onClick={goToPrevPage} disabled={currentPage <= 1}>
                        ◀
                    </button>
                    {editingPage ? (
                        <span className="pdf-page-input-wrapper">
                            <input
                                type="text"
                                className="pdf-page-input"
                                value={pageInput}
                                onChange={(e) => setPageInput(e.target.value)}
                                onBlur={commitPageInput}
                                onKeyDown={handlePageInputKeyDown}
                                autoFocus
                            />
                            <span> / {numPages}</span>
                        </span>
                    ) : (
                        <span className="pdf-page-display" onClick={startEditingPage}>
                            {currentPage} / {numPages}
                        </span>
                    )}
                    <button
                        onClick={goToNextPage}
                        disabled={currentPage >= numPages}
                    >
                        ▶
                    </button>
                </div>
                <div className="pdf-zoom">
                    <button onClick={zoomOut}>−</button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button onClick={zoomIn}>+</button>
                </div>
                {loadingPage && <span className="pdf-page-loading">Loading page...</span>}
                {chunksLoaded > 0 && chunksLoaded < totalChunks && (
                    <span className="pdf-chunks">
                        Chunks: {chunksLoaded}/{totalChunks}
                    </span>
                )}
            </div>
            <div className="pdf-canvas-container">
                <div className="pdf-page-wrapper">
                    <canvas ref={canvasRef} />
                </div>
            </div>
            <div className="pdf-tag-bar">
                <div className="tags">
                    {item.tags.map((tag) => {
                        const bgColor = tagColors[tag] || "#446";
                        const textColor = getContrastColor(bgColor);
                        return (
                            <span
                                className="tag"
                                key={tag}
                                style={{ background: bgColor, color: textColor }}
                            >
                                <span className="tag-text">{tag}</span>
                                <span
                                    className="remove-tag"
                                    onClick={() => removeTag(tag)}
                                >
                                    ×
                                </span>
                            </span>
                        );
                    })}
                    <div className="add-tag">
                        <button
                            className="add-tag-btn"
                            onClick={openTagDropdown}
                        >
                            +
                        </button>
                        {addingTag && (
                            <div className="add-tag-dropdown">
                                <input
                                    ref={tagInputRef}
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    onBlur={() =>
                                        setTimeout(() => setAddingTag(false), 150)
                                    }
                                    placeholder="Add tag..."
                                />
                                {suggestedTags.map((tag) => (
                                    <div
                                        key={tag}
                                        className="tag-option"
                                        onMouseDown={() => addTag(tag)}
                                    >
                                        {tag}
                                    </div>
                                ))}
                                {showCreateOption && (
                                    <div
                                        className="tag-option create"
                                        onMouseDown={() =>
                                            addTag(tagInput.toLowerCase().trim())
                                        }
                                    >
                                        Create "{tagInput.toLowerCase().trim()}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
