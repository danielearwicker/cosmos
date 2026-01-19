import { parseCsvText } from "./csv";

export interface DateOnly {
    year: number;
    month: number;
    day: number;
}

export function dateDiff(date1: string, date2: string) {
    const parsed1 = parseIsoDate(date1),
        parsed2 = parseIsoDate(date2);

    const d1 = new Date(parsed1.year, parsed1.month - 1, parsed1.day),
        d2 = new Date(parsed2.year, parsed2.month - 1, parsed2.day);

    return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
}

export function dateAdd(
    date: string,
    unit: "days" | "months",
    add: number
): string {
    const parsed = parseIsoDate(date);
    const d = new Date(parsed.year, parsed.month - 1, parsed.day);
    if (unit === "days") {
        d.setDate(d.getDate() + add);
    } else {
        d.setMonth(d.getMonth() + add);
    }
    return formatDateToIso({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
    });
}

export function formatDateToIso(date: DateOnly) {
    return (
        `${date.year}`.padStart(4, "0") +
        "-" +
        `${date.month}`.padStart(2, "0") +
        "-" +
        `${date.day}`.padStart(2, "0")
    );
}

function parseUkDate(dateStr: string): DateOnly {
    const [day, month, year] = dateStr.split("/");
    return {
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
    };
}

const usDatePattern = /(\d\d)\/(\d\d)\/(\d\d\d\d)/;

export function parseUsDate(dateStr: string): DateOnly {
    const parsed = usDatePattern.exec(dateStr);
    if (!parsed || parsed.length !== 4) {
        throw new Error("Unexpected date format: " + dateStr);
    }

    const [_, month, day, year] = Array.from(parsed);

    return {
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
    };
}

export function parseIsoDate(dateStr: string): DateOnly {
    const [year, month, day] = dateStr.split("-");
    return {
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
    };
}

export function quarterFromDate(date: string) {
    const parsed = parseIsoDate(date);
    const qtr = Math.floor((parsed.month - 1) / 3) + 1;
    return `${parsed.year} Q${qtr}`;
}

const bankAmountRubbish = /[^\d\.\-]/;

export function parseBankAmount(amountStr: string) {
    const cleaned = amountStr.replace(bankAmountRubbish, "");
    return Math.round(parseFloat(cleaned) * 100);
}

export function formatBankAmount(amount: number) {
    if (amount === 0) {
        return "0";
    }

    const sign = amount < 0 ? "-" : "";

    amount = Math.abs(amount);

    if (amount < 100) {
        return `${sign}0.${amount}`;
    }
    const str = `${amount}`;

    const pounds = str.substring(0, str.length - 2),
        pennies = str.substring(str.length - 2);

    return sign + (pennies === "00" ? pounds : pounds + "." + pennies);
}

export interface Payment {
    line: number;
    date: string;
    description: string;
    amount: number; // pennies
}

export function parseStatement(text: string) {
    const records: Payment[] = [];

    let lineNumber = 0;
    for (const fields of parseCsvText(text)) {
        if (fields.length !== 3) {
            throw new Error("Unexpected csv result: " + JSON.stringify(fields));
        }
        const [date, description, amount] = fields;

        records.push({
            line: lineNumber++,
            date: formatDateToIso(parseUkDate(date)),
            description: description.toUpperCase(),
            amount: parseBankAmount(amount),
        });
    }

    return records;
}

export function sort<T>(items: T[]) {
    function builder(criteria: { key: keyof T; desc: boolean }[]) {
        return {
            thenBy(key: keyof T, desc: boolean = false) {
                return builder([...criteria, { key, desc }]);
            },
            value() {
                const copy = items.slice();
                copy.sort((l, r) => {
                    for (const criterion of criteria) {
                        const lValue = l[criterion.key],
                            rValue = r[criterion.key];
                        const c =
                            typeof lValue === "number" &&
                            typeof rValue === "number"
                                ? lValue - rValue
                                : `${lValue}`.localeCompare(`${rValue}`);
                        if (c !== 0) {
                            return criterion.desc ? -c : c;
                        }
                    }
                    return 0;
                });
                return copy;
            },
        };
    }

    return {
        by(key: keyof T, desc: boolean = false) {
            return builder([{ key, desc }]);
        },
    };
}

export function removeAdjacentDuplicates(payments: Payment[]) {
    for (let n = 0; n < payments.length - 1; n++) {
        const a = payments[n],
            b = payments[n + 1];
        if (
            a.line === b.line &&
            a.amount === b.amount &&
            a.description === b.description &&
            a.date === b.date
        ) {
            payments.splice(n, 1);
            n--;
        }
    }
}

function mixed(str: string) {
    return !!/[a-z]/.exec(str) && !!/\d/.exec(str);
}

export function getPattern(str: string) {
    const words = str
        .toLocaleLowerCase()
        .replace(/[^\w]+/g, " ")
        .replace(/\d+/, "0")
        .trim()
        .split(/\s/);

    return words.map((x) => (mixed(x) ? "_" : x)).join(" ");
}

export function getPaymentsWithCategories(
    payments: readonly Payment[],
    patternsToCategories: Readonly<Record<string, string>>
) {
    return payments.map((payment, index) => {
        return {
            ...payment,
            category:
                patternsToCategories[payment.description] || "uncategorised",
            index,
        };
    });
}
