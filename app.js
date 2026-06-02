import * as pdfjsLib from "./vendor/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.mjs";

const form = document.querySelector("#activity-form");
const flyerContent = document.querySelector("#flyer-content");
const generateButton = document.querySelector("#generate-button");
const printButton = document.querySelector("#print-button");
const statusMessage = document.querySelector("#status-message");
const templateCanvas = document.querySelector("#template-canvas");
const templateFallback = document.querySelector("#template-fallback");

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
    const response = await fetch("activities.json");

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
        url: item.url || ""
      });

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
}

function getSelections() {
  return activityMenu.map((group) => {
    const selectedItems = [...form.querySelectorAll(`input[name="${cssEscape(group.category)}"]:checked`)]
      .map((input) => JSON.parse(input.value));

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
    printButton.disabled = true;
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

  statusMessage.textContent = "Flyer generated. Use Print / Save PDF to open your browser print dialog.";
  statusMessage.classList.remove("error");
  printButton.disabled = false;
}

function printFlyer() {
  window.print();
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
  const rightColumn = ["Tex Mex", "Other Items"]
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
printButton.addEventListener("click", printFlyer);

initializeApp();
