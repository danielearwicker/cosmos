import { useMemo, useState } from "react";
import type { SpendyAction, SpendyState } from "./reducer";
import {
    dateDiff,
    formatBankAmount,
    getPaymentsWithCategories,
    type Payment,
    sort,
} from "./statements";
import type { AmazonOrder } from "./amazon";
import { CheckBox } from "./inputComponents/CheckBox";

export interface UnmatchedAmazonProps {
    state: SpendyState;
    dispatch: (action: SpendyAction) => void;
}

export function UnmatchedAmazon({ state, dispatch }: UnmatchedAmazonProps) {
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

    const paymentsWithCategories = useMemo(
        () =>
            getPaymentsWithCategories(
                state.payments,
                state.patternsToCategories
            ),
        [state.payments, state.patternsToCategories]
    );

    const allAmazonOrders = useMemo(
        () => state.amazonOrders.concat(state.amazonUsOrders ?? []),
        [state.amazonOrders, state.amazonUsOrders]
    );

    const [unmatchedPayments, unmatchedOrders] = useMemo(() => {
        const amountBuckets: Record<number, AmazonOrder[]> = {};

        for (const order of allAmazonOrders) {
            const d = dateDiff(earliestDate, order.items[0].date);
            if (d >= -5) {
                (
                    amountBuckets[order.total] ??
                    (amountBuckets[order.total] = [])
                ).push(order);
            }
        }

        const unmatchedPayments: Payment[] = [];

        for (const payment of paymentsWithCategories) {
            if (
                !`${payment.category}/`.startsWith("amazon/") ||
                payment.amount >= 0
            ) {
                continue;
            }

            const priceMatches = amountBuckets[-payment.amount] ?? [];

            const paidAfterOrder = priceMatches.filter(
                (x) =>
                    x.items[0].date <= payment.date &&
                    dateDiff(x.items[0].date, payment.date) < 100
            );

            if (paidAfterOrder.length === 0) {
                unmatchedPayments.push(payment);
            } else {
                const bestMatch = paidAfterOrder.reduce((l, r) =>
                    l.items[0].date > r.items[0].date ? l : r
                );
                const i = priceMatches.indexOf(bestMatch);
                if (i === -1) throw new Error("um?");
                priceMatches.splice(i, 1);
            }
        }

        const unmatchedOrders = Object.values(amountBuckets).flat();

        return [unmatchedPayments, unmatchedOrders];
    }, [allAmazonOrders]);

    const unmatchedCombination = useMemo(
        () =>
            sort(
                unmatchedOrders
                    .map((x) => ({
                        date: x.items[0].date,
                        type: "order",
                        amount: x.total,
                        description: x.items
                            .map((x) => x.description)
                            .join(","),
                        id: x.orderId,
                    }))
                    .concat(
                        unmatchedPayments.map((x) => ({
                            date: x.date,
                            type: "payment",
                            amount: x.amount,
                            description: x.description,
                            id: `${x.date}-${x.line}`,
                        }))
                    )
            )
                .by("date")
                .value(),
        [unmatchedOrders, unmatchedPayments]
    );

    const [unmatchedSelected, setUnmatchedSelected] = useState<{
        [id: string]: boolean;
    }>({});

    const selection = useMemo(() => {
        const ids = Object.keys(unmatchedSelected);
        const orders = ids.filter(
            (id) =>
                unmatchedCombination.find((u) => u.id === id)?.type === "order"
        );
        const payments = ids.filter(
            (id) =>
                unmatchedCombination.find((u) => u.id === id)?.type ===
                "payment"
        );
        return { orders, payments };
    }, [unmatchedSelected, unmatchedCombination]);

    const manuallyMatched = useMemo(() => {
        const ids: Record<string, boolean> = {};

        for (const m of state.manualMatches || []) {
            for (const o of m.orders) {
                ids[o] = true;
            }

            for (const p of m.payments) {
                ids[p] = true;
            }
        }

        return ids;
    }, state.manualMatches);

    const unmatchedFiltered = unmatchedCombination.filter(
        (x) => !manuallyMatched[x.id]
    );

    const selectionTotal = unmatchedFiltered
        .filter((x) => unmatchedSelected[x.id])
        .map((x) => x.amount)
        .reduce((l, r) => l + r, 0);

    const canSave = selection.orders.length && selection.payments.length;

    function save() {
        if (canSave) {
            dispatch({
                type: "SAVE_MANUAL_MATCH",
                orders: selection.orders,
                payments: selection.payments,
            });

            setUnmatchedSelected({});
        }
    }

    return (
        <div className="unmatched">
            <div className="selection">
                <span className="total">
                    Total: {selectionTotal}, Orders: {selection.orders.length},
                    Payments: {selection.payments.length}
                </span>
                <button onClick={save} disabled={!canSave}>
                    Save
                </button>
            </div>
            <div className="table">
                <table>
                    <thead>
                        <tr>
                            <td></td>
                            <td>Date</td>
                            <td>Type</td>
                            <td>Description</td>
                            <td>Amount</td>
                        </tr>
                    </thead>
                    <tbody>
                        {unmatchedFiltered.map((x) => (
                            <tr>
                                <td>
                                    <CheckBox
                                        checked={!!unmatchedSelected[x.id]}
                                        onChange={(c) =>
                                            setUnmatchedSelected((o) => ({
                                                ...o,
                                                [x.id]: c,
                                            }))
                                        }
                                    />
                                </td>
                                <td>{x.date}</td>
                                <td>{x.type}</td>
                                <td>{x.description}</td>
                                <td>{formatBankAmount(x.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
