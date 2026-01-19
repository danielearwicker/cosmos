import { useState } from "react";
import { normalizeCategory } from "./reducer";
import { chain as _ } from "underscore";

export interface RenameCategory {
    category: string;
    rename(renamed: string): void;
}

export function RenameCategory({ category, rename }: RenameCategory) {
    const [expanded, setExpanded] = useState(false);
    const [renamed, setRenamed] = useState(category);

    const normalized = normalizeCategory(renamed);

    function expand() {
        setRenamed(category);
        setExpanded(true);
    }

    const canSave = normalized && normalized !== category;

    function collapse() {
        setExpanded(false);
    }

    function save() {
        rename(normalized);
        collapse();
    }

    return !expanded ? (
        <a onClick={expand} className="rename">
            Rename
        </a>
    ) : (
        <div className="rename-category">
            <input
                autoFocus={true}
                value={renamed}
                onChange={e => setRenamed(e.target.value)}
            />
            <button onClick={save} disabled={!canSave}>
                Save
            </button>
            <button onClick={collapse}>Cancel</button>
        </div>
    );
}
