import { useSpendyStorage } from "./reducer";
import { UploadFiles } from "./UploadFiles";
import { Explorer } from "./Explorer";
import {
    BrowserRouter,
    Navigate,
    NavLink,
    Route,
    Routes,
} from "react-router-dom";
import { CategoryManagement } from "./CategoryManagement";

const tabs = ["uploads", "explorer", "categories"] as const;

export function Tabs() {
    const [state, dispatch] = useSpendyStorage();

    return (
        <BrowserRouter>
            <div className="tabs">
                <div className="tab-buttons">
                    {tabs.map(x => (
                        <NavLink to={x} key={x}>
                            <div className="tab">{x}</div>
                        </NavLink>
                    ))}
                </div>
                <div className="tab-content">
                    <Routes>
                        <Route
                            index
                            element={<Navigate to="explorer" replace />}
                        />
                        <Route
                            path="uploads"
                            element={<UploadFiles dispatch={dispatch} />}
                        />
                        <Route
                            path="explorer"
                            element={
                                <Explorer state={state} dispatch={dispatch} />
                            }
                        />
                        <Route
                            path="categories"
                            element={
                                <CategoryManagement
                                    state={state}
                                    dispatch={dispatch}
                                />
                            }
                        />
                    </Routes>
                </div>
            </div>
        </BrowserRouter>
    );
}
