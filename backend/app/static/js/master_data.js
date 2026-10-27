
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const refreshButton = document.getElementById("md-refresh");
    const statusElement = document.getElementById("md-status");

    refreshButton.addEventListener("click", loadMasterData);

    loadMasterData();

    async function fetchJson(url) {
        const response = await fetch(url, {
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`${url} failed (${response.status}): ${detail}`);
        }

        return response.json();
    }

    function makeCell(row, value, tag = "td") {
        const cell = document.createElement(tag);
        cell.textContent = String(value ?? "—");
        row.appendChild(cell);
        return cell;
    }

    function showEmptyRow(tbody, columnCount, message) {
        tbody.replaceChildren();
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = columnCount;
        cell.className = "md-empty";
        cell.textContent = message;

        row.appendChild(cell);
        tbody.appendChild(row);
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function renderLines(lines) {
        const container = document.getElementById("md-lines");
        container.replaceChildren();

        if (!lines.length) {
            container.appendChild(
                makeElement("p", "md-placeholder", "No production lines found.")
            );
            return;
        }

        lines.forEach(line => {
            const card = makeElement("article", "md-line-card");
            const top = makeElement("div", "md-line-card-top");
            const badge = makeElement(
                "span",
                "md-line-badge",
                `L${line.line_id}`
            );

            const title = makeElement("h3", "", line.name);
            const id = makeElement(
                "p",
                "md-muted",
                `Line ID: ${line.line_id}`
            );

            top.append(badge, title);
            card.append(top, id);
            container.appendChild(card);
        });
    }

    function renderProducts(products) {
        const body = document.getElementById("md-products");
        body.replaceChildren();

        if (!products.length) {
            showEmptyRow(body, 2, "No products found.");
            return;
        }

        products.forEach(product => {
            const row = document.createElement("tr");
            makeCell(row, product.product_id);
            makeCell(row, product.name);
            body.appendChild(row);
        });
    }

    function renderShifts(shifts) {
        const container = document.getElementById("md-shifts");
        container.replaceChildren();

        if (!shifts.length) {
            container.appendChild(
                makeElement("p", "md-placeholder", "No shifts found.")
            );
            return;
        }

        shifts.forEach(shift => {
            const card = makeElement("article", "md-shift-card");
            const badge = makeElement(
                "span",
                "md-shift-badge",
                shift.name
            );

            const title = makeElement("h3", "", `Shift ${shift.name}`);
            const id = makeElement(
                "p",
                "md-muted",
                `Shift ID: ${shift.shift_id}`
            );

            card.append(badge, title, id);
            container.appendChild(card);
        });
    }

    function renderMappings(lines, mappings) {
        const container = document.getElementById("md-mappings");
        container.replaceChildren();

        if (!lines.length) {
            container.appendChild(
                makeElement("p", "md-placeholder", "No line mappings available.")
            );
            return;
        }

        lines.forEach(line => {
            const card = makeElement("article", "md-mapping-card");
            const heading = makeElement("div", "md-mapping-heading");
            const title = makeElement("h3", "", line.name);
            const count = mappings[line.line_id]?.length ?? 0;

            const countBadge = makeElement(
                "span",
                "md-count-badge",
                `${count} ${count === 1 ? "product" : "products"}`
            );

            heading.append(title, countBadge);

            const description = makeElement(
                "p",
                "md-muted",
                `Line ID: ${line.line_id}`
            );

            const productList = makeElement("div", "md-product-chips");
            const products = mappings[line.line_id] || [];

            if (!products.length) {
                productList.appendChild(
                    makeElement(
                        "span",
                        "md-no-mapping",
                        "No allowed products returned"
                    )
                );
            } else {
                products.forEach(product => {
                    const chip = makeElement(
                        "span",
                        "md-product-chip",
                        product.name
                    );
                    productList.appendChild(chip);
                });
            }

            card.append(heading, description, productList);
            container.appendChild(card);
        });
    }

    async function loadMasterData() {
        refreshButton.disabled = true;
        statusElement.textContent = "Loading master data…";

        try {
            const [lines, products, shifts] = await Promise.all([
                fetchJson("/api/v1/lines"),
                fetchJson("/api/v1/products"),
                fetchJson("/api/v1/shifts")
            ]);

            if (!Array.isArray(lines) ||
                !Array.isArray(products) ||
                !Array.isArray(shifts)) {
                throw new Error(
                    "Unexpected response format from a master-data endpoint."
                );
            }

            const mappingResults = await Promise.allSettled(
                lines.map(async line => ({
                    lineId: line.line_id,
                    products: await fetchJson(
                        `/api/v1/lines/${encodeURIComponent(line.line_id)}/products`
                    )
                }))
            );

            const mappings = {};
            const failedLineIds = [];

            mappingResults.forEach((result, index) => {
                const line = lines[index];

                if (result.status === "fulfilled" &&
                    Array.isArray(result.value.products)) {
                    mappings[result.value.lineId] = result.value.products;
                } else {
                    mappings[line.line_id] = [];
                    failedLineIds.push(line.line_id);
                    console.error(
                        `Could not load products for line ${line.line_id}:`,
                        result.reason || "Unexpected response format"
                    );
                }
            });

            renderLines(lines);
            renderProducts(products);
            renderShifts(shifts);
            renderMappings(lines, mappings);

            const mappingCount = Object.values(mappings)
                .reduce((total, items) => total + items.length, 0);

            document.getElementById("md-line-count").textContent =
                lines.length;

            document.getElementById("md-product-count").textContent =
                products.length;

            document.getElementById("md-shift-count").textContent =
                shifts.length;

            document.getElementById("md-mapping-count").textContent =
                mappingCount;

            if (failedLineIds.length) {
                statusElement.textContent =
                    `Master data loaded, but mappings could not be loaded for line IDs: ${failedLineIds.join(", ")}.`;
            } else {
                statusElement.textContent =
                    "Master data loaded successfully.";
            }
        } catch (error) {
            console.error("Master data loading error:", error);

            statusElement.textContent =
                "Could not load master data. Check the backend server and browser console.";
        } finally {
            refreshButton.disabled = false;
        }
    }
});
