import {
    addDays,
    ComestiblesContext,
    dateDiff,
    type FatboyData,
    getFacts,
    startOfMonth,
    startOfWeek,
    sum,
    today,
} from "./data";
import { chain as _ } from "underscore";
import { StackedBar } from "./StackedBar";
import { NumberStat } from "./NumberStat";
import { useContext, useState } from "react";
import { getDailyLimit } from "./ProgressBar";

interface TypedSelectProps<T extends string> {
    options: Record<T, unknown>;
    value: T;
    onChange(v: T): void;
}

function TypedSelect<T extends string>({
    options,
    value,
    onChange,
}: TypedSelectProps<T>) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value as T)}>
            {Object.keys(options).map((type) => (
                <option key={type}>{type}</option>
            ))}
        </select>
    );
}

export interface StatsProps {
    state: FatboyData;
}

export function Stats({ state }: StatsProps) {
    const comestibles = useContext(ComestiblesContext);

    function getLabel(c: string) {
        const label = comestibles[c]?.label;
        if (!label) {
            console.log("getLabel", "missing", c);
            return "[none]";
        }
        return label;
    }

    const [startDate, setStartDate] = useState(addDays(today(), -27));
    const [endDate, setEndDate] = useState(today());

    const filteredState = {
        ...state,
        days: state.days.filter(
            (d) =>
                (!startDate || dateDiff(startDate, d.date) >= 0) &&
                (!endDate || dateDiff(endDate, d.date) <= 0)
        ),
    };

    const facts = getFacts(filteredState, comestibles);
    const totalCalories = sum(facts.map((x) => x.calories));
    const totalRedMeat = sum(facts.map((x) => x.redMeat ?? 0));
    const totalSugar = sum(facts.map((x) => x.sugar ?? 0));
    const totalAlcohol = sum(facts.map((x) => x.alcohol ?? 0));
    const totalSatch = sum(facts.map((x) => x.satch ?? 0));
    const dayCount = filteredState.days.length || 1;

    type Fact = (typeof facts)[number];

    const measures = {
        calories: (f: Fact) => f.calories,
        "sugar (g)": (f: Fact) => f.sugar,
        "red meat (g)": (f: Fact) => f.redMeat,
        "alcohol (units)": (f: Fact) => f.alcohol,
        "satch (g)": (f: Fact) => f.satch,
    };

    const segments = {
        meal: (f: Fact) => f.meal,
        category: (f: Fact) => f.category,
        comestible: (f: Fact) => getLabel(f.comestible),
    };

    const dates = {
        day: (f: Fact) => f.date,
        week: (f: Fact) => startOfWeek(f.date),
        month: (f: Fact) => startOfMonth(f.date),
    };

    const bars = {
        ...dates,
        ...segments,
    };

    const [measure, setMeasure] = useState<keyof typeof measures>("calories");
    const [bar, setBar] = useState<keyof typeof bars>("day");
    const [segment, setSegment] = useState<keyof typeof segments>("meal");

    const isDate = Object.keys(dates).includes(bar);

    const showLine =
        measure === "calories" && bar === "day" && segment === "meal";

    return (
        <div className="stats">
            <div className="filters">
                <span>from</span>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
                <span>to</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </div>
            <div className="stat-box">
                <NumberStat value={filteredState.days.length} label="days" />
                <NumberStat value={totalCalories / dayCount} label="cal/day" />
                <NumberStat
                    value={totalRedMeat / dayCount}
                    label="red meat (g)"
                />
                <NumberStat value={totalSugar / dayCount} label="sugar (g)" />
                <NumberStat value={totalAlcohol / dayCount} label="alcohol" />
                <NumberStat value={totalSatch / dayCount} label="satch (g)" />
            </div>

            <div className="chart-config">
                <TypedSelect<keyof typeof measures>
                    value={measure}
                    options={measures}
                    onChange={setMeasure}
                />
                <span>by</span>
                <TypedSelect<keyof typeof bars>
                    value={bar}
                    options={bars}
                    onChange={setBar}
                />
                <span>and</span>
                <TypedSelect<keyof typeof segments>
                    value={segment}
                    options={segments}
                    onChange={setSegment}
                />
            </div>

            <StackedBar
                sort={isDate ? "bar" : "value"}
                source={facts.map((fact) => ({
                    bar: bars[bar](fact),
                    segment: segments[segment](fact),
                    value: isDate
                        ? measures[measure](fact)
                        : measures[measure](fact) / dayCount,
                    date: isDate ? fact.date : "none",
                }))}
                limit={!showLine ? undefined : getDailyLimit}
            />
        </div>
    );
}
