export interface NutritionInfo {
    serving_size: number;
    energy_kcal: number;
    saturated_fat_g: number;
    sugar_g: number;
    fibre_g: number;
    protein_g: number;
    salt_g: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export async function handleNutritionPhoto(
    key: string | undefined,
    ev: React.ChangeEvent<HTMLInputElement>,
    feedback: (msg: string) => void
) {
    if (!key || !ev.target.files?.length) return;

    feedback("Obtaining image data...");

    const dataUrl = await readFileAsDataUrl(ev.target.files[0]);

    const base64Image = dataUrl.split(",")[1]; // Extract base64 string

    feedback("Sending request to OpenAI...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are an AI that extracts nutrition facts from food packaging images and returns structured JSON data.",
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Extract the nutrition information from this image.
Prefer the serving size of 100g or 100ml where available. Return a JSON object, with no added 
formatting, compatible with this TypeScript interface:

interface NutritionInfo {
serving_size: number; // in grams or millilitres
energy_kcal: number;
saturated_fat_g: number;
sugar_g: number;
fibre_g: number;
protein_g: number;
salt_g: number;
}
`,
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 300,
        }),
    });

    const data = await response.json();

    const rawResult = data.choices?.[0]?.message?.content as string;
    const cleanResult = rawResult.replace(/```json/g, "").replace(/```/g, "");
    let result: NutritionInfo | undefined = undefined;
    try {
        result = JSON.parse(cleanResult);
    } catch (e) {
        console.error(e);
    }

    console.log("Nutrition result", result);

    if (!result || !result.energy_kcal || !result.serving_size) {
        feedback("Couldn't get nutrition data!");
        return undefined;
    }

    return result;
}
