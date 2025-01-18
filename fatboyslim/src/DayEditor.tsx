import { useContext, useMemo } from "react";
import { AddComestible } from "./AddComestible";
import { ComestiblesContext, type FatboyData, meals } from "./data";
import { DatePicker } from "./DatePicker";
import { getTotals, MealContents } from "./MealContents";
import { getDailyLimit, ProgressBar } from "./ProgressBar";
import { type FatboyAction } from "./reducer";
import { chain as _ } from "underscore";
import { EditingDay } from "./editingDay";

export interface DayEditorProps {
    state: FatboyData;
    dispatch: React.Dispatch<FatboyAction>;
    showComestible(name: string): void;
}

export function DayEditor({ state, dispatch, showComestible }: DayEditorProps) {
    const editingDay = useContext(EditingDay);

    const existingDay = useMemo(
        () => state.days.find((x) => x.date === editingDay.value),
        [state.days, editingDay.value]
    );

    const day = existingDay ?? {
        date: editingDay.value,
        ate: [],
    };

    const comestibles = useContext(ComestiblesContext);

    const ate = day.ate
        .map((x) => ({
            meal: x.meal,
            comestible: comestibles[x.comestible]!,
            quantity: x.quantity,
        }))
        .filter((x) => !!x.comestible);

    const totals = getTotals(
        ate.map((a) => ({ ...a.comestible, quantity: a.quantity }))
    );
    const dailyLimits = getDailyLimit(editingDay.value);
    const remainingCalories = Math.max(dailyLimits.calories - totals.calories);

    const byMeal = useMemo(
        () =>
            meals.map((m) => ({
                meal: m,
                ate: ate
                    .filter((a) => a.meal === m)
                    .map((a) => ({ ...a.comestible, quantity: a.quantity })),
            })),
        [meals, ate]
    );

    return (
        <>
            <DatePicker {...editingDay} />
            <ProgressBar
                icon={"⚡️"}
                total={totals.calories}
                dailyLimit={dailyLimits.calories}
            />
            <ProgressBar
                icon={"💔"}
                total={totals.satch}
                dailyLimit={dailyLimits.satch}
            />
            <ProgressBar
                icon={"🦷"}
                total={totals.sugar}
                dailyLimit={dailyLimits.sugar}
            />
            <div className="day">
                {!existingDay && <p>It's a brand new day!</p>}
                {byMeal.map((m) => (
                    <MealContents
                        key={m.meal}
                        meal={m.meal}
                        ate={m.ate}
                        dispatch={dispatch}
                        showComestible={showComestible}
                    >
                        <AddComestible
                            key={`${m.meal}_add_comestible`}
                            day={day}
                            meal={m.meal}
                            limit={remainingCalories}
                            state={state}
                            dispatch={dispatch}
                        />
                    </MealContents>
                ))}
            </div>
        </>
    );
}
