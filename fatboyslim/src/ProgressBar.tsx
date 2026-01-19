import { memo } from "react";
import { neatNumber } from "./MealContents";

type DailyLimitPeriod = {
    calories: number;
    satch: number;
    sugar: number;
    startDate: string;
};

export const dailyLimitPeriods: DailyLimitPeriod[] = [
    { startDate: "2025-08-15", calories: 2210, satch: 26, sugar: 60 },
    { startDate: "2025-07-14", calories: 2075, satch: 26, sugar: 60 },
    { startDate: "2024-12-12", calories: 2050, satch: 26, sugar: 60 },
    { startDate: "2024-10-10", calories: 2050, satch: 50, sugar: 80 },
    { startDate: "2024-04-29", calories: 2100, satch: 50, sugar: 80 },
    { startDate: "2023-08-07", calories: 2200, satch: 50, sugar: 80 },
    { startDate: "2023-02-12", calories: 2000, satch: 50, sugar: 80 },
    { startDate: "2022-12-10", calories: 1900, satch: 50, sugar: 80 },
    { startDate: "2022-08-10", calories: 1800, satch: 50, sugar: 80 },
];

export function getDailyLimit(day: string) {
    for (const p of dailyLimitPeriods) {
        if (day >= p.startDate) {
            return p;
        }
    }

    return { calories: 5000, satch: 100, sugar: 100 };
}

export interface ProgressBarProps {
    total: number;
    dailyLimit: number;
    icon: string;
}

export const ProgressBar = memo(
    ({ total, dailyLimit, icon }: ProgressBarProps) => {
        const progress = (100 * Math.min(total, dailyLimit)) / dailyLimit;
        const over = total > dailyLimit ? "over" : "";

        return (
            <div className="calorie-bar">
                <div
                    className={`progress ${over}`}
                    style={{ width: `${progress}%` }}
                />
                <div className="ate">
                    <span className="icon">{icon}</span> {neatNumber(total)}
                </div>
                <div className="remaining">
                    {total > dailyLimit
                        ? `over by ${neatNumber(total - dailyLimit)}`
                        : neatNumber(dailyLimit - total)}
                </div>
            </div>
        );
    }
);
