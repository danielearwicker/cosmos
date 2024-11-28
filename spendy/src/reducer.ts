import { type AmazonOrder, parseAmazonOrderHistory } from "./amazon";
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
          pattern: string;
          category: string;
      }
    | {
          type: "CATEGORY_RENAME";
          category: string;
          renamed: string;
      }
    | {
          type: "ADD_BANK_STATEMENT";
          text: string;
      }
    | {
          type: "CATEGORY_EXCLUDE";
          category: string;
          excluded: boolean;
      }
    | {
          type: "IMPORT_AMAZON_STATEMENT";
          text: string;
          us: boolean;
      }
    | {
          type: "SAVE_MANUAL_MATCH";
          payments: string[];
          orders: string[];
      };

export interface ManualMatch {
    payments: string[];
    orders: string[];
}

export type SpendyState = Readonly<{
    payments: readonly Payment[];
    categories: readonly string[];
    patternsToCategories: Readonly<Record<string, string>>;
    excludedCategories: string[];
    amazonOrders: readonly AmazonOrder[];
    amazonUsOrders?: readonly AmazonOrder[];
    manualMatches: readonly ManualMatch[];
}>;

export function normalizeCategory(category: string) {
    return category
        .replace(/^[\s\/]+/, "")
        .replace(/[\s\/]+$/, "")
        .replace(/\s+/, "-")
        .toLocaleLowerCase();
}

function getCategories(patternsToCategories: Readonly<Record<string, string>>) {
    const categories: Record<string, boolean> = {};

    for (const c of Object.values(patternsToCategories)) {
        categories[c] = true;
    }

    return Object.keys(categories);
}

export function spendyReducer(old: SpendyState, action: SpendyAction) {
    switch (action.type) {
        case "LOAD": {
            return action.state;
        }

        case "ADD_BANK_STATEMENT": {
            const payments = old.payments.concat(parseStatement(action.text));
            const sorted = sort(payments)
                .by("date")
                .thenBy("description")
                .thenBy("amount")
                .thenBy("line")
                .value();
            removeAdjacentDuplicates(sorted);
            return { ...old, payments: sorted };
        }

        case "CATEGORY_SET": {
            const category = normalizeCategory(action.category);

            const patternsToCategories = {
                ...old.patternsToCategories,
                [action.pattern]: category,
            };

            return {
                ...old,
                patternsToCategories,
                categories: getCategories(patternsToCategories),
            };
        }

        case "CATEGORY_RENAME": {
            const renamed = `${normalizeCategory(action.renamed)}/`;
            const category = `${action.category}/`;

            function rename(c: string) {
                const suffixed = `${c}/`;
                if (!suffixed.startsWith(category)) {
                    return c;
                }

                return normalizeCategory(
                    `${renamed}${suffixed.substring(category.length)}`
                );
            }

            const patternsToCategories = Object.fromEntries(
                Object.entries(old.patternsToCategories).map(([p, c]) => [
                    p,
                    rename(c),
                ])
            );

            const excludedCategories = old.excludedCategories.map(rename);

            return {
                ...old,
                patternsToCategories,
                excludedCategories,
                categories: getCategories(patternsToCategories),
            };
        }

        case "CATEGORY_EXCLUDE": {
            const category = normalizeCategory(action.category);

            const excludedCategories = old.excludedCategories.filter(
                (x) => !`${x}/`.startsWith(`${category}/`)
            );

            if (action.excluded) {
                excludedCategories.push(category);
            }

            console.log(excludedCategories);

            return { ...old, excludedCategories };
        }

        case "IMPORT_AMAZON_STATEMENT": {
            const parsed = parseAmazonOrderHistory(action.text);

            return action.us
                ? {
                      ...old,
                      amazonUsOrders: parsed,
                  }
                : {
                      ...old,
                      amazonOrders: parsed,
                  };
        }

        case "SAVE_MANUAL_MATCH": {
            return {
                ...old,
                manualMatches: [
                    ...old.manualMatches,
                    {
                        payments: action.payments,
                        orders: action.orders,
                    },
                ],
            };
        }
    }
}

const initialState: SpendyState = {
    payments: [],
    categories: [],
    patternsToCategories: {},
    excludedCategories: [],
    amazonOrders: [],
    manualMatches: [],
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
