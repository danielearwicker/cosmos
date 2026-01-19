import { memo, useCallback, useMemo, useState } from "react";
import { Body } from "./Body";
import { Comestibles } from "./Comestibles";
import { DayEditor } from "./DayEditor";
import { Notes } from "./Notes";
import { useFatboyStorage } from "./reducer";
import { Stats } from "./Stats";
import { ComestiblesContext, generateComestibleContext } from "./data";
import {
    EditingDay,
    tabs,
    useEditingDayProvider,
    type Tab,
} from "./editingDay";
import { Pills } from "./Pills";

export const Tabs = memo(() => {
    const [state, dispatch, info] = useFatboyStorage();

    const [tab, setTab] = useState<Tab>("meals");
    const [search, setSearch] = useState<string>("");

    const editingDay = useEditingDayProvider(setTab);

    const showComestible = useCallback((name: string) => {
        setTimeout(() => {
            setSearch(name);
            setTab("comestibles");
        }, 1);
    }, []);

    const counts: Partial<Record<Tab, number>> = {
        comestibles: state.comestibles.filter((x) => x.category === "other")
            .length,
    };

    const comestiblesContext = useMemo(
        () => generateComestibleContext(state.comestibles, state.days),
        [state.comestibles, state.days]
    );

    if (!info) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <EditingDay.Provider value={editingDay}>
            <ComestiblesContext.Provider value={comestiblesContext}>
                <div className="fatboy-slim">
                    <div className="tabs">
                        {tabs.map((t) => (
                            <div
                                key={t}
                                className={`tab${t === tab ? " selected" : ""}`}
                                onClick={() => setTab(t)}
                            >
                                {t}
                                {(counts[t] ?? 0) > 0 && (
                                    <div className="count">{counts[t]}</div>
                                )}
                            </div>
                        ))}
                    </div>
                    {tab === "meals" ? (
                        <DayEditor
                            state={state}
                            dispatch={dispatch}
                            showComestible={showComestible}
                        />
                    ) : tab === "stats" ? (
                        <Stats state={state} />
                    ) : tab === "comestibles" ? (
                        <Comestibles
                            state={state}
                            dispatch={dispatch}
                            setEditingDay={(day) =>
                                editingDay.onChange(day, "meals")
                            }
                            search={search}
                            setSearch={setSearch}
                        />
                    ) : tab === "body" ? (
                        <Body state={state} dispatch={dispatch} />
                    ) : tab === "notes" ? (
                        <Notes state={state} dispatch={dispatch} />
                    ) : tab === "pills" ? (
                        <Pills state={state} dispatch={dispatch} />
                    ) : undefined}
                    <div className="info">{info}</div>
                </div>
            </ComestiblesContext.Provider>
        </EditingDay.Provider>
    );
});
