import * as pdfjsLib from "./pdf.mjs";
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "./pdf-lib.esm.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

const form = document.querySelector("#activity-form");
const flyerContent = document.querySelector("#flyer-content");
const generateButton = document.querySelector("#generate-button");
const downloadButton = document.querySelector("#download-button");
const statusMessage = document.querySelector("#status-message");
const templateCanvas = document.querySelector("#template-canvas");
const templateFallback = document.querySelector("#template-fallback");

document.querySelector("#print-button")?.remove();

let activityMenu = [];

async function initializeApp() {
  await Promise.all([
    renderLockedTemplate(),
    loadActivities()
  ]);
}

async function renderLockedTemplate() {
  try {
    const pdf = await pdfjsLib.getDocument("./template-source.pdf").promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const context = templateCanvas.getContext("2d");

    templateCanvas.width = Math.ceil(viewport.width);
    templateCanvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
  } catch (error) {
    templateFallback.hidden = false;
    templateFallback.textContent = "Template PDF could not be loaded. Make sure template-source.pdf is in this folder.";
    statusMessage.textContent = "Template PDF could not be loaded. Make sure template-source.pdf is in this folder.";
    statusMessage.classList.add("error");
  }
}

async function loadActivities() {
  try {
    const response = await fetch("./activities.json?v=20260608-1");

    if (!response.ok) {
      throw new Error("Could not load activities.json");
    }

    activityMenu = await response.json();
    renderForm();
  } catch (error) {
    statusMessage.textContent = "Activity menu could not be loaded. Check activities.json and refresh.";
    statusMessage.classList.add("error");
  }
}

function renderForm() {
  form.innerHTML = activityMenu.map((group, groupIndex) => {
    const options = group.items.map((item, itemIndex) => {
      const id = `group-${groupIndex}-item-${itemIndex}`;
      const label = getItemLabel(item);
      const value = JSON.stringify({
        label,
        url: item.url || "",
        allowCustomText: item.allowCustomText || false
      });

      if (item.allowCustomText) {
        return `
          <div class="option custom-option">
            <input id="${id}" type="checkbox" name="${escapeAttribute(group.category)}" value="${escapeAttribute(value)}" aria-label="Include custom activity">
            <input class="custom-text" type="text" data-custom-text-for="${id}" value="${escapeAttribute(label)}" aria-label="${escapeAttribute(label)}">
          </div>
        `;
      }

      return `
        <label class="option" for="${id}">
          <input id="${id}" type="checkbox" name="${escapeAttribute(group.category)}" value="${escapeAttribute(value)}">
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    }).join("");

    return `
      <fieldset class="category-group" data-category="${escapeAttribute(group.category)}">
        <div class="category-heading">
          <h3>${escapeHtml(group.category)}</h3>
          <p class="category-help">Optional</p>
        </div>
        <div class="option-list">${options}</div>
      </fieldset>
    `;
  }).join("");

  form.querySelectorAll(".custom-text").forEach((input) => {
    input.addEventListener("focus", () => {
      if (input.value === "Custom activity") {
        input.select();
      }
    });

    input.addEventListener("input", () => {
      const checkbox = document.querySelector(`#${cssEscape(input.dataset.customTextFor)}`);

      if (input.value.trim()) {
        checkbox.checked = true;
      }
    });
  });
}

function getSelections() {
  return activityMenu.map((group) => {
    const selectedItems = [...form.querySelectorAll(`input[name="${cssEscape(group.category)}"]:checked`)]
      .map((input) => {
        const item = JSON.parse(input.value);

        if (!item.allowCustomText) {
          return item;
        }

        const customText = form.querySelector(`[data-custom-text-for="${cssEscape(input.id)}"]`)?.value.trim();

        return {
          ...item,
          label: customText || item.label,
          url: ""
        };
      });

    return {
      ...group,
      selectedItems
    };
  });
}

function generateFlyer() {
  const selections = getSelections()
    .filter((group) => group.selectedItems.length > 0);

  if (selections.length === 0) {
    flyerContent.innerHTML = '<p class="empty-preview">Select at least one activity to overlay on the template.</p>';
    statusMessage.textContent = "No activities selected yet.";
    statusMessage.classList.add("error");
    downloadButton.disabled = true;
    return;
  }

  const columns = splitIntoColumns(selections);

  flyerContent.innerHTML = columns.map((column) => `
    <div class="overlay-column overlay-column-${column.name}">
      ${column.groups.map((group) => `
        <section class="overlay-section ${getCategoryClass(group.category)}">
          <h3>
            <svg class="category-header-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <rect width="100" height="100" fill="#020202"></rect>
            </svg>
            <span>${escapeHtml(group.category)}</span>
          </h3>
          <ul>
            ${group.selectedItems.map((item) => `<li>${renderActivityItem(item)}</li>`).join("")}
          </ul>
        </section>
      `).join("")}
    </div>
  `).join("");

  statusMessage.textContent = "Flyer generated. Use Download Final PDF for the finished file.";
  statusMessage.classList.remove("error");
  downloadButton.disabled = false;
}

async function downloadFinalPdf() {
  if (downloadButton.disabled) {
    return;
  }

  const originalLabel = downloadButton.textContent;

  try {
    downloadButton.disabled = true;
    downloadButton.textContent = "Generating PDF...";
    statusMessage.textContent = "Generating the final Letter-size PDF...";

    const templateResponse = await fetch("./template-source.pdf");

    if (!templateResponse.ok) {
      throw new Error("Could not load template-source.pdf");
    }

    const templateBytes = await templateResponse.arrayBuffer();
    const outputPdf = await PDFDocument.create();
    const [templatePage] = await outputPdf.embedPdf(templateBytes, [0]);
    const pdfPage = outputPdf.addPage([612, 792]);
    const boldFont = await outputPdf.embedFont(StandardFonts.HelveticaBold);

    pdfPage.drawPage(templatePage, {
      x: 0,
      y: 0,
      width: 612,
      height: 792
    });

    drawPreviewOverlayToPdf(outputPdf, pdfPage, boldFont);

    const pdfBytes = await outputPdf.save({ useObjectStreams: false });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "welcome-to-texas-flyer.pdf";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    statusMessage.textContent = "Final PDF downloaded.";
    statusMessage.classList.remove("error");
  } catch (error) {
    statusMessage.textContent = "The final PDF could not be generated. Refresh the page and try again.";
    statusMessage.classList.add("error");
    console.error(error);
  } finally {
    downloadButton.textContent = originalLabel;
    downloadButton.disabled = false;
  }
}

function drawPreviewOverlayToPdf(pdfDocument, pdfPage, boldFont) {
  const flyerRect = document.querySelector("#flyer").getBoundingClientRect();
  const scaleX = 612 / flyerRect.width;
  const scaleY = 792 / flyerRect.height;
  const linkAnnotations = [];

  flyerContent.querySelectorAll(".overlay-section").forEach((section) => {
    drawCategoryHeader(pdfPage, boldFont, section.querySelector("h3"), flyerRect, scaleX, scaleY);

    section.querySelectorAll("li").forEach((item) => {
      drawActivityItem(pdfDocument, pdfPage, boldFont, item, flyerRect, scaleX, scaleY, linkAnnotations);
    });
  });

  if (linkAnnotations.length > 0) {
    pdfPage.node.set(PDFName.of("Annots"), pdfDocument.context.obj(linkAnnotations));
  }
}

function drawCategoryHeader(pdfPage, boldFont, header, flyerRect, scaleX, scaleY) {
  const rect = header.getBoundingClientRect();
  const x = (rect.left - flyerRect.left) * scaleX;
  const y = 792 - (rect.bottom - flyerRect.top) * scaleY;
  const width = rect.width * scaleX;
  const height = rect.height * scaleY;
  const fontSize = parsePixels(getComputedStyle(header).fontSize) * scaleY;
  const label = header.textContent.trim();
  const labelWidth = boldFont.widthOfTextAtSize(label, fontSize);

  pdfPage.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(2 / 255, 2 / 255, 2 / 255)
  });

  pdfPage.drawText(label, {
    x: x + (width - labelWidth) / 2,
    y: y + (height - fontSize) / 2 + fontSize * 0.2,
    size: fontSize,
    font: boldFont,
    color: rgb(253 / 255, 225 / 255, 192 / 255)
  });
}

function drawActivityItem(pdfDocument, pdfPage, boldFont, item, flyerRect, scaleX, scaleY, linkAnnotations) {
  const rect = item.getBoundingClientRect();
  const labelElement = item.querySelector("a, span");
  const labelRect = labelElement.getBoundingClientRect();
  const itemStyle = getComputedStyle(item);
  const fontSize = parsePixels(itemStyle.fontSize) * scaleY;
  const lineHeight = parsePixels(itemStyle.lineHeight) * scaleY;
  const boxSize = 0.17 * 96 * scaleX;
  const boxX = (rect.left - flyerRect.left) * scaleX + 0.01 * 96 * scaleX;
  const firstLineCenter = 792 - (rect.top - flyerRect.top) * scaleY - lineHeight / 2;
  const boxY = firstLineCenter - boxSize / 2;
  const textX = (labelRect.left - flyerRect.left) * scaleX;
  const textTop = 792 - (labelRect.top - flyerRect.top) * scaleY;
  const maxTextWidth = (rect.right - labelRect.left) * scaleX;
  const lines = wrapPdfText(labelElement.textContent.trim(), boldFont, fontSize, maxTextWidth);
  const isLinked = labelElement.tagName === "A";

  pdfPage.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    borderWidth: 1.5,
    borderColor: rgb(6 / 255, 6 / 255, 6 / 255)
  });

  lines.forEach((line, index) => {
    const textY = textTop - fontSize - index * lineHeight;
    const textWidth = boldFont.widthOfTextAtSize(line, fontSize);

    pdfPage.drawText(line, {
      x: textX,
      y: textY,
      size: fontSize,
      font: boldFont,
      color: rgb(8 / 255, 8 / 255, 7 / 255)
    });

    if (isLinked) {
      pdfPage.drawLine({
        start: { x: textX, y: textY - 1 },
        end: { x: textX + textWidth, y: textY - 1 },
        thickness: 0.55,
        color: rgb(8 / 255, 8 / 255, 7 / 255)
      });

      linkAnnotations.push(addPdfLinkAnnotation(pdfDocument, pdfPage, labelElement.href, {
        x: textX,
        y: textY - 1.5,
        width: textWidth,
        height: lineHeight + 2
      }));
    }
  });
}

function addPdfLinkAnnotation(pdfDocument, pdfPage, url, rect) {
  const action = pdfDocument.context.obj({
    Type: PDFName.of("Action"),
    S: PDFName.of("URI"),
    URI: PDFString.of(url)
  });
  const annotation = pdfDocument.context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Link"),
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],
    F: 4,
    H: PDFName.of("I"),
    P: pdfPage.ref,
    A: action
  });

  return pdfDocument.context.register(annotation);
}

function wrapPdfText(text, font, fontSize, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function parsePixels(value) {
  return Number.parseFloat(value) || 0;
}

function renderActivityItem(item) {
  const label = escapeHtml(item.label);

  if (!item.url) {
    return `<span>${label}</span>`;
  }

  return `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener">${label}</a>`;
}

function splitIntoColumns(groups) {
  const byCategory = new Map(groups.map((group) => [group.category, group]));
  const leftColumn = ["Texas BBQ", "Steakhouse", "Tecovas Boot/Hat"]
    .map((category) => byCategory.get(category))
    .filter(Boolean);
  const rightColumn = ["Tex Mex", "Experiences"]
    .map((category) => byCategory.get(category))
    .filter(Boolean);

  return [
    { name: "left", groups: leftColumn },
    { name: "right", groups: rightColumn }
  ];
}

function getCategoryClass(category) {
  return `category-${category.toLowerCase().replaceAll("&", "and").replaceAll("/", "-").replaceAll(" ", "-")}`;
}

function getItemLabel(item) {
  return typeof item === "string" ? item : item.label;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value).replaceAll('"', '\\"');
}

generateButton.addEventListener("click", generateFlyer);
downloadButton.addEventListener("click", downloadFinalPdf);

initializeApp();
