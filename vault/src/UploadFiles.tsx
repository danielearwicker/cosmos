import React from "react";
import type { VaultAction } from "./reducer";

export interface UploadFilesProps {
    dispatch: (action: VaultAction) => void;
}

export function UploadFiles({ dispatch }: UploadFilesProps) {
    async function addFiles(ev: React.ChangeEvent<HTMLInputElement>) {
        if (ev.target.files) {
            for (const file of Array.from(ev.target.files)) {
                dispatch({
                    type: "ITEM_ADD",
                    item: {
                        id: crypto.randomUUID(),
                        name: file.name,
                        type: file.type,
                        added: new Date().toISOString(),
                        tags: ["new"],
                    },
                });
            }
        }
    }

    return <input type="file" onChange={addFiles} multiple={true} />;
}
