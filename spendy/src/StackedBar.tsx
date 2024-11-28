import {
    Hint,
    HorizontalBarSeries,
    type HorizontalBarSeriesPoint,
    VerticalGridLines,
    XAxis,
    XYPlot,
    YAxis,
} from "react-vis";
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
    segments?: string[];
    sort?: "bar" | "value";
    highlight?: { bar: string; segment?: string };
    format?(value: number): string;
    colour?(segment: string): string;
    onClick?(bar: string, segment?: string): void;
}

export function StackedBar({
    source,
    segments,
    sort,
    highlight,
    format,
    colour,
    onClick,
}: StackedBarProps) {
    const effectiveFormat = format ?? ((x) => `${x}`);

    const effectiveSegments =
        segments ??
        _(source)
            .map((x) => x.segment)
            .unique()
            .value();

    const bars =
        sort === "bar"
            ? _(source)
                  .map((s) => s.bar)
                  .unique()
                  .sort()
                  .value()
            : _(source)
                  .groupBy((s) => s.bar)
                  .pairs()
                  .map(([bar, group]) => ({
                      bar,
                      total: group
                          .map((s) => s.value)
                          .reduce((l, r) => l + r, 0),
                  }))
                  .sortBy((x) => x.total)
                  .map((x) => x.bar)
                  .value();

    const cells = _(source)
        .groupBy((s) => `${s.bar}-${s.segment}`)
        .mapObject((g) => g.map((s) => s.value).reduce((l, r) => l + r, 0))
        .value();

    const [hint, setHint] = useState<{
        point: HorizontalBarSeriesPoint;
        bar: string;
        segment: string;
        value: number;
    }>();

    return (
        <MeasuredContainer className="stat-box">
            {(width, height) => (
                <XYPlot
                    width={width}
                    height={height}
                    stackBy="x"
                    margin={{ left: 150, right: 10, top: 10, bottom: 40 }}
                >
                    <VerticalGridLines />
                    <XAxis tickFormat={effectiveFormat} />
                    <YAxis
                        tickTotal={bars.length}
                        tickFormat={(t) => bars[t] ?? ""}
                    />
                    {effectiveSegments.map((segment) => {
                        const data = bars.map((bar, i) => ({
                            y: i,
                            x: cells[`${bar}-${segment}`] ?? 0,
                            color: colour && colour(segment),
                            opacity:
                                !highlight ||
                                (highlight.bar === bar &&
                                    highlight.segment === segment)
                                    ? 1
                                    : 0.5,
                        }));
                        return (
                            <HorizontalBarSeries
                                key={segment}
                                barWidth={0.8}
                                onValueMouseOver={(point) =>
                                    setHint({
                                        point,
                                        segment,
                                        bar: bars[point.y as number],
                                        value: data[point.y as number].x,
                                    })
                                }
                                onValueMouseOut={() => setHint(undefined)}
                                colorType="literal"
                                data={data}
                                onValueClick={(point) =>
                                    onClick?.(bars[point.y as number], segment)
                                }
                            />
                        );
                    })}
                    {hint ? (
                        <Hint value={hint.point}>
                            <div className="tooltip">
                                <div>{effectiveFormat(hint.value)}</div>
                                <div>{hint.segment}</div>
                            </div>
                        </Hint>
                    ) : undefined}
                </XYPlot>
            )}
        </MeasuredContainer>
    );
}
