import { memo } from "react";
import { addDays, today } from "./data";

export interface DatePickerProps {
    value: string;
    onChange(day: string): void;
}

export const DatePicker = memo(({ value, onChange }: DatePickerProps) => {
    return (
        <div className="date-picker">
            <button onClick={() => onChange(addDays(value, -1))}>↞</button>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <button onClick={() => onChange(today())}>today</button>
            <button onClick={() => onChange(addDays(value, 1))}>↠</button>
        </div>
    );
});
