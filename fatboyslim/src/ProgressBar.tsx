import { memo } from "react";
import { type Comestible, formatNumber } from "./data";

type DailyLimitPeriod = {
    limit: number;
    startDate: string;
};

export const dailyLimitPeriods: DailyLimitPeriod[] = [
    { startDate: "2024-10-10", limit: 2050 },
    { startDate: "2024-04-29", limit: 2100 },
    { startDate: "2023-08-07", limit: 2200 },
    { startDate: "2023-02-12", limit: 2000 },
    { startDate: "2022-12-10", limit: 1900 },
    { startDate: "2022-08-10", limit: 1800 },
];

export function getDailyLimit(day: string) {
    for (const p of dailyLimitPeriods) {
        if (day >= p.startDate) {
            return p.limit;
        }
    }

    return 5000;
}

export interface ProgressBarProps {
    total: number;
    dailyLimit: number;
}

export function alreadyPlanned(
    ate: { comestible: Comestible; quantity: number }[]
) {
    return ate
        .map((a) => a.comestible.calories * a.quantity)
        .reduce((l, r) => l + r, 0);
}

export const ProgressBar = memo(({ total, dailyLimit }: ProgressBarProps) => {
    const progress = (100 * total) / dailyLimit;

    return total > dailyLimit ? (
        <h2 className="over-the-limit">
            You are {Math.round(total - dailyLimit)} (
            {Math.round(progress - 100)}%) over your limit!
        </h2>
    ) : (
        <div className="calorie-bar">
            <div className="progress" style={{ width: `${progress}%` }} />
            <div className="ate">{formatNumber(total)}</div>
            <div className="remaining">{formatNumber(dailyLimit - total)}</div>
        </div>
    );
});
