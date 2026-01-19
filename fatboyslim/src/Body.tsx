import { useContext, useState } from "react";
import {
    type FatboyData,
    type MeasurementType,
    measurementTypes,
} from "./data";
import { type FatboyAction } from "./reducer";
import { DatePicker } from "./DatePicker";
import { StackedBar } from "./StackedBar";
import { EditingDay } from "./editingDay";

export interface BodyProps {
    state: FatboyData;
    dispatch: React.Dispatch<FatboyAction>;
}

export function Body({ state, dispatch }: BodyProps) {
    const [type, setType] = useState<MeasurementType>(measurementTypes[0]);

    const orderedMeasurements = state.measurements.slice();
    orderedMeasurements.sort((l, r) => l.date.localeCompare(r.date));

    // Remove duplicate entries for same day
    for (let n = 0; n < orderedMeasurements.length - 1; n++) {
        if (orderedMeasurements[n].date === orderedMeasurements[n + 1].date) {
            orderedMeasurements.splice(n, 1);
            n--;
        }
    }

    const waistData = orderedMeasurements.filter((m) => m.type === "Waist/cm");
    const weightData = orderedMeasurements.filter(
        (m) => m.type === "Weight/kg"
    );

    function fetchValue(day: string, type: MeasurementType) {
        const m = orderedMeasurements.find(
            (x) => x.date === day && x.type === type
        );
        return "" + (m?.value ?? "");
    }

    const editingDay = useContext(EditingDay);

    const [value, setValue] = useState(fetchValue(editingDay.value, type));

    function add() {
        if (!value) {
            dispatch({
                type: "REMOVE_MEASUREMENT",
                editingDay: editingDay.value,
                measurementType: type,
            });
        } else {
            dispatch({
                type: "ADD_MEASUREMENT",
                editingDay: editingDay.value,
                measurementType: type,
                value: parseFloat(value),
            });
        }
    }

    const showData = type === "Waist/cm" ? waistData : weightData;

    return (
        <>
            <DatePicker {...editingDay} />
            <div className="measurements">
                <div className="entry">
                    <div className="type">
                        <select
                            value={type}
                            onChange={(e) =>
                                setType(e.target.value as MeasurementType)
                            }
                        >
                            {measurementTypes.map((x) => (
                                <option key={x}>{x}</option>
                            ))}
                        </select>
                    </div>
                    <div className="value">
                        <input
                            type="number"
                            placeholder="Value"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                    </div>
                    <div className="buttons">
                        <button onClick={add}>Add</button>
                    </div>
                </div>
                <div className="history">
                    <StackedBar
                        title={type}
                        sort="bar"
                        source={showData.map((fact) => ({
                            bar: fact.date,
                            segment: type,
                            value: fact.value,
                        }))}
                    />
                </div>
            </div>
        </>
    );
}
