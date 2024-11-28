import React, { useState } from "react";
import { chain as _ } from "underscore";

export interface AssignCategoryProps {
    categories: readonly string[];
    setCategory(category: string): void;
}

export function AssignCategory({
    categories,
    setCategory,
}: AssignCategoryProps) {
    const [newCategory, setNewCategory] = useState("");

    const sorted = categories.slice().sort();

    const canAddNew = !!newCategory.trim();

    function addNew(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        e.stopPropagation();
        setCategory(newCategory.trim().toLocaleLowerCase());
        setNewCategory("");
    }

    return (
        <div className="categories">
            {sorted.map(x => (
                <div
                    key={x}
                    className="category"
                    onClick={() => setCategory(x)}>
                    {x}
                </div>
            ))}
            <form onSubmit={addNew}>
                <input
                    autoFocus={true}
                    value={newCategory}
                    onChange={x => setNewCategory(x.target.value)}
                />
                <button disabled={!canAddNew}>Add</button>
            </form>
        </div>
    );
}
