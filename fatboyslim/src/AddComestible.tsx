import React, {
    memo,
    useCallback,
    useContext,
    useId,
    useMemo,
    useState,
} from "react";
import {
    type Comestible,
    ComestiblesContext,
    dateDiff,
    type Day,
    type FatboyData,
    type Meal,
    searchComestibles,
    sortComestibleChoices,
} from "./data";
import { type FatboyAction } from "./reducer";
import { EditingDay } from "./editingDay";
import { useStorage } from "../../encrypted-storage/Storage";
import { handleNutritionPhoto } from "./ai";

export type AddComestibleProps = Readonly<{
    day: Day;
    meal: Meal;
    state: FatboyData;
    limit: number;
    dispatch: React.Dispatch<FatboyAction>;
}>;

export function getLatestQuantity(state: FatboyData, comestible: string) {
    const sorted: [string, number][] = [];

    for (const day of state.days) {
        for (const ate of day.ate) {
            if (ate.comestible === comestible) {
                sorted.push([day.date, ate.quantity]);
            }
        }
    }

    sorted.sort((l, r) => dateDiff(l[0], r[0]));

    const frequencies: Record<number, number> = {};

    for (const quantity of sorted.map((s) => s[1]).slice(0, 10)) {
        frequencies[quantity] = (frequencies[quantity] ?? 0) + 1;
    }

    const mostFrequent = Object.entries(frequencies).sort(
        (l, r) => r[1] - l[1]
    )[0];

    return mostFrequent ? parseFloat(mostFrequent[0]) : 1;
}

export function mostOftenEatenWith(
    comestiblesMap: ComestiblesContext,
    state: FatboyData,
    meal: Meal,
    ate: string[],
    day: string,
    limit: number
) {
    const lastConsumed: Record<string, string[]> = {};

    for (const d of state.days) {
        for (const a of d.ate) {
            if (a.meal === meal) {
                const lc =
                    lastConsumed[a.comestible] ??
                    (lastConsumed[a.comestible] = []);
                if (lc.length === 10) {
                    lc.shift();
                }
                lc.push(d.date);
            }
        }
    }

    const frequencies: { comestible: Comestible; hits: number }[] = [];

    for (const [comestible, lc] of Object.entries(lastConsumed)) {
        let hits = 0;
        if (lc.length > 1) {
            const last = lc.length - 1;
            const daysToNow = Math.abs(dateDiff(lc[last], day));
            if (daysToNow < 50) {
                for (let n = 0; n < last; n++) {
                    const daysBetween = dateDiff(lc[n], lc[n + 1]);
                    if (daysToNow % daysBetween === 0) {
                        hits += 1 / (daysToNow / daysBetween);
                    }
                }
            }
        }

        if (hits > 0) {
            frequencies.push({
                comestible: state.comestibles.find((c) => c.id === comestible)!,
                hits,
            });
        }
    }

    const rightAboutNow = frequencies
        .slice(0, 8)
        .map((x) => ({
            comestible: x.comestible,
            weight: x.hits,
        }))
        .filter((x) => x.weight > 0);

    const eatenToday: { [id: string]: boolean } = {};

    for (const a of ate) {
        eatenToday[a] = true;
    }

    const network: {
        [id: string]: number;
    } = {};

    for (const d of state.days) {
        const daysAgo = Math.abs(dateDiff(d.date, day));

        const timeWeight = Math.exp(-daysAgo / 50);

        for (const eatenThen of d.ate) {
            if (eatenThen.meal === meal && eatenToday[eatenThen.comestible]) {
                for (const eatenThenOther of d.ate) {
                    if (
                        eatenThenOther.meal === meal &&
                        !eatenToday[eatenThenOther.comestible]
                    ) {
                        network[eatenThenOther.comestible] =
                            (network[eatenThenOther.comestible] ?? 0) +
                            timeWeight;
                    }
                }
            }
        }
    }

    const suggestions = Object.entries(network).map(([id, weight]) => ({
        id,
        weight,
    }));
    suggestions.sort((l, r) => r.weight - l.weight);

    const implied = suggestions.slice(0, 5).map((x) => ({
        comestible: comestiblesMap[x.id],
        weight: x.weight,
    }));

    const extras = state.comestibles.filter(
        (x) =>
            x.calories < limit && x.category == "treat" && !ate.includes(x.id)
    );
    extras.sort((l, r) => r.calories - l.calories);
    const topExtras = extras.slice(0, 5).map((comestible) => ({
        weight: 1,
        comestible,
    }));

    const candidates =
        ate.length === 0
            ? rightAboutNow
            : implied.length !== 0
            ? implied
            : topExtras;

    sortComestibleChoices(candidates, limit);

    return candidates;
}

export const AddComestible = memo(
    ({ day, meal, limit, state, dispatch }: AddComestibleProps) => {
        const [search, setSearch] = useState("");
        const [calories, setCalories] = useState("");

        const ate = useMemo(
            () =>
                day.ate.filter((a) => a.meal === meal).map((a) => a.comestible),
            [day.ate]
        );

        const comestiblesMap = useContext(ComestiblesContext);

        const mealChoices = useMemo(
            () =>
                mostOftenEatenWith(
                    comestiblesMap,
                    state,
                    meal,
                    ate,
                    day.date,
                    limit
                ),
            [comestiblesMap, state, meal, ate, day.date]
        );

        const found = (
            search.trim().length > 0
                ? searchComestibles(
                      state.comestibles.filter((x) => !ate.includes(x.id)),
                      search,
                      limit
                  )
                : mealChoices
        ).slice(0, 10);

        if (search.trim().length > 0) {
            // put best match at bottom so it's next to search input box
            found.reverse();
        }

        function reset() {
            setSearch("");
            setCalories("");
        }

        const editingDay = useContext(EditingDay).value;

        const [aiFeedback, setAiFeedback] = useState("");
        const openApiKey = useStorage().extra.openAiKey;

        const handlePhoto = useCallback(
            async (ev: React.ChangeEvent<HTMLInputElement>) => {
                console.log("Furbies", {
                    search,
                    meal,
                    editingDay,
                });

                const result = await handleNutritionPhoto(
                    openApiKey,
                    ev,
                    setAiFeedback
                );
                if (result) {
                    dispatch({
                        type: "ADD_COMESTIBLE",
                        editingDay,
                        name: search,
                        calories: result.energy_kcal,
                        category: "other",
                        redMeat: 0,
                        satch: result.saturated_fat_g,
                        protein: result.protein_g,
                        alcohol: 0,
                        sugar: result.sugar_g,
                        meal,
                    });
                    reset();
                    setAiFeedback(`For serving size: ${result.serving_size}`);
                }
            },
            [openApiKey, search, meal, editingDay]
        );

        const photoButtonId = useId();

        return (
            <>
                {found.map((c) => (
                    <div
                        key={c.comestible.id}
                        className={`comestible addable${
                            c.comestible.calories > limit ? " too-much" : ""
                        }`}
                        onClick={() => {
                            dispatch({
                                type: "ADD_ATE",
                                editingDay,
                                meal,
                                comestible: c.comestible.id,
                                quantity: getLatestQuantity(
                                    state,
                                    c.comestible.id
                                ),
                            });
                            reset();
                        }}
                    >
                        {!!c.comestible.sugar && <span>🦷</span>}
                        {!!c.comestible.satch && <span>💔</span>}
                        {!!c.comestible.redMeat && <span>🥩</span>}
                        {!!c.comestible.alcohol && <span>🍺</span>}
                        <span className="calories">
                            {c.comestible.calories}
                        </span>
                        <span className="name">{c.comestible.label}</span>
                        {!!c.weight && (
                            <span className="weight">
                                {c.weight.toFixed(2)}
                            </span>
                        )}
                    </div>
                ))}
                <div className={`add-comestible ${meal}`}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const caloriesNumber = parseFloat(calories);
                            if (!isNaN(caloriesNumber) && !!search) {
                                dispatch({
                                    type: "ADD_COMESTIBLE",
                                    editingDay,
                                    name: search,
                                    calories: parseFloat(calories),
                                    category: "other",
                                    redMeat: 0,
                                    satch: 0,
                                    alcohol: 0,
                                    sugar: 0,
                                    protein: 0,
                                    meal,
                                });
                                reset();
                            }
                        }}
                    >
                        <input
                            className="search"
                            placeholder="Comestible"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <input
                            className="calories"
                            placeholder="Calories"
                            value={calories}
                            onChange={(e) => setCalories(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isNaN(parseFloat(calories)) || !search}
                        >
                            Add
                        </button>

                        <label htmlFor={photoButtonId}>📸</label>
                        <input
                            id={photoButtonId}
                            style={{ display: "none" }}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhoto}
                        />
                        {aiFeedback && <div>{aiFeedback}</div>}
                    </form>
                </div>
            </>
        );
    }
);
