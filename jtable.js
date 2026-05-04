(function () {
    "use strict";

    const tableData = window.JTABLE_DATA ?? {};
    const rowData = tableData.rows ?? {};

    const DICT_TITLES = {
        "1": "Very common",
        "2": "Common",
        "3": "Above average",
        "4": "Regularly used",
        "5": "Limited regular usage",
        "6": "Rare or obsolete usage",
        "7": "Irregular or search-only usage",
        "-": "Not present in JMdict-listed spellings"
    };

    const GRADE_DESCRIPTIONS = {
        "1": "Kyōiku",
        "2": "Kyōiku",
        "3": "Kyōiku",
        "4": "Kyōiku",
        "5": "Kyōiku",
        "6": "Kyōiku",
        "8": "Jōyō",
        "9": "Jinmeiyō I",
        "10": "Jinmeiyō II",
        "12": "Publishing Kanji",
        "V": "Variant"
    };

    const SUMMARY_FIELD_SPECS = [
        { label: "Grade", key: "grade" },
        { label: "JIS", key: "jis" },
        { label: "Unicode code", key: "unicode" },
        { label: "IICore", key: "iicore" },
        { label: "JMdict priority", key: "jmdict" }
    ];

    function text(node, fallback = "-") {
        const value = node?.textContent?.trim() ?? "";
        return value || fallback;
    }

    function firstChar(value, fallback = "") {
        let base = Array.from(value || "")[0] || fallback;
        if (base === "=") {
            base = fallback;
        }
        return base;
    }

    function toUplus(char) {
        return "U+" + char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    }

    function isDataRow(row) {
        return (
            row instanceof HTMLTableRowElement &&
            row.children.length >= 7 &&
            row.firstElementChild instanceof HTMLTableCellElement &&
            row.firstElementChild.tagName === "TH"
        );
    }

    function headCell(row) {
        return isDataRow(row) ? row.firstElementChild : null;
    }

    function make(tag, className, textContent) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (textContent !== undefined) {
            node.textContent = textContent;
        }
        return node;
    }

    function categoryClass(node) {
        return Array.from(node?.classList ?? []).find((className) => className.startsWith("cat-")) || "";
    }

    function rowPayload(rowOrChar) {
        const key = typeof rowOrChar === "string" ? rowOrChar : rowOrChar?.id;
        const detail = key ? rowData[key] : null;
        return detail && typeof detail === "object" ? detail : null;
    }

    function glyphClassForChar(char) {
        const base = firstChar(char);
        const row = base ? document.getElementById(base) : null;
        if (isDataRow(row)) {
            return categoryClass(row);
        }

        return "cat-x";
    }

    function glyphHref(glyph, preferredHref = null) {
        if (preferredHref) {
            return preferredHref;
        }

        const base = firstChar(glyph);
        if (!base) {
            return null;
        }
        const row = document.getElementById(base);
        return isDataRow(row) ? "#" + base : null;
    }

    function variantFontForGlyph(glyph) {
        return Array.from(glyph || "").length > 1;
    }

    function makeGlyph(glyph, glyphClass, variantFont = false, href = null) {
        const targetHref = glyphHref(glyph, href);
        const node = make(targetHref ? "a" : "span");
        if (glyphClass) {
            node.classList.add(glyphClass);
        }
        if (variantFont) {
            node.classList.add("v");
        }
        if (targetHref) {
            node.href = targetHref;
        }
        node.textContent = glyph;
        return node;
    }

    function buildLookupLinks(char) {
        const hex = char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
        return [
            {
                label: "Mojikiban",
                href: "https://moji.or.jp/mojikibansearch/result?UCS=" + hex
            },
            {
                label: "Unicode char tools",
                href: "https://util.unicode.org/UnicodeJsps/character.jsp?a=" + encodeURIComponent(char)
            },
            {
                label: "Unihan",
                href: "https://www.unicode.org/cgi-bin/GetUnihanData.pl?codepoint=" + hex
            },
            {
                label: "Wiktionary ja",
                href: "https://ja.wiktionary.org/wiki/" + encodeURIComponent(char)
            },
            {
                label: "Wiktionary en",
                href: "https://en.wiktionary.org/wiki/" + encodeURIComponent(char)
            },
            {
                label: "JMDict",
                href: "https://www.edrdg.org/cgi-bin/wwwjdic/wwwjdic?1MUL" + encodeURIComponent(char)
            }
        ];
    }

    function buildLookupLinksNode(char) {
        const wrapper = make("div", "jt-link-list");
        buildLookupLinks(char).forEach((entry, index) => {
            if (index > 0) {
                wrapper.appendChild(make("span", "jt-link-sep", " | "));
            }
            const link = make("a", "", entry.label);
            link.href = entry.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            wrapper.appendChild(link);
        });
        return wrapper;
    }

    function appendEmptySection(container, heading, message) {
        const section = make("section");
        section.appendChild(make("h4", "", heading));
        section.appendChild(make("p", "jt-muted", message));
        container.appendChild(section);
    }

    function detailFlag(detail, key, defaultValue) {
        return Object.prototype.hasOwnProperty.call(detail, key) ? detail[key] : defaultValue;
    }

    function firstListedSource(firstListedYear, timeline) {
        if (!firstListedYear || !Array.isArray(timeline)) {
            return "";
        }

        const listEvents = timeline.filter((event) => event?.kind === "list" && event.action === "added");
        if (!listEvents.length) {
            return "";
        }

        const match = listEvents.find((event) => firstListedYear === event.year || firstListedYear === event.source_year);
        return match?.to_list || listEvents[0]?.to_list || "";
    }

    function buildGradeField(detail) {
        const effgrade = detail.effgrade || "-";
        const description = GRADE_DESCRIPTIONS[effgrade];
        let value = description ? (effgrade + " - " + description) : effgrade;

        if (detail.first_listed != null) {
            const listedIn = firstListedSource(detail.first_listed, detail.timeline || []);
            value += " (first listed " + detail.first_listed + (listedIn ? (" in " + listedIn) : "") + ")";
        }

        const notes = [];
        if (detailFlag(detail, "first_listed_as_alt_form", false)) {
            let note = "Alternative-form name-list character (1981-2004 list)";
            if (detail.alt_name_list_target) {
                note += " for " + detail.alt_name_list_target;
            }
            notes.push(note + ".");
        }
        if (detailFlag(detail, "is_pubkanji", false) && effgrade !== "12") {
            notes.push("Listed in the Publishing Kanji list (表外漢字字体表).");
        }

        return { value, notes };
    }

    function buildJisField(detail) {
        const notes = [];
        const timeline = Array.isArray(detail.timeline) ? detail.timeline : [];

        if (detail.jislevel > 2 && detailFlag(detail, "is_jis208_any", false)) {
            const replacements = timeline.filter(
                (event) => event?.kind === "jis" && event.action === "replaced" && jisLevel(event.from_jis_code) && [1, 2].includes(jisLevel(event.from_jis_code))
            );
            if (replacements.length) {
                for (const event of replacements) {
                    const level = jisLevel(event.from_jis_code);
                    let note = "Previously in JIS X 0208 level " + level;
                    if (event.related_char) {
                        note += ", replaced by " + event.related_char;
                    }
                    notes.push(note + ".");
                }
            } else {
                notes.push("Previously encoded in JIS X 0208 via a historical form.");
            }
        }

        if (detailFlag(detail, "jis213only", false)) {
            notes.push("JIS X 0213-only (no JIS X 0212 encoding).");
        }
        if (detail.jis2004_added === true) {
            notes.push("Added as new form in the 2004 JIS revision.");
        } else if ([1, 2].includes(detail.jislevel) && detailFlag(detail, "is_jis78_cp", true) === false) {
            notes.push("Not present in JIS X 0208:1978.");
        } else if (detail.jis2004_added === false) {
            notes.push("Canonical appearance modified in the 2004 JIS revision.");
        }

        return {
            value: (detail.jis_code || "X") + " - Level " + (detail.jislevel ?? "-"),
            notes
        };
    }

    function buildUnicodeField(detail) {
        let value = detail.char_code || "-";
        if (detail.unicode_age) {
            value += " - Unicode v" + detail.unicode_age;
        }

        const notes = [];
        if (detail.compatibility_target) {
            notes.push("Compatibility ideograph unified with " + detail.compatibility_target + ".");
        } else if (detailFlag(detail, "in_bmp", true) === false) {
            notes.push("Outside the BMP and outside the CJK Unified Ideographs block (URO).");
        } else if (detailFlag(detail, "in_uro", true) === false) {
            notes.push("Outside the CJK Unified Ideographs block (URO).");
        }

        return { value, notes };
    }

    function buildIicoreField(detail) {
        const value = detail.iicore_full && detail.iicore_full !== "-"
            ? ((detail.iicore || "-") + " - " + detail.iicore_full)
            : (detail.iicore || "-");

        const notes = [];
        const core2020 = detailFlag(detail, "core2020", true);
        if (core2020 == null) {
            notes.push("Not in Unihan Core 2020.");
        } else if (core2020 === false) {
            notes.push("In Unihan Core 2020 but without J source.");
        }
        if (detailFlag(detail, "in_bmp", true) === false) {
            notes.push("Outside the Basic Multilingual Plane (BMP).");
        } else if (detailFlag(detail, "in_uro", true) === false) {
            notes.push("Outside the CJK Unified Ideographs block (URO).");
        }

        return { value, notes };
    }

    function buildJmdictField(detail) {
        const dictValue = detail.dictprio && detail.dictprio < 8 ? String(detail.dictprio) : "-";
        return {
            value: dictValue + " - " + DICT_TITLES[dictValue],
            notes: []
        };
    }

    function buildSummaryField(detail, key) {
        switch (key) {
        case "grade":
            return buildGradeField(detail);
        case "jis":
            return buildJisField(detail);
        case "unicode":
            return buildUnicodeField(detail);
        case "iicore":
            return buildIicoreField(detail);
        case "jmdict":
            return buildJmdictField(detail);
        default:
            return { value: "-", notes: [] };
        }
    }

    function appendCompatibilityTargetText(container, value) {
        const textValue = String(value || "");
        const markers = [
            "Compatibility ideograph unified with ",
            "compatibility ideograph for "
        ];

        for (const marker of markers) {
            const markerIndex = textValue.indexOf(marker);
            if (markerIndex < 0) {
                continue;
            }

            const glyphStart = markerIndex + marker.length;
            const chars = Array.from(textValue.slice(glyphStart));
            const glyph = chars[0];
            if (!glyph) {
                return false;
            }

            container.append(textValue.slice(0, glyphStart));
            container.appendChild(
                makeGlyph(glyph, glyphClassForChar(glyph), variantFontForGlyph(glyph))
            );

            const remainder = chars.slice(1).join("");
            if (remainder) {
                container.append(remainder);
            }
            return true;
        }

        return false;
    }

    function appendNotes(container, notes) {
        if (!Array.isArray(notes) || !notes.length) {
            return;
        }

        const list = make("ul", "jt-field-notes");
        for (const note of notes) {
            const item = make("li");
            if (!appendCompatibilityTargetText(item, note)) {
                item.textContent = String(note);
            }
            list.appendChild(item);
        }
        container.appendChild(list);
    }

    function appendField(summary, label, field) {
        summary.appendChild(make("dt", "", label));
        const dd = make("dd");
        dd.appendChild(make("div", "", field?.value || "-"));
        appendNotes(dd, field?.notes || []);
        summary.appendChild(dd);
    }

    function appendFieldNode(summary, label, valueNode) {
        summary.appendChild(make("dt", "", label));
        const dd = make("dd");
        dd.appendChild(valueNode);
        summary.appendChild(dd);
    }

    function appendGlyph(container, glyph) {
        if (!glyph) {
            return;
        }
        container.appendChild(
            makeGlyph(glyph, glyphClassForChar(glyph), variantFontForGlyph(glyph))
        );
    }

    function isSupplementaryJisCode(code) {
        return String(code || "").startsWith("212:");
    }

    function jisStandardName(code, year) {
        if (isSupplementaryJisCode(code)) {
            return "JIS X 0212";
        }
        return year >= 2000 ? "JIS X 0213" : "JIS X 0208";
    }

    function jisLevel(code) {
        if (!code || isSupplementaryJisCode(code)) {
            return null;
        }

        const parts = String(code).split("-").map((part) => Number(part));
        const [men, ku, ten] = parts.length === 2 ? [1, parts[0], parts[1]] : parts;

        if (men === 1) {
            if (ku === 1) {
                return 0;
            }
            if (16 <= ku && ku <= 47) {
                return 1;
            }
            if (48 <= ku && ku <= 83) {
                return 2;
            }
            if ((ku === 47 && ten >= 52) || (ku === 84 && ten >= 7) || ku >= 13) {
                return 3;
            }
        }

        if (men === 2) {
            return 4;
        }

        return null;
    }

    function formatJisCodeDetail(year, code) {
        const displayCode = String(code || "").replace(/^212:/, "");
        if (!displayCode) {
            return "";
        }
        if (isSupplementaryJisCode(code)) {
            return jisStandardName(code, year) + " " + displayCode;
        }
        const level = jisLevel(code);
        if (level == null) {
            return jisStandardName(code, year) + " " + displayCode;
        }
        return jisStandardName(code, year) + " " + displayCode + " (level " + level + ")";
    }

    function appendTimelineCodeDetail(container, value) {
        if (!value) {
            return;
        }
        container.appendChild(make("span", "jt-codepoint jt-timeline-detail jt-timeline-detail-inline", value));
    }

    function appendTimelineEventBody(container, event) {
        const fromJisYear = event.from_jis_year || event.year;
        const toJisYear = event.to_jis_year || event.year;

        switch (event.kind) {
        case "unicode": {
            const relatedChar = event.related_char || "";
            container.append("Added to Unicode");
            const detail = make("span", "jt-codepoint jt-timeline-detail jt-timeline-detail-inline");
            if (event.unicode_version) {
                detail.append("Unicode " + event.unicode_version);
            }
            if (event.unicode_type === "compatibility") {
                if (detail.textContent) {
                    detail.append("; ");
                }
                detail.append("compatibility ideograph for ");
                if (relatedChar) {
                    detail.appendChild(
                        makeGlyph(
                            relatedChar,
                            glyphClassForChar(relatedChar),
                            variantFontForGlyph(relatedChar)
                        )
                    );
                }
            } else if (event.unicode_type === "non-bmp") {
                if (detail.textContent) {
                    detail.append("; ");
                }
                detail.append("non-BMP ideograph outside the URO");
            } else if (event.unicode_type === "non-uro-bmp") {
                if (detail.textContent) {
                    detail.append("; ");
                }
                detail.append("non-URO BMP ideograph");
            }
            if (detail.textContent) {
                container.append(" ");
                container.appendChild(detail);
            }
            return;
        }

        case "list": {
            const relatedChar = event.related_char || "";
            if (!event.from_list) {
                container.append("Added to " + (event.to_list || "list"));
                if (event.to_list_part) {
                    container.append(" as " + event.to_list_part);
                }
                if (relatedChar) {
                    container.append(" (for ");
                    appendGlyph(container, relatedChar);
                    container.append(")");
                }
                if (event.source_year) {
                    container.append(" ");
                    appendTimelineCodeDetail(container, "primary form listed in " + event.source_year);
                }
                return;
            }

            const action = event.action || "moved";
            container.append(
                action[0].toUpperCase() +
                action.slice(1) +
                " from " + (event.from_list || "?") +
                " to " + (event.to_list || "?")
            );
            return;
        }

        case "jis": {
            const relatedChar = event.related_char || "";
            const displayCode = event.to_jis_code || event.from_jis_code;
            const displayYear = event.to_jis_year || event.from_jis_year || event.year;

            if (event.action === "included") {
                container.append("Included in " + jisStandardName(event.to_jis_code, toJisYear));
                const detail = formatJisCodeDetail(displayYear, displayCode);
                if (detail) {
                    container.append(" ");
                    appendTimelineCodeDetail(container, detail);
                }
                return;
            }

            if (event.action === "re-added") {
                container.append("Re-added to JIS");
                const detail = formatJisCodeDetail(displayYear, displayCode);
                if (detail) {
                    container.append(" ");
                    appendTimelineCodeDetail(container, detail);
                }
                return;
            }

            if (event.action === "added") {
                container.append("Added to JIS");
                const detail = formatJisCodeDetail(displayYear, displayCode);
                if (detail) {
                    container.append(" ");
                    appendTimelineCodeDetail(container, detail);
                }
                return;
            }

            if (event.action === "removed") {
                container.append("Removed from JIS");
                const detail = formatJisCodeDetail(fromJisYear, event.from_jis_code);
                if (detail) {
                    container.append(" ");
                    appendTimelineCodeDetail(container, detail);
                }
                return;
            }

            if (event.action === "became" || event.action === "replaced") {
                container.append("JIS form changed");
                const detailNode = make("span", "jt-codepoint jt-timeline-detail jt-timeline-detail-inline");
                if (event.action === "became") {
                    detailNode.append("became the encoded form at ");
                    detailNode.append(formatJisCodeDetail(toJisYear, event.to_jis_code));
                    if (relatedChar) {
                        detailNode.append("; replaced ");
                        appendGlyph(detailNode, relatedChar);
                    }
                } else {
                    detailNode.append("replaced at ");
                    detailNode.append(formatJisCodeDetail(fromJisYear, event.from_jis_code));
                    if (relatedChar) {
                        detailNode.append(" by ");
                        appendGlyph(detailNode, relatedChar);
                    }
                }
                if (detailNode.textContent) {
                    container.append(" ");
                    container.appendChild(detailNode);
                }
                return;
            }

            if (event.action === "moved") {
                container.append("Moved in JIS");
                const detailNode = make("span", "jt-codepoint jt-timeline-detail jt-timeline-detail-inline");
                detailNode.append(formatJisCodeDetail(toJisYear, event.to_jis_code));
                if (relatedChar) {
                    detailNode.append("; swapped with ");
                    appendGlyph(detailNode, relatedChar);
                }
                if (detailNode.textContent) {
                    container.append(" ");
                    container.appendChild(detailNode);
                }
                return;
            }

            container.append(event.action || "JIS event");
            if (displayCode) {
                const detail = formatJisCodeDetail(displayYear, displayCode);
                if (detail) {
                    container.append(" ");
                    appendTimelineCodeDetail(container, detail);
                }
            }
            return;
        }

        default:
            container.append(event.action || event.kind || "Timeline event");
        }
    }

    function appendTimelineSection(container, events) {
        if (!Array.isArray(events) || !events.length) {
            appendEmptySection(container, "Timeline", "No timeline metadata.");
            return;
        }

        const section = make("section");
        section.appendChild(make("h4", "", "Timeline"));
        const list = make("ul", "jt-timeline-list");

        for (const event of events) {
            const item = make("li", "jt-timeline-item");
            item.appendChild(make("span", "jt-timeline-year", String(event.year)));
            item.appendChild(document.createTextNode(" "));
            appendTimelineEventBody(item, event);
            list.appendChild(item);
        }

        section.appendChild(list);
        container.appendChild(section);
    }

    function appendVariantHead(container, glyph, glyphClass, options = {}) {
        const head = make("div", "jt-variant-head");
        head.appendChild(makeGlyph(glyph, glyphClass, options.variantFont));
        const metaParts = [options.code, options.relation].filter(Boolean);
        if (metaParts.length) {
            head.appendChild(make("span", "jt-codepoint", metaParts.join("; ")));
        }
        container.appendChild(head);
    }

    function appendVariantSection(container, heading, items, emptyMessage, renderItem, sectionClass) {
        if (!Array.isArray(items) || !items.length) {
            appendEmptySection(container, heading, emptyMessage);
            return;
        }

        const section = make("section");
        if (sectionClass) {
            section.classList.add(sectionClass);
        }
        section.appendChild(make("h4", "", heading));
        const list = make("ul", "jt-variant-list");
        for (const item of items) {
            const li = make("li");
            renderItem(li, item);
            list.appendChild(li);
        }
        section.appendChild(list);
        container.appendChild(section);
    }

    function createDetailContent(row) {
        const rowChar = row.id || firstChar(text(headCell(row)));
        const detail = rowPayload(rowChar) || {};
        const glyphClass = categoryClass(row);

        const wrapper = make("div", "jt-detail");
        const hero = make("header", "jt-detail-hero");
        const glyph = make("div", "jt-detail-glyph", rowChar);
        if (glyphClass) {
            glyph.classList.add(glyphClass);
        }
        hero.append(glyph, make("div", "jt-codepoint", toUplus(rowChar)));
        wrapper.appendChild(hero);

        const summary = make("dl", "jt-detail-summary");
        for (const fieldSpec of SUMMARY_FIELD_SPECS) {
            appendField(summary, fieldSpec.label, buildSummaryField(detail, fieldSpec.key));
        }
        appendFieldNode(summary, "Look up", buildLookupLinksNode(rowChar));
        wrapper.appendChild(summary);

        const meta = make("div", "jt-detail-meta");
        appendTimelineSection(meta, detail.timeline || []);

        const ivsItems = Array.isArray(detail.ivs) ? detail.ivs : [];
        const canonicalItems = Array.isArray(detail.canonical) ? detail.canonical : [];
        const ivsHeading = ivsItems.length && canonicalItems.length
            ? "IVS / Canonical+IVS"
            : canonicalItems.length
            ? "Canonical+IVS"
            : "IVS";

        appendVariantSection(
            meta,
            ivsHeading,
            [...ivsItems, ...canonicalItems],
            "No pseudo-variant metadata.",
            (item, entry) => {
                appendVariantHead(item, entry.glyph, glyphClassForChar(entry.glyph), {
                    variantFont: true,
                    relation: entry.jis_form ? (entry.relation + " - " + entry.jis_form) : entry.relation
                });
            },
            "jt-ivs-section"
        );

        appendVariantSection(
            meta,
            "Variants",
            detail.variants || [],
            "No variant metadata.",
            (item, entry) => {
                appendVariantHead(item, entry.glyph, glyphClassForChar(entry.glyph), {
                    code: entry.code,
                    relation: entry.relation
                });

                if (!Array.isArray(entry.refs) || !entry.refs.length) {
                    return;
                }

                const refs = make("div", "jt-variant-ref-list");
                for (const ref of entry.refs) {
                    const refItem = make("span");
                    refItem.append(make("strong", "", ref.short), " ", ref.detail);
                    refs.appendChild(refItem);
                }
                item.appendChild(refs);
            }
        );

        appendVariantSection(
            meta,
            "Components",
            detail.components || [],
            "No component metadata.",
            (item, entry) => {
                const glyph = makeGlyph(entry.glyph, glyphClassForChar(entry.glyph));
                glyph.classList.add("jt-component-glyph");
                item.append(glyph, " - " + entry.code);
            }
        );

        wrapper.appendChild(meta);
        return wrapper;
    }

    function enhanceInlineRefs(table) {
        for (const span of table.querySelectorAll("tbody td span[class*='cat-']")) {
            if (!(span instanceof HTMLSpanElement) || span.closest("a")) {
                continue;
            }

            const cell = span.closest("td");
            const value = text(span, "");
            if (!value || (cell?.cellIndex === 5 && /^(V:|I:)/.test(value))) {
                continue;
            }

            const target = Array.from(value)[0];
            if (!target) {
                continue;
            }
            if (target !== "=" && !span.title) {
                span.title = toUplus(target);
            }

            const targetHref = glyphHref(target);
            if (!targetHref) {
                continue;
            }

            const link = make("a");
            link.href = targetHref;
            span.replaceWith(link);
            link.appendChild(span);
        }
    }

    function applyDictionaryTitles(table) {
        for (const row of table.tBodies[0]?.rows || []) {
            if (!(row instanceof HTMLTableRowElement) || row.children.length < 5) {
                continue;
            }

            const cell = row.children[4];
            if (!(cell instanceof HTMLTableCellElement)) {
                continue;
            }

            const dictTitle = DICT_TITLES[text(cell)];
            if (dictTitle) {
                cell.title = dictTitle;
            }
        }
    }

    function applySidecarTitles(table) {
        for (const row of table.tBodies[0]?.rows || []) {
            if (!isDataRow(row) || !row.id) {
                continue;
            }

            const detail = rowPayload(row.id);
            if (!detail) {
                continue;
            }

            const [head, gradeCell, _jisCell, iicoreCell] = row.children;
            head.title = toUplus(row.id) + " (" + (detail.jis_code || "X") + ")";
            if (detail.first_listed != null) {
                gradeCell.title = String(detail.first_listed);
            }
            if (detail.iicore_full) {
                iicoreCell.title = detail.iicore_full;
            }
        }
    }

    function initializeTableEnhancements(table) {
        enhanceInlineRefs(table);
        applyDictionaryTitles(table);
        applySidecarTitles(table);
        setupMasterDetail(table);
    }

    function setupMasterDetail(table) {
        const tbody = table.tBodies[0];
        if (!tbody) {
            return;
        }

        const baseTitle = document.title;
        const detailRow = make("tr", "jt-detail-row");
        const detailCell = make("td");
        detailCell.colSpan = table.tHead?.rows[0]?.cells.length || 7;
        detailRow.hidden = true;
        detailRow.appendChild(detailCell);

        let selectedRow = null;
        let hasHistoryEntry = window.location.hash.length > 1;

        function setDocumentTitle(row) {
            if (!isDataRow(row)) {
                document.title = baseTitle;
                return;
            }

            const rowChar = row.id || firstChar(text(headCell(row)));
            document.title = rowChar + " (" + toUplus(rowChar) + ") - " + baseTitle;
        }

        function updateHash(row) {
            if (!row.id) {
                return;
            }

            const url = new URL(window.location.href);
            if (url.hash === "#" + row.id) {
                return;
            }

            url.hash = row.id;
            if (hasHistoryEntry) {
                history.replaceState(null, "", url);
            } else {
                history.pushState(null, "", url);
                hasHistoryEntry = true;
            }
        }

        function selectRow(row, syncHash = true) {
            if (!isDataRow(row) || row === selectedRow) {
                return;
            }

            if (selectedRow) {
                selectedRow.classList.remove("jt-selected");
                headCell(selectedRow)?.setAttribute("aria-expanded", "false");
            }

            selectedRow = row;
            row.classList.add("jt-selected");
            headCell(row)?.setAttribute("aria-expanded", "true");
            detailCell.replaceChildren(createDetailContent(row));
            row.insertAdjacentElement("afterend", detailRow);
            detailRow.hidden = false;
            setDocumentTitle(row);

            if (syncHash) {
                updateHash(row);
            }
        }

        function selectHashRow() {
            const id = decodeURIComponent(window.location.hash.slice(1));
            if (!id) {
                setDocumentTitle(null);
                return;
            }

            const row = document.getElementById(id);
            if (isDataRow(row)) {
                hasHistoryEntry = true;
                selectRow(row, false);
            }
        }

        for (const row of tbody.rows) {
            if (!isDataRow(row)) {
                continue;
            }
            const th = headCell(row);
            if (!th) {
                continue;
            }
            th.classList.add("jt-selectable");
            th.tabIndex = 0;
            th.setAttribute("role", "button");
            th.setAttribute("aria-expanded", "false");
        }

        tbody.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const th = target.closest("th");
            const row = th?.parentElement;
            if (!isDataRow(row)) {
                return;
            }

            if (target.closest("a")) {
                event.preventDefault();
            }

            selectRow(row);
        });

        tbody.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const th = target.closest("th");
            const row = th?.parentElement;
            if (!isDataRow(row)) {
                return;
            }

            event.preventDefault();
            selectRow(row);
        });

        window.addEventListener("hashchange", selectHashRow);
        selectHashRow();
    }

    const table = document.getElementById("maintab");
    if (!(table instanceof HTMLTableElement)) {
        return;
    }

    initializeTableEnhancements(table);

    const jumpForm = document.getElementById("kanji-jump-form");
    const jumpInput = document.getElementById("kanji-jump");
    if (jumpForm && jumpInput) {
        jumpForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const char = Array.from(jumpInput.value.trim())[0];
            if (char) {
                window.location.hash = encodeURIComponent(char);
            }
            jumpInput.value = "";
        });
    }
})();