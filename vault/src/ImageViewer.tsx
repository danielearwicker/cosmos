import { useEffect, useRef, useState, useMemo } from "react";
import { useStorage } from "../../encrypted-storage/Storage";
import type { VaultItem, VaultAction } from "./reducer";

// Helper function to determine if text should be light or dark based on background
function getContrastColor(hexColor: string): string {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000" : "#fff";
}

export interface ImageViewerProps {
    item: VaultItem;
    dispatch: (action: VaultAction) => void;
    onClose: () => void;
    allTags: string[];
    tagColors: Readonly<Record<string, string>>;
}

export function ImageViewer({
    item,
    dispatch,
    onClose,
    allTags,
    tagColors,
}: ImageViewerProps) {
    const storage = useStorage();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addingTag, setAddingTag] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [loadProgress, setLoadProgress] = useState<{
        downloaded: number;
        total: number;
    } | null>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);

    console.log("Properties:", item.properties);

    // Check if the item has location data
    const hasLocation =
        item.properties?.latitude !== undefined &&
        item.properties?.longitude !== undefined;
    const mapUrl = hasLocation
        ? `https://www.openstreetmap.org/?mlat=${item.properties.latitude}&mlon=${item.properties.longitude}#map=15/${item.properties.latitude}/${item.properties.longitude}`
        : null;

    function openMap() {
        if (mapUrl) {
            window.open(mapUrl, "_blank", "noopener,noreferrer");
        }
    }

    // Load the image
    useEffect(() => {
        let cancelled = false;
        let url: string | null = null;

        async function loadImage() {
            try {
                setLoading(true);
                setError(null);

                let payload;
                if (storage.loadChunked) {
                    setLoadProgress({ downloaded: 0, total: 1 });
                    payload = await storage.loadChunked(
                        item.id,
                        (downloaded, total) => {
                            setLoadProgress({ downloaded, total });
                        }
                    );
                    setLoadProgress(null);
                } else {
                    payload = await storage.load(item.id);
                }

                if (cancelled) return;

                if (payload.data) {
                    const blob = new Blob([payload.data], { type: item.type });
                    url = URL.createObjectURL(blob);
                    setImageUrl(url);
                    setLoading(false);
                } else {
                    setError("No image data found");
                    setLoading(false);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                    setLoading(false);
                }
            }
        }

        loadImage();

        return () => {
            cancelled = true;
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [item.id, item.type, storage]);

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
            if (e.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (error) {
        return (
            <div className="image-viewer">
                <div className="image-toolbar">
                    <button onClick={onClose}>Close</button>
                    <span className="image-title">{item.name}</span>
                </div>
                <div className="image-error">Error loading image: {error}</div>
            </div>
        );
    }

    if (loading) {
        const progressText = loadProgress
            ? `Loading image... ${Math.round(
                  (loadProgress.downloaded / loadProgress.total) * 100
              )}%`
            : "Loading image...";

        return (
            <div className="image-viewer">
                <div className="image-toolbar">
                    <button onClick={onClose}>Close</button>
                    <span className="image-title">{item.name}</span>
                </div>
                <div className="image-loading">
                    <div className="image-loading-text">{progressText}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="image-viewer">
            <div className="image-toolbar">
                <button onClick={onClose}>Close</button>
                <span className="image-title">{item.name}</span>
                {hasLocation && (
                    <button onClick={openMap}>
                        View Location
                    </button>
                )}
            </div>
            <div className="image-container">
                <div className="image-wrapper">
                    {imageUrl && <img src={imageUrl} alt={item.name} />}
                </div>
            </div>
            <div className="image-tag-bar">
                <div className="tags">
                    {item.tags.map((tag) => {
                        const bgColor = tagColors[tag] || "#446";
                        const textColor = getContrastColor(bgColor);
                        return (
                            <span
                                className="tag"
                                key={tag}
                                style={{
                                    background: bgColor,
                                    color: textColor,
                                }}
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
                                    onChange={(e) =>
                                        setTagInput(e.target.value)
                                    }
                                    onKeyDown={handleTagKeyDown}
                                    onBlur={() =>
                                        setTimeout(
                                            () => setAddingTag(false),
                                            150
                                        )
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
                                            addTag(
                                                tagInput.toLowerCase().trim()
                                            )
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
