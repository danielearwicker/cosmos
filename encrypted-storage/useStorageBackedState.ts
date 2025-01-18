import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { StorageConfig } from "./Storage";
import { useLocalStorageState } from "./useLocalStorageState";

export function useStorageBackedState<T extends object, A>(
    storage: StorageConfig,
    name: string,
    reducer: (old: T, action: A) => T,
    initialState: T,
    generateLoadAction: (state: T) => A
) {
    const [state, dispatchWithoutSave] = useReducer(reducer, initialState);

    const [version, setVersion] = useState("none");

    const flags = useRef({
        shouldLoad: true,
        savingSoon: false,
        saving: false,
    });
    const [shouldSave, setShouldSave] = useState(false);

    const [info, setInfo] = useState("");

    const [queuedActionsJson, setQueuedActionsJson] = useLocalStorageState(
        "queuedActions",
        "[]"
    );

    const queuedActions = JSON.parse(queuedActionsJson) as A[];

    const setQueuedActions = useCallback(
        (update: React.SetStateAction<A[]>) =>
            setQueuedActionsJson((prev) =>
                JSON.stringify(
                    typeof update === "function"
                        ? update(JSON.parse(prev))
                        : update
                )
            ),
        []
    );

    useEffect(() => {
        async function load() {
            try {
                const loaded = await storage.load(name);
                if (loaded.data) {
                    const state = JSON.parse(
                        new TextDecoder().decode(loaded.data)
                    ) as T;
                    dispatchWithoutSave(generateLoadAction(state));
                }
                setInfo(`Loaded ${loaded.version}`);
                setVersion(loaded.version);

                if (queuedActions.length) {
                    for (const action of queuedActions) {
                        dispatchWithoutSave(action);
                    }

                    saveSoon(
                        `Recovering (${queuedActions.length}) ${loaded.version}`
                    );
                }
            } catch (e) {
                setInfo(`Load failed: ${e}`);
            }
        }

        if (flags.current.shouldLoad) {
            flags.current.shouldLoad = false;
            load();
        }
    }, []);

    const saveTimer = useRef<number | undefined>();

    const saveSoon = useCallback((message: string) => {
        setInfo(message);

        if (flags.current.saving || flags.current.savingSoon) {
            return;
        }

        if (saveTimer.current !== undefined) {
            window.clearTimeout(saveTimer.current);
        }

        flags.current.savingSoon = true;
        saveTimer.current = window.setTimeout(() => {
            flags.current.savingSoon = false;
            setShouldSave(true);
        }, 2000);
    }, []);

    useEffect(() => {
        async function reconcile() {
            try {
                setInfo("Saving...");

                const data = new TextEncoder().encode(JSON.stringify(state));

                flags.current.saving = true;

                const savedActions = queuedActions.slice();

                setVersion(await storage.save(name, { data, version }));

                setInfo("Saved successfully");

                flags.current.saving = false;

                setQueuedActions((prev) => {
                    const updated = prev.filter(
                        (p) =>
                            !savedActions.find(
                                (s) => JSON.stringify(s) === JSON.stringify(p)
                            )
                    );
                    if (updated.length > 0) {
                        saveSoon(`${updated.length} more to save`);
                    }
                    return updated;
                });
            } catch (e) {
                flags.current.saving = false;

                const loaded = await storage.load(name);

                const state = loaded.data
                    ? (JSON.parse(new TextDecoder().decode(loaded.data)) as T)
                    : initialState;

                dispatchWithoutSave(generateLoadAction(state));

                setVersion(loaded.version);

                for (const action of queuedActions) {
                    dispatchWithoutSave(action);
                }

                saveSoon(`${e} (${queuedActions.length}) ${loaded.version}`);
            }
        }

        if (shouldSave) {
            setShouldSave(false);
            reconcile();
        }
    }, [shouldSave, state, queuedActions]);

    return [
        state,

        (action: A) => {
            setQueuedActions((a) => a.concat(action));
            dispatchWithoutSave(action);
            saveSoon(`Saving (${queuedActions.length + 1}) soon`);
        },

        info,
        queuedActions,
    ] as const;
}
