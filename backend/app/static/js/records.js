"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    const dateInput = $("records-date");
    const lineSelect = $("records-line");
    const shiftSelect = $("records-shift");
    const tbody = $("records-body");
    const message = $("records-message");

    let allRecords = [];

    function todayLocal() {
        const d = new Date();
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0"),
        ].join("-");
    }

    async function getJson(url) {
        const response = await fetch(url, {
            headers: { Accept: "application/json" },
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const detail = data?.detail || data?.message ||
                `HTTP ${response.status}`;
            throw new Error(
                Array.isArray(detail)
                    ? detail.map(e => e.msg || JSON.stringify(e)).join("; ")
                    : String(detail)
            );
        }

        return data;
    }

    function asList(data, keys) {
        if (Array.isArray(data)) return data;

        for (const key of keys) {
            if (Array.isArray(data?.[key])) return data[key];
        }

        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data?.data)) return data.data;

        return [];
    }

    function showMessage(text, type = "error") {
        message.textContent = text;
        message.className = `records-message records-${type}`;
        message.hidden = !text;
    }

    function addOptions(select, items, type, defaultText) {
        select.replaceChildren();

        const first = document.createElement("option");
        first.value = "";
        first.textContent = defaultText;
        select.appendChild(first);

        for (const item of items) {
            const id = item[`${type}_id`] ?? item.id;
            if (id === undefined || id === null) continue;

            const option = document.createElement("option");
            option.value = String(id);
            option.textContent =
                item.name || item[`${type}_name`] || `${type} ${id}`;

            select.appendChild(option);
        }
    }

    function cell(row, value) {
        const td = document.createElement("td");
        td.textContent = value == null ? "—" : String(value);
        row.appendChild(td);
        return td;
    }

    function number(value, digits = 0) {
        return Number(value || 0).toLocaleString("en-IN", {
            maximumFractionDigits: digits,
        });
    }

    function renderRecords() {
        const lineFilter = lineSelect.value;
        const shiftFilter = shiftSelect.value;

        const filtered = allRecords.filter(record => {
            const lineMatches =
                !lineFilter ||
                String(record.line_id) === lineFilter;

            const shiftMatches =
                !shiftFilter ||
                String(record.shift_id) === shiftFilter;

            return lineMatches && shiftMatches;
        });

        $("records-count").textContent = number(filtered.length);

        $("records-production").textContent = number(
            filtered.reduce(
                (sum, r) => sum + Number(r.production_quantity || 0),
                0
            )
        );

        $("records-energy").textContent =
            `${number(filtered.reduce(
                (sum, r) => sum + Number(r.energy_consumed || 0),
                0
            ), 3)} kWh`;

        $("records-period").textContent = dateInput.value
            ? `Production date: ${dateInput.value}`
            : "All available records";

        tbody.replaceChildren();

        if (!filtered.length) {
            const row = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 8;
            td.className = "records-empty";
            td.textContent = "No records match the selected filters.";
            row.appendChild(td);
            tbody.appendChild(row);
            return;
        }

        for (const record of filtered) {
            const row = document.createElement("tr");

            cell(row, String(record.production_date || "").slice(0, 10));
            cell(row, record.line_name);
            cell(row, record.product_name);
            cell(row, record.shift_name);
            cell(row, number(record.production_quantity));
            cell(row, number(record.line_speed, 2));
            cell(row, `${number(record.energy_consumed, 3)} kWh`);

            const actionCell = document.createElement("td");
            const editLink = document.createElement("a");

            editLink.href = "/operator";
            editLink.className = "records-edit-link";
            editLink.textContent = "Edit";

            // The operator page currently selects records for its chosen date.
            // Pass the record identifier for a future direct-edit deep link.
            editLink.addEventListener("click", event => {
                event.preventDefault();
                sessionStorage.setItem(
                    "production-record-to-edit",
                    String(record.record_id)
                );
                window.location.href = "/operator";
            });

            actionCell.appendChild(editLink);
            row.appendChild(actionCell);
            tbody.appendChild(row);
        }
    }

    async function loadRecords() {
        showMessage("");

        tbody.replaceChildren();
        const loadingRow = document.createElement("tr");
        const loadingCell = document.createElement("td");
        loadingCell.colSpan = 8;
        loadingCell.className = "records-empty";
        loadingCell.textContent = "Loading records…";
        loadingRow.appendChild(loadingCell);
        tbody.appendChild(loadingRow);

        try {
            const params = new URLSearchParams();

            if (dateInput.value) {
                params.set("production_date", dateInput.value);
            }

            const query = params.toString();
            const url = "/api/v1/production-records" +
                (query ? `?${query}` : "");

            const data = await getJson(url);

            allRecords = asList(data, ["records", "items"]);
            renderRecords();
        } catch (error) {
            allRecords = [];
            renderRecords();

            showMessage(
                `Could not load production records: ${error.message}`
            );
        }
    }

    async function loadFilters() {
        try {
            const [lineData, shiftData] = await Promise.all([
                getJson("/api/v1/lines"),
                getJson("/api/v1/shifts"),
            ]);

            addOptions(
                lineSelect,
                asList(lineData, ["lines"]),
                "line",
                "All lines"
            );

            addOptions(
                shiftSelect,
                asList(shiftData, ["shifts"]),
                "shift",
                "All shifts"
            );
        } catch (error) {
            showMessage(
                `Could not load filter options: ${error.message}`
            );
        }
    }

    $("records-apply").addEventListener("click", loadRecords);

    $("records-refresh").addEventListener("click", loadRecords);

    $("records-clear").addEventListener("click", async () => {
        dateInput.value = "";
        lineSelect.value = "";
        shiftSelect.value = "";
        await loadRecords();
    });

    lineSelect.addEventListener("change", renderRecords);
    shiftSelect.addEventListener("change", renderRecords);

    dateInput.value = todayLocal();

    (async () => {
        await loadFilters();
        await loadRecords();
    })();
});
