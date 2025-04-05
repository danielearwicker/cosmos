import {
    fromIsoDate,
    isoDate,
    type Dose,
    type FatboyData,
    type Pill,
} from "./data";
import { chain as _ } from "underscore";
import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { upgrade, type FatboyAction } from "./reducer";
import { EditingDay } from "./editingDay";
import { DatePicker } from "./DatePicker";
import { all } from "underscore";

export interface PillsProps {
    state: FatboyData;
    dispatch: React.Dispatch<FatboyAction>;
}

const hourInMs = 1000 * 60 * 60;
const dayInMs = hourInMs * 24;

export function Pills({ state, dispatch }: PillsProps) {
    state = upgrade(state);

    const editingDay = useContext(EditingDay);

    const [now, setNow] = useState(getNowToNearestMinute());

    const modifyNow = useCallback((time: number) => {
        setNow(time);
        editingDay.onChange(isoDate(new Date(time)));
    }, []);

    const modifyDate = useCallback(
        (date: string) => {
            const oldDateTime = new Date(now);
            const newDateTime = fromIsoDate(date);
            modifyNow(
                new Date(
                    newDateTime.getFullYear(),
                    newDateTime.getMonth(),
                    newDateTime.getDate(),
                    oldDateTime.getHours(),
                    oldDateTime.getMinutes(),
                    0,
                    0
                ).getTime()
            );
        },
        [now, modifyNow]
    );

    const modifyHour = useCallback(
        (hour: number) => {
            const dt = new Date(now);
            dt.setHours(hour);
            modifyNow(dt.getTime());
        },
        [now, modifyNow]
    );

    const modifyMinute = useCallback(
        (min: number) => {
            const dt = new Date(now);
            dt.setMinutes(min);
            modifyNow(dt.getTime());
        },
        [now, modifyNow]
    );

    useEffect(() => {
        // On mounting, set the date to today
        modifyNow(now);
    }, []);

    useEffect(() => {
        // If within a minute of now, track the current time
        if (Math.abs(getNowToNearestMinute() - now) < 1000 * 60) {
            const interval = window.setInterval(() => {
                const newNow = getNowToNearestMinute();
                if (newNow !== now) {
                    modifyNow(newNow);
                }
            }, 1000);
            return () => window.clearInterval(interval);
        }
        return undefined;
    }, [now]);

    const nowMinus7Days = now - dayInMs * 7;

    const recentDoses: DoseWithPill[] = useMemo(() => {
        return state.doses
            .filter((d) => d.time >= nowMinus7Days && d.time <= now)
            .map((dose) => ({
                time: dose.time,
                pill: state.pills.find((p) => p.id === dose.pill)!,
            }))
            .filter((dose) => dose.pill)
            .sort((l, r) => {
                return r.time - l.time;
            });
    }, [state.doses, nowMinus7Days, state.pills]);

    const pills = useMemo(
        () =>
            state.pills.map((pill) => {
                let pillDoses = recentDoses
                    .filter((x) => x.pill.id === pill.id)
                    .map((x) => x.time);

                const nextDoseTimeByBetweenDoses =
                    pillDoses.length === 0
                        ? now
                        : Math.max(
                              now,
                              pillDoses[0] + pill.hoursBetweenDoses * hourInMs
                          );

                const nextDoseTimeByMaxDosesPerDay =
                    pillDoses.length < pill.maxDosesPerDay
                        ? now
                        : pillDoses[pill.maxDosesPerDay - 1] + dayInMs;

                const nextDoseTime = Math.max(
                    nextDoseTimeByBetweenDoses,
                    nextDoseTimeByMaxDosesPerDay
                );

                return {
                    ...pill,
                    nextDoseTime,
                    available: nextDoseTime <= now,
                };
            }),
        [state.pills, recentDoses, now]
    );

    return (
        <div className="pills">
            <div className="date-time">
                <DatePicker value={editingDay.value} onChange={modifyDate} />
                <div className="time">
                    <NumberEditor
                        value={new Date(now).getHours()}
                        onChange={modifyHour}
                    />
                    <NumberEditor
                        value={new Date(now).getMinutes()}
                        onChange={modifyMinute}
                    />
                    <button onClick={() => modifyNow(getNowToNearestMinute())}>
                        Now
                    </button>
                </div>
            </div>
            <div className="pill-buttons">
                {pills.map((pill) => (
                    <button
                        className={`pill ${
                            pill.available ? "available" : "unavailable"
                        }`}
                        key={pill.id}
                        disabled={!pill.available}
                        onClick={() => {
                            dispatch({
                                type: "ADD_DOSE",
                                time: now,
                                pill: pill.id,
                            });
                        }}
                    >
                        <div className="name">{pill.name}</div>
                        {pill.available ? (
                            "✅"
                        ) : (
                            <div className="next-dose">
                                ❌ until {getLocalTimeString(pill.nextDoseTime)}
                            </div>
                        )}
                    </button>
                ))}
            </div>
            <Doses doses={recentDoses} dispatch={dispatch} />
            <PillEditor pills={state.pills} dispatch={dispatch} />
        </div>
    );
}

type DoseWithPill = Readonly<{ time: number; pill: Pill }>;

function Dose({
    dose,
    dispatch,
}: {
    dose: DoseWithPill;
    dispatch: React.Dispatch<FatboyAction>;
}) {
    const remove = useCallback(
        () =>
            dispatch({
                type: "REMOVE_DOSE",
                time: dose.time,
                pill: dose.pill.id,
            }),
        [dose.time, dose.pill.id, dispatch]
    );

    return (
        <div className="dose">
            <div className="time">{getLocalTimeString(dose.time)}</div>
            <div className="pill">{dose.pill.name}</div>
            <button className="remove" onClick={remove}>
                ❌
            </button>
        </div>
    );
}

function Doses({
    doses,
    dispatch,
}: {
    doses: DoseWithPill[];
    dispatch: React.Dispatch<FatboyAction>;
}) {
    const groupedByDate = _(doses)
        .map((d) => ({
            ...d,
            dateHeading: getLocalDayName(d.time),
        }))
        .groupBy((d) => d.dateHeading)
        .pairs()
        .map(([day, doses]) => ({
            day,
            doses,
        }))
        .value();

    return (
        <div className="doses-day">
            {groupedByDate.map(({ day, doses }) => (
                <>
                    <h2 key={day}>{day}</h2>
                    <div className="doses">
                        {doses.map((dose) => (
                            <Dose
                                dose={dose}
                                key={`${dose.time}-${dose.pill.id}`}
                                dispatch={dispatch}
                            />
                        ))}
                    </div>
                </>
            ))}
        </div>
    );
}

function NumberEditor({
    value,
    onChange,
    allowInvalid,
}: {
    value: number;
    onChange: (v: number) => void;
    allowInvalid?: boolean;
}) {
    const currentAsString = isNaN(value) ? "" : value + "";
    const [str, setStr] = useState<string | undefined>(undefined);

    const change = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const newValue = parseFloat(e.target.value);
            if (!isNaN(newValue)) {
                onChange(newValue);
                setStr(undefined);
            } else {
                setStr(e.target.value);
                if (allowInvalid) {
                    onChange(NaN);
                }
            }
        },
        [onChange, value]
    );

    return (
        <input type="number" value={str ?? currentAsString} onChange={change} />
    );
}

function PillEditor({
    pills,
    dispatch,
}: {
    pills: readonly Pill[];
    dispatch: React.Dispatch<FatboyAction>;
}) {
    const [editing, setEditing] = useState<Pill>();

    const [name, setName] = useState("");
    const [hoursBetweenDoses, setHoursBetweenDoses] = useState(NaN);
    const [maxDosesPerDay, setMaxDosesPerDay] = useState(NaN);

    const edit = useCallback(
        (id: string) => {
            const pill = pills.find((p) => p.id === id);
            if (pill) {
                setEditing(pill);
                setName(pill.name);
                setHoursBetweenDoses(pill.hoursBetweenDoses);
                setMaxDosesPerDay(pill.maxDosesPerDay);
            } else {
                setEditing(undefined);
                setName("");
                setHoursBetweenDoses(NaN);
                setMaxDosesPerDay(NaN);
            }
        },
        [pills]
    );

    return (
        <div className="pill-editor">
            <select
                value={editing?.id ?? ""}
                onChange={(e) => edit(e.target.value)}
            >
                <option value="">Add a new type of pill</option>
                {pills.map((pill) => (
                    <option key={pill.id} value={pill.id}>
                        {pill.name}
                    </option>
                ))}
            </select>

            <table>
                <tr>
                    <td>Name</td>
                    <td>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </td>
                </tr>
                <tr>
                    <td>Hours between doses</td>
                    <td>
                        <NumberEditor
                            value={hoursBetweenDoses}
                            onChange={setHoursBetweenDoses}
                            allowInvalid={true}
                        />
                    </td>
                </tr>
                <tr>
                    <td>Max per 24 hours</td>
                    <td>
                        <NumberEditor
                            value={maxDosesPerDay}
                            onChange={setMaxDosesPerDay}
                            allowInvalid={true}
                        />
                    </td>
                </tr>
            </table>

            <div className="action-buttons">
                <button
                    disabled={
                        !name.trim() ||
                        isNaN(hoursBetweenDoses) ||
                        isNaN(maxDosesPerDay) ||
                        (name === editing?.name &&
                            hoursBetweenDoses === editing?.hoursBetweenDoses &&
                            maxDosesPerDay === editing?.maxDosesPerDay)
                    }
                    onClick={() => {
                        const pill = {
                            name,
                            hoursBetweenDoses,
                            maxDosesPerDay,
                        };
                        if (!editing) {
                            dispatch({
                                type: "ADD_PILL",
                                ...pill,
                            });
                        } else {
                            dispatch({
                                type: "UPDATE_PILL",
                                id: editing!.id,
                                ...pill,
                            });
                        }
                        edit("");
                    }}
                >
                    {editing ? "Save" : "Add"}
                </button>
                {editing && <button onClick={() => edit("")}>Cancel</button>}
            </div>
        </div>
    );
}

function getLocalDayName(time: number) {
    const d = new Date(time);

    const dayOfWeek = d.toLocaleDateString("en-gb", { weekday: "long" });
    const monthName = d.toLocaleDateString("en-gb", { month: "short" });
    const date = `${d.getDate()}`.padStart(2, "0");

    return ` ${date} ${monthName} - ${dayOfWeek}`;
}

function getLocalTimeString(time: number) {
    const d = new Date(time);
    return (
        `${d.getHours()}`.padStart(2, "0") +
        ":" +
        `${d.getMinutes()}`.padStart(2, "0")
    );
}

function getNowToNearestMinute() {
    const d = new Date();
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d.getTime();
}
