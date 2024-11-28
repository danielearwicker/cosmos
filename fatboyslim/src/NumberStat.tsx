import { formatNumber } from "./data";
import { chain as _ } from "underscore";

export interface NumberStatProps {
    value: number;
    label: string;
}

export function NumberStat({ value, label }: NumberStatProps) {
    return (
        <div className="number-stat">
            <div className="big-number">{formatNumber(value)}</div>
            <div className="little-label">{label}</div>
        </div>
    );
}
