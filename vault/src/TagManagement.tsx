import { useMemo, useState } from "react";
import type { VaultAction, VaultState } from "./reducer";

interface TagManagementProps {
    state: VaultState;
    dispatch: (action: VaultAction) => void;
    onClose: () => void;
}

interface TagInfo {
    tag: string;
    count: number;
    fileIds: string[];
}

type ConfirmationDialog =
    | { type: "none" }
    | { type: "delete"; tag: string; affectedFiles: string[] }
    | { type: "merge"; sourceTag: string; targetTag: string; affectedFiles: string[] };

// Predefined color palette (same as in Vault.tsx)
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
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000" : "#fff";
}

export function TagManagement({ state, dispatch, onClose }: TagManagementProps) {
    const [renameTag, setRenameTag] = useState<string | null>(null);
    const [renameInput, setRenameInput] = useState("");
    const [mergeSourceTag, setMergeSourceTag] = useState<string | null>(null);
    const [mergeTargetInput, setMergeTargetInput] = useState("");
    const [confirmation, setConfirmation] = useState<ConfirmationDialog>({ type: "none" });
    const [colorPickerTag, setColorPickerTag] = useState<string | null>(null);
    const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

    const tagStats = useMemo(() => {
        const tagMap = new Map<string, TagInfo>();

        for (const item of state.items) {
            for (const tag of item.tags) {
                const existing = tagMap.get(tag);
                if (existing) {
                    existing.count++;
                    existing.fileIds.push(item.id);
                } else {
                    tagMap.set(tag, {
                        tag,
                        count: 1,
                        fileIds: [item.id],
                    });
                }
            }
        }

        return Array.from(tagMap.values()).sort((a, b) => a.tag.localeCompare(b.tag));
    }, [state.items]);

    // Build hierarchical structure
    interface HierarchicalTag {
        tag: string;
        info: TagInfo | null;  // null for virtual parent nodes
        children: HierarchicalTag[];
        isParent: boolean;
    }

    const hierarchicalTags = useMemo(() => {
        const result: HierarchicalTag[] = [];
        const parentMap = new Map<string, HierarchicalTag>();

        // First pass: identify all parent tags and create nodes
        for (const info of tagStats) {
            const parts = info.tag.split("/");

            if (parts.length === 1) {
                // Root tag
                const hasChildren = tagStats.some(other =>
                    other.tag.startsWith(info.tag + "/")
                );
                result.push({
                    tag: info.tag,
                    info,
                    children: [],
                    isParent: hasChildren,
                });
                parentMap.set(info.tag, result[result.length - 1]);
            } else {
                // Child tag - create parent nodes if needed
                let currentPath = "";
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    currentPath = currentPath ? `${currentPath}/${part}` : part;

                    if (!parentMap.has(currentPath)) {
                        // Create virtual parent node
                        const existingInfo = tagStats.find(t => t.tag === currentPath);
                        const node: HierarchicalTag = {
                            tag: currentPath,
                            info: existingInfo || null,
                            children: [],
                            isParent: true,
                        };

                        // Add to appropriate parent or root
                        const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
                        if (parentPath && parentMap.has(parentPath)) {
                            parentMap.get(parentPath)!.children.push(node);
                        } else {
                            result.push(node);
                        }
                        parentMap.set(currentPath, node);
                    }
                }

                // Add the actual child tag
                const parentPath = parts.slice(0, -1).join("/");
                const childNode: HierarchicalTag = {
                    tag: info.tag,
                    info,
                    children: [],
                    isParent: false,
                };

                if (parentMap.has(parentPath)) {
                    parentMap.get(parentPath)!.children.push(childNode);
                } else {
                    result.push(childNode);
                }
            }
        }

        return result;
    }, [tagStats]);

    function startRename(tag: string) {
        setRenameTag(tag);
        setRenameInput(tag);
        setMergeSourceTag(null);
    }

    function cancelRename() {
        setRenameTag(null);
        setRenameInput("");
    }

    function commitRename() {
        if (!renameTag) return;
        const newTag = renameInput.toLowerCase().trim();
        if (newTag && newTag !== renameTag) {
            dispatch({ type: "TAG_RENAME_GLOBAL", oldTag: renameTag, newTag });
        }
        cancelRename();
    }

    function handleRenameKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            commitRename();
        } else if (e.key === "Escape") {
            cancelRename();
        }
    }

    function startDelete(tag: string) {
        const info = tagStats.find((t) => t.tag === tag);
        if (!info) return;

        const affectedFileNames = info.fileIds
            .map((id) => state.items.find((item) => item.id === id)?.name)
            .filter((name): name is string => !!name);

        setConfirmation({
            type: "delete",
            tag,
            affectedFiles: affectedFileNames,
        });
    }

    function confirmDelete() {
        if (confirmation.type !== "delete") return;
        dispatch({ type: "TAG_DELETE_GLOBAL", tag: confirmation.tag });
        setConfirmation({ type: "none" });
    }

    function startMerge(tag: string) {
        setMergeSourceTag(tag);
        setMergeTargetInput("");
        setRenameTag(null);
    }

    function cancelMerge() {
        setMergeSourceTag(null);
        setMergeTargetInput("");
    }

    function commitMerge() {
        if (!mergeSourceTag) return;
        const targetTag = mergeTargetInput.toLowerCase().trim();
        if (!targetTag || targetTag === mergeSourceTag) {
            cancelMerge();
            return;
        }

        const sourceInfo = tagStats.find((t) => t.tag === mergeSourceTag);
        if (!sourceInfo) return;

        const affectedFileNames = sourceInfo.fileIds
            .map((id) => state.items.find((item) => item.id === id)?.name)
            .filter((name): name is string => !!name);

        setConfirmation({
            type: "merge",
            sourceTag: mergeSourceTag,
            targetTag,
            affectedFiles: affectedFileNames,
        });
    }

    function confirmMerge() {
        if (confirmation.type !== "merge") return;
        dispatch({
            type: "TAG_MERGE_GLOBAL",
            sourceTag: confirmation.sourceTag,
            targetTag: confirmation.targetTag,
        });
        setConfirmation({ type: "none" });
        cancelMerge();
    }

    function handleMergeKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            commitMerge();
        } else if (e.key === "Escape") {
            cancelMerge();
        }
    }

    const availableMergeTags = useMemo(() => {
        if (!mergeSourceTag) return [];
        const term = mergeTargetInput.toLowerCase().trim();
        return tagStats
            .filter((t) => t.tag !== mergeSourceTag && (!term || t.tag.includes(term)))
            .map((t) => t.tag);
    }, [mergeSourceTag, mergeTargetInput, tagStats]);

    const showCreateMergeOption =
        mergeTargetInput.trim() &&
        !availableMergeTags.includes(mergeTargetInput.toLowerCase().trim());

    function setTagColor(tag: string, color: string) {
        dispatch({ type: "TAG_SET_COLOR", tag, color });
        setColorPickerTag(null);
    }

    function toggleCollapse(tag: string) {
        setCollapsedParents((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) {
                next.delete(tag);
            } else {
                next.add(tag);
            }
            return next;
        });
    }

    function renderHierarchicalTag(node: HierarchicalTag, depth: number = 0): JSX.Element | null {
        const info = node.info;
        const isCollapsed = collapsedParents.has(node.tag);
        const indent = depth * 1.5;

        return (
            <div key={node.tag}>
                <div className="tag-row" style={{ paddingLeft: `${indent}rem` }}>
                    <div className="tag-info">
                        {node.isParent && (
                            <button
                                className="collapse-btn"
                                onClick={() => toggleCollapse(node.tag)}
                            >
                                {isCollapsed ? "▸" : "▾"}
                            </button>
                        )}
                        {renameTag === node.tag ? (
                            <input
                                className="tag-rename-input"
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={handleRenameKeyDown}
                                autoFocus
                            />
                        ) : (
                            <>
                                <span
                                    className="tag-name tag-chip"
                                    style={{
                                        background: state.tagColors[node.tag] || "#446",
                                        color: getContrastColor(
                                            state.tagColors[node.tag] || "#446"
                                        ),
                                    }}
                                >
                                    {node.tag}
                                </span>
                                {info && (
                                    <button
                                        className="color-picker-btn"
                                        onClick={() =>
                                            setColorPickerTag(
                                                colorPickerTag === node.tag ? null : node.tag
                                            )
                                        }
                                    >
                                        🎨
                                    </button>
                                )}
                            </>
                        )}
                        {info && (
                            <span className="tag-count">
                                {info.count} {info.count === 1 ? "file" : "files"}
                            </span>
                        )}
                        {!info && (
                            <span className="tag-count virtual">(virtual parent)</span>
                        )}
                    </div>
                    {colorPickerTag === node.tag && (
                        <div className="tag-color-picker">
                            {TAG_COLORS.map((color) => (
                                <div
                                    key={color.value}
                                    className="color-option"
                                    onClick={() => setTagColor(node.tag, color.value)}
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
                    {info && (
                        <div className="tag-actions">
                            <button onClick={() => startRename(node.tag)}>Rename</button>
                            <button onClick={() => startMerge(node.tag)}>Merge</button>
                            <button
                                className="delete-tag-btn"
                                onClick={() => startDelete(node.tag)}
                            >
                                Delete
                            </button>
                        </div>
                    )}
                    {mergeSourceTag === node.tag && info && (
                        <div className="merge-input-row">
                            <span className="merge-label">Merge into:</span>
                            <div className="merge-input-container">
                                <input
                                    className="merge-target-input"
                                    value={mergeTargetInput}
                                    onChange={(e) => setMergeTargetInput(e.target.value)}
                                    onKeyDown={handleMergeKeyDown}
                                    placeholder="Target tag..."
                                    autoFocus
                                />
                                {(availableMergeTags.length > 0 || showCreateMergeOption) && (
                                    <div className="merge-suggestions">
                                        {availableMergeTags.map((tag) => (
                                            <div
                                                key={tag}
                                                className="merge-suggestion"
                                                onClick={() => setMergeTargetInput(tag)}
                                            >
                                                {tag}
                                            </div>
                                        ))}
                                        {showCreateMergeOption && (
                                            <div
                                                className="merge-suggestion create"
                                                onClick={() =>
                                                    setMergeTargetInput(
                                                        mergeTargetInput.toLowerCase().trim()
                                                    )
                                                }
                                            >
                                                Create "{mergeTargetInput.toLowerCase().trim()}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button onClick={commitMerge}>Merge</button>
                            <button onClick={cancelMerge}>Cancel</button>
                        </div>
                    )}
                </div>
                {!isCollapsed && node.children.map((child) => renderHierarchicalTag(child, depth + 1))}
            </div>
        );
    }

    return (
        <div className="tag-management-overlay" onClick={onClose}>
            <div className="tag-management-panel" onClick={(e) => e.stopPropagation()}>
                <div className="tag-management-header">
                    <h2>Manage Tags</h2>
                    <button className="close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="tag-management-body">
                    {tagStats.length === 0 ? (
                        <div className="no-tags">No tags in vault</div>
                    ) : (
                        <div className="tag-list">
                            {hierarchicalTags.map((node) => renderHierarchicalTag(node))}
                        </div>
                    )}
                </div>

                {confirmation.type !== "none" && (
                    <div
                        className="confirmation-overlay"
                        onClick={() => setConfirmation({ type: "none" })}
                    >
                        <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
                            {confirmation.type === "delete" && (
                                <>
                                    <h3>Delete tag "{confirmation.tag}"?</h3>
                                    <p>
                                        This will remove the tag from {confirmation.affectedFiles.length}{" "}
                                        {confirmation.affectedFiles.length === 1 ? "file" : "files"}:
                                    </p>
                                    <ul className="affected-files">
                                        {confirmation.affectedFiles.slice(0, 10).map((name, i) => (
                                            <li key={i}>{name}</li>
                                        ))}
                                        {confirmation.affectedFiles.length > 10 && (
                                            <li>
                                                ... and {confirmation.affectedFiles.length - 10} more
                                            </li>
                                        )}
                                    </ul>
                                    <div className="confirmation-buttons">
                                        <button onClick={() => setConfirmation({ type: "none" })}>
                                            Cancel
                                        </button>
                                        <button className="confirm-delete-btn" onClick={confirmDelete}>
                                            Delete Tag
                                        </button>
                                    </div>
                                </>
                            )}
                            {confirmation.type === "merge" && (
                                <>
                                    <h3>
                                        Merge "{confirmation.sourceTag}" into "{confirmation.targetTag}"?
                                    </h3>
                                    <p>
                                        This will replace "{confirmation.sourceTag}" with "
                                        {confirmation.targetTag}" on {confirmation.affectedFiles.length}{" "}
                                        {confirmation.affectedFiles.length === 1 ? "file" : "files"}:
                                    </p>
                                    <ul className="affected-files">
                                        {confirmation.affectedFiles.slice(0, 10).map((name, i) => (
                                            <li key={i}>{name}</li>
                                        ))}
                                        {confirmation.affectedFiles.length > 10 && (
                                            <li>
                                                ... and {confirmation.affectedFiles.length - 10} more
                                            </li>
                                        )}
                                    </ul>
                                    <div className="confirmation-buttons">
                                        <button onClick={() => setConfirmation({ type: "none" })}>
                                            Cancel
                                        </button>
                                        <button className="confirm-merge-btn" onClick={confirmMerge}>
                                            Merge Tags
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
