const fs = require("node:fs");
const path = require("node:path");

function pushGeometryIssues(record, metrics) {
  for (const issue of metrics.issues) record.issues.push(issue);
  record.metrics = metrics.metrics;
}

async function runDynamicLayoutAudit({ contexts, api, width, height, out }) {
  const records = [];
  const admin = await contexts.admin.newPage();
  await admin.setViewportSize({ width, height });
  await admin.goto("/admin?tab=listings", { waitUntil: "domcontentloaded" });
  await admin.locator(".admin-tabs").waitFor();
  const tabs = [
    ["Thu thập tin", "collector"],
    ["Quản lý bài", "listings"],
    ["Cộng đồng", "community"],
    ["Báo cáo", "reports"],
    ["Nhật ký kiểm duyệt", "audit"],
    ["Thu thập từ HTML", "html"],
  ];

  for (const [label, key] of tabs) {
    const tab = admin.getByRole("button", { name: new RegExp(`^${label}`) });
    await tab.click();
    await admin.waitForTimeout(80);
    const record = {
      name: `admin-tab-${key}`,
      width,
      height,
      issues: [],
    };
    if (!(await tab.evaluate((el) => el.classList.contains("is-active"))))
      record.issues.push(`Admin tab did not activate: ${label}`);
    if (key === "collector") {
      const url = admin.locator("#crawl-url");
      await url.waitFor();
      pushGeometryIssues(
        record,
        await admin.evaluate((viewportWidth) => {
          const issueList = [];
          const metrics = {};
          const url = document.querySelector("#crawl-url");
          const pages = document.querySelector("#crawl-pages");
          const labelFor = (control) =>
            control.closest("label") ||
            (control.id
              ? document.querySelector(`label[for='${control.id}']`)
              : null);
          const labelRect = (label) => {
            if (!label?.firstChild || label.firstChild.nodeType !== Node.TEXT_NODE)
              return label?.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(label.firstChild);
            return range.getBoundingClientRect();
          };
          const urlLabel = labelFor(url);
          const urlBox = url?.getBoundingClientRect();
          const labelBox = labelRect(urlLabel);
          metrics.url = { width: urlBox?.width, height: urlBox?.height };
          if (!urlLabel || labelBox.bottom > urlBox.top + 2)
            issueList.push("URL label must sit above its input");
          if (urlBox.width < 240 || urlBox.width > 721)
            issueList.push(`URL input width outside 240..720px: ${urlBox.width}`);
          if (urlLabel && !urlLabel.classList.contains("ui-field"))
            issueList.push("URL input must use the shared ui-field wrapper");
          const pagesLabel = labelFor(pages);
          const pagesBox = pages?.getBoundingClientRect();
          const pagesLabelBox = labelRect(pagesLabel);
          const pagesCss = getComputedStyle(pages);
          metrics.pages = {
            width: pagesBox?.width,
            height: pagesBox?.height,
            font: parseFloat(pagesCss.fontSize),
          };
          if (!pagesLabel || pagesLabelBox.bottom > pagesBox.top + 2)
            issueList.push("Maximum-pages label must sit above its select");
          if (pagesBox.height !== 40 || parseFloat(pagesCss.fontSize) < 14)
            issueList.push("Maximum-pages select must be 40px and at least 14px");
          const fields = document.querySelector(".url-crawl-fields")?.getBoundingClientRect();
          const actions = document.querySelector(".url-crawl-actions")?.getBoundingClientRect();
          const analyze = [...document.querySelectorAll(".url-crawl-actions button")]
            .find((button) => button.textContent.includes("Phân tích URL"));
          const analyzeBox = analyze?.getBoundingClientRect();
          const summary = document.querySelector(".url-crawl-panel + .admin-summary")?.getBoundingClientRect();
          metrics.gaps = {
            fieldRows: pagesLabelBox.top - urlBox.bottom,
            beforeAction: analyzeBox?.top - pagesBox.bottom,
            beforeStats: summary?.top - document.querySelector(".url-crawl-panel")?.getBoundingClientRect().bottom,
          };
          if (!fields || metrics.gaps.fieldRows < 12)
            issueList.push("Crawl form fields need at least 12px vertical spacing");
          if (!analyzeBox || metrics.gaps.beforeAction < 12)
            issueList.push("Analyze button needs at least 12px top spacing");
          if (!summary || metrics.gaps.beforeStats < 24)
            issueList.push("Collector statistics need 24px separation from URL panel");
          if (analyze?.disabled && getComputedStyle(analyze).opacity < 0.5)
            issueList.push("Disabled analyze button is too faint to read");
          const note = document.querySelector(".admin-auto-run-note")?.getBoundingClientRect();
          const auto = document.querySelector(".collector-auto-run")?.getBoundingClientRect();
          const run = [...document.querySelectorAll(".collector-run-controls button")]
            .find((button) => button.textContent.includes("Chạy ngay"))
            ?.getBoundingClientRect();
          metrics.autoRun = {
            noteWidth: note?.width,
            autoHeight: auto?.height,
            horizontalGap: run && auto ? run.left - auto.right : null,
            overlap: Boolean(note && run && note.left < run.right && note.right > run.left && note.top < run.bottom && note.bottom > run.top),
          };
          if (!note || !auto || !run || metrics.autoRun.overlap)
            issueList.push("Auto-run label, note and button must not overlap");
          if (viewportWidth >= 390 && (!auto || auto.width < 220))
            issueList.push("Auto-run note column is too narrow to wrap");
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context.font = `${getComputedStyle(url).fontSize} ${getComputedStyle(url).fontFamily}`;
          const placeholder = context.measureText(url.placeholder).width;
          metrics.placeholder = { measured: placeholder, available: url.clientWidth - 24, scroll: url.scrollWidth };
          if (url.scrollWidth > url.clientWidth + 1 || placeholder > url.clientWidth - 24)
            issueList.push("URL placeholder is clipped");
          return { issues: issueList, metrics };
        }, width),
      );
      if ([390, 768, 1366, 1920].includes(width))
        await admin.screenshot({
          path: path.join(out, `dynamic-${width}-crawl-url.png`),
          fullPage: true,
          animations: "disabled",
        });
    }
    if (key === "listings") {

      await admin.locator(".admin-listing-filters").waitFor();
      pushGeometryIssues(
        record,
        await admin.evaluate((viewportWidth) => {
          const issueList = [];
          const metrics = {};
          const filter = document.querySelector(".admin-listing-filters");
          const search = filter?.querySelector("input");
          const select = filter?.querySelector("select");
          const searchBox = search?.getBoundingClientRect();
          const selectBox = select?.getBoundingClientRect();
          metrics.filters = {
            searchWidth: searchBox?.width,
            searchHeight: searchBox?.height,
            selectWidth: selectBox?.width,
            selectHeight: selectBox?.height,
            gap: selectBox && searchBox ? selectBox.left - searchBox.right : null,
          };
          if (!search || !select || searchBox.width < 280 || searchBox.width > 421)
            issueList.push("Listing search width must be 280..420px on desktop");
          if (selectBox.width < 180)
            issueList.push("Listing status select must be at least 180px wide");
          if (searchBox.height !== 40 || selectBox.height !== 40)
            issueList.push("Listing filters must both be 40px tall");
          if (searchBox.left < selectBox.right && selectBox.left < searchBox.right && Math.abs(searchBox.top - selectBox.top) < 4) {
            if (selectBox.left - searchBox.right < 8)
              issueList.push("Listing filters need at least 8px horizontal gap");
          }
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context.font = `${getComputedStyle(search).fontSize} ${getComputedStyle(search).fontFamily}`;
          const placeholder = context.measureText(search.placeholder).width;
          metrics.placeholder = { measured: placeholder, available: search.clientWidth - 24, scroll: search.scrollWidth };
          if (search.scrollWidth > search.clientWidth + 1 || placeholder > search.clientWidth - 24)
            issueList.push("Listing search placeholder is clipped");
          const actions = document.querySelector(".admin-main .admin-section-head .admin-controls");
          const buttons = actions ? [...actions.querySelectorAll(":scope > button")].map((button) => button.getBoundingClientRect()) : [];
          if (buttons.some((box, index) => index && box.left - buttons[index - 1].right < 8))
            issueList.push("Listing action buttons need at least 8px gap");
          const pagination = document.querySelector(".admin-listings-status .button-row");
          const pageButtons = pagination ? [...pagination.querySelectorAll("button")].map((button) => button.getBoundingClientRect()) : [];
          if (pageButtons.length !== 2 || pageButtons[1].left - pageButtons[0].right < 8)
            issueList.push("Pagination buttons need at least 8px gap");
          if (pageButtons.length === 2 && pageButtons.some((box) => box.height !== pageButtons[0].height))
            issueList.push("Pagination buttons need a consistent height");
          if (pageButtons.length === 2 && pageButtons.some((box) => box.width !== pageButtons[0].width))
            issueList.push("Pagination buttons need a consistent width");
          const status = document.querySelector(".admin-listings-status")?.getBoundingClientRect();
          const batch = document.querySelector(".admin-listings-batch");
          if (batch) {
            const batchBox = batch.getBoundingClientRect();
            const check = batch.querySelector("input[type=checkbox]")?.getBoundingClientRect();
            const label = batch.querySelector("label")?.getBoundingClientRect();
            metrics.batch = { gap: batchBox.top - status.bottom, checkCenter: check && label ? Math.abs(check.top + check.height / 2 - (label.top + label.height / 2)) : null };
            if (metrics.batch.gap < 12 || metrics.batch.gap > 20)
              issueList.push("Listing statistics and select-all need 12..20px vertical spacing");
            if (metrics.batch.checkCenter > 3)
              issueList.push("Select-all checkbox must align with its label");
          }
          return { issues: issueList, metrics };
        }, width),
      );
      if ([390, 768, 1366, 1920].includes(width))
        await admin.screenshot({
          path: path.join(out, `dynamic-${width}-admin-listings.png`),
          fullPage: true,
          animations: "disabled",
        });
      const search = admin.locator(".admin-listing-filters input");
      await search.fill("__layout_no_match__");
      await admin.getByText("Không có bài đăng phù hợp bộ lọc.", { exact: true }).waitFor();
      await search.clear();
    }
    if (key === "html") {
      const sourceForm = admin.locator(".html-source-form");
      await sourceForm.waitFor();
      pushGeometryIssues(
        record,
        await sourceForm.evaluate((form, viewportWidth) => {
          const issues = [];
          const fields = [...form.querySelectorAll(":scope > label")];
          const sizes = fields.map((field) => {
            const control = field.querySelector("input, select, textarea");
            const firstText = [...field.childNodes].find(
              (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
            );
            const range = document.createRange();
            if (firstText) range.selectNodeContents(firstText);
            const labelBox = firstText
              ? range.getBoundingClientRect()
              : field.getBoundingClientRect();
            const controlBox = control?.getBoundingClientRect();
            if (!field.classList.contains("ui-field"))
              issues.push("HTML source field must use the shared ui-field wrapper");
            if (!control || labelBox.bottom > controlBox.top + 2)
              issues.push("HTML source labels must sit above their inputs");
            if (control && controlBox.width < 240)
              issues.push(`HTML source input is too narrow: ${controlBox.width}`);
            if (control && viewportWidth >= 768 && controlBox.width < 240)
              issues.push(`HTML source field is narrower than 240px: ${controlBox.width}`);
            return {
              width: controlBox?.width,
              height: controlBox?.height,
            };
          });
          if (new Set(sizes.map((size) => size.height)).size !== 1)
            issues.push("HTML source inputs need a common height");
          return { issues, metrics: { fields: sizes } };
        }, width),
      );
      if ([390, 768, 1366, 1920].includes(width))
        await admin.screenshot({
          path: path.join(out, `dynamic-${width}-admin-html-form.png`),
          fullPage: true,
          animations: "disabled",
        });
    }
    records.push(record);
  }
  await admin.close();

  const community = await contexts.student.newPage();
  await community.setViewportSize({ width, height });
  await community.goto("/thao-luan", { waitUntil: "domcontentloaded" });
  await community.getByRole("button", { name: "Viết thảo luận", exact: true }).click();
  await community.locator(".discussion-form").waitFor();
  const composer = {
    name: "community-discussion-composer",
    width,
    height,
    issues: [],
  };
  pushGeometryIssues(
    composer,
    await community.evaluate(() => {
      const issueList = [];
      const metrics = {};
      const form = document.querySelector(".discussion-form");
      if (!form) {
        return {
          issues: ["Discussion composer did not render an authenticated form"],
          metrics,
        };
      }
      const labels = [...form.querySelectorAll(":scope > label")];
      for (const label of labels) {
        const control = label.querySelector(":scope > input, :scope > textarea, :scope > select");
        const labelRange = document.createRange();
        const firstText = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (firstText) labelRange.selectNodeContents(firstText);
        const labelBox = firstText ? labelRange.getBoundingClientRect() : label.getBoundingClientRect();
        const controlBox = control?.getBoundingClientRect();
        if (!control || labelBox.bottom > controlBox.top + 2)
          issueList.push("Discussion label must sit above its control");
        if (!label.classList.contains("ui-field"))
          issueList.push("Discussion form labels must use shared ui-field markup");
        const panelBox = document.querySelector(".composer-panel")?.getBoundingClientRect();
        const panelStyle = document.querySelector(".composer-panel") && getComputedStyle(document.querySelector(".composer-panel"));
        const panelInnerWidth = panelBox && panelStyle
          ? panelBox.width - parseFloat(panelStyle.paddingLeft) - parseFloat(panelStyle.paddingRight)
          : innerWidth;
        if (control && controlBox.width < panelInnerWidth - 2)
          issueList.push(`Discussion control is too narrow: ${controlBox.width}px`);
        if (control && control.localName !== "textarea" && controlBox.height !== 40)
          issueList.push(`Discussion ${control.localName} must be 40px tall`);
        if (control?.localName === "textarea" && controlBox.height < 120)
          issueList.push("Discussion textarea must be at least 120px tall");
        if (control && getComputedStyle(control).borderTopLeftRadius !== "8px")
          issueList.push("Discussion controls must use an 8px radius");
      }
      const topics = document.querySelector(".discussion-topic-fields");
      if (!topics) {
        return {
          issues: [...issueList, "Discussion topic field grid is missing"],
          metrics,
        };
      }
      const topicFields = [...topics.querySelectorAll(":scope > label")].map((el) => el.getBoundingClientRect());
      metrics.topicColumns = topicFields.map((box) => box.width);
      if (topicFields.length !== 2)
        issueList.push("Discussion topic and area need two grid fields");
      if (innerWidth <= 520 && topicFields.length === 2 && Math.abs(topicFields[0].top - topicFields[1].top) < 4)
        issueList.push("Discussion topic fields must stack on mobile");
      if (innerWidth > 520 && topicFields.length === 2 && Math.abs(topicFields[0].top - topicFields[1].top) > 4)
        issueList.push("Discussion topic fields must share a desktop row");
      if (topics && getComputedStyle(topics).columnGap !== "16px")
        issueList.push("Discussion topic fields need a 16px gap");
      const controlBoxes = labels
        .map((label) => label.querySelector(":scope > input, :scope > textarea, :scope > select")?.getBoundingClientRect())
        .filter(Boolean);
      for (let left = 0; left < controlBoxes.length; left++) {
        for (let right = left + 1; right < controlBoxes.length; right++) {
          const a = controlBoxes[left];
          const b = controlBoxes[right];
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
            issueList.push("Discussion form controls overlap");
        }
      }
      const panel = document.querySelector(".composer-panel");
      const heading = panel?.querySelector(".section-title-row")?.getBoundingClientRect();
      const firstLabel = labels[0]?.getBoundingClientRect();
      const footer = form?.querySelector(".composer-footer")?.getBoundingClientRect();
      const lastLabel = labels.at(-1)?.getBoundingClientRect();
      metrics.spacing = {
        headingToForm: firstLabel?.top - heading?.bottom,
        formToFooter: footer?.top - lastLabel?.bottom,
        panelWidth: panel?.getBoundingClientRect().width,
      };
      if (metrics.spacing.headingToForm < 16)
        issueList.push("Discussion form needs 20px separation from its heading");
      if (metrics.spacing.formToFooter < 16)
        issueList.push("Discussion footer needs 20px separation from fields");
      if (metrics.spacing.panelWidth > 641)
        issueList.push("Discussion panel must be no wider than 640px");
      const footerNote = form?.querySelector(".composer-footer p")?.getBoundingClientRect();
      const footerButton = form?.querySelector(".composer-footer button")?.getBoundingClientRect();
      if (footerNote && footerButton) {
        const overlap = footerNote.left < footerButton.right && footerNote.right > footerButton.left && footerNote.top < footerButton.bottom && footerNote.bottom > footerButton.top;
        if (overlap)
          issueList.push("Discussion footer note and submit button overlap");
      }
      return { issues: issueList, metrics };
    }),
  );
  if ([390, 768, 1366, 1920].includes(width))
    await community.screenshot({
      path: path.join(out, `dynamic-${width}-discussion-composer.png`),
      fullPage: true,
      animations: "disabled",
    });
  records.push(composer);
  await community.close();
  return records;
}

module.exports = { runDynamicLayoutAudit };
