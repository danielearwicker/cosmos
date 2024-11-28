import { createContext, useState } from "react";
import { today } from "./data";

export interface EditingDay {
    value: string;
    onChange(day: string): void;
}

export const EditingDay = createContext<EditingDay>({
    value: today(),
    onChange() {},
});

export function useEditingDayProvider(): EditingDay {
    const [value, onChange] = useState(today());
    return { value, onChange };
}
