export interface YearMonthProps {
    min: string;
    max: string;
    value: string;
    monthWhenSettingYear?: number;
    setValue(value: string): void;
}

function splitYearMonth(ym: string) {
    const [year, month] = ym.split("-");
    return [parseInt(year), parseInt(month)];
}

function formatYearMonth(y: number, m: number) {
    return y + "-" + `${m}`.padStart(2, "0");
}

const names = [
    "",
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
];

export function YearMonth({
    min,
    max,
    value,
    monthWhenSettingYear,
    setValue,
}: YearMonthProps) {
    const [minYear] = splitYearMonth(min);
    const [maxYear] = splitYearMonth(max);
    const [year, month] = splitYearMonth(value);

    const years = Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => i + minYear
    );

    const months = Array.from({ length: 12 }, (_, i) =>
        formatYearMonth(year, i + 1)
    )
        .filter(x => x.localeCompare(min) >= 0 && x.localeCompare(max) <= 0)
        .map(x => splitYearMonth(x)[1]);

    function onChangeYear(e: React.ChangeEvent<HTMLSelectElement>) {
        const ym = formatYearMonth(
            parseInt(e.target.value),
            monthWhenSettingYear ?? month
        );
        setValue(
            ym.localeCompare(min) < 0
                ? min
                : ym.localeCompare(max) > 0
                ? max
                : ym
        );
    }

    function onChangeMonth(e: React.ChangeEvent<HTMLSelectElement>) {
        setValue(formatYearMonth(year, parseInt(e.target.value)));
    }

    return (
        <>
            <select value={year} onChange={onChangeYear}>
                {years.map(y => (
                    <option key={y}>{y}</option>
                ))}
            </select>

            <select value={month} onChange={onChangeMonth}>
                {months.map(m => (
                    <option key={m} value={m}>
                        {names[m]}
                    </option>
                ))}
            </select>
        </>
    );
}
