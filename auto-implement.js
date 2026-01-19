#!/usr/bin/env node

/**
 * Automated implementation loop for Claude Code
 *
 * Runs the /implement command repeatedly until:
 * - "NO_REMAINING_WORK" is found in output (success exit)
 * - "Spending cap reached" is found (sleep 1 hour, retry)
 * - Process is interrupted (Ctrl+C)
 */

const { spawn } = require("child_process");

const HOUR_MS = 60 * 60 * 1000;

// Get project from command line argument
const PROJECT = process.argv[2];

if (!PROJECT) {
    console.error("Usage: node auto-implement.js <project>");
    console.error("Example: node auto-implement.js vault");
    process.exit(1);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime() {
    return new Date().toISOString().replace("T", " ").substring(0, 19);
}

async function runImplement() {
    return new Promise((resolve) => {
        const command = "claude";
        const args = [];

        console.log(
            `[${formatTime()}] Running command: ${command} (interactive mode)`
        );
        console.log(`[${formatTime()}] Working directory: ${__dirname}`);
        console.log(`[${formatTime()}] ------- Claude Output Start -------\n`);

        const claude = spawn(command, args, {
            cwd: __dirname,
            stdio: ["pipe", "pipe", "pipe"], // pipe stdin to send command
            env: { ...process.env, FORCE_COLOR: "1" }, // Preserve colors
        });

        // Send the implement command and signal we're done
        claude.stdin.write(`/implement ${PROJECT}\n`);
        claude.stdin.end();

        let output = "";
        let errorOutput = "";

        // Capture and display stdout
        claude.stdout.on("data", (data) => {
            const chunk = data.toString();
            output += chunk;
            process.stdout.write(chunk);
        });

        // Capture and display stderr
        claude.stderr.on("data", (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
            process.stderr.write(chunk);
        });

        claude.on("close", (code) => {
            console.log(
                `\n[${formatTime()}] ------- Claude Output End -------`
            );
            console.log(`[${formatTime()}] Process exited with code: ${code}`);

            const fullOutput = output + errorOutput;
            resolve({ code, output: fullOutput });
        });

        claude.on("error", (err) => {
            console.error(
                `\n[${formatTime()}] Failed to start claude:`,
                err.message
            );
            console.error(
                `[${formatTime()}] Make sure 'claude' is installed and in your PATH`
            );
            resolve({ code: 1, output: "" });
        });
    });
}

async function main() {
    console.log(
        `[${formatTime()}] Starting auto-implement loop for project: ${PROJECT}`
    );
    console.log(`[${formatTime()}] Press Ctrl+C to stop\n`);

    let iteration = 0;

    while (true) {
        iteration++;
        console.log(`\n${"=".repeat(80)}`);
        console.log(`[${formatTime()}] Iteration ${iteration}`);
        console.log(`${"=".repeat(80)}\n`);

        const result = await runImplement();

        // Check for completion
        if (result.output.includes("NO_REMAINING_WORK")) {
            console.log(
                `\n[${formatTime()}] ✅ All work complete! NO_REMAINING_WORK found.`
            );
            process.exit(0);
        }

        // Check for rate limit
        if (result.output.includes("Spending cap reached")) {
            console.log(
                `\n[${formatTime()}] ⏳ Rate limit hit. Sleeping for 1 hour...`
            );
            await sleep(HOUR_MS);
            console.log(`[${formatTime()}] Resuming after rate limit sleep.`);
            continue;
        }

        // Check for errors
        if (result.code !== 0) {
            console.error(
                `\n[${formatTime()}] ⚠️  Claude exited with code ${result.code}`
            );
            console.error(`[${formatTime()}] Retrying in 10 seconds...`);
            await sleep(10000);
            continue;
        }

        // Successful iteration, small delay before continuing
        console.log(
            `\n[${formatTime()}] Iteration ${iteration} complete. Continuing in 5 seconds...`
        );
        await sleep(5000);
    }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
    console.log(`\n\n[${formatTime()}] Interrupted by user. Exiting...`);
    process.exit(0);
});

main().catch((err) => {
    console.error(`\n[${formatTime()}] Fatal error:`, err);
    process.exit(1);
});
