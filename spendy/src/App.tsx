import { Storage } from "../../encrypted-storage/Storage";
// import { azureBackend } from "../../encrypted-storage/azureBackend";
import { localStorageBackend } from "../../encrypted-storage/localStorageBackend";

import { Tabs } from "./Tabs";

export function App() {
    console.log("App");
    return (
        <Storage backend={localStorageBackend} app="spendy" settings={{}}>
            <Tabs />
        </Storage>
    );
}
