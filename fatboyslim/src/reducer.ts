import { produce } from "immer";
import {
    type Category,
    type FatboyData,
    type Meal,
    type MeasurementType,
} from "./data";
import { useStorage } from "../../encrypted-storage/Storage";
import { useStorageBackedState } from "../../encrypted-storage/useStorageBackedState";

export type FatboyAction =
    | {
          type: "LOAD";
          config: FatboyData;
      }
    | {
          type: "DELETE_ATE";
          editingDay: string;
          meal: Meal;
          comestible: string;
      }
    | {
          type: "ADD_ATE";
          editingDay: string;
          meal: Meal;
          comestible: string;
          quantity: number;
      }
    | {
          type: "ADD_COMESTIBLE";
          editingDay: string;
          name: string;
          calories: number;
          category: Category;
          redMeat: number;
          sugar: number;
          alcohol: number;
          satch: number;
          meal: Meal;
      }
    | {
          type: "DELETE_COMESTIBLE";
          id: string;
          replacement?: string;
          quantity?: number;
      }
    | {
          type: "SET_CATEGORY";
          category: Category;
          comestible: string;
      }
    | {
          type: "CONFIGURE_COMESTIBLE";
          comestible: string;
          calories: number;
          redMeat: number;
          sugar: number;
          alcohol: number;
          satch: number;
          newName: string;
      }
    | {
          type: "ADD_MEASUREMENT";
          editingDay: string;
          measurementType: MeasurementType;
          value: number;
      }
    | {
          type: "REMOVE_MEASUREMENT";
          editingDay: string;
          measurementType: MeasurementType;
      }
    | {
          type: "EDIT_NOTE";
          editingDay: string;
          text: string;
      }
    | {
          type: "ADD_NOTE_PICTURE";
          editingDay: string;
          id: string;
          contentType: string;
      }
    | {
          type: "REMOVE_NOTE_PICTURE";
          editingDay: string;
          id: string;
      };

export function fatboyReducer(data: FatboyData, action: FatboyAction) {
    switch (action.type) {
        case "LOAD": {
            return action.config;
        }
        case "DELETE_ATE":
            return produce(data, (draft) => {
                const dayAt = draft.days.findIndex(
                    (x) => x.date === action.editingDay
                );
                if (dayAt === -1) return;

                const day = draft.days[dayAt];
                const ateAt = day.ate.findIndex(
                    (x) =>
                        x.meal === action.meal &&
                        x.comestible === action.comestible
                );
                if (ateAt === -1) return;

                day.ate.splice(ateAt, 1);

                if (!day.ate.length) {
                    draft.days.splice(dayAt, 1);
                }
            });
        case "ADD_ATE":
            return produce(data, (draft) => {
                let day = draft.days.find((x) => x.date === action.editingDay);
                if (!day) {
                    day = { date: action.editingDay, ate: [] };
                    draft.days.push(day);
                }

                let ate = day.ate.find(
                    (x) =>
                        x.meal === action.meal &&
                        x.comestible === action.comestible
                );
                if (!ate) {
                    ate = {
                        meal: action.meal,
                        comestible: action.comestible,
                        quantity: 0,
                    };
                    day.ate.push(ate);
                }

                ate.quantity = action.quantity;
            });
        case "ADD_COMESTIBLE":
            return produce(data, (draft) => {
                if (
                    !draft.comestibles.find(
                        (c) =>
                            c.label.toLowerCase() === action.name.toLowerCase()
                    )
                ) {
                    const id = window.crypto.randomUUID();
                    draft.comestibles.push({
                        id,
                        label: action.name,
                        calories: action.calories,
                        category: action.category,
                        redMeat: 0,
                        sugar: 0,
                        alcohol: 0,
                        satch: 0,
                    });

                    let day = draft.days.find(
                        (x) => x.date === action.editingDay
                    );
                    if (!day) {
                        day = { date: action.editingDay, ate: [] };
                        draft.days.push(day);
                    }

                    day.ate.push({
                        meal: action.meal,
                        comestible: id,
                        quantity: 1,
                    });
                }
            });
        case "SET_CATEGORY":
            return produce(data, (draft) => {
                const c = draft.comestibles.find(
                    (x) => x.id === action.comestible
                );
                if (c) {
                    c.category = action.category;
                }
            });
        case "CONFIGURE_COMESTIBLE":
            return produce(data, (draft) => {
                const c = draft.comestibles.find(
                    (x) => x.id === action.comestible
                );
                if (c) {
                    c.calories = action.calories;
                    c.redMeat = action.redMeat;
                    c.sugar = action.sugar;
                    c.alcohol = action.alcohol;
                    c.satch = action.satch;
                    c.label = action.newName;
                }
            });
        case "DELETE_COMESTIBLE":
            return produce(data, (draft) => {
                for (const d of draft.days) {
                    for (const a of d.ate) {
                        if (a.comestible === action.id) {
                            if (!action.replacement || !action.quantity) {
                                return;
                            }
                            a.comestible = action.replacement;
                            a.quantity = a.quantity * action.quantity;
                        }
                    }
                }
                const i = draft.comestibles.findIndex(
                    (c) => c.id === action.id
                );
                if (i !== -1) {
                    draft.comestibles.splice(i, 1);
                }
            });
        case "ADD_MEASUREMENT":
            return produce(data, (draft) => {
                const existing = draft.measurements.find(
                    (x) =>
                        x.date === action.editingDay &&
                        x.type === action.measurementType
                );
                if (existing) {
                    existing.value = action.value;
                } else {
                    draft.measurements.push({
                        type: action.measurementType,
                        value: action.value,
                        date: action.editingDay,
                    });
                }
            });
        case "REMOVE_MEASUREMENT":
            return produce(data, (draft) => {
                const existing = draft.measurements.findIndex(
                    (x) =>
                        x.date === action.editingDay &&
                        x.type === action.measurementType
                );
                if (existing !== -1) {
                    draft.measurements.splice(existing, 1);
                }
            });
        case "EDIT_NOTE":
            return produce(data, (draft) => {
                const existing = draft.notes?.find(
                    (x) => x.date === action.editingDay
                );
                if (existing) {
                    existing.text = action.text;
                } else {
                    draft.notes?.push({
                        text: action.text,
                        date: action.editingDay,
                        pictures: [],
                    });
                }
            });
        case "ADD_NOTE_PICTURE":
            return produce(data, (draft) => {
                const existing = draft.notes?.find(
                    (x) => x.date === action.editingDay
                );
                const pic = {
                    id: action.id,
                    type: action.contentType,
                };
                if (existing) {
                    existing.pictures.push(pic);
                } else {
                    draft.notes?.push({
                        text: "",
                        date: action.editingDay,
                        pictures: [pic],
                    });
                }
            });
        case "REMOVE_NOTE_PICTURE":
            return produce(data, (draft) => {
                const existing = draft.notes?.find(
                    (x) => x.date === action.editingDay
                );
                if (existing) {
                    const i = existing.pictures.findIndex(
                        (x) => x.id === action.id
                    );
                    if (i !== -1) {
                        existing.pictures.splice(i, 1);
                    }
                }
            });
    }

    const catchAll: never = action;
    throw new Error(`Unrecognised action ${JSON.stringify(catchAll)}`);
}

const initialState: FatboyData = {
    measurements: [],
    comestibles: [],
    days: [],
    notes: [],
};

function generateLoadAction(config: FatboyData): FatboyAction {
    return { type: "LOAD", config };
}

export function useFatboyStorage() {
    const storage = useStorage();

    return useStorageBackedState(
        storage,
        "fatboy",
        fatboyReducer,
        initialState,
        generateLoadAction
    );
}

export type FatboyStorage = ReturnType<typeof useFatboyStorage>;
