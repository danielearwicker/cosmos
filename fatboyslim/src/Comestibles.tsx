import { useCallback, useMemo, useRef, useState } from "react";
import {
    categories,
    type Category,
    type FatboyData,
    searchComestibles,
    type Comestible,
    compareStrings,
} from "./data";
import type { FatboyAction } from "./reducer";
import { chain as _ } from "underscore";
import { useStorage } from "../../encrypted-storage/Storage";
import { handleNutritionPhoto } from "./ai";

export interface ConfigProps {
    state: FatboyData;
    dispatch: React.Dispatch<FatboyAction>;
    setEditingDay(day: string): void;
    search: string;
    setSearch(name: string): void;
}

const limitTypes = ["calories", "sugar", "satch"] as const;

type LimitType = (typeof limitTypes)[number];

type LimitsAsStrings = {
    [P in LimitType]: string;
};

type LimitsAsNumbers = {
    [P in LimitType]: number;
};

function getLimitsAsNumbers(asStrings: LimitsAsStrings): LimitsAsNumbers {
    const result: LimitsAsNumbers = {
        calories: Number.MAX_VALUE,
        sugar: Number.MAX_VALUE,
        satch: Number.MAX_VALUE,
    };

    for (const type of limitTypes) {
        const parsed = parseFloat(asStrings[type]);
        if (!isNaN(parsed)) {
            result[type] = parsed;
        }
    }

    return result;
}

function LimitEditor({
    limits,
    update,
    type,
}: {
    limits: LimitsAsStrings;
    update: React.Dispatch<React.SetStateAction<LimitsAsStrings>>;
    type: LimitType;
}) {
    const change = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            update((prev) => ({ ...prev, [type]: e.target.value })),
        [update, type]
    );

    const clear = useCallback(
        () => update((prev) => ({ ...prev, [type]: "" })),
        [update, type]
    );

    return (
        <tr>
            <td>
                <span>{type}</span>
            </td>
            <td>
                <input value={limits[type]} onChange={change} />
            </td>
            <td>
                <button className="clear" onClick={clear}>
                    ❎
                </button>
            </td>
        </tr>
    );
}

export function Comestibles({
    state,
    dispatch,
    setEditingDay,
    search,
    setSearch,
}: ConfigProps) {
    const daysByComestible = useMemo(() => {
        const result: { [id: string]: string[] } = {};

        for (const day of state.days) {
            for (const a of day.ate) {
                const days =
                    result[a.comestible] ?? (result[a.comestible] = []);
                days.push(day.date);
            }
        }

        for (const [id, days] of Object.entries(result)) {
            days.sort();
            days.reverse();
        }

        return result;
    }, [state.days]);

    const [sort, setSort] = useState("latest");
    const [descending, setDescending] = useState(true);
    const [category, setCategory] = useState("");

    const sorted = state.comestibles.slice(0);

    if (sort === "alpha") {
        sorted.sort((l, r) => l.label.localeCompare(r.label));
    } else if (sort === "calories") {
        sorted.sort((l, r) => l.calories - r.calories);
    } else if (sort === "category") {
        sorted.sort((l, r) => l.category.localeCompare(r.category));
    } else if (sort === "satch") {
        sorted.sort((l, r) => (l.satch ?? 0) - (r.satch ?? 0));
    } else if (sort === "eaten") {
        sorted.sort((l, r) => {
            const lDate = daysByComestible[l.id]?.[0] ?? "2000-01-01";
            const rDate = daysByComestible[r.id]?.[0] ?? "2000-01-01";
            return lDate.localeCompare(rDate);
        });
    }

    if (descending) {
        sorted.reverse();
    }

    const filteredByCategory = !category
        ? sorted
        : sorted.filter((x) => x.category === category);

    const [limits, setLimits] = useState({
        calories: "",
        sugar: "",
        satch: "",
    });

    const limitsAsNumbers = getLimitsAsNumbers(limits);

    const filteredByLimits = filteredByCategory.filter(
        (x) =>
            x.calories < limitsAsNumbers.calories &&
            (!x.sugar || x.sugar <= limitsAsNumbers.sugar) &&
            (!x.satch || x.satch <= limitsAsNumbers.satch)
    );

    const [showLimits, setShowLimits] = useState(false);

    const filtered =
        search.trim().length === 0
            ? filteredByLimits
            : searchComestibles(filteredByLimits, search, Number.MAX_VALUE).map(
                  (x) => x.comestible
              );

    const sliced = filtered.slice(0, 100);

    const searchInput = useRef<HTMLInputElement>(null);

    return (
        <div className="config">
            <div className="search-bar">
                <input
                    ref={searchInput}
                    placeholder="filter"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    onClick={() => {
                        setSearch("");
                        searchInput.current?.focus();
                    }}
                >
                    ❎
                </button>
            </div>
            <br />
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="alpha">Sort alphabetically</option>
                <option value="latest">Sort latest first</option>
                <option value="calories">Sort by calories</option>
                <option value="category">Sort by category</option>
                <option value="eaten">Sort by last eaten</option>
                <option value="satch">Sort by satch</option>
            </select>
            <select
                value={descending ? "desc" : "asc"}
                onChange={(e) => setDescending(e.target.value === "desc")}
            >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
            </select>
            <select
                className="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
            >
                <option key={""} value="">
                    All
                </option>
                {categories.map((cat) => (
                    <option key={cat}>{cat}</option>
                ))}
            </select>
            {showLimits ? (
                <table className="limits">
                    <tbody>
                        {limitTypes.map((type) => (
                            <LimitEditor
                                key={type}
                                type={type}
                                limits={limits}
                                update={setLimits}
                            />
                        ))}
                        <tr>
                            <td colSpan={2}>
                                <button onClick={() => setShowLimits(false)}>
                                    Hide
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            ) : (
                <button onClick={() => setShowLimits(true)}>Limits</button>
            )}
            <span className="result-count">{filtered.length} results</span>
            {sliced.map((comestible) => (
                <ComestibleEditor
                    key={comestible.id}
                    comestible={comestible}
                    dispatch={dispatch}
                    daysByComestible={daysByComestible}
                    setEditingDay={setEditingDay}
                    comestibles={state.comestibles}
                />
            ))}
        </div>
    );
}

interface ComestibleProps {
    comestible: Comestible;
    dispatch: React.Dispatch<FatboyAction>;
    daysByComestible: { [id: string]: string[] };
    setEditingDay(day: string): void;
    comestibles: readonly Comestible[];
}

function ComestibleEditor({
    comestible,
    dispatch,
    daysByComestible,
    setEditingDay,
    comestibles,
}: ComestibleProps) {
    const [editing, setEditing] = useState(false);
    const [calories, setCalories] = useState("");
    const [redMeat, setRedMeat] = useState("");
    const [sugar, setSugar] = useState("");
    const [alcohol, setAlcohol] = useState("");
    const [satch, setSatch] = useState("");
    const [protein, setProtein] = useState("");
    const [name, setName] = useState("");

    const [deleting, setDeleting] = useState(false);
    const [filter, setFilter] = useState("");
    const [replacement, setReplacement] = useState("");
    const [quantity, setQuantity] = useState(NaN);

    const onDelete = useCallback(() => {
        const c = daysByComestible[comestible.id] ?? [];
        if (!c.length) {
            if (confirm(`Definitely delete ${comestible.label}?`)) {
                dispatch({
                    type: "DELETE_COMESTIBLE",
                    id: comestible.id,
                });
            }
            return;
        }

        setDeleting(true);
    }, [daysByComestible, comestible]);

    const filteredComestibles = useMemo(() => {
        const others = comestibles.filter(
            (c) =>
                filter &&
                c.id !== comestible.id &&
                compareStrings(c.label, filter) > 0.1
        );
        others.sort(
            (l, r) =>
                compareStrings(r.label, filter) -
                compareStrings(l.label, filter)
        );
        return others.slice(0, 20);
    }, [comestibles, filter, comestible]);

    const onReplaceAndDelete = useCallback(() => {
        const replacementId = replacement || filteredComestibles[0].id;

        const replacementLabel = filteredComestibles.find(
            (c) => c.id === replacementId
        )?.label;

        if (
            confirm(
                `Definitely delete ${comestible.label}, replacing with ${replacementLabel}?`
            )
        ) {
            dispatch({
                type: "DELETE_COMESTIBLE",
                id: comestible.id,
                replacement: replacementId,
                quantity,
            });
        }
        setReplacement("");
        setQuantity(NaN);
        setDeleting(false);
    }, [comestible, replacement, quantity, filteredComestibles]);

    const openApiKey = useStorage().extra.openAiKey;

    const [aiFeedback, setAiFeedback] = useState("");

    const handlePhoto = useCallback(
        async (ev: React.ChangeEvent<HTMLInputElement>) => {
            const result = await handleNutritionPhoto(
                openApiKey,
                ev,
                setAiFeedback
            );
            if (result) {
                setAiFeedback(`For serving size: ${result.serving_size}`);
                setCalories(`${result.energy_kcal}`);
                setSatch(`${result.saturated_fat_g}`);
                setSugar(`${result.sugar_g}`);
            }
        },
        [openApiKey]
    );

    return (
        <div
            key={comestible.id}
            className={`comestible${
                comestible.redMeat
                    ? " red-meat"
                    : comestible.sugar
                    ? " sugar"
                    : comestible.alcohol
                    ? " alcohol"
                    : ""
            }`}
        >
            <div>
                <span className="name">{comestible.label}</span>
                <span className="component">
                    ⚡️ {comestible.calories} kCal
                </span>
                {!!comestible.redMeat && (
                    <span className="component">🥩 {comestible.redMeat}g</span>
                )}
                {!!comestible.sugar && (
                    <span className="component">🦷 {comestible.sugar}g</span>
                )}
                {!!comestible.alcohol && (
                    <span className="component">🍺 {comestible.alcohol}u</span>
                )}
                {!!comestible.satch && (
                    <span className="component">💔 {comestible.satch}g</span>
                )}
                {!!comestible.protein && (
                    <span className="component">💪 {comestible.protein}g</span>
                )}
            </div>
            <select
                className="category"
                value={comestible.category}
                onChange={(e) =>
                    dispatch({
                        type: "SET_CATEGORY",
                        comestible: comestible.id,
                        category: e.target.value as Category,
                    })
                }
            >
                {categories.map((cat) => (
                    <option key={cat}>{cat}</option>
                ))}
            </select>
            {!editing && (
                <>
                    <button
                        onClick={() => {
                            setCalories(`${comestible.calories ?? 0}`);
                            setRedMeat(`${comestible.redMeat ?? 0}`);
                            setSugar(`${comestible.sugar ?? 0}`);
                            setAlcohol(`${comestible.alcohol ?? 0}`);
                            setSatch(`${comestible.satch ?? 0}`);
                            setProtein(`${comestible.protein ?? 0}`);
                            setName(comestible.label);
                            setEditing(true);
                        }}
                    >
                        Edit
                    </button>
                    <button onClick={onDelete}>Delete</button>
                </>
            )}
            {deleting && (
                <div className="deleting">
                    <div>
                        Choose a replacement for the{" "}
                        {(daysByComestible[comestible.id] ?? []).length}{" "}
                        affected meals:
                    </div>
                    <div>
                        <input
                            placeholder="Filter..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <select
                            value={
                                filteredComestibles.length === 1
                                    ? filteredComestibles[0].id
                                    : replacement
                            }
                            onChange={(e) => setReplacement(e.target.value)}
                        >
                            <option value="">Select...</option>
                            {filteredComestibles.map((c) => (
                                <option value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>Quantity</label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) =>
                                setQuantity(e.target.valueAsNumber)
                            }
                        />
                    </div>
                    <div>
                        <button
                            onClick={onReplaceAndDelete}
                            disabled={
                                (!replacement &&
                                    filteredComestibles.length !== 1) ||
                                isNaN(quantity)
                            }
                        >
                            Replace and Delete
                        </button>
                    </div>
                </div>
            )}
            {editing && (
                <div className="editing">
                    {aiFeedback && <div>{aiFeedback}</div>}
                    <div>
                        <input
                            className="name"
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label>⚡️</label>
                        <input
                            type="number"
                            className="calories"
                            placeholder="Calories"
                            value={calories}
                            onChange={(e) => setCalories(e.target.value)}
                        />
                        kCal
                    </div>
                    <div>
                        <label>🥩</label>
                        <input
                            type="number"
                            className="red-meat"
                            placeholder="Red meat"
                            value={redMeat}
                            onChange={(e) => setRedMeat(e.target.value)}
                        />
                        g
                    </div>
                    <div>
                        <label>🦷</label>
                        <input
                            type="number"
                            className="sugar"
                            placeholder="Sugar"
                            value={sugar}
                            onChange={(e) => setSugar(e.target.value)}
                        />
                        g
                    </div>
                    <div>
                        <label>🍺</label>
                        <input
                            type="number"
                            className="alcohol"
                            placeholder="Alcohol"
                            value={alcohol}
                            onChange={(e) => setAlcohol(e.target.value)}
                        />
                        units
                    </div>
                    <div>
                        <label>💔</label>
                        <input
                            type="number"
                            className="sugar"
                            placeholder="Satch"
                            value={satch}
                            onChange={(e) => setSatch(e.target.value)}
                        />
                        g
                    </div>
                    <div>
                        <label>💪</label>
                        <input
                            type="number"
                            className="protein"
                            placeholder="Protein"
                            value={protein}
                            onChange={(e) => setProtein(e.target.value)}
                        />
                        g
                    </div>
                    <div>
                        <button
                            disabled={
                                isNaN(parseFloat(calories)) ||
                                isNaN(parseFloat(redMeat)) ||
                                isNaN(parseFloat(sugar)) ||
                                isNaN(parseFloat(alcohol)) ||
                                isNaN(parseFloat(satch)) ||
                                isNaN(parseFloat(protein))
                            }
                            onClick={() => {
                                dispatch({
                                    type: "CONFIGURE_COMESTIBLE",
                                    comestible: comestible.id,
                                    calories: parseFloat(calories),
                                    redMeat: parseFloat(redMeat),
                                    sugar: parseFloat(sugar),
                                    alcohol: parseFloat(alcohol),
                                    satch: parseFloat(satch),
                                    protein: parseFloat(protein),
                                    newName: name,
                                });
                                setEditing(false);
                            }}
                        >
                            Save
                        </button>
                        <button onClick={() => setEditing(false)}>
                            Cancel
                        </button>

                        <label htmlFor="photo-picker">📸</label>
                        <input
                            id="photo-picker"
                            style={{ display: "none" }}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhoto}
                        />
                    </div>
                </div>
            )}
            <div className="days">
                {(daysByComestible[comestible.id] ?? []).length}x uses:{" "}
                {(daysByComestible[comestible.id] ?? [])
                    .slice(0, 8)
                    .map((x) => (
                        <span
                            className="ate"
                            key={x}
                            onClick={() => setEditingDay(x)}
                        >
                            {x}
                        </span>
                    ))}
            </div>
        </div>
    );
}
