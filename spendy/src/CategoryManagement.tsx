import { useMemo } from "react";
import { type SpendyAction, type SpendyState } from "./reducer";
import { getPattern, type Payment } from "./statements";
export const uploadTypes = ["hsbc", "amazon-uk", "amazon-us"] as const;

export type UploadType = (typeof uploadTypes)[number];

export interface CategoryManagementProps {
    state: SpendyState;
    dispatch: (action: SpendyAction) => void;
}

export function CategoryManagement({
    state,
    dispatch,
}: CategoryManagementProps) {
    const patternsByCategory = useMemo(() => {
        const byCategory: Record<string, string[]> = {};
        for (const [pattern, category] of Object.entries(
            state.patternsToCategories
        )) {
            (byCategory[category] ?? (byCategory[category] = [])).push(pattern);
        }
        return byCategory;
    }, [state.patternsToCategories]);

    const paymentsByPattern = useMemo(() => {
        const byPattern: Record<string, Payment[]> = {};
        for (const payment of state.payments) {
            const pattern = getPattern(payment.description);
            (byPattern[pattern] ?? (byPattern[pattern] = [])).push(payment);
        }
        return byPattern;
    }, [state.payments]);

    const sorted = useMemo(
        () =>
            state.categories
                .slice()
                .sort()
                .map((c) => ({
                    title: c,
                    patterns: (patternsByCategory[c] ?? [])
                        .map((p) => ({
                            definition: p,
                            payments: paymentsByPattern[p],
                        }))
                        .sort((l, r) => r.payments.length - l.payments.length),
                })),
        [state.categories]
    );

    return (
        <div className="category-management">
            {sorted.map((c) => (
                <div className="category">
                    <div className="title">{c.title}</div>
                    <div className="patterns">
                        {c.patterns.map((p) => (
                            <div className="pattern">
                                <div className="definition">{p.definition}</div>
                                <div className="payment-count">
                                    {p.payments.length}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
