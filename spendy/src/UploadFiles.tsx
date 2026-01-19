import React, { useState } from "react";
import type { SpendyAction } from "./reducer";
import { Select } from "./inputComponents/Select";

export const uploadTypes = [
    "hsbc",
    "categories",
    "category-assignments",
] as const;

export type UploadType = (typeof uploadTypes)[number];

export interface UploadFilesProps {
    dispatch: (action: SpendyAction) => void;
}

export function UploadFiles({ dispatch }: UploadFilesProps) {
    const [uploadType, setUploadType] = useState<UploadType>("hsbc");

    async function addFiles(ev: React.ChangeEvent<HTMLInputElement>) {
        if (ev.target.files) {
            for (const file of Array.from(ev.target.files)) {
                dispatch({
                    type:
                        uploadType === "hsbc"
                            ? "ADD_BANK_STATEMENT"
                            : uploadType == "categories"
                            ? "ADD_CATEGORIES"
                            : "ADD_TRANSACTION_CATEGORIES",
                    text: await file.text(),
                });
            }
        }
    }

    return (
        <div className="uploads">
            <Select<UploadType>
                value={uploadType}
                onChange={setUploadType}
                options={uploadTypes}
            />
            <input type="file" onChange={addFiles} multiple={true} />
        </div>
    );
}
