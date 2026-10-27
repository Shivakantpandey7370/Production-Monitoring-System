"use strict";

document.addEventListener("DOMContentLoaded", initialiseOperator);

function initialiseOperator() {
    const $ = (id) => document.getElementById(id);

    const form = $("oe-form");
    const dateInput = $("oe-date");
    const lineSelect = $("oe-line");
    const productSelect = $("oe-product");
    const shiftSelect = $("oe-shift");
    const quantityInput = $("oe-quantity");
    const speedInput = $("oe-speed");
    const energyInput = $("oe-energy");

    const messageBox = $("oe-message");
    const fieldError = $("oe-field-error");
    const reviewPanel = $("oe-review-panel");
    const reviewContent = $("oe-review-content");
    const reviewButton = $("oe-review-button");
    const confirmButton = $("oe-confirm-button");

    let lines = [];
    let shifts = [];
    let allowedProducts = [];
    let records = [];
    let editingRecordId = null;
    let pendingPayload = null;
    let loadingProducts = false;
    let loadingRecords = false;

    function todayLocal() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function readList(payload, keys = []) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (!payload || typeof payload !== "object") {
            return [];
        }

        for (const key of [
            ...keys,
            "items",
            "data",
            "results",
        ]) {
            if (Array.isArray(payload[key])) {
                return payload[key];
            }
        }

        return [];
    }

    function optionId(item, type) {
        return item[
            `${type}_id`
        ] ?? item.id;
    }

    function optionName(item, type) {
        return (
            item.name ||
            item[`${type}_name`] ||
            item.title ||
            `${type} ${optionId(item, type) ?? ""}`
        );
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {}),
            },
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            let message =
                payload?.detail ||
                payload?.message ||
                response.statusText;

            if (Array.isArray(message)) {
                message = message
                    .map(item => item.msg || JSON.stringify(item))
                    .join("; ");
            }

            throw new Error(
                `${message || "Request failed"} (HTTP ${response.status})`
            );
        }

        return payload;
    }

    function setMessage(message, type = "info") {
        messageBox.textContent = message || "";
        messageBox.className = `oe-message oe-message-${type}`;
        messageBox.hidden = !message;
    }

    function setFieldError(message = "") {
        fieldError.textContent = message;
        fieldError.hidden = !message;
    }

    function escapeText(value) {
        return String(value ?? "");
    }

    function dateLabel(value) {
        if (!value) return "—";

        const parsed = new Date(`${value}T00:00:00`);

        if (Number.isNaN(parsed.getTime())) {
            return value;
        }

        return parsed.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    function setOptions(
        select,
        items,
        type,
        placeholder,
        selectedValue = ""
    ) {
        select.replaceChildren();

        const first = document.createElement("option");
        first.value = "";
        first.textContent = placeholder;
        select.appendChild(first);

        for (const item of items) {
            const id = optionId(item, type);

            if (id === undefined || id === null) {
                continue;
            }

            const option = document.createElement("option");

            option.value = String(id);
            option.textContent = optionName(item, type);

            if (String(id) === String(selectedValue)) {
                option.selected = true;
            }

            select.appendChild(option);
        }
    }

    function selectedNumber(select) {
        return select.value === ""
            ? null
            : Number(select.value);
    }

    function getLineRecords(lineId) {
        return records.filter(
            record => Number(record.line_id) === Number(lineId)
        );
    }

    function getLineProduct(lineId) {
        const existing = getLineRecords(lineId)[0];
        return existing ? Number(existing.product_id) : null;
    }

    function updateDateSummary() {
        $("oe-date-summary").textContent =
            `Production date: ${dateLabel(dateInput.value)}`;
    }

    function updateReviewItem(label, value) {
        const item = document.createElement("div");
        item.className = "oe-review-item";

        const labelElement = document.createElement("span");
        labelElement.className = "oe-review-label";
        labelElement.textContent = label;

        const valueElement = document.createElement("strong");
        valueElement.className = "oe-review-value";
        valueElement.textContent = escapeText(value);

        item.append(labelElement, valueElement);
        reviewContent.appendChild(item);
    }

    async function loadMasterData() {
        try {
            setMessage("Loading lines and shifts…", "info");

            const [linesPayload, shiftsPayload] =
                await Promise.all([
                    requestJson("/api/v1/lines"),
                    requestJson("/api/v1/shifts"),
                ]);

            lines = readList(
                linesPayload,
                ["lines", "items"]
            );

            shifts = readList(
                shiftsPayload,
                ["shifts", "items"]
            );

            setOptions(
                lineSelect,
                lines,
                "line",
                "Select production line"
            );

            setOptions(
                shiftSelect,
                shifts,
                "shift",
                "Select shift"
            );

            if (!lines.length) {
                throw new Error(
                    "No production lines were returned by the API."
                );
            }

            if (!shifts.length) {
                throw new Error(
                    "No shifts were returned by the API."
                );
            }

            setMessage("", "info");
            await loadDailyRecords();
        } catch (error) {
            console.error("Master data error:", error);

            setMessage(
                `Could not load lines or shifts. ${error.message}`,
                "error"
            );
        }
    }

    async function loadAllowedProducts() {
        const lineId = lineSelect.value;

        allowedProducts = [];
        productSelect.disabled = true;

        if (!lineId) {
            setOptions(
                productSelect,
                [],
                "product",
                "Select a line first"
            );

            $("oe-product-help").textContent =
                "Products are filtered by the selected line.";

            return;
        }

        loadingProducts = true;

        setOptions(
            productSelect,
            [],
            "product",
            "Loading allowed products…"
        );

        try {
            const payload = await requestJson(
                `/api/v1/lines/${encodeURIComponent(lineId)}/products`
            );

            allowedProducts = readList(
                payload,
                ["products", "allowed_products", "items"]
            );

            const existingProductId =
                getLineProduct(lineId);

            setOptions(
                productSelect,
                allowedProducts,
                "product",
                "Select product",
                existingProductId ?? ""
            );

            productSelect.disabled = allowedProducts.length === 0;

            if (existingProductId !== null) {
                const productName =
                    productSelect.selectedOptions[0]?.textContent ||
                    "the product already assigned";

                $("oe-product-help").textContent =
                    `This line already has records for this date. Continue with ${productName}.`;
            } else {
                $("oe-product-help").textContent =
                    "Only products permitted on this line are shown.";
            }

            if (!allowedProducts.length) {
                $("oe-product-help").textContent =
                    "No allowed products were returned for this line.";
            }

            updateShiftAvailability();
        } catch (error) {
            console.error("Product loading error:", error);

            setOptions(
                productSelect,
                [],
                "product",
                "Could not load products"
            );

            setMessage(
                `Could not load allowed products. ${error.message}`,
                "error"
            );
        } finally {
            loadingProducts = false;
        }
    }

    function updateShiftAvailability() {
        const lineId = lineSelect.value;

        for (const option of shiftSelect.options) {
            if (!option.value) continue;

            const shiftId = Number(option.value);

            const duplicate = records.some(record =>
                Number(record.line_id) === Number(lineId) &&
                Number(record.shift_id) === shiftId &&
                Number(record.record_id) !== Number(editingRecordId)
            );

            option.disabled =
                !editingRecordId && duplicate;
        }
    }

    async function loadDailyRecords() {
        const selectedDate = dateInput.value;

        if (!selectedDate) return;

        loadingRecords = true;
        updateDateSummary();

        $("oe-records-body").replaceChildren();

        const loadingRow = document.createElement("tr");
        const loadingCell = document.createElement("td");

        loadingCell.colSpan = 7;
        loadingCell.className = "oe-empty-row";
        loadingCell.textContent = "Loading saved records…";

        loadingRow.appendChild(loadingCell);
        $("oe-records-body").appendChild(loadingRow);

        try {
            const payload = await requestJson(
                `/api/v1/production-records?${new URLSearchParams({
                    production_date: selectedDate,
                })}`
            );

            records = readList(payload, ["records", "items"]);

            renderRecords();
            updateShiftAvailability();
        } catch (error) {
            console.error("Records loading error:", error);

            records = [];
            renderRecords(
                "Could not load saved records. " + error.message
            );
        } finally {
            loadingRecords = false;
        }
    }

    function appendCell(row, value, className = "") {
        const cell = document.createElement("td");

        cell.textContent = escapeText(value);

        if (className) {
            cell.className = className;
        }

        row.appendChild(cell);
        return cell;
    }

    function renderRecords(errorMessage = "") {
        const tbody = $("oe-records-body");

        tbody.replaceChildren();

        const totalProduction = records.reduce(
            (sum, record) =>
                sum + Number(record.production_quantity || 0),
            0
        );

        const totalEnergy = records.reduce(
            (sum, record) =>
                sum + Number(record.energy_consumed || 0),
            0
        );

        $("oe-record-count").textContent =
            records.length.toLocaleString("en-IN");

        $("oe-record-production").textContent =
            totalProduction.toLocaleString("en-IN");

        $("oe-record-energy").textContent =
            `${totalEnergy.toLocaleString("en-IN", {
                maximumFractionDigits: 3,
            })} kWh`;

        if (errorMessage) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 7;
            cell.className = "oe-empty-row";
            cell.textContent = errorMessage;

            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        if (!records.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 7;
            cell.className = "oe-empty-row";
            cell.textContent =
                "No production records for this date yet.";

            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        for (const record of records) {
            const row = document.createElement("tr");

            appendCell(row, record.line_name);
            appendCell(row, record.product_name);
            appendCell(row, record.shift_name);

            appendCell(
                row,
                Number(record.production_quantity || 0)
                    .toLocaleString("en-IN"),
                "oe-number-cell"
            );

            appendCell(
                row,
                Number(record.line_speed || 0)
                    .toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                    }),
                "oe-number-cell"
            );

            appendCell(
                row,
                Number(record.energy_consumed || 0)
                    .toLocaleString("en-IN", {
                        maximumFractionDigits: 3,
                    }),
                "oe-number-cell"
            );

            const actionCell = document.createElement("td");
            const editButton = document.createElement("button");

            editButton.type = "button";
            editButton.className = "oe-edit-button";
            editButton.textContent = "Edit";
            editButton.addEventListener(
                "click",
                () => startEditing(record)
            );

            actionCell.appendChild(editButton);
            row.appendChild(actionCell);
            tbody.appendChild(row);
        }
    }

    function resetEntry() {
        const selectedDate = dateInput.value || todayLocal();

        editingRecordId = null;
        pendingPayload = null;

        form.reset();
        dateInput.disabled = false;

        dateInput.value = selectedDate;

        lineSelect.disabled = false;
        productSelect.disabled = true;
        shiftSelect.disabled = false;

        $("oe-form-title").textContent =
            "Enter Production Data";

        reviewButton.textContent = "Review Entry →";
        confirmButton.textContent = "✓ Confirm & Save";

        reviewPanel.hidden = true;

        setFieldError("");
        setMessage("");

        setOptions(
            productSelect,
            [],
            "product",
            "Select a line first"
        );

        updateDateSummary();
        updateShiftAvailability();
    }

    async function startEditing(record) {
        editingRecordId = Number(record.record_id);
        pendingPayload = null;

        dateInput.value = String(record.production_date).slice(0, 10);
        lineSelect.value = String(record.line_id);

        updateDateSummary();

        await loadAllowedProducts();

        productSelect.value = String(record.product_id);
        shiftSelect.value = String(record.shift_id);

        quantityInput.value = record.production_quantity;
        speedInput.value = record.line_speed;
        energyInput.value = record.energy_consumed;

        dateInput.disabled = true;
        lineSelect.disabled = true;
        productSelect.disabled = true;
        shiftSelect.disabled = true;

        $("oe-form-title").textContent =
            `Editing ${record.line_name} · ${record.shift_name}`;

        reviewButton.textContent = "Review Changes →";
        confirmButton.textContent = "✓ Confirm Update";

        reviewPanel.hidden = true;

        setFieldError("");

        setMessage(
            "Edit mode: date, line, product and shift are locked. " +
            "Only quantity, speed and energy can be updated.",
            "info"
        );

        $("oe-form-title").scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }

    function validateEntry() {
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }

        const quantity = Number(quantityInput.value);
        const speed = Number(speedInput.value);
        const energy = Number(energyInput.value);

        if (
            !Number.isFinite(quantity) ||
            quantity < 0 ||
            !Number.isInteger(quantity)
        ) {
            setFieldError(
                "Production quantity must be a whole number greater than or equal to zero."
            );
            return false;
        }

        if (!Number.isFinite(speed) || speed < 0) {
            setFieldError(
                "Line speed must be a valid number greater than or equal to zero."
            );
            return false;
        }

        if (!Number.isFinite(energy) || energy < 0) {
            setFieldError(
                "Energy consumed must be a valid number greater than or equal to zero."
            );
            return false;
        }

        const lineId = selectedNumber(lineSelect);
        const productId = selectedNumber(productSelect);
        const shiftId = selectedNumber(shiftSelect);

        if (
            lineId === null ||
            productId === null ||
            shiftId === null
        ) {
            setFieldError(
                "Select a production line, an allowed product and a shift."
            );
            return false;
        }

        if (loadingProducts || loadingRecords) {
            setFieldError(
                "Please wait for the allowed products and daily records to finish loading."
            );
            return false;
        }

        if (!allowedProducts.some(
            item => Number(optionId(item, "product")) === productId
        )) {
            setFieldError(
                "The selected product is not allowed on this line."
            );
            return false;
        }

        const existingLineRecords = getLineRecords(lineId);

        const assignedProduct =
            existingLineRecords.length
                ? Number(existingLineRecords[0].product_id)
                : null;

        if (
            !editingRecordId &&
            assignedProduct !== null &&
            assignedProduct !== productId
        ) {
            setFieldError(
                "A different product is already recorded for this line and date. Use the existing product."
            );
            return false;
        }

        const duplicate = records.find(record =>
            Number(record.line_id) === lineId &&
            Number(record.shift_id) === shiftId &&
            Number(record.record_id) !== Number(editingRecordId)
        );

        if (duplicate && !editingRecordId) {
            setFieldError(
                `A record already exists for ${duplicate.line_name}, ` +
                `${duplicate.shift_name} on ${dateLabel(dateInput.value)}. ` +
                "Choose another shift or edit the existing record."
            );
            return false;
        }

        setFieldError("");
        return true;
    }

    function createPayload() {
        return {
            production_date: dateInput.value,
            line_id: Number(lineSelect.value),
            product_id: Number(productSelect.value),
            shift_id: Number(shiftSelect.value),
            production_quantity: Number(quantityInput.value),
            line_speed: Number(speedInput.value),
            energy_consumed: Number(energyInput.value),
        };
    }

    function showReview() {
        if (!validateEntry()) {
            reviewPanel.hidden = true;
            return;
        }

        pendingPayload = createPayload();

        reviewContent.replaceChildren();

        const isEdit = editingRecordId !== null;

        updateReviewItem(
            "Action",
            isEdit ? "Update existing record" : "Create new record"
        );

        updateReviewItem(
            "Production date",
            dateLabel(pendingPayload.production_date)
        );

        updateReviewItem(
            "Production line",
            lineSelect.selectedOptions[0].textContent
        );

        updateReviewItem(
            "Product",
            productSelect.selectedOptions[0].textContent
        );

        updateReviewItem(
            "Shift",
            shiftSelect.selectedOptions[0].textContent
        );

        updateReviewItem(
            "Production quantity",
            `${pendingPayload.production_quantity.toLocaleString("en-IN")} units`
        );

        updateReviewItem(
            "Line speed",
            `${pendingPayload.line_speed.toLocaleString("en-IN")} units/min`
        );

        updateReviewItem(
            "Energy consumed",
            `${pendingPayload.energy_consumed.toLocaleString("en-IN")} kWh`
        );

        confirmButton.disabled = false;

        reviewPanel.hidden = false;

        reviewPanel.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }

    async function saveEntry() {
        if (!pendingPayload) {
            setMessage(
                "Review the entry before saving it.",
                "error"
            );
            return;
        }

        if (confirmButton.disabled) return;

        confirmButton.disabled = true;
        reviewButton.disabled = true;

        setMessage(
            editingRecordId
                ? "Updating production record…"
                : "Saving production record…",
            "info"
        );

        try {
            let result;

            if (editingRecordId !== null) {
                const updatePayload = {
                    production_quantity:
                        pendingPayload.production_quantity,
                    line_speed: pendingPayload.line_speed,
                    energy_consumed:
                        pendingPayload.energy_consumed,
                };

                result = await requestJson(
                    `/api/v1/production-records/${editingRecordId}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(updatePayload),
                    }
                );
            } else {
                result = await requestJson(
                    "/api/v1/production-records",
                    {
                        method: "POST",
                        body: JSON.stringify(pendingPayload),
                    }
                );
            }

            const wasUpdate = editingRecordId !== null;

            const successMessage = wasUpdate
                ? "✓ Production record updated successfully!"
                : "✓ Production record added successfully!";

            reviewPanel.hidden = true;

            resetEntry();

            await loadDailyRecords();

            setMessage(successMessage, "success");

            // const successMessage =
            //     result?.message ||
            //     (
            //         editingRecordId
            //             ? "Production record updated successfully."
            //             : "Production record saved successfully."
            //     );

            // reviewPanel.hidden = true;

            // setMessage(successMessage, "success");

            // resetEntry();

            // await loadDailyRecords();

            // if (lineSelect.value) {
            //     await loadAllowedProducts();
            // }

            // setMessage(successMessage, "success");
        } catch (error) {
            console.error("Production save error:", error);

            setMessage(
                `Unable to save the record. ${error.message}`,
                "error"
            );

            setFieldError(
                "Check the message above. Correct the entry or edit an existing record if necessary."
            );
        } finally {
            confirmButton.disabled = false;
            reviewButton.disabled = false;
        }
    }

    // UI events
    lineSelect.addEventListener("change", async () => {
        setFieldError("");
        reviewPanel.hidden = true;

        await loadAllowedProducts();
    });

    dateInput.addEventListener("change", async () => {
        if (editingRecordId !== null) {
            resetEntry();
        }

        setFieldError("");
        reviewPanel.hidden = true;

        await loadDailyRecords();

        if (lineSelect.value) {
            await loadAllowedProducts();
        }
    });

    shiftSelect.addEventListener("change", () => {
        setFieldError("");
        reviewPanel.hidden = true;
    });

    form.addEventListener("input", () => {
        setFieldError("");

        if (!reviewPanel.hidden) {
            reviewPanel.hidden = true;
        }
    });

    $("oe-reset").addEventListener("click", async () => {
        resetEntry();

        if (lineSelect.value) {
            await loadAllowedProducts();
        }
    });

    reviewButton.addEventListener("click", showReview);

    $("oe-back-button").addEventListener("click", () => {
        reviewPanel.hidden = true;
        setFieldError("");
    });

    confirmButton.addEventListener("click", saveEntry);

    $("oe-reload-records").addEventListener(
        "click",
        loadDailyRecords
    );

    // Initial loading
    dateInput.value = todayLocal();
    updateDateSummary();

    loadMasterData();
}