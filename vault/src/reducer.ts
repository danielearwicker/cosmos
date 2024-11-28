import { useStorage } from "../../encrypted-storage/Storage";
import { useStorageBackedState } from "../../encrypted-storage/useStorageBackedState";

export type VaultItem = Readonly<{
    id: string;
    name: string;
    type: string;
    added: string; // ISO UTC datetime
    tags: string[];
}>;

export type VaultState = Readonly<{
    items: readonly VaultItem[];
}>;

export type VaultAction =
    | {
          type: "LOAD";
          state: VaultState;
      }
    | {
          type: "ITEM_ADD";
          item: VaultItem;
      };

export function vaultReducer(old: VaultState, action: VaultAction) {
    switch (action.type) {
        case "LOAD": {
            return action.state;
        }

        case "ITEM_ADD": {
            return {
                ...old,
                items: [...old.items, action.item],
            };
        }
    }
}

const initialState: VaultState = {
    items: [],
};

function generateLoadAction(state: VaultState): VaultAction {
    return { type: "LOAD", state };
}

export function useVaultStorage() {
    const storage = useStorage();

    return useStorageBackedState(
        storage,
        "vault",
        vaultReducer,
        initialState,
        generateLoadAction
    );
}

export type VaultStorage = ReturnType<typeof useVaultStorage>;
