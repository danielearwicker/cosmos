import { Tabs } from "./Tabs";
import { Storage } from "../../encrypted-storage/Storage";
import { azureBackend } from "../../encrypted-storage/azureBackend";
//import { localStorageBackend } from "../../encrypted-storage/localStorageBackend";

export default function App() {
    return (
        <Storage
            backend={azureBackend}
            app="fatboy"
            settings={{ openAiKey: "oai" }}
        >
            <Tabs />
        </Storage>
    );
}
