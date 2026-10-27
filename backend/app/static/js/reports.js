
"use strict";

/*
 * Reports & Trends
 * Uses the response structures returned by app/routers/production.py.
 */

const rtCharts = {};

const rtPalette = [
    "#2563eb",
    "#0d9488",
    "#f97316",
    "#8b5cf6",
    "#e11d48",
    "#0891b2"
];

const rtEndpoints = {
    summary: "/api/v1/reports/summary",
    production: "/api/v1/reports/production-trend",
    energy: "/api/v1/reports/energy-trend",
    speed: "/api/v1/reports/line-speed-trend",
    shifts: "/api/v1/reports/shift-comparison",
    lineProducts: "/api/v1/reports/line-product-summary",
    breakdown: "/api/v1/reports/shift-production-breakdown"
};

function rtDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function rtNumber(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
}

function rtFormatNumber(value, maximumFractionDigits = 2) {
    return rtNumber(value).toLocaleString(undefined, {
        maximumFractionDigits
    });
}

function rtDateLabel(value) {
    if (!value) return "Unknown date";

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));

    if (!match) return String(value);

    return `${match[3]}/${match[2]}/${match[1]}`;
}

async function rtFetch(endpoint, startDate, endDate) {
    const url = new URL(endpoint, window.location.origin);

    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);

    const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        const details = await response.text();

        throw new Error(
            `${endpoint} failed (${response.status}): ${details}`
        );
    }

    return response.json();
}

function rtDestroyChart(canvasId) {
    if (rtCharts[canvasId]) {
        rtCharts[canvasId].destroy();
        delete rtCharts[canvasId];
    }
}

function rtShowEmpty(canvasId, message) {
    rtDestroyChart(canvasId);

    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(`rt-empty-${canvasId.replace("rt-", "")}`);

    if (canvas) canvas.hidden = true;

    if (empty) {
        empty.textContent = message;
        empty.hidden = false;
    }
}

function rtPrepareChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(
        `rt-empty-${canvasId.replace("rt-", "")}`
    );

    if (canvas) canvas.hidden = false;
    if (empty) empty.hidden = true;

    return canvas;
}

function rtCreateChart(canvasId, type, labels, datasets, options = {}) {
    const validData = datasets.some(dataset =>
        dataset.data.some(value => value !== null && Number.isFinite(Number(value)))
    );

    if (!labels.length || !validData) {
        rtShowEmpty(canvasId, "No data available for the selected date range.");
        return;
    }

    const canvas = rtPrepareChart(canvasId);
    if (!canvas) return;

    rtDestroyChart(canvasId);

    rtCharts[canvasId] = new Chart(canvas, {
        type,
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    display: datasets.length > 1 ||
                        options.showLegend === true,
                    position: "bottom"
                },
                tooltip: {
                    enabled: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 2
                    }
                }
            }
        }
    });
}

function rtSingleDataset(values, label, color, type = "line") {
    return {
        label,
        data: values,
        borderColor: color,
        backgroundColor: type === "line"
            ? color + "24"
            : color + "CC",
        borderWidth: 2,
        pointRadius: type === "line" ? 3 : 0,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: type === "line"
    };
}

function rtRenderDailyTrend(canvasId, rows, valueKey, label, color) {
    if (!Array.isArray(rows) || !rows.length) {
        rtShowEmpty(canvasId, "No data available for the selected date range.");
        return;
    }

    const labels = rows.map(row => rtDateLabel(row.date));
    const values = rows.map(row => rtNumber(row[valueKey]));

    rtCreateChart(
        canvasId,
        "line",
        labels,
        [rtSingleDataset(values, label, color, "line")]
    );
}

/* Chart 1 and chart 2: daily totals */
function rtRenderProductionTrend(payload) {
    rtRenderDailyTrend(
        "rt-production-trend",
        payload?.daily_totals,
        "total_production",
        "Production",
        rtPalette[0]
    );
}

function rtRenderEnergyTrend(payload) {
    rtRenderDailyTrend(
        "rt-energy-trend",
        payload?.daily_totals,
        "total_energy",
        "Energy",
        rtPalette[2]
    );
}

/* Chart 3: separate average-speed series for each production line */
function rtRenderSpeedTrend(payload) {
    const rows = payload?.by_line || [];

    if (!rows.length) {
        rtRenderDailyTrend(
            "rt-speed-trend",
            payload?.daily_totals,
            "average_speed",
            "Average speed",
            rtPalette[3]
        );
        return;
    }

    const dates = [...new Set(rows.map(row => String(row.date)))].sort();
    const lineNames = [...new Set(rows.map(row => row.line_name))];

    const datasets = lineNames.map((lineName, index) => {
        const valuesByDate = new Map();

        rows
            .filter(row => row.line_name === lineName)
            .forEach(row => {
                valuesByDate.set(String(row.date), rtNumber(row.average_speed));
            });

        return {
            label: lineName,
            data: dates.map(date =>
                valuesByDate.has(date) ? valuesByDate.get(date) : null
            ),
            borderColor: rtPalette[index % rtPalette.length],
            backgroundColor: rtPalette[index % rtPalette.length] + "20",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            spanGaps: false,
            fill: false
        };
    });

    rtCreateChart(
        "rt-speed-trend",
        "line",
        dates.map(rtDateLabel),
        datasets
    );
}

/* Chart 4: production totals grouped by line */
function rtRenderLineProduction(payload) {
    const rows = payload?.by_line || [];
    const totals = new Map();

    rows.forEach(row => {
        const name = row.line_name || "Unknown line";
        totals.set(
            name,
            (totals.get(name) || 0) + rtNumber(row.production)
        );
    });

    const labels = [...totals.keys()];
    const values = [...totals.values()];

    rtCreateChart(
        "rt-line-production",
        "bar",
        labels,
        [rtSingleDataset(values, "Production", rtPalette[0], "bar")]
    );
}

/* Chart 5 and chart 6: data from payload.shifts */
function rtRenderShiftChart(payload, canvasId, valueKey, label, color) {
    const rows = payload?.shifts || [];

    const labels = rows.map(row => row.shift_name || "Unknown shift");
    const values = rows.map(row => rtNumber(row[valueKey]));

    rtCreateChart(
        canvasId,
        "bar",
        labels,
        [rtSingleDataset(values, label, color, "bar")]
    );
}

function rtRenderShiftTable(payload) {
    const body = document.getElementById("rt-shift-table");
    body.replaceChildren();

    const rows = payload?.shifts || [];

    if (!rows.length) {
        rtAppendEmptyRow(body, 4, "No shift data available for this period.");
        return;
    }

    rows.forEach(row => {
        const tr = document.createElement("tr");

        rtAppendCell(tr, row.shift_name ?? "—");
        rtAppendCell(tr, rtFormatNumber(row.total_production));
        rtAppendCell(tr, rtFormatNumber(row.total_energy));
        rtAppendCell(tr, rtFormatNumber(row.average_speed));

        body.appendChild(tr);
    });
}

/* Aggregate line-product summary into product totals and line totals */
function rtAggregate(rows, groupKey, valueKey) {
    const totals = new Map();

    rows.forEach(row => {
        const label = row[groupKey] || "Unknown";
        const value = rtNumber(row[valueKey]);

        totals.set(label, (totals.get(label) || 0) + value);
    });

    return {
        labels: [...totals.keys()],
        values: [...totals.values()]
    };
}

/* Chart 7 and chart 8 */
function rtRenderProductChart(payload, valueKey, canvasId, label, color) {
    const rows = payload?.items || [];
    const aggregated = rtAggregate(rows, "product_name", valueKey);

    rtCreateChart(
        canvasId,
        "bar",
        aggregated.labels,
        [rtSingleDataset(aggregated.values, label, color, "bar")]
    );
}

function rtAppendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = String(value);
    row.appendChild(cell);
}

function rtAppendEmptyRow(body, columnCount, message) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = columnCount;
    td.className = "rt-empty-cell";
    td.textContent = message;

    tr.appendChild(td);
    body.appendChild(tr);
}

function rtRenderBreakdownTable(payload) {
    const body = document.getElementById("rt-breakdown-table");
    body.replaceChildren();

    const rows = payload?.items || [];

    if (!rows.length) {
        rtAppendEmptyRow(
            body,
            5,
            "No line, product and shift records are available for this period."
        );
        return;
    }

    rows.forEach(row => {
        const tr = document.createElement("tr");

        rtAppendCell(tr, row.line_name ?? "—");
        rtAppendCell(tr, row.product_name ?? "—");
        rtAppendCell(tr, row.shift_name ?? "—");
        rtAppendCell(tr, rtFormatNumber(row.total_production));
        rtAppendCell(tr, rtFormatNumber(row.total_energy));

        body.appendChild(tr);
    });
}

function rtUpdateSummary(payload) {
    document.getElementById("rt-total-production").textContent =
        rtFormatNumber(payload?.total_production, 0);

    document.getElementById("rt-total-energy").textContent =
        rtFormatNumber(payload?.total_energy, 3);

    document.getElementById("rt-average-speed").textContent =
        rtFormatNumber(payload?.average_speed, 2);
}

async function rtLoadReports() {
    const startInput = document.getElementById("rt-start-date");
    const endInput = document.getElementById("rt-end-date");
    const status = document.getElementById("rt-status");
    const generateButton = document.getElementById("rt-generate");
    const refreshButton = document.getElementById("rt-refresh");

    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!startDate || !endDate) {
        status.textContent = "Please select both a start date and an end date.";
        return;
    }

    if (startDate > endDate) {
        status.textContent = "Start date cannot be later than end date.";
        return;
    }

    generateButton.disabled = true;
    refreshButton.disabled = true;
    status.textContent = "Loading reports for the selected period…";

    const requests = Object.entries(rtEndpoints).map(async ([key, endpoint]) => ({
        key,
        data: await rtFetch(endpoint, startDate, endDate)
    }));

    const results = await Promise.allSettled(requests);
    const payloads = {};
    const failures = [];

    results.forEach((result, index) => {
        const key = Object.keys(rtEndpoints)[index];

        if (result.status === "fulfilled") {
            payloads[result.value.key] = result.value.data;
        } else {
            failures.push({
                key,
                error: result.reason
            });

            console.error(
                `Could not load report "${key}":`,
                result.reason
            );
        }
    });

    try {
        if (payloads.summary) {
            rtUpdateSummary(payloads.summary);
        }

        if (payloads.production) {
            rtRenderProductionTrend(payloads.production);
            rtRenderLineProduction(payloads.production);
        } else {
            rtShowEmpty("rt-production-trend", "Production trend could not be loaded.");
            rtShowEmpty("rt-line-production", "Line production could not be loaded.");
        }

        if (payloads.energy) {
            rtRenderEnergyTrend(payloads.energy);
        } else {
            rtShowEmpty("rt-energy-trend", "Energy trend could not be loaded.");
        }

        if (payloads.speed) {
            rtRenderSpeedTrend(payloads.speed);
        } else {
            rtShowEmpty("rt-speed-trend", "Line-speed trend could not be loaded.");
        }

        if (payloads.shifts) {
            rtRenderShiftChart(
                payloads.shifts,
                "rt-shift-production",
                "total_production",
                "Production",
                rtPalette[0]
            );

            rtRenderShiftChart(
                payloads.shifts,
                "rt-shift-energy",
                "total_energy",
                "Energy",
                rtPalette[2]
            );

            rtRenderShiftTable(payloads.shifts);
        } else {
            rtShowEmpty("rt-shift-production", "Shift production could not be loaded.");
            rtShowEmpty("rt-shift-energy", "Shift energy could not be loaded.");

            const shiftBody = document.getElementById("rt-shift-table");
            shiftBody.replaceChildren();
            rtAppendEmptyRow(shiftBody, 4, "Shift report could not be loaded.");
        }

        if (payloads.lineProducts) {
            rtRenderProductChart(
                payloads.lineProducts,
                "total_production",
                "rt-product-production",
                "Production",
                rtPalette[0]
            );

            rtRenderProductChart(
                payloads.lineProducts,
                "total_energy",
                "rt-product-energy",
                "Energy",
                rtPalette[2]
            );
        } else {
            rtShowEmpty("rt-product-production", "Product production could not be loaded.");
            rtShowEmpty("rt-product-energy", "Product energy could not be loaded.");
        }

        if (payloads.breakdown) {
            rtRenderBreakdownTable(payloads.breakdown);
        } else {
            const body = document.getElementById("rt-breakdown-table");
            body.replaceChildren();
            rtAppendEmptyRow(body, 5, "Shift breakdown could not be loaded.");
        }

        if (failures.length) {
            status.textContent =
                `${failures.length} of ${Object.keys(rtEndpoints).length} report APIs failed. ` +
                "Available reports are shown; check the browser console and backend terminal.";
        } else {
            status.textContent =
                `Reports loaded for ${startDate} to ${endDate}.`;
        }
    } catch (error) {
        console.error("Could not render reports:", error);
        status.textContent =
            "The APIs responded, but a chart could not be displayed. Check the browser console.";
    } finally {
        generateButton.disabled = false;
        refreshButton.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date();
    const firstDayOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    document.getElementById("rt-start-date").value =
        rtDateString(firstDayOfMonth);

    document.getElementById("rt-end-date").value =
        rtDateString(today);

    document.getElementById("rt-filter-form").addEventListener(
        "submit",
        event => {
            event.preventDefault();
            rtLoadReports();
        }
    );

    document.getElementById("rt-refresh").addEventListener(
        "click",
        rtLoadReports
    );

    if (typeof Chart === "undefined") {
        document.getElementById("rt-status").textContent =
            "Chart.js could not load. Check your internet connection and reload this page.";
        return;
    }

    rtLoadReports();
});
