import { useEffect, useRef } from "react";

export interface CheckboxProps {
    checked: boolean | undefined;
    onChange(checked: boolean): void;
}

export function CheckBox({ checked, onChange }: CheckboxProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = checked === undefined;
        }
    }, [inputRef.current, checked]);

    return (
        <input
            type="checkbox"
            ref={inputRef}
            checked={checked ?? false}
            onChange={e => onChange(e.target.checked)}
        />
    );
}
