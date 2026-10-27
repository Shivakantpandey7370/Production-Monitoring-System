"use strict";

const dateInput = document.getElementById("dashboard-date");
const refreshButton = document.getElementById("refresh-dashboard");
const chartInstances = new Map();

if (window.Chart && window.ChartDataLabels) {
    Chart.register(ChartDataLabels);
}

const chartPalette = [
    "#2677F3",
    "#20B66A",
    "#F59A23",
    "#8B5CF6",
    "#EF4444",
];

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getSelectedMonth(selectedDate) {
    const [year, month] = selectedDate.split("-").map(Number);

    const startDate =
        `${year}-${String(month).padStart(2, "0")}-01`;

    const lastDay = new Date(year, month, 0).getDate();

    const endDate =
        `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    return { year, month, startDate, endDate };
}

function makeQuery(params) {
    return new URLSearchParams(params).toString();
}

async function fetchReport(endpoint) {
    const response = await fetch(endpoint, {
        headers: {
            Accept: "application/json",
        },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const detail =
            payload && (payload.detail || payload.message);

        throw new Error(
            `${endpoint} (${response.status}): ` +
            `${detail || response.statusText}`
        );
    }

    return payload;
}

function setKpi(id, value, decimals = 0) {
    const element = document.getElementById(id);

    if (!element) return;

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        element.textContent = "—";
        return;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        element.textContent = "—";
        return;
    }

    element.textContent = number.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function showStatus(message = "", type = "") {
    const loading =
        document.getElementById("dashboard-loading");

    const error =
        document.getElementById("dashboard-error");

    if (loading) {
        loading.hidden = type !== "loading";
        loading.replaceChildren();

        if (type === "loading") {
            const spinner = document.createElement("span");
            spinner.className = "pm-status-spinner";
            spinner.setAttribute("aria-hidden", "true");

            loading.append(
                spinner,
                document.createTextNode(message)
            );
        }
    }

    if (error) {
        error.hidden = type !== "error";
        error.textContent = type === "error" ? message : "";
    }
}

function formatPeriodLabel(
    value,
    options = {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }
) {
    if (!value) return "—";

    const date = new Date(
        `${String(value).slice(0, 10)}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-IN", options);
}

function displayMonth(year, month) {
    return new Date(year, month - 1, 1).toLocaleDateString(
        "en-IN",
        {
            month: "long",
            year: "numeric",
        }
    );
}

function showEmptyChart(
    container,
    message = "No data available for this period."
) {
    const note = document.createElement("div");
    note.className = "pm-chart-empty";

    const icon = document.createElement("span");
    icon.className = "pm-empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⌁";

    const text = document.createElement("p");
    text.textContent = message;

    note.append(icon, text);
    container.replaceChildren(note);
}

function drawChart(
    containerId,
    type,
    labels,
    datasets,
    options = {}
) {
    const container =
        document.getElementById(containerId);

    if (!container) return;

    const existingChart =
        chartInstances.get(containerId);

    if (existingChart) {
        existingChart.destroy();
        chartInstances.delete(containerId);
    }

    if (!Array.isArray(labels) || labels.length === 0) {
        showEmptyChart(
            container,
            "No records available for this chart and period."
        );
        return;
    }

    if (!window.Chart) {
        showEmptyChart(
            container,
            "Chart library could not load. Check your internet connection and refresh."
        );
        return;
    }

    container.replaceChildren();

    const canvas = document.createElement("canvas");

    canvas.setAttribute("role", "img");
    canvas.setAttribute(
        "aria-label",
        options.accessibleLabel ||
        "Production monitoring chart"
    );

    container.appendChild(canvas);

    const isCircular =
        type === "doughnut" || type === "pie";

    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,

        animation: {
            duration: 350,
        },

        interaction: {
            intersect: false,
            mode: "index",
        },

        plugins: {
            legend: {
                display:
                    options.legendDisplay !== false &&
                    (isCircular || datasets.length > 1),

                position: "bottom",

                labels: {
                    usePointStyle: true,
                    pointStyle: "circle",
                    boxWidth: 8,
                    boxHeight: 8,
                    padding: 15,
                    color: "#52627a",

                    font: {
                        family: "Segoe UI, Arial, sans-serif",
                        size: 11,
                    },
                },
            },

            tooltip: {
                backgroundColor: "#14283f",
                padding: 11,
                cornerRadius: 8,

                titleFont: {
                    weight: "600",
                },
            },
        },
    };

    if (!isCircular) {
        baseOptions.scales = {
            x: {
                grid: {
                    display: false,
                },

                border: {
                    display: false,
                },

                ticks: {
                    color: "#718096",
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 8,

                    font: {
                        size: 10,
                    },
                },
            },

            y: {
                beginAtZero: true,

                grid: {
                    color: "#edf1f6",
                    drawBorder: false,
                },

                border: {
                    display: false,
                },

                ticks: {
                    color: "#718096",
                    font: {
                        size: 10,
                    },
                    maxTicksLimit: 5,
                },
            },
        };
    }

    if (isCircular) {
        baseOptions.cutout = type === "doughnut" ? "62%" : 0;

        // Legend example: Product 1 (750)
        if (options.legendIncludeValues) {
            baseOptions.plugins.legend.labels.generateLabels = function (chart) {
                const generator =
                    Chart.overrides?.[chart.config.type]?.plugins?.legend
                        ?.labels?.generateLabels ||
                    Chart.defaults.plugins.legend.labels.generateLabels;

                return generator(chart).map(item => {
                    const dataset =
                        chart.data.datasets[item.datasetIndex || 0];

                    const value = dataset?.data[item.index] ?? 0;

                    return {
                        ...item,
                        text: `${item.text} (${Number(value).toLocaleString("en-IN")})`
                    };
                });
            };
        }

        // Percentage label inside each non-zero pie slice
        if (options.showPercentDataLabels && window.ChartDataLabels) {
            baseOptions.plugins.datalabels = {
                color: "#ffffff",
                font: {
                    weight: "700",
                    size: 12
                },
                textStrokeColor: "rgba(20, 35, 60, 0.18)",
                textStrokeWidth: 1,
                formatter: function (value, context) {
                    const data =
                        context.chart.data.datasets[context.datasetIndex].data;

                    const total = data.reduce(
                        (sum, item) => sum + Number(item || 0),
                        0
                    );

                    if (total <= 0 || Number(value) <= 0) {
                        return "";
                    }

                    return `${(Number(value) / total * 100).toFixed(1)}%`;
                }
            };
        }
    }

    const config = {
        type,
        data: {
            labels,
            datasets,
        },

        options: {
            ...baseOptions,
            ...(options.chartOptions || {}),
        },
    };

    const chart = new Chart(
        canvas.getContext("2d"),
        config
    );

    chartInstances.set(containerId, chart);
}

function makeBarDataset(
    label,
    values,
    colorOrColors
) {
    const colors = Array.isArray(colorOrColors)
        ? colorOrColors
        : values.map(() => colorOrColors);

    return {
        label,
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 42,
    };
}

function lineDataset(
    label,
    values,
    color,
    fill = false
) {
    return {
        label,
        data: values,
        borderColor: color,
        backgroundColor: fill ? `${color}20` : color,
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        tension: 0.3,
        fill,
        spanGaps: true,
    };
}

function renderDashboardCharts({
    daily,
    productionTrend,
    energyTrend,
    speedTrend,
    productsResponse,
}) {
    const byLine = Array.isArray(daily.by_line)
        ? daily.by_line
        : [];

    const byShift = Array.isArray(daily.by_shift)
        ? daily.by_shift
        : [];

    const dailyProductRows = Array.isArray(daily.by_product)
        ? daily.by_product
        : [];

    const masterProducts = Array.isArray(productsResponse)
        ? productsResponse
        : [];

    const byProduct = masterProducts.length
        ? masterProducts.map(product => {
            const dailyRow = dailyProductRows.find(
                item => item.product_name === product.name
            );

            return {
                product_name: product.name,
                production: Number(dailyRow?.production || 0),
                energy: Number(dailyRow?.energy || 0)
            };
        })
        : dailyProductRows;
    // 1. Production by line
    drawChart(
        "production-by-line-chart",
        "bar",

        byLine.map(item => item.line_name),

        [
            makeBarDataset(
                "Production units",
                byLine.map(
                    item => Number(item.production || 0)
                ),
                chartPalette[0]
            ),
        ],

        {
            legendDisplay: false,
            accessibleLabel: "Daily production by line",
        }
    );

    // 2. Energy by line
    drawChart(
        "energy-by-line-chart",
        "bar",

        byLine.map(item => item.line_name),

        [
            makeBarDataset(
                "Energy (kWh)",
                byLine.map(
                    item => Number(item.energy || 0)
                ),
                chartPalette[1]
            ),
        ],

        {
            legendDisplay: false,
            accessibleLabel: "Daily energy consumed by line",
        }
    );

    // 3. Production trend
    const productionDays =
        Array.isArray(productionTrend.daily_totals)
            ? productionTrend.daily_totals
            : [];

    drawChart(
        "production-trend-chart",
        "line",

        productionDays.map(item =>
            formatPeriodLabel(
                item.date,
                {
                    day: "2-digit",
                    month: "short",
                }
            )
        ),

        [
            lineDataset(
                "Production units",
                productionDays.map(
                    item => Number(item.total_production || 0)
                ),
                chartPalette[0],
                true
            ),
        ],

        {
            legendDisplay: false,
            accessibleLabel:
                "Production trend for the selected month",
        }
    );

    // 4. Energy trend
    const energyDays =
        Array.isArray(energyTrend.daily_totals)
            ? energyTrend.daily_totals
            : [];

    drawChart(
        "energy-trend-chart",
        "line",

        energyDays.map(item =>
            formatPeriodLabel(
                item.date,
                {
                    day: "2-digit",
                    month: "short",
                }
            )
        ),

        [
            lineDataset(
                "Energy (kWh)",
                energyDays.map(
                    item => Number(item.total_energy || 0)
                ),
                chartPalette[2],
                true
            ),
        ],

        {
            legendDisplay: false,
            accessibleLabel:
                "Energy consumption trend for the selected month",
        }
    );

    // 5. Line speed trend
    const speedRows =
        Array.isArray(speedTrend.by_line)
            ? speedTrend.by_line
            : [];

    const speedDates = [
        ...new Set(
            speedRows.map(
                item => String(item.date).slice(0, 10)
            )
        ),
    ].sort();

    const speedLines = [
        ...new Set(
            speedRows.map(item => item.line_name)
        ),
    ].sort();

    const speedSeries = speedLines.map(
        (lineName, index) => {
            const lineColor =
                chartPalette[index % chartPalette.length];

            const valuesByDate = new Map(
                speedRows
                    .filter(
                        item => item.line_name === lineName
                    )
                    .map(item => [
                        String(item.date).slice(0, 10),
                        Number(item.average_speed || 0),
                    ])
            );

            return lineDataset(
                lineName,

                speedDates.map(date =>
                    valuesByDate.has(date)
                        ? valuesByDate.get(date)
                        : null
                ),

                lineColor
            );
        }
    );

    drawChart(
        "line-speed-trend-chart",
        "line",

        speedDates.map(date =>
            formatPeriodLabel(
                date,
                {
                    day: "2-digit",
                    month: "short",
                }
            )
        ),

        speedSeries,

        {
            legendDisplay: true,
            accessibleLabel:
                "Average line speed trend by production line",
        }
    );

    // 6. Production by shift
    drawChart(
        "shift-production-chart",
        "bar",

        byShift.map(item => item.shift_name),

        [
            makeBarDataset(
                "Production units",
                byShift.map(
                    item => Number(item.production || 0)
                ),
                chartPalette[0]
            ),
        ],

        {
            legendDisplay: false,
            accessibleLabel: "Daily production by shift",
        }
    );

    // 7. Energy by shift
    drawChart(
        "shift-energy-chart",
        "bar",

        byShift.map(item => item.shift_name),

        [
            makeBarDataset(
                "Energy (kWh)",
                byShift.map(
                    item => Number(item.energy || 0)
                ),
                chartPalette[2]
            ),
        ],

        {
            legendDisplay: false,
            accessibleLabel:
                "Daily energy consumption by shift",
        }
    );

    // 8. Production by Product — percentages + product counts
    drawChart(
        "product-production-chart",
        "pie",

        byProduct.map(item => item.product_name),

        [
            {
                label: "Production units",

                data: byProduct.map(
                    item => Number(item.production || 0)
                ),

                backgroundColor: chartPalette,
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 6
            },
        ],

        {
            legendDisplay: true,
            legendIncludeValues: true,
            showPercentDataLabels: true,

            accessibleLabel:
                "Production percentage and production count by product"
        }
    );

    // 9. Energy by product
    drawChart(
        "product-energy-chart",
        "bar",

        byProduct.map(item => item.product_name),

        [
            makeBarDataset(
                "Energy (kWh)",

                byProduct.map(
                    item => Number(item.energy || 0)
                ),

                chartPalette
            ),
        ],

        {
            legendDisplay: false,
            accessibleLabel:
                "Energy consumed by product",
        }
    );
}

function renderLinePerformanceTable(
    linesResponse,
    daily,
    lineProductSummary
) {
    const tbody =
        document.getElementById("line-performance-body");

    if (!tbody) return;

    const byLine = Array.isArray(daily.by_line)
        ? daily.by_line
        : [];

    const productItems =
        lineProductSummary &&
        Array.isArray(lineProductSummary.items)
            ? lineProductSummary.items
            : [];

    let masterLines = Array.isArray(linesResponse)
        ? linesResponse
        : (
            linesResponse &&
            Array.isArray(linesResponse.lines)
                ? linesResponse.lines
                : []
        );

    if (masterLines.length === 0) {
        const names = new Set([
            ...byLine.map(item => item.line_name),
            ...productItems.map(item => item.line_name),
        ]);

        masterLines = [...names].map(
            (name, index) => ({
                line_id: index + 1,
                name,
            })
        );

        if (masterLines.length === 0) {
            masterLines = [
                { line_id: 1, name: "Line 1" },
                { line_id: 2, name: "Line 2" },
                { line_id: 3, name: "Line 3" },
                { line_id: 4, name: "Line 4" },
            ];
        }
    }

    masterLines = [...masterLines].sort(
        (a, b) =>
            Number(a.line_id || 0) -
            Number(b.line_id || 0)
    );

    tbody.replaceChildren();

    for (const line of masterLines) {
        const lineName =
            line.name ||
            line.line_name ||
            `Line ${line.line_id || "—"}`;

        const dailyRow = byLine.find(
            item => item.line_name === lineName
        );

        const productRow = productItems.find(
            item => item.line_name === lineName
        );

        const hasRecord = Boolean(dailyRow || productRow);

        const row = document.createElement("tr");

        const values = [
            lineName,

            hasRecord
                ? (
                    productRow?.product_name ||
                    dailyRow?.product_name ||
                    "—"
                )
                : "—",

            hasRecord
                ? Number(
                    dailyRow?.production ??
                    productRow?.total_production ??
                    0
                ).toLocaleString("en-IN")
                : "—",

            hasRecord
                ? Number(
                    dailyRow?.energy ??
                    productRow?.total_energy ??
                    0
                ).toLocaleString("en-IN", {
                    maximumFractionDigits: 3,
                })
                : "—",

            hasRecord && dailyRow?.average_speed != null
                ? Number(
                    dailyRow.average_speed
                ).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })
                : "—",
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;

            if (index > 1 && index < 5) {
                cell.className = "pm-number-cell";
            }

            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const status = document.createElement("span");

        status.className = hasRecord
            ? "pm-status-pill pm-status-recorded"
            : "pm-status-pill pm-status-no-data";

        status.textContent = hasRecord
            ? "Recorded"
            : "No data";

        statusCell.appendChild(status);
        row.appendChild(statusCell);
        tbody.appendChild(row);
    }
}

async function loadDashboard() {
    if (!dateInput) return;

    const selectedDate =
        dateInput.value || formatDate(new Date());

    const {
        year,
        month,
        startDate,
    } = getSelectedMonth(selectedDate);

    const trendQuery = makeQuery({
        start_date: startDate,
        end_date: selectedDate,
    });

    const dailyQuery = makeQuery({
        report_date: selectedDate,
    });

    const monthlyQuery = makeQuery({
        year,
        month,
    });

    const productQuery = makeQuery({
        start_date: selectedDate,
        end_date: selectedDate,
    });

    showStatus("Loading production reports…", "loading");

    try {
    const [
        daily,
        monthly,
        productionTrend,
        energyTrend,
        speedTrend,
        lineProductSummary,
        linesResponse,
        productsResponse,
    ] = await Promise.all([
            fetchReport(
                `/api/v1/reports/daily?${dailyQuery}`
            ),

            fetchReport(
                `/api/v1/reports/monthly?${monthlyQuery}`
            ),

            fetchReport(
                `/api/v1/reports/production-trend?${trendQuery}`
            ),

            fetchReport(
                `/api/v1/reports/energy-trend?${trendQuery}`
            ),

            fetchReport(
                `/api/v1/reports/line-speed-trend?${trendQuery}`
            ),

            fetchReport(
                `/api/v1/reports/line-product-summary?${productQuery}`
            ),

            fetchReport("/api/v1/lines").catch(error => {
                console.warn(
                    "Could not load master line list:",
                    error.message
                );
                return [];
            }),

            fetchReport("/api/v1/products").catch(error => {
                console.warn(
                    "Could not load master products:",
                    error.message
                );
                return [];
            }),
        ]);

        // DAILY KPIs
        setKpi(
            "daily-production",
            daily.total_production
        );

        setKpi(
            "daily-energy",
            daily.total_energy,
            3
        );

        setKpi(
            "daily-speed",
            daily.average_speed,
            2
        );

        const activeLineCount =
            Array.isArray(daily.by_line)
                ? daily.by_line.length
                : 0;

        const activeLinesKpi =
            document.getElementById("daily-active-lines");

        if (activeLinesKpi) {
            activeLinesKpi.textContent =
                `${activeLineCount} / 4`;
        }

        // MONTHLY KPIs
        setKpi(
            "monthly-production",
            monthly.total_production
        );

        setKpi(
            "monthly-energy",
            monthly.total_energy,
            3
        );

        // Uses monthly.average_speed from the API response.
        // If the endpoint doesn't return this field,
        // this KPI will display a dash until the backend
        // response/calculation is updated.
        setKpi(
            "monthly-speed",
            monthly.average_speed,
            2
        );

        // DATE LABELS
        const dailyLabel =
            document.getElementById("daily-period-label");

        if (dailyLabel) {
            dailyLabel.textContent =
                `Performance for ${formatPeriodLabel(selectedDate)}.`;
        }

        const monthlyLabel =
            document.getElementById("monthly-period-label");

        if (monthlyLabel) {
            monthlyLabel.textContent =
                `Totals for ${displayMonth(year, month)}.`;
        }

        // CHARTS AND TABLE
        renderDashboardCharts({
            daily,
            productionTrend,
            energyTrend,
            speedTrend,
            productsResponse,
        });

        renderLinePerformanceTable(
            linesResponse,
            daily,
            lineProductSummary
        );

        showStatus();

    } catch (error) {
        console.error(
            "Dashboard loading error:",
            error
        );

        showStatus(
            `Dashboard could not load: ${error.message}. ` +
            "Confirm the backend server is running and the report endpoints are available.",
            "error"
        );
    }
}

function initialiseDashboard() {
    if (!dateInput) return;

    if (!dateInput.value) {
        dateInput.value = formatDate(new Date());
    }

    dateInput.addEventListener(
        "change",
        loadDashboard
    );

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadDashboard
        );
    }

    loadDashboard();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiseDashboard
    );
} else {
    initialiseDashboard();
}