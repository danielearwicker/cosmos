export interface SelectProps<T extends string> {
    options: readonly T[];
    value: T;
    onChange(value: T): void;
}

export function Select<T extends string>({
    options,
    value,
    onChange,
}: SelectProps<T>) {
    return (
        <select value={value} onChange={e => onChange(e.target.value as T)}>
            {options.map(o => (
                <option key={o}>{o}</option>
            ))}
        </select>
    );
}
