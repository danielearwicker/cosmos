import { useMemo, useState } from "react";
import {
    normalizeCategory,
    type SpendyAction,
    type SpendyState,
} from "./reducer";
import {
    dateAdd,
    dateDiff,
    formatBankAmount,
    getPattern,
    getPaymentsWithCategories,
    quarterFromDate,
    sort,
} from "./statements";
import { StackedBar } from "./StackedBar";
import { RenameCategory } from "./RenameCategory";
import { CategoryPath, getPathElements } from "./CategoryPath";
import { ChildCategories, getChildCategory } from "./ChildCategories";
import { getCategoryColour } from "./colours";
import { Select } from "./inputComponents/Select";
import { YearMonth } from "./YearMonth";
import { useSearchParams } from "react-router-dom";
import { AssignCategory } from "./AssignCategory";
import { chain as _ } from "underscore";

export const paymentTypes = [
    "debits",
    "credits",
    "net per",
    "net running",
] as const;

export type PaymentType = (typeof paymentTypes)[number];

export const dateRanges = [
    "last 30 days",
    "last 12 months",
    "all time",
    "custom",
] as const;

export type DateRange = (typeof dateRanges)[number];

export interface ExplorerProps {
    state: SpendyState;
    dispatch(action: SpendyAction): void;
}

export function Explorer({ state, dispatch }: ExplorerProps) {
    const [searchParams, setSearchParams] = useSearchParams();

    function updateSearchParams(updates: Record<string, string>) {
        setSearchParams({
            ...Object.fromEntries(searchParams.entries()),
            ...updates,
        });
    }

    const [search, setSearch] = useState("");

    const path = searchParams.get("path") ?? "";

    function setPath(path: string) {
        updateSearchParams({ path });
    }

    const type = (searchParams.get("type") as PaymentType) ?? "debits";

    function setType(type: PaymentType) {
        updateSearchParams({ type });
    }

    const dateRange =
        (searchParams.get("dateRange") as DateRange) ?? "last 30 days";

    function setDateRange(dateRange: DateRange) {
        updateSearchParams({ dateRange });
    }

    const dateRangeCustomStart = searchParams.get("dateRangeCustomStart") ?? "";
    const dateRangeCustomEnd = searchParams.get("dateRangeCustomEnd") ?? "";

    function setDateRangeCustomStart(dateRangeCustomStart: string) {
        updateSearchParams({ dateRangeCustomStart });
    }

    function setDateRangeCustomEnd(dateRangeCustomEnd: string) {
        updateSearchParams({ dateRangeCustomEnd });
    }

    const [tableFilter, setTableFilter] = useState<
        undefined | { bar: string; segment?: string }
    >();

    const latestDate = useMemo(
        () =>
            state.payments
                .map((x) => x.date)
                .reduce(
                    (l, r) => (l.localeCompare(r) > 0 ? l : r),
                    "2000-01-01"
                ),
        [state.payments]
    );

    const earliestDate = useMemo(
        () =>
            state.payments
                .map((x) => x.date)
                .reduce(
                    (l, r) => (l.localeCompare(r) < 0 ? l : r),
                    "2100-01-01"
                ),
        [state.payments]
    );

    const startDate =
        dateRange === "last 12 months"
            ? dateAdd(latestDate, "months", -12)
            : dateRange === "last 30 days"
            ? dateAdd(latestDate, "days", -30)
            : dateRange === "custom" && dateRangeCustomStart
            ? `${dateRangeCustomStart}-01`
            : earliestDate;

    const endDate =
        dateRange === "custom" && dateRangeCustomEnd
            ? `${dateRangeCustomEnd}-31`
            : latestDate;

    const rangeInDays = dateDiff(startDate, endDate);

    const getDateBar =
        rangeInDays < 65
            ? (d: string) => d
            : rangeInDays < 500
            ? (d: string) => d.substring(0, 7)
            : rangeInDays < 2000
            ? quarterFromDate
            : (d: string) => d.substring(0, 4);

    const paymentsWithCategories = useMemo(
        () =>
            getPaymentsWithCategories(
                state.payments,
                state.patternsToCategories
            ),
        [state.payments, state.patternsToCategories]
    );

    const showCredits = type === "credits";
    const searchLower = search.toLocaleLowerCase();

    const earliestYearMonth = earliestDate.substring(0, 7);
    const latestYearMonth = latestDate.substring(0, 7);

    const filtered = useMemo(
        () =>
            paymentsWithCategories.filter(
                (x) =>
                    x.date.localeCompare(startDate) >= 0 &&
                    x.date.localeCompare(endDate) <= 0 &&
                    (type === "net per" ||
                        type === "net running" ||
                        x.amount > 0 === showCredits) &&
                    `${x.category}/`.startsWith(path) &&
                    (!searchLower ||
                        x.description.toLocaleLowerCase().includes(searchLower))
            ),
        [
            paymentsWithCategories,
            startDate,
            endDate,
            type,
            showCredits,
            path,
            searchLower,
        ]
    );

    const excludedCategoriesObj = Object.fromEntries(
        state.excludedCategories.map((c) => [c, true])
    );

    function setExcludedCategory(category: string, excluded: boolean) {
        dispatch({ type: "CATEGORY_EXCLUDE", category, excluded });
    }

    const filteredForExcludedCategories = filtered.filter((x) =>
        getPathElements(x.category).every(
            (pe) => !excludedCategoriesObj[pe.path]
        )
    );

    const sorted = useMemo(
        () =>
            sort(filteredForExcludedCategories)
                .by("date")
                .thenBy("line")
                .thenBy("description")
                .thenBy("amount")
                .value(),
        [filteredForExcludedCategories]
    );

    const netBars = useMemo(() => {
        const bars: {
            bar: string;
            value: number;
            segment: string;
        }[] = [];

        for (const payment of sorted) {
            const current = bars[bars.length - 1];
            const bar = getDateBar(payment.date);
            if (current?.bar !== bar) {
                bars.push({
                    bar,
                    value:
                        (type === "net running" ? current?.value ?? 0 : 0) +
                        payment.amount,
                    segment: "net value",
                });
            } else {
                current.value += payment.amount;
            }
        }

        return bars;
    }, [sorted]);

    function rename(renamed: string) {
        dispatch({
            type: "CATEGORY_RENAME",
            category: normalizeCategory(path),
            renamed,
        });

        setPath(renamed + "/");
    }

    function toggleTableFilter(bar: string, segment?: string) {
        if (tableFilter?.bar === bar && tableFilter?.segment === segment) {
            setTableFilter(undefined);
        } else {
            setTableFilter({ bar, segment });
        }
    }

    const filteredForTable = !tableFilter
        ? sorted
        : sorted.filter(
              (p) =>
                  getDateBar(p.date) === tableFilter.bar &&
                  (!tableFilter.segment ||
                      getChildCategory(path, p.category) ===
                          tableFilter.segment)
          );

    const [changingCategory, setChangingCategory] = useState(false);

    function setCategory(category: string) {
        for (const p of filtered) {
            dispatch({
                type: "CATEGORY_SET",
                pattern: getPattern(p.description),
                category,
            });
        }

        setChangingCategory(false);
        setSearch("");
    }

    return (
        <div className="explorer">
            <div className="path">
                <CategoryPath path={path} setPath={setPath} />
                {!!path && (
                    <RenameCategory
                        category={normalizeCategory(path)}
                        rename={rename}
                    />
                )}
                <Select<PaymentType>
                    value={type}
                    options={paymentTypes}
                    onChange={setType}
                />
                <Select<DateRange>
                    value={dateRange}
                    options={dateRanges}
                    onChange={setDateRange}
                />
                {dateRange === "custom" && (
                    <>
                        <span> from </span>
                        <YearMonth
                            min={earliestYearMonth}
                            max={latestYearMonth}
                            value={dateRangeCustomStart || earliestYearMonth}
                            monthWhenSettingYear={1}
                            setValue={setDateRangeCustomStart}
                        />
                        <span> to </span>
                        <YearMonth
                            min={earliestYearMonth}
                            max={latestYearMonth}
                            value={dateRangeCustomEnd || latestYearMonth}
                            monthWhenSettingYear={12}
                            setValue={setDateRangeCustomEnd}
                        />
                    </>
                )}
            </div>

            <div className="panel-container">
                <div className="children">
                    <ChildCategories
                        payments={filtered}
                        path={path}
                        setPath={setPath}
                        excludedCategories={excludedCategoriesObj}
                        setExcludedCategory={setExcludedCategory}
                    />
                </div>
                <div className="leaf">
                    <div className="filter">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button
                            onClick={() =>
                                setChangingCategory(!changingCategory)
                            }
                        >
                            {!changingCategory ? "change category" : "cancel"}
                        </button>
                    </div>

                    {type === "net per" || type === "net running" ? (
                        <StackedBar
                            source={netBars}
                            sort="bar"
                            format={formatBankAmount}
                            onClick={toggleTableFilter}
                        />
                    ) : (
                        <StackedBar
                            source={filteredForExcludedCategories.map((p) => ({
                                bar: getDateBar(p.date),
                                segment:
                                    getChildCategory(path, p.category) ?? "",
                                value: Math.abs(p.amount),
                            }))}
                            sort="bar"
                            format={formatBankAmount}
                            colour={getCategoryColour}
                            highlight={tableFilter}
                            onClick={toggleTableFilter}
                        />
                    )}

                    <div className="table">
                        {changingCategory ? (
                            <AssignCategory
                                categories={state.categories}
                                setCategory={setCategory}
                            />
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <td>Date</td>
                                        <td>Category</td>
                                        <td>Description</td>
                                        <td>Amount</td>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredForTable.map((payment, n) => (
                                        <tr key={n}>
                                            <td>{payment.date}</td>
                                            <td>
                                                {payment.category ??
                                                    "uncategorised"}
                                            </td>
                                            <td>{payment.description}</td>
                                            <td>
                                                {formatBankAmount(
                                                    payment.amount
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
