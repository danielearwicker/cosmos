import {
    parseStatement,
    type Payment,
    removeAdjacentDuplicates,
    sort,
} from "./statements";
import { useStorage } from "../../encrypted-storage/Storage";
import { useStorageBackedState } from "../../encrypted-storage/useStorageBackedState";

export type SpendyAction =
    | {
          type: "LOAD";
          state: SpendyState;
      }
    | {
          type: "CATEGORY_SET";
          description: string;
          category: string;
      }
    | {
          type: "ADD_BANK_STATEMENT";
          text: string;
      }
    | {
          type: "ADD_CATEGORIES";
          text: string;
      }
    | {
          type: "ADD_TRANSACTION_CATEGORIES";
          text: string;
      };

export type SpendyState = Readonly<{
    transactions: readonly Readonly<Payment>[];
    categories: readonly (readonly [label: string, explanation: string])[];
    categoriesByDescription: Readonly<Record<string, string>>;
}>;

export function normalizeCategory(category: string) {
    return category
        .replace(/^[\s\/]+/, "")
        .replace(/[\s\/]+$/, "")
        .replace(/\s+/, "-")
        .toLocaleLowerCase();
}

export function spendyReducer(old: SpendyState, action: SpendyAction) {
    switch (action.type) {
        case "LOAD": {
            console.log(action.state);

            return {
                transactions: action.state.transactions ?? [],
                categories: action.state.categories ?? [],
                categoriesByDescription:
                    action.state.categoriesByDescription ?? {},
            };
        }

        case "ADD_BANK_STATEMENT": {
            const payments = old.transactions.concat(
                parseStatement(action.text)
            );
            const sorted = sort(payments)
                .by("date")
                .thenBy("description")
                .thenBy("amount")
                .thenBy("line")
                .value();
            removeAdjacentDuplicates(sorted);
            return { ...old, transactions: sorted };
        }

        case "CATEGORY_SET": {
            const category = normalizeCategory(action.category);

            const categoriesByDescription = {
                ...old.categoriesByDescription,
                [action.description]: category,
            };

            return {
                ...old,
                categoriesByDescription,
            };
        }

        case "ADD_CATEGORIES": {
            const parsed = JSON.parse(action.text) as readonly (readonly [
                name: string,
                explanation: string
            ])[];
            const newCategories = old.categories.slice(0);

            for (const [name, explanation] of parsed) {
                const category = normalizeCategory(name);
                if (!newCategories.some((c) => c[0] === category)) {
                    newCategories.push([category, explanation]);
                }
            }

            return {
                ...old,
                categories: newCategories,
            };
        }

        case "ADD_TRANSACTION_CATEGORIES": {
            const parsed = JSON.parse(action.text) as readonly (readonly [
                description: string,
                category: string
            ])[];
            const categoriesByDescription = { ...old.categoriesByDescription };

            for (const [description, category] of parsed) {
                categoriesByDescription[description] =
                    normalizeCategory(category);
            }
            return {
                ...old,
                categoriesByDescription,
            };
        }
    }

    checkUnhandledAction(action);
    return old;
}

function checkUnhandledAction(action: never) {
    throw new Error("Unknown action: " + JSON.stringify(action));
}

const initialState: SpendyState = {
    transactions: [],
    categories: [],
    categoriesByDescription: {},
};

function generateLoadAction(state: SpendyState): SpendyAction {
    return { type: "LOAD", state };
}

export function useSpendyStorage() {
    const storage = useStorage();

    return useStorageBackedState(
        storage,
        "spendy",
        spendyReducer,
        initialState,
        generateLoadAction
    );
}

export type SpendyStorage = ReturnType<typeof useSpendyStorage>;
