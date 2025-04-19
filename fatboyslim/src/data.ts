import { createContext } from "react";

export const categories = [
    "savoury",
    "carbs",
    "condiment",
    "dairy",
    "bread",
    "treat",
    "drink",
    "booze",
    "fruit",
    "veg",
    "cereal",
    "other",
] as const;
export type Category = (typeof categories)[number];

export type Comestible = Readonly<{
    id: string;
    label: string;
    calories: number;
    category: Category;
    redMeat: number;
    sugar?: number;
    alcohol?: number;
    satch?: number;
    protein?: number;
}>;

const levenshtein = (function () {
    function _min(d0: number, d1: number, d2: number, bx: number, ay: number) {
        return d0 < d1 || d2 < d1
            ? d0 > d2
                ? d2 + 1
                : d0 + 1
            : bx === ay
            ? d1
            : d1 + 1;
    }

    return function (a: string, b: string): number {
        if (a === b) {
            return 0;
        }

        if (a.length > b.length) {
            let tmp = a;
            a = b;
            b = tmp;
        }

        let la = a.length;
        let lb = b.length;

        while (la > 0 && a.charCodeAt(la - 1) === b.charCodeAt(lb - 1)) {
            la--;
            lb--;
        }

        let offset = 0;

        while (offset < la && a.charCodeAt(offset) === b.charCodeAt(offset)) {
            offset++;
        }

        la -= offset;
        lb -= offset;

        if (la === 0 || lb < 3) {
            return lb;
        }

        let x = 0;
        let y;
        let d0;
        let d1;
        let d2;
        let d3;
        let dd = 0;
        let dy;
        let ay;
        let bx0;
        let bx1;
        let bx2;
        let bx3;

        let vector = [];

        for (y = 0; y < la; y++) {
            vector.push(y + 1);
            vector.push(a.charCodeAt(offset + y));
        }

        let len = vector.length - 1;

        for (; x < lb - 3; ) {
            bx0 = b.charCodeAt(offset + (d0 = x));
            bx1 = b.charCodeAt(offset + (d1 = x + 1));
            bx2 = b.charCodeAt(offset + (d2 = x + 2));
            bx3 = b.charCodeAt(offset + (d3 = x + 3));
            dd = x += 4;
            for (y = 0; y < len; y += 2) {
                dy = vector[y];
                ay = vector[y + 1];
                d0 = _min(dy, d0, d1, bx0, ay);
                d1 = _min(d0, d1, d2, bx1, ay);
                d2 = _min(d1, d2, d3, bx2, ay);
                dd = _min(d2, d3, dd, bx3, ay);
                vector[y] = dd;
                d3 = d2;
                d2 = d1;
                d1 = d0;
                d0 = dy;
            }
        }

        for (; x < lb; ) {
            bx0 = b.charCodeAt(offset + (d0 = x));
            dd = ++x;
            for (y = 0; y < len; y += 2) {
                dy = vector[y];
                vector[y] = dd = _min(dy, d0, dd, bx0, vector[y + 1]);
                d0 = dy;
            }
        }

        return dd;
    };
})();

export function compareStrings(a: string, b: string) {
    return (
        1 -
        levenshtein(a.toLowerCase(), b.toLowerCase()) /
            Math.max(a.length, b.length)
    );
}

export function sortComestibleChoices(
    choices: {
        weight: number;
        comestible: {
            calories: number;
        };
    }[],
    limit: number
) {
    choices.sort((l, r) => {
        const lAllowed = l.comestible.calories < limit ? 1 : 0;
        const rAllowed = r.comestible.calories < limit ? 1 : 0;
        if (lAllowed === rAllowed) {
            return r.weight - l.weight;
        }
        return rAllowed - lAllowed;
    });
}

export function searchComestibles(
    comestibles: readonly Comestible[],
    search: string,
    limit: number
) {
    const found = comestibles
        .map((comestible) => ({
            comestible,
            score: compareStrings(comestible.label, search),
        }))
        .filter((x) => x.score > 0);

    const scaled = found.map((x) => ({
        ...x,
        weight: x.score,
    }));

    scaled.sort((l, r) => r.weight - l.weight);

    //    sortComestibleChoices(scaled, limit);
    return scaled;
}

export const meals = ["breakfast", "lunch", "tea", "pud"] as const;

export type Meal = (typeof meals)[number];

export type Ate = Readonly<{
    comestible: string;
    meal: Meal;
    quantity: number;
}>;

// ISO format, but cannot use toISOString which returns UTC. We want local TZ date
export function isoDate(d: Date | number) {
    if (typeof d === "number") {
        const s = `${d}`;
        return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6)}`;
    }

    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

export function fromIsoDate(d: string) {
    return new Date(`${d}T00:00:00`);
}

export function addDays(date: string, add: number) {
    const d = fromIsoDate(date);
    return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + add));
}

export function dateDiff(date1: string, date2: string) {
    // construct as UTC deliberately to simplify day diff!
    const d1 = new Date(date1),
        d2 = new Date(date2);

    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function today(): string {
    return isoDate(new Date());
}

export function startOfWeek(d: string) {
    const date = fromIsoDate(d),
        day = date.getDay();

    date.setDate(date.getDate() - (day >= 1 ? day - 1 : 6));
    date.setHours(0, 0, 0, 0);
    return isoDate(date);
}

export function startOfMonth(d: string) {
    const date = fromIsoDate(d);
    return isoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export type Day = Readonly<{
    date: string;
    ate: readonly Ate[];
}>;

export const measurementTypes = ["Waist/cm", "Weight/kg"] as const;

export type MeasurementType = (typeof measurementTypes)[number];

export type Measurement = Readonly<{
    value: number;
    date: string;
    type: MeasurementType;
}>;

export type Attachment = Readonly<{
    id: string;
    type: string;
    tags: readonly string[];
}>;

export type Note = Readonly<{
    text: string;
    date: string;
    pictures: readonly Attachment[]; // not actually limited to pictures!
}>;

export type Pill = Readonly<{
    id: string;
    name: string;
    hoursBetweenDoses: number;
    maxDosesPerDay: number;
}>;

export type Dose = Readonly<{
    time: number; // ms since epoch
    pill: string;
}>;

export type FatboyData = Readonly<{
    measurements: readonly Measurement[];
    comestibles: readonly Comestible[];
    days: readonly Day[];
    notes: readonly Note[];
    pills: readonly Pill[];
    doses: readonly Dose[];
}>;

export function sum(ar: number[]) {
    return ar.reduce((l, r) => l + r, 0);
}

export type ComestibleWithQuantities = Readonly<Comestible> & {
    readonly quantities: { [value: number]: number };
};

export type ComestiblesContext = {
    readonly [id: string]: ComestibleWithQuantities;
};

export const ComestiblesContext = createContext<ComestiblesContext>({});

export function generateComestibleContext(
    comestibles: readonly Comestible[],
    days: readonly Day[]
): ComestiblesContext {
    const result: { [id: string]: ComestibleWithQuantities } =
        Object.fromEntries(
            comestibles.map((x) => [x.id, { ...x, quantities: {} }])
        );

    for (const day of days) {
        for (const ate of day.ate) {
            const c = result[ate.comestible];
            if (c) {
                c.quantities[ate.quantity] =
                    (c.quantities[ate.quantity] || 0) + 1;
            }
        }
    }

    return result;
}

export function getDayFacts(day: Day, comestibles: Record<string, Comestible>) {
    return day.ate.map((a) => {
        const c = comestibles[a.comestible] ?? {
            name: "unknown",
            category: "other",
            calories: 0,
            redMeat: 0,
            sugar: 0,
            alcohol: 0,
            satch: 0,
            protein: 0,
            comestible: a.comestible,
            meal: a.meal,
        };

        return {
            date: day.date,
            category: c.category,
            quantity: a.quantity,
            calories: c.calories * a.quantity,
            redMeat: c.redMeat * a.quantity,
            sugar: (c.sugar ?? 0) * a.quantity,
            alcohol: (c.alcohol ?? 0) * a.quantity,
            satch: (c.satch ?? 0) * a.quantity,
            protein: (c.protein ?? 0) * a.quantity,
            comestible: c.id,
            meal: a.meal,
        };
    });
}

export function getFacts(
    state: FatboyData,
    comestibles: Record<string, Comestible>
) {
    return state.days.flatMap((d) => getDayFacts(d, comestibles));
}

export function formatNumber(value: number) {
    return value > 1
        ? value.toFixed(1).replace(/\.0+$/, "")
        : value.toPrecision(2);
}
