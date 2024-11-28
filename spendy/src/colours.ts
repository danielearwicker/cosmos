export const colours = [
    "#12939A",
    "#79C7E3",
    "#1A3177",
    "#FF9833",
    "#EF5D28",
    "#19CDD7",
    "#DDB27C",
    "#88572C",
    "#FF991F",
    "#F15C17",
    "#223F9A",
    "#DA70BF",
    "#125C77",
    "#4DC19C",
    "#776E57",
    "#12939A",
    "#17B8BE",
    "#F6D18A",
    "#B7885E",
    "#FFCB99",
    "#F89570",
    "#829AE3",
    "#E79FD5",
    "#1E96BE",
    "#89DAC1",
    "#B3AD9E",
];

const categoryColours: Record<string, string> = {};

let nextColour = 0;

export function getCategoryColour(category: string) {
    return (
        categoryColours[category] ??
        (categoryColours[category] = colours[nextColour++ % colours.length])
    );
}
