import { createContext, useCallback, useState } from "react";
import { today } from "./data";

export const tabs = [
    "meals",
    "stats",
    "comestibles",
    "body",
    "notes",
    "pills",
] as const;
export type Tab = (typeof tabs)[number];

export interface EditingDay {
    value: string;
    onChange(day: string, tab?: Tab): void;
}

export const EditingDay = createContext<EditingDay>({
    value: today(),
    onChange() {},
});

export function useEditingDayProvider(showTab: (tab: Tab) => void): EditingDay {
    const [value, setValue] = useState(today());

    const onChange = useCallback(
        (v: string, t?: Tab) => {
            setValue(v);
            if (t) {
                showTab(t);
            }
        },
        [showTab]
    );

    return { value, onChange };
}
