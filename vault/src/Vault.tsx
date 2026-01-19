import { useEffect, useMemo, useRef, useState } from "react";
import { useStorage } from "../../encrypted-storage/Storage";
import { useVaultStorage, type VaultItem, type VaultAction } from "./reducer";
import { UploadFiles } from "./UploadFiles";
import { PDFViewer } from "./PDFViewer";
import { ImageViewer } from "./ImageViewer";
import { TagManagement } from "./TagManagement";
import { Timeline } from "./Timeline";

function getFileIcon(mimeType: string): string {
    if (!mimeType) return "📄";

    // Check exact matches first
    const exactMatches: Record<string, string> = {
        "application/pdf": "📕",
        "application/zip": "📦",
        "application/x-zip-compressed": "📦",
        "application/x-rar-compressed": "📦",
        "application/x-7z-compressed": "📦",
        "application/gzip": "📦",
        "application/json": "📋",
        "application/xml": "📋",
        "application/javascript": "📜",
        "application/typescript": "📜",
        "application/msword": "📘",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📘",
        "application/vnd.ms-excel": "📗",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📗",
        "application/vnd.ms-powerpoint": "📙",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📙",
    };

    if (exactMatches[mimeType]) {
        return exactMatches[mimeType];
    }

    // Check prefix matches
    const [category] = mimeType.split("/");
    switch (category) {
        case "image": return "🖼️";
        case "video": return "🎬";
        case "audio": return "🎵";
        case "text": return "📝";
        case "font": return "🔤";
        default: return "📄";
    }
}

function matchesFileType(mimeType: string, typeKeyword: string): boolean {
    if (!mimeType) return false;

    const mime = mimeType.toLowerCase();
    const keyword = typeKeyword.toLowerCase();

    switch (keyword) {
        case "pdf":
            return mime === "application/pdf";
        case "image":
            return mime.startsWith("image/");
        case "video":
            return mime.startsWith("video/");
        case "audio":
            return mime.startsWith("audio/");
        case "text":
            return mime.startsWith("text/");
        case "document":
            return (
                mime === "application/msword" ||
                mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                mime === "application/vnd.ms-excel" ||
                mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                mime === "application/vnd.ms-powerpoint" ||
                mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            );
        case "archive":
            return (
                mime === "application/zip" ||
                mime === "application/x-zip-compressed" ||
                mime === "application/x-rar-compressed" ||
                mime === "application/x-7z-compressed" ||
                mime === "application/gzip"
            );
        default:
            return false;
    }
}

export function Vault() {
    const [state, dispatch] = useVaultStorage();
    const [search, setSearch] = useState("");
    const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);
    const [viewingImageId, setViewingImageId] = useState<string | null>(null);
    const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
    const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
    const [showingTagManagement, setShowingTagManagement] = useState(false);
    const [showingTypeDropdown, setShowingTypeDropdown] = useState(false);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        for (const item of state.items) {
            for (const tag of item.tags) {
                tags.add(tag);
            }
        }
        return Array.from(tags).sort();
    }, [state.items]);

    const distinctFileTypes = useMemo(() => {
        const types = new Set<string>();
        for (const item of state.items) {
            if (item.type) {
                types.add(item.type);
            }
        }
        return Array.from(types).sort();
    }, [state.items]);

    // Close type dropdown when clicking outside
    useEffect(() => {
        if (showingTypeDropdown) {
            const handleClick = () => setShowingTypeDropdown(false);
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [showingTypeDropdown]);

    const filteredItems = useMemo(() => {
        let items = state.items;

        // Filter by active tag filters (AND logic)
        // Support hierarchical tags: selecting "work" also includes "work/project-a"
        if (activeTagFilters.length > 0) {
            items = items.filter((item) =>
                activeTagFilters.every((filterTag) => {
                    // Check for exact match or if any item tag starts with filterTag/
                    return item.tags.some(
                        (itemTag) =>
                            itemTag === filterTag || itemTag.startsWith(filterTag + "/")
                    );
                })
            );
        }

        // Filter by active file type filter
        if (activeTypeFilter) {
            items = items.filter((item) => item.type === activeTypeFilter);
        }

        // Parse search term for tag: syntax
        const searchTerm = search.toLowerCase().trim();
        const tagMatches = searchTerm.match(/tag:(\S+)/g);
        const searchTags = tagMatches ? tagMatches.map(t => t.substring(4)) : [];

        // Parse search term for date range syntax
        const afterMatch = searchTerm.match(/after:(\S+)/);
        const beforeMatch = searchTerm.match(/before:(\S+)/);
        const afterDate = afterMatch ? new Date(afterMatch[1]) : null;
        const beforeDate = beforeMatch ? new Date(beforeMatch[1]) : null;

        // Parse search term for type: syntax
        const typeMatches = searchTerm.match(/type:(\S+)/g);
        const searchTypes = typeMatches ? typeMatches.map(t => t.substring(5)) : [];

        // Remove all search syntax patterns to get filename search
        const filenameSearch = searchTerm
            .replace(/tag:\S+/g, '')
            .replace(/after:\S+/g, '')
            .replace(/before:\S+/g, '')
            .replace(/type:\S+/g, '')
            .trim();

        // Filter by tag: syntax (AND logic)
        // Support hierarchical tags: searching for "work" also includes "work/project-a"
        if (searchTags.length > 0) {
            items = items.filter((item) =>
                searchTags.every((searchTag) =>
                    item.tags.some(
                        (itemTag) =>
                            itemTag === searchTag || itemTag.startsWith(searchTag + "/")
                    )
                )
            );
        }

        // Filter by date range
        if (afterDate && !isNaN(afterDate.getTime())) {
            items = items.filter((item) => {
                const itemDate = new Date(item.added);
                return itemDate >= afterDate;
            });
        }
        if (beforeDate && !isNaN(beforeDate.getTime())) {
            items = items.filter((item) => {
                const itemDate = new Date(item.added);
                return itemDate <= beforeDate;
            });
        }

        // Filter by type: syntax (OR logic - match any of the specified types)
        if (searchTypes.length > 0) {
            items = items.filter((item) =>
                searchTypes.some((type) => matchesFileType(item.type, type))
            );
        }

        // Filter by filename search term
        if (filenameSearch) {
            items = items.filter((item) =>
                item.name.toLowerCase().includes(filenameSearch)
            );
        }

        return items;
    }, [state.items, search, activeTagFilters, activeTypeFilter]);

    function toggleTagFilter(tag: string) {
        setActiveTagFilters((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    }

    function clearTagFilters() {
        setActiveTagFilters([]);
    }

    const viewingPdfItem = viewingPdfId
        ? state.items.find((i) => i.id === viewingPdfId)
        : null;

    const viewingImageItem = viewingImageId
        ? state.items.find((i) => i.id === viewingImageId)
        : null;

    if (viewingPdfItem) {
        return (
            <PDFViewer
                item={viewingPdfItem}
                dispatch={dispatch}
                onClose={() => setViewingPdfId(null)}
                allTags={allTags}
                tagColors={state.tagColors}
            />
        );
    }

    if (viewingImageItem) {
        return (
            <ImageViewer
                item={viewingImageItem}
                dispatch={dispatch}
                onClose={() => setViewingImageId(null)}
                allTags={allTags}
                tagColors={state.tagColors}
            />
        );
    }

    // Extract the filename search term for highlighting
    const searchTerm = search.toLowerCase().trim();
    const filenameSearchTerm = searchTerm
        .replace(/tag:\S+/g, '')
        .replace(/after:\S+/g, '')
        .replace(/before:\S+/g, '')
        .replace(/type:\S+/g, '')
        .trim();

    return (
        <div className="vault">
            <div className="toolbar">
                <div className="view-tabs">
                    <button
                        className={`view-tab ${state.viewMode === "files" ? "active" : ""}`}
                        onClick={() => dispatch({ type: "SET_VIEW_MODE", viewMode: "files" })}
                    >
                        Files
                    </button>
                    <button
                        className={`view-tab ${state.viewMode === "timeline" ? "active" : ""}`}
                        onClick={() => dispatch({ type: "SET_VIEW_MODE", viewMode: "timeline" })}
                    >
                        Timeline
                    </button>
                </div>
                <input
                    type="text"
                    className="search"
                    placeholder="Search files..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    className="manage-tags-btn"
                    onClick={() => setShowingTagManagement(true)}
                >
                    Manage Tags
                </button>
                <div className="type-filter-container">
                    <button
                        className="types-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowingTypeDropdown(!showingTypeDropdown);
                        }}
                    >
                        Types {activeTypeFilter ? `(${activeTypeFilter})` : ""}
                    </button>
                    {showingTypeDropdown && (
                        <div className="type-dropdown">
                            <div
                                className="type-option"
                                onClick={() => {
                                    setActiveTypeFilter(null);
                                    setShowingTypeDropdown(false);
                                }}
                            >
                                All types
                            </div>
                            {distinctFileTypes.map((type) => (
                                <div
                                    key={type}
                                    className={`type-option ${activeTypeFilter === type ? "active" : ""}`}
                                    onClick={() => {
                                        setActiveTypeFilter(type);
                                        setShowingTypeDropdown(false);
                                    }}
                                >
                                    {getFileIcon(type)} {type}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <UploadFiles dispatch={dispatch} />
            </div>
            {activeTagFilters.length > 0 && (
                <div className="active-filters">
                    <span className="filter-label">Filtered by tags:</span>
                    {activeTagFilters.map((tag) => (
                        <span className="active-filter-tag" key={tag}>
                            {tag}
                            <span
                                className="remove-filter"
                                onClick={() => toggleTagFilter(tag)}
                            >
                                ×
                            </span>
                        </span>
                    ))}
                    <button className="clear-filters" onClick={clearTagFilters}>
                        Clear all
                    </button>
                </div>
            )}
            {state.viewMode === "files" ? (
                <div className="items">
                    {filteredItems.map((item) => (
                        <VaultItemRow
                            key={item.id}
                            item={item}
                            dispatch={dispatch}
                            allTags={allTags}
                            onViewPdf={() => setViewingPdfId(item.id)}
                            onViewImage={() => setViewingImageId(item.id)}
                            onTagClick={toggleTagFilter}
                            activeTagFilters={activeTagFilters}
                            searchHighlight={filenameSearchTerm}
                            tagColors={state.tagColors}
                        />
                    ))}
                </div>
            ) : (
                <Timeline
                    items={filteredItems}
                    dispatch={dispatch}
                    allTags={allTags}
                    tagColors={state.tagColors}
                    collapsedYears={state.timelineCollapsed.years}
                    collapsedMonths={state.timelineCollapsed.months}
                    onViewImage={setViewingImageId}
                />
            )}
            {showingTagManagement && (
                <TagManagement
                    state={state}
                    dispatch={dispatch}
                    onClose={() => setShowingTagManagement(false)}
                />
            )}
        </div>
    );
}

interface VaultItemRowProps {
    item: VaultItem;
    dispatch: (action: VaultAction) => void;
    allTags: string[];
    onViewPdf: () => void;
    onViewImage: () => void;
    onTagClick: (tag: string) => void;
    activeTagFilters: string[];
    searchHighlight: string;
    tagColors: Readonly<Record<string, string>>;
}

// Predefined color palette
const TAG_COLORS = [
    { name: "Red", value: "#c55" },
    { name: "Orange", value: "#d83" },
    { name: "Yellow", value: "#cc6" },
    { name: "Green", value: "#6c6" },
    { name: "Teal", value: "#5aa" },
    { name: "Blue", value: "#68c" },
    { name: "Purple", value: "#a6c" },
    { name: "Pink", value: "#c6a" },
    { name: "Gray", value: "#888" },
    { name: "Default", value: "#446" },
];

// Helper function to determine if text should be light or dark based on background
function getContrastColor(hexColor: string): string {
    // Remove # if present
    const hex = hexColor.replace("#", "");

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return dark text for light backgrounds, light text for dark backgrounds
    return luminance > 0.5 ? "#000" : "#fff";
}

function VaultItemRow({ item, dispatch, allTags, onViewPdf, onViewImage, onTagClick, activeTagFilters, searchHighlight, tagColors }: VaultItemRowProps) {
    const storage = useStorage();
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [addingTag, setAddingTag] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const tagInputRef = useRef<HTMLInputElement>(null);
    const [downloadProgress, setDownloadProgress] = useState<{
        downloaded: number;
        total: number;
    } | null>(null);
    const [showingDeleteConfirm, setShowingDeleteConfirm] = useState(false);
    const [colorPickerTag, setColorPickerTag] = useState<string | null>(null);

    // Close color picker when clicking outside
    useEffect(() => {
        if (colorPickerTag) {
            const handleClick = () => setColorPickerTag(null);
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [colorPickerTag]);

    // Helper function to render filename with search highlighting
    function renderHighlightedName() {
        if (!searchHighlight) {
            return item.name;
        }

        const lowerName = item.name.toLowerCase();
        const lowerSearch = searchHighlight.toLowerCase();
        const index = lowerName.indexOf(lowerSearch);

        if (index === -1) {
            return item.name;
        }

        const before = item.name.substring(0, index);
        const match = item.name.substring(index, index + searchHighlight.length);
        const after = item.name.substring(index + searchHighlight.length);

        return (
            <>
                {before}
                <mark className="search-highlight">{match}</mark>
                {after}
            </>
        );
    }

    async function download() {
        let payload;
        if (storage.loadChunked) {
            setDownloadProgress({ downloaded: 0, total: 1 });
            payload = await storage.loadChunked(item.id, (downloaded, total) => {
                setDownloadProgress({ downloaded, total });
            });
        } else {
            payload = await storage.load(item.id);
        }
        setDownloadProgress(null);

        if (payload.data) {
            const blob = new Blob([payload.data], { type: item.type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = item.name;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    function startRename() {
        setEditName(item.name);
        setEditing(true);
    }

    function commitRename() {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== item.name) {
            dispatch({ type: "ITEM_RENAME", id: item.id, name: trimmed });
        }
        setEditing(false);
    }

    function handleNameKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            commitRename();
        } else if (e.key === "Escape") {
            setEditing(false);
        }
    }

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
    }

    async function deleteFile() {
        try {
            await storage.delete(item.id);
            dispatch({ type: "ITEM_DELETE", id: item.id });
        } catch (error) {
            console.error("Failed to delete file:", error);
            alert(`Failed to delete file: ${error}`);
        } finally {
            setShowingDeleteConfirm(false);
        }
    }

    function handleDeleteKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Escape") {
            setShowingDeleteConfirm(false);
        }
    }

    function handleTagRightClick(e: React.MouseEvent, tag: string) {
        e.preventDefault();
        setColorPickerTag(tag);
    }

    function setTagColor(tag: string, color: string) {
        dispatch({ type: "TAG_SET_COLOR", tag, color });
        setColorPickerTag(null);
    }

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

    const uploadProg = item.uploadProgress;
    const uploadPercent =
        uploadProg && uploadProg.total > 0
            ? Math.round((uploadProg.uploaded / uploadProg.total) * 100)
            : 0;

    const downloadPercent =
        downloadProgress && downloadProgress.total > 0
            ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)
            : 0;

    const uploadStateLabel =
        item.uploadState === "queued"
            ? "Queued"
            : item.uploadState === "uploading"
              ? `Uploading ${uploadPercent}%`
              : null;

    const isDownloading = downloadProgress !== null;

    return (
        <div className={`item ${item.uploadState !== "complete" || isDownloading ? "uploading" : ""}`}>
            {item.uploadState === "uploading" && uploadProg && (
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${uploadPercent}%` }}
                    />
                </div>
            )}
            {isDownloading && (
                <div className="progress-bar download">
                    <div
                        className="progress-fill"
                        style={{ width: `${downloadPercent}%` }}
                    />
                </div>
            )}
            <div className="name-row">
                {editing ? (
                    <input
                        className="name-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={handleNameKeyDown}
                        autoFocus
                    />
                ) : (
                    <span className="name" onClick={startRename}>
                        {renderHighlightedName()}
                    </span>
                )}
            </div>
            <div className="actions">
                {item.type === "application/pdf" && (
                    <button onClick={onViewPdf}>Read</button>
                )}
                {item.type.startsWith("image/") && (
                    <button onClick={onViewImage}>Read</button>
                )}
                <button onClick={download} disabled={isDownloading}>
                    {isDownloading ? `${downloadPercent}%` : "Download"}
                </button>
                <button onClick={startRename}>Rename</button>
                <button onClick={() => setShowingDeleteConfirm(true)}>Delete</button>
            </div>
            <div className="meta">
                {uploadStateLabel && (
                    <span className="upload-state">{uploadStateLabel}</span>
                )}
                <span className="type">{getFileIcon(item.type)} {item.type || "unknown"}</span>
                <span className="added">
                    {new Date(item.added).toLocaleDateString()}
                </span>
                <div className="tags">
                    {item.tags.map((tag) => {
                        const bgColor = tagColors[tag] || "#446";
                        const textColor = getContrastColor(bgColor);
                        return (
                            <span
                                className={`tag ${activeTagFilters.includes(tag) ? "active-filter" : ""}`}
                                key={tag}
                                style={{ background: bgColor, color: textColor }}
                                onContextMenu={(e) => handleTagRightClick(e, tag)}
                            >
                                <span
                                    className="tag-text"
                                    onClick={() => onTagClick(tag)}
                                >
                                    {tag}
                                </span>
                                <span
                                    className="remove-tag"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeTag(tag);
                                    }}
                                >
                                    ×
                                </span>
                                {colorPickerTag === tag && (
                                    <div className="color-picker-dropdown">
                                        {TAG_COLORS.map((color) => (
                                            <div
                                                key={color.value}
                                                className="color-option"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTagColor(tag, color.value);
                                                }}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                <span
                                                    className="color-swatch"
                                                    style={{ background: color.value }}
                                                />
                                                <span className="color-name">{color.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
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
            {showingDeleteConfirm && (
                <div className="delete-confirm-overlay" onClick={() => setShowingDeleteConfirm(false)}>
                    <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleDeleteKeyDown}>
                        <h3>Delete {item.name}?</h3>
                        <p>This action cannot be undone. The file will be permanently removed from storage.</p>
                        <div className="delete-confirm-buttons">
                            <button onClick={() => setShowingDeleteConfirm(false)}>Cancel</button>
                            <button className="delete-btn" onClick={deleteFile}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
