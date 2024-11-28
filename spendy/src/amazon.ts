import { parseCsvText } from "./csv";
import {
    formatDateToIso,
    parseUsDate,
    type Payment,
    parseBankAmount,
} from "./statements";

export interface AmazonOrder {
    orderId: string;
    items: Payment[];
    total: number;
}

export function parseAmazonOrderHistory(text: string): AmazonOrder[] {
    const orders: {
        [orderId: string]: Payment[];
    } = {};

    const firstLine = parseCsvText(text).next().value as string[];

    const headers = Object.fromEntries(
        firstLine.map((field, index) => [field, index])
    );

    const orderIdIndex = headers["Order ID"],
        orderDateIndex = headers["Order Date"],
        shipDateIndex = headers["Ship Date"],
        orderStatusIndex = headers["Order Status"],
        quantityIndex = headers["Quantity"],
        totalOwedIndex = headers["Total Owed"],
        productNameIndex = headers["Product Name"];

    let lineNumber = 0;
    for (const fields of parseCsvText(text)) {
        lineNumber++;

        if (lineNumber === 1) continue;

        const orderId = fields[orderIdIndex],
            orderDate = fields[orderDateIndex],
            shipDate = fields[shipDateIndex],
            orderStatus = fields[orderStatusIndex],
            quantity = fields[quantityIndex],
            totalOwed = fields[totalOwedIndex],
            productName = fields[productNameIndex];

        if (orderStatus !== "Closed" || quantity === "0") continue;

        const effectiveDate =
            !shipDate || shipDate.startsWith("Due to technical limitations")
                ? orderDate
                : shipDate;

        try {
            const items = orders[orderId] ?? (orders[orderId] = []);

            items.push({
                line: lineNumber,
                date: formatDateToIso(parseUsDate(effectiveDate)),
                description: productName,
                amount: parseBankAmount(totalOwed),
            });
        } catch (e) {
            if (e instanceof Error) {
                throw new Error(
                    e.message + " from line " + JSON.stringify(fields)
                );
            }
            throw new Error("Blah from line " + JSON.stringify(fields));
        }
    }

    return Object.entries(orders).map(([orderId, items]) => ({
        orderId,
        items,
        total: items.map((x) => x.amount).reduce((l, r) => l + r),
    }));
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
