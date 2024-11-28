import React, { useContext } from "react";
import { type ReactNode } from "react";
import { type ComestibleWithQuantities, type Meal } from "./data";
import { type FatboyAction } from "./reducer";
import { EditingDay } from "./editingDay";

export interface MealProps {
    meal: Meal;
    ate: (ComestibleWithQuantities & {
        quantity: number;
    })[];
    stats: {
        caloriesAverage: number;
    };
    limit: number;
    dispatch: React.Dispatch<FatboyAction>;
    showComestible(name: string): void;
    children: ReactNode;
}

export const MealContents = ({
    meal,
    ate,
    stats,
    limit,
    dispatch,
    showComestible,
    children,
}: MealProps) => {
    const totalCalories = ate
        .map((x) => x.calories * x.quantity)
        .reduce((l, r) => l + r, 0);

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

    const percentageOfAverage = (100 * totalCalories) / stats.caloriesAverage;

    return (
        <div className="meal">
            <div className="meal-heading">
                <div className="title">{meal}</div>
                <div className="calories">
                    {totalCalories
                        .toFixed(2)
                        .replace(/0+$/, "")
                        .replace(/\.$/, "")}{" "}
                    {!isNaN(percentageOfAverage) &&
                        `(${percentageOfAverage.toFixed(0)}%)`}
                </div>
            </div>
            <div className="ate">
                {ate.map((c) => (
                    <div key={c.id} className="comestible">
                        {!!c.sugar && <span>🦷</span>}
                        {!!c.satch && <span>💔</span>}
                        {!!c.redMeat && <span>🥩</span>}
                        {!!c.alcohol && <span>🍺</span>}
                        {(c.satch === undefined ||
                            c.sugar === undefined ||
                            c.redMeat === undefined ||
                            c.alcohol === undefined) && (
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
