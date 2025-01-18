import { formatNumber, sum } from "./data";
import { chain as _ } from "underscore";
import { useState } from "react";
import { neatNumber } from "./MealContents";

export interface StackedBarProps {
    title?: string;
    source: {
        bar: string;
        segment: string;
        value: number;
        date?: string;
    }[];
    segments?: string[];
    sort?: "bar" | "value";
    limit?(bar: string): number;
    onClick?(bar: string): void;
}

// Ripped from react-viz
const segmentColours = [
    "#12939A",
    "#79C7E3",

    "#1E96BE",
    "#FF9833",
    "#EF5D28",
    "#19CDD7",
    "#DDB27C",
    "#88572C",
    "#FF991F",
    "#F15C17",
    "#223F9A",
    "#DA70BF",
    "#125C77",
    "#4DC19C",
    "#776E57",
    "#12939A",
    "#17B8BE",
    "#F6D18A",
    "#B7885E",
    "#FFCB99",
    "#F89570",
    "#829AE3",
    "#E79FD5",
    "#1A3177",
    "#89DAC1",
    "#B3AD9E",
];

function cellKey(bar: string, segment: string) {
    return `${bar}-${segment}`;
}

export function StackedBar({
    title,
    source,
    segments,
    sort,
    limit,
    onClick,
}: React.PropsWithChildren<StackedBarProps>) {
    segments ??= _(source)
        .filter((x) => x.value > 0)
        .map((x) => x.segment)
        .unique()
        .value();

    const bars =
        sort === "bar"
            ? _(source)
                  .map((s) => s.bar)
                  .unique()
                  .sortBy()
                  .reverse()
                  .value()
            : _(source)
                  .groupBy((s) => s.bar)
                  .pairs()
                  .map(([bar, group]) => ({
                      bar,
                      total: sum(group.map((s) => s.value)),
                  }))
                  .filter((x) => x.total > 0)
                  .sortBy((x) => x.total)
                  .map((x) => x.bar)
                  .value();

    const cells = _(source)
        .groupBy((s) => cellKey(s.bar, s.segment))
        .mapObject((g) => {
            const dayCount =
                _(g)
                    .map((x) => x.date)
                    .unique()
                    .value().length ?? 1;

            return sum(g.map((s) => s.value)) / dayCount;
        })
        .value();

    const [hint, setHint] = useState<{
        index: number;
        bar: string;
        segment: string;
        value: number;
    }>();

    const totals = bars.map((b) =>
        sum(segments.map((s) => cells[cellKey(b, s)] ?? 0))
    );

    const maxBar = totals.reduce((l, r) => Math.max(l, r), 0);

    return (
        <div className="stat-box">
            {title && <h3>{title}</h3>}
            <div className="stacked-bar-chart" style={{ gridAutoRows: "auto" }}>
                {bars.map((bar, barIndex) => (
                    <>
                        <div
                            style={{ gridRow: barIndex + 1 }}
                            className="label"
                            onClick={() => onClick?.(bar)}
                        >
                            {bar}
                        </div>
                        <div style={{ gridRow: barIndex + 1 }} className="bar">
                            {segments.map((segment, s) => (
                                <div
                                    className="segment"
                                    style={{
                                        backgroundColor:
                                            segmentColours[
                                                s % segmentColours.length
                                            ],
                                        width: `${
                                            (100 *
                                                (cells[cellKey(bar, segment)] ??
                                                    0)) /
                                            maxBar
                                        }%`,
                                    }}
                                />
                            ))}

                            {limit && (
                                <div
                                    className="limit"
                                    style={{
                                        left: `${(100 * limit(bar)) / maxBar}%`,
                                    }}
                                />
                            )}
                        </div>
                        <div
                            style={{ gridRow: barIndex + 1 }}
                            className="amount"
                        >
                            {neatNumber(totals[barIndex])}
                        </div>
                    </>
                ))}
            </div>
        </div>
    );
}
