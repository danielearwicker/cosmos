import type { WritableDraft } from "immer";
import { startOfMonth, type FatboyData, type Meal, type Ate } from "./src/data";
import { readFileSync, writeFileSync } from "fs";

const data = JSON.parse(readFileSync("data.json", "utf-8")) as FatboyData;

export type Month = Readonly<{
    start: string;
    ate: WritableDraft<Ate>[];
}>;

const months: Month[] = [];

for (const day of data.days) {
    const start = startOfMonth(day.date);

    let month = months.find((x) => x.start === start);
    if (!month) {
        month = { start, ate: [] };
        months.push(month);
    }

    for (const ate of day.ate) {
        let monthAte = month.ate.find(
            (x) => x.comestible === ate.comestible && x.meal === ate.meal
        );
        if (!monthAte) {
            monthAte = { ...ate };
            month.ate.push(monthAte);
        } else {
            monthAte.quantity++;
        }
    }
}

const { days, ...other } = data;

const smalled = { ...other };

writeFileSync("smalled.json", JSON.stringify(smalled));
