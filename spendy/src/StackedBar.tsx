import { chain as _ } from "underscore";
import { useEffect, useRef, useState } from "react";

interface MeasuredContainerProps {
    className?: string;
    children: (width: number, height: number) => React.ReactNode;
}

function MeasuredContainer({ children, className }: MeasuredContainerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });

    useEffect(() => {
        let quit = false;

        setInterval(() => {
            const width = ref.current?.clientWidth ?? 0,
                height = ref.current?.clientHeight ?? 0;

            if (size.width !== width || size.height !== height) {
                setSize({ width, height });
            }
        }, 100);

        return () => {
            quit = true;
        };
    });

    return (
        <div ref={ref} className={className} style={{ position: "relative" }}>
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    overflow: "hidden",
                }}
            >
                {children(size.width, size.height)}
            </div>
        </div>
    );
}

export interface StackedBarProps {
    source: {
        bar: string;
        segment: string;
        value: number;
    }[];
    //segments?: string[];
    sort?: "bar" | "value";
    highlight?: { bar: string; segment?: string };
    format?(value: number): string;
    colour?(segment: string): string;
    onClick?(bar: string, segment?: string): void;
}

export function StackedBar({
    source,
    sort,
    highlight,
    format,
    colour,
    onClick,
}: StackedBarProps) {
    const effectiveFormat = format ?? ((x) => `${x}`);

    const bars: Record<string, { segments: Record<string, number> }> = {};

    for (const s of source) {
        if (!bars[s.bar]) {
            bars[s.bar] = { segments: {} };
        }
        bars[s.bar].segments[s.segment] =
            (bars[s.bar].segments[s.segment] ?? 0) + s.value;
    }

    const barArray = Object.entries(bars).map(([bar, { segments }]) => {
        const sortedSegments = _(Object.entries(segments))
            .map(([segment, value]) => ({ segment, value }))
            .sortBy((s) => s.segment)
            .value();

        let runningTotal = 0;

        const segmentsWithRunningTotal = sortedSegments.map((seg, index) => {
            const from = runningTotal;
            runningTotal += seg.value;
            return { ...seg, from };
        });

        return {
            bar,
            total: runningTotal,
            segments: segmentsWithRunningTotal,
        };
    });

    const maxTotal = Math.max(...barArray.map((b) => b.total));

    if (sort === "bar") {
        barArray.sort((l, r) => l.bar.localeCompare(r.bar));
    } else {
        barArray.sort((l, r) => r.total - l.total);
    }

    return (
        <MeasuredContainer className="stat-box">
            {(width, height) => (
                <svg width={width} height={height}>
                    {barArray.map((bar, barIndex) => (
                        <g
                            key={bar.bar}
                            transform={`translate(0, ${barIndex * 20})`}
                        >
                            <text x={5} y={15} fontSize={12}>
                                {bar.bar}
                            </text>
                            {bar.segments.map((segment) => (
                                <rect
                                    key={segment.segment}
                                    x={
                                        100 +
                                        (segment.from / maxTotal) *
                                            (width - 150)
                                    }
                                    y={0}
                                    width={
                                        (segment.value / maxTotal) *
                                        (width - 150)
                                    }
                                    height={18}
                                    fill={colour?.(segment.segment) ?? "gray"}
                                    onClick={() =>
                                        onClick?.(bar.bar, segment.segment)
                                    }
                                />
                            ))}
                        </g>
                    ))}
                </svg>
            )}
        </MeasuredContainer>
    );
}
