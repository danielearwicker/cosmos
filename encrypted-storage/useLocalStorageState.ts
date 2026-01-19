import { useState } from "react";

export function useLocalStorageState(
    name: string,
    defaultValue = "",
    disable?: boolean
) {
    const [val, setVal] = useState(localStorage.getItem(name) ?? defaultValue);

    function setValAndStore(update: React.SetStateAction<string>) {
        setVal(oldVal => {
            const newVal =
                typeof update === "function" ? update(oldVal) : update;
            if (!disable) {
                localStorage.setItem(name, newVal);
            } else {
                localStorage.removeItem(name);
            }
            return newVal;
        });
    }

    return [val, setValAndStore] as const;
}
