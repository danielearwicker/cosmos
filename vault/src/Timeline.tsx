import { useMemo, useState, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStorage } from "../../encrypted-storage/Storage";
import type { VaultItem, VaultAction } from "./reducer";

interface TimelineProps {
    items: readonly VaultItem[];
    dispatch: (action: VaultAction) => void;
    allTags: string[];
    tagColors: Readonly<Record<string, string>>;
    collapsedYears: readonly number[];
    collapsedMonths: readonly string[];
    onViewImage: (id: string) => void;
}

interface DayGroup {
    year: number;
    month: number;
    day: number;
    date: Date;
    items: VaultItem[];
}

interface MonthGroup {
    year: number;
    month: number;
    days: DayGroup[];
}

interface YearGroup {
    year: number;
    months: MonthGroup[];
}

function buildTimelineIndex(items: readonly VaultItem[]): YearGroup[] {
    // Filter to only images with created dates
    const imageItems = items.filter(
        (item) => item.type.startsWith("image/") && item.created
    );

    // Group by date
    const dayMap = new Map<string, DayGroup>();

    for (const item of imageItems) {
        const date = new Date(item.created!);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-12
        const day = date.getDate();
        const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (!dayMap.has(key)) {
            dayMap.set(key, { year, month, day, date, items: [] });
        }
        dayMap.get(key)!.items.push(item);
    }

    // Sort items within each day by created time, most recent first
    for (const dayGroup of dayMap.values()) {
        dayGroup.items.sort((a, b) => {
            const dateA = new Date(a.created!).getTime();
            const dateB = new Date(b.created!).getTime();
            return dateB - dateA;
        });
    }

    // Group days into months
    const monthMap = new Map<string, MonthGroup>();

    for (const dayGroup of dayMap.values()) {
        const key = `${dayGroup.year}-${String(dayGroup.month).padStart(2, "0")}`;
        if (!monthMap.has(key)) {
            monthMap.set(key, {
                year: dayGroup.year,
                month: dayGroup.month,
                days: [],
            });
        }
        monthMap.get(key)!.days.push(dayGroup);
    }

    // Sort days within each month (most recent first)
    for (const monthGroup of monthMap.values()) {
        monthGroup.days.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    // Group months into years
    const yearMap = new Map<number, YearGroup>();

    for (const monthGroup of monthMap.values()) {
        if (!yearMap.has(monthGroup.year)) {
            yearMap.set(monthGroup.year, {
                year: monthGroup.year,
                months: [],
            });
        }
        yearMap.get(monthGroup.year)!.months.push(monthGroup);
    }

    // Sort months within each year (most recent first)
    for (const yearGroup of yearMap.values()) {
        yearGroup.months.sort((a, b) => b.month - a.month);
    }

    // Convert to array and sort years (most recent first)
    const years = Array.from(yearMap.values());
    years.sort((a, b) => b.year - a.year);

    return years;
}

function formatMonthName(month: number, year: number): string {
    const date = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatDayName(day: number, month: number, year: number): string {
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

interface VirtualItem {
    type: "year" | "month" | "day";
    year: number;
    month?: number;
    day?: DayGroup;
    yearCollapsed?: boolean;
    monthCollapsed?: boolean;
}

export function Timeline({
    items,
    dispatch,
    allTags,
    tagColors,
    collapsedYears,
    collapsedMonths,
    onViewImage,
}: TimelineProps) {
    const [jumpDate, setJumpDate] = useState("");
    const parentRef = useRef<HTMLDivElement>(null);

    const timelineIndex = useMemo(() => buildTimelineIndex(items), [items]);

    // Build flat list of virtual items for virtualization
    const virtualItems = useMemo(() => {
        const result: VirtualItem[] = [];

        // Defensive: ensure we have arrays, not Sets or other objects
        const yearsArray = Array.isArray(collapsedYears) ? collapsedYears : [];
        const monthsArray = Array.isArray(collapsedMonths) ? collapsedMonths : [];

        for (const yearGroup of timelineIndex) {
            const yearCollapsed = yearsArray.includes(yearGroup.year);
            result.push({ type: "year", year: yearGroup.year, yearCollapsed });

            if (!yearCollapsed) {
                for (const monthGroup of yearGroup.months) {
                    const monthKey = `${yearGroup.year}-${String(monthGroup.month).padStart(2, "0")}`;
                    const monthCollapsed = monthsArray.includes(monthKey);
                    result.push({
                        type: "month",
                        year: yearGroup.year,
                        month: monthGroup.month,
                        monthCollapsed
                    });

                    if (!monthCollapsed) {
                        for (const dayGroup of monthGroup.days) {
                            result.push({
                                type: "day",
                                year: yearGroup.year,
                                month: monthGroup.month,
                                day: dayGroup
                            });
                        }
                    }
                }
            }
        }

        return result;
    }, [timelineIndex, collapsedYears, collapsedMonths]);

    const virtualizer = useVirtualizer({
        count: virtualItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const item = virtualItems[index];
            if (item.type === "year") return 60;
            if (item.type === "month") return 50;
            // Estimate day height based on number of images
            const dayItem = item.day!;
            const imageCount = dayItem.items.length;
            const rowCount = Math.ceil(imageCount / 5); // Assume ~5 images per row
            return 40 + (rowCount * 220); // Header + image rows
        },
        overscan: 2,
    });

    function toggleYear(year: number) {
        dispatch({ type: "TIMELINE_TOGGLE_YEAR", year });
    }

    function toggleMonth(year: number, month: number) {
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
        dispatch({ type: "TIMELINE_TOGGLE_MONTH", yearMonth: monthKey });
    }

    function handleJumpToDate() {
        if (!jumpDate) return;

        const targetDate = new Date(jumpDate);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1;
        const targetDay = targetDate.getDate();

        // Find the index of the target day (or nearest later day)
        let foundIndex = -1;
        for (let i = 0; i < virtualItems.length; i++) {
            const item = virtualItems[i];
            if (item.type === "day" && item.day) {
                const itemDate = item.day.date;
                if (
                    itemDate.getFullYear() === targetYear &&
                    itemDate.getMonth() + 1 === targetMonth &&
                    itemDate.getDate() === targetDay
                ) {
                    foundIndex = i;
                    break;
                }
                // If we've passed the target date, use this day (nearest later)
                if (itemDate <= targetDate) {
                    foundIndex = i;
                    break;
                }
            }
        }

        if (foundIndex !== -1) {
            virtualizer.scrollToIndex(foundIndex, { align: "start" });
        }
    }

    if (timelineIndex.length === 0) {
        return (
            <div className="timeline-empty">
                <p>No images with dates found.</p>
                <p>Images need a "created" date from EXIF metadata to appear in the timeline.</p>
            </div>
        );
    }

    return (
        <div className="timeline">
            <div className="timeline-controls">
                <input
                    type="date"
                    className="date-jump"
                    value={jumpDate}
                    onChange={(e) => setJumpDate(e.target.value)}
                    placeholder="Jump to date..."
                />
                <button onClick={handleJumpToDate} disabled={!jumpDate}>
                    Jump to Date
                </button>
                {jumpDate && (
                    <button onClick={() => setJumpDate("")} className="clear-date">
                        Clear
                    </button>
                )}
            </div>
            <div ref={parentRef} className="timeline-scroll">
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const item = virtualItems[virtualRow.index];

                        return (
                            <div
                                key={virtualRow.index}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                {item.type === "year" && (
                                    <div className="timeline-year">
                                        <button
                                            className="timeline-year-toggle"
                                            onClick={() => toggleYear(item.year)}
                                        >
                                            <span className="timeline-collapse-icon">
                                                {item.yearCollapsed ? "▶" : "▼"}
                                            </span>
                                            <span className="timeline-year-label">{item.year}</span>
                                        </button>
                                    </div>
                                )}
                                {item.type === "month" && (
                                    <div className="timeline-month">
                                        <button
                                            className="timeline-month-toggle"
                                            onClick={() => toggleMonth(item.year, item.month!)}
                                        >
                                            <span className="timeline-collapse-icon">
                                                {item.monthCollapsed ? "▶" : "▼"}
                                            </span>
                                            <span className="timeline-month-label">
                                                {formatMonthName(item.month!, item.year)}
                                            </span>
                                        </button>
                                    </div>
                                )}
                                {item.type === "day" && item.day && (
                                    <DayView
                                        dayGroup={item.day}
                                        onViewImage={onViewImage}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

interface DayViewProps {
    dayGroup: DayGroup;
    onViewImage: (id: string) => void;
}

function DayView({ dayGroup, onViewImage }: DayViewProps) {
    const storage = useStorage();
    const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        // Load thumbnails for this day's images
        const loadThumbnails = async () => {
            const newThumbnails = new Map<string, string>();

            for (const item of dayGroup.items) {
                try {
                    const payload = await storage.load(`${item.id}-thumb`);
                    if (payload.data) {
                        const blob = new Blob([payload.data], { type: "image/jpeg" });
                        const url = URL.createObjectURL(blob);
                        newThumbnails.set(item.id, url);
                    }
                } catch (error) {
                    console.error(`Failed to load thumbnail for ${item.id}:`, error);
                }
            }

            setThumbnails(newThumbnails);
        };

        loadThumbnails();

        // Cleanup function to revoke object URLs
        return () => {
            for (const url of thumbnails.values()) {
                URL.revokeObjectURL(url);
            }
        };
    }, [dayGroup.items, storage]);

    return (
        <div className="timeline-day">
            <div className="timeline-day-header">
                {formatDayName(dayGroup.day, dayGroup.month, dayGroup.year)}
                <span className="timeline-day-count">
                    {dayGroup.items.length} {dayGroup.items.length === 1 ? "image" : "images"}
                </span>
            </div>
            <div className="timeline-day-grid">
                {dayGroup.items.map((item) => (
                    <div
                        key={item.id}
                        className="timeline-thumbnail"
                        onClick={() => onViewImage(item.id)}
                    >
                        {thumbnails.has(item.id) ? (
                            <img src={thumbnails.get(item.id)} alt={item.name} />
                        ) : (
                            <div className="timeline-thumbnail-placeholder">
                                <span>Loading...</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
