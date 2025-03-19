import React, { useContext } from "react";
import { type ReactNode } from "react";
import { type ComestibleWithQuantities, type Meal } from "./data";
import { type FatboyAction } from "./reducer";
import { EditingDay } from "./editingDay";

export type AteItem = ComestibleWithQuantities & {
    quantity: number;
};

export interface MealProps {
    meal: Meal;
    ate: AteItem[];
    dispatch: React.Dispatch<FatboyAction>;
    showComestible(name: string): void;
    children: ReactNode;
}

export function neatNumber(num: number) {
    return num.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function totalOf<T>(list: T[], get: (i: T) => number) {
    return list.map(get).reduce((l, r) => l + r, 0);
}

export function getTotals(ate: AteItem[]) {
    return {
        calories: totalOf(ate, (x) => x.calories * x.quantity),
        satch: totalOf(ate, (x) => (x.satch ?? 0) * x.quantity),
        sugar: totalOf(ate, (x) => (x.sugar ?? 0) * x.quantity),
        protein: totalOf(ate, (x) => (x.protein ?? 0) * x.quantity),
    };
}

export const MealContents = ({
    meal,
    ate,
    dispatch,
    showComestible,
    children,
}: MealProps) => {
    const totals = getTotals(ate);

    const editingDay = useContext(EditingDay).value;

    function setQuantity(comestible: string, old: number, choice: string) {
        const newQuantity =
            choice === "other" ? prompt("Quantity", `${old}`) : choice;

        if (newQuantity !== null) {
            const parsed = parseFloat(newQuantity);
            if (!isNaN(parsed)) {
                dispatch({
                    type: "ADD_ATE",
                    editingDay,
                    meal,
                    comestible,
                    quantity: parsed,
                });
            }
        }
    }

    return (
        <div className="meal">
            <div className="meal-heading">
                <div className="title">{meal}</div>
                <div className="calories">
                    ⚡️{neatNumber(totals.calories)}
                    <span className="divider">|</span>💔
                    {neatNumber(totals.satch)}
                    <span className="divider">|</span>🦷
                    {neatNumber(totals.sugar)}
                </div>
            </div>
            <div className="ate">
                {ate.map((c) => (
                    <div key={c.id} className="comestible">
                        {!!c.sugar && <span>🦷</span>}
                        {!!c.satch && <span>💔</span>}
                        {!!c.redMeat && <span>🥩</span>}
                        {!!c.alcohol && <span>🍺</span>}
                        {!!c.protein && <span>💪</span>}
                        {(c.satch === undefined ||
                            c.sugar === undefined ||
                            c.redMeat === undefined ||
                            c.alcohol === undefined ||
                            c.protein === undefined) && (
                            <span className="satch">🤨</span>
                        )}
                        <span className="calories">{c.calories}</span>
                        <span
                            className="name"
                            onClick={() => showComestible(c.label)}
                        >
                            {c.label}
                        </span>
                        <select
                            className="quantity"
                            value={c.quantity}
                            onChange={(e) => {
                                setQuantity(c.id, c.quantity, e.target.value);
                            }}
                        >
                            {Object.keys(c.quantities)
                                .map((k) => parseFloat(k))
                                .sort((a, b) => a - b)
                                .map((q) => (
                                    <option value={q} key={q}>
                                        {q}
                                    </option>
                                ))}
                            <option value="other">Other...</option>
                        </select>
                        <span
                            className="delete"
                            onClick={() =>
                                dispatch({
                                    type: "DELETE_ATE",
                                    editingDay,
                                    meal,
                                    comestible: c.id,
                                })
                            }
                        >
                            ❌
                        </span>
                    </div>
                ))}
            </div>
            {children}
        </div>
    );
};
