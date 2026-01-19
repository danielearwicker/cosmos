import { getCategoryColour } from "./colours";
import { type Payment } from "./statements";
import { chain as _ } from "underscore";
import { CheckBox } from "./inputComponents/CheckBox";

export interface PaymentWithCategory extends Payment {
    category: string;
}

export interface ChildCategoryProps {
    category: string;
    path: string;
    setPath(path: string): void;
}

export function ChildCategory({ category, path, setPath }: ChildCategoryProps) {
    const categoryPath = `${path}${category}`;

    const isExcluded = false;

    return (
        <div
            key={category}
            className={`child-category ${isExcluded ? "excluded" : "included"}`}
            style={{
                backgroundColor: isExcluded
                    ? "#ccc"
                    : getCategoryColour(category),
            }}
            onClick={isExcluded ? undefined : () => setPath(`${categoryPath}/`)}
        >
            <div className="category-label">
                <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={
                        (e) => {}
                        //setExcludedCategory(categoryPath, !e.target.checked)
                    }
                    onClick={(e) => e.stopPropagation()}
                />
                {category}
            </div>
        </div>
    );
}

export interface ChildCategoriesProps {
    payments: PaymentWithCategory[];
    path: string;
    setPath(path: string): void;
}

export function getChildCategory(path: string, category: string) {
    return !category.startsWith(path)
        ? undefined
        : category.substring(path.length).split("/")[0];
}

export function ChildCategories({
    payments,
    path,
    setPath,
}: ChildCategoriesProps) {
    const childCategories = _(payments)
        .map((x) => ({
            c: getChildCategory(path, x.category)!,
            a: Math.abs(x.amount),
        }))
        .filter((x) => !!x.c)
        .groupBy((x) => x.c)
        .map((x, c) => ({ c, a: x.map((p) => p.a).reduce((l, r) => l + r, 0) }))
        .sortBy((x) => x.a)
        .map((x) => x.c)
        .reverse()
        .value();

    const countExcluded = 0;

    const allSelected =
        countExcluded === 0
            ? true
            : countExcluded === childCategories.length
            ? false
            : undefined;

    function selectAll(checked: boolean) {
        for (const category of childCategories) {
            // setExcludedCategory(category, !checked);
        }
    }

    return (
        <>
            <div>
                <label>
                    <CheckBox checked={allSelected} onChange={selectAll} />
                    Select all
                </label>
            </div>
            {childCategories.map((c) => (
                <ChildCategory
                    key={c}
                    category={c}
                    path={path}
                    setPath={setPath}
                />
            ))}
        </>
    );
}
