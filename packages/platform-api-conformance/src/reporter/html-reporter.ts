import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { BRAND_DISPLAY_NAME } from "@privacy-brand/tooling-shared/brand";

import { resolveRepoPath } from "../repo-paths.js";
import type { ConformanceReport } from "../types.js";

import type { ReportInput } from "./report-input.js";

const REPORT_TITLE = `${BRAND_DISPLAY_NAME} API Conformance Report`;
const REPORT_HEADING = `${BRAND_DISPLAY_NAME} API Conformance (v2 Runtime)`;

const REPORT_PAYLOAD_TOKEN = "__API_CONFORMANCE_REPORT_PAYLOAD__";
const REPORT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${REPORT_TITLE}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f9fafb; }
    h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }

    /* Layout */
    .dashboard { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
    @media (max-width: 900px) { .dashboard { grid-template-columns: 1fr; } }

    /* Header & General controls */
    .header-info { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .search-box { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px;}
    input[type="text"] { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; box-sizing: border-box; font-size: 1em; }
    .severity-filters { display: flex; gap: 15px; flex-wrap: wrap; }

    /* Sidebar Filters */
    .sidebar { display: flex; flex-direction: column; gap: 15px; }
    .filter-panel { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .filter-panel-title { font-weight: 600; margin-bottom: 8px; font-size: 0.9em; text-transform: uppercase; color: #4b5563; display: flex; justify-content: space-between; }
    .filter-count { background: #e5e7eb; padding: 2px 6px; border-radius: 99px; font-size: 0.8em; }
    .filter-list { max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; font-size: 0.9em; padding-right: 5px; }
    .filter-all { padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; font-weight: bold; }
    label { cursor: pointer; display: flex; align-items: flex-start; gap: 6px; line-height: 1.3; word-break: break-all; }
    input[type="checkbox"] { margin-top: 2px; }

    /* Findings */
    .finding { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 5px solid #d1d5db; }
    .finding.severity-CRITICAL { border-left-color: #ef4444; }
    .finding.severity-WARNING { border-left-color: #f59e0b; }
    .finding.severity-INFO { border-left-color: #3b82f6; }
    .finding-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .finding-api { font-weight: 600; font-size: 1.1em; font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    .badge { padding: 4px 8px; border-radius: 999px; font-size: 0.8em; font-weight: bold; color: white; }
    .badge-CRITICAL { background: #ef4444; }
    .badge-WARNING { background: #f59e0b; }
    .badge-INFO { background: #3b82f6; }
    .badge-category-stealth { background: #7c3aed; }
    .badge-category-compatibility { background: #059669; }
    .badge-category-coverage { background: #6b7280; }
    .badge-target { background: #0ea5e9; }
    .finding-message { margin-bottom: 10px; }
    .finding-location { font-family: monospace; font-size: 0.85em; color: #6b7280; background: #f9fafb; padding: 10px; border-radius: 4px; white-space: pre-wrap; border: 1px solid #f3f4f6;}
    .empty-state { text-align: center; padding: 40px; color: #6b7280; font-style: italic; background: #fff; border-radius: 8px; border: 1px dashed #d1d5db; }

    /* Scrollbar for filters */
    .filter-list::-webkit-scrollbar { width: 6px; }
    .filter-list::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
    .filter-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .filter-list::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
  </style>
</head>
<body>
  <h1>${REPORT_HEADING}</h1>

  <div class="header-info">
    <div><strong>Generated:</strong> <span id="timestamp"></span></div>
    <div><strong>Targets:</strong> <span id="targets"></span></div>
    <div><strong>Summary:</strong> <span id="summary"></span></div>
    <details style="margin-top: 15px;">
      <summary style="cursor: pointer; font-weight: bold; color: #4b5563;">View all <span id="scannedCount"></span> Scanned APIs</summary>
      <div id="scannedList" style="margin-top: 10px; font-family: monospace; font-size: 0.85em; color: #6b7280; background: #f9fafb; padding: 15px; border-radius: 6px; max-height: 250px; overflow-y: auto; border: 1px solid #e5e7eb; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px;">
      </div>
    </details>
  </div>

  <div class="dashboard">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Quick search (API or Message)...">
        <div class="severity-filters">
          <label><input type="checkbox" id="filterCritical" checked> <span style="color: #ef4444; font-weight: bold;">CRITICAL</span></label>
          <label><input type="checkbox" id="filterWarning" checked> <span style="color: #f59e0b; font-weight: bold;">WARNING</span></label>
          <label><input type="checkbox" id="filterInfo" checked> <span style="color: #3b82f6; font-weight: bold;">INFO</span></label>
        </div>
      </div>

      <div class="filter-panel" id="targetFilters"></div>
      <div class="filter-panel" id="categoryFilters"></div>
    </div>

    <!-- Main Content -->
    <div id="findingsContainer"></div>
  </div>

  <script>
    // Embedded payload
    const reportData = ${REPORT_PAYLOAD_TOKEN};

    function esc(str) {
      const el = document.createElement('span');
      el.textContent = str;
      return el.innerHTML;
    }

    // Parsed Data
    const uniqueCategories = new Set();
    const uniqueTargets = new Set();

    // Process findings
    reportData.findings.forEach(f => {
      uniqueCategories.add(f.category);

      // Collect affected targets; findings with no specific target get a synthetic key
      const NO_TARGET = '(no specific target)';
      f._targets = (f.affectedTargets && f.affectedTargets.length > 0)
        ? f.affectedTargets
        : [NO_TARGET];
      f._targets.forEach(t => uniqueTargets.add(t));
    });

    // State
    const state = {
      search: '',
      filters: {
        severity: { CRITICAL: true, WARNING: true, INFO: true },
        targets: new Set(uniqueTargets),
        categories: new Set(uniqueCategories),
      }
    };

    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const filterCheckboxes = {
      CRITICAL: document.getElementById('filterCritical'),
      WARNING: document.getElementById('filterWarning'),
      INFO: document.getElementById('filterInfo')
    };
    const container = document.getElementById('findingsContainer');

    // Initialize Header
    document.getElementById('timestamp').textContent = new Date(reportData.timestamp).toLocaleString();
    document.getElementById('targets').textContent = reportData.targets.map(t => t.name + ' ' + t.version).join(', ');
    document.getElementById('scannedCount').textContent = reportData.scannedApis.length;
    document.getElementById('scannedList').innerHTML = reportData.scannedApis.map(api => '<span>' + esc(api) + '</span>').join('');

    const counts = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    reportData.findings.forEach(f => counts[f.severity]++);
    document.getElementById('summary').textContent =
      counts.CRITICAL + " Critical, " + counts.WARNING + " Warning, " + counts.INFO + " Info";

    // Helper to generate checkbox group
    function createFilterGroup(containerId, title, itemsSet, stateKey) {
      const containerDOM = document.getElementById(containerId);
      if (!containerDOM) return;

      const items = Array.from(itemsSet).sort();
      if (items.length === 0) {
        containerDOM.style.display = 'none';
        return;
      }

      let html = '<div class="filter-panel-title"><span>' + title + '</span><span class="filter-count">' + items.length + '</span></div>';
      html += '<div class="filter-all"><label><input type="checkbox" class="toggle-all" data-target="' + stateKey + '" checked> (Select All)</label></div>';
      html += '<div class="filter-list">';
      items.forEach(item => {
        html += '<label title="' + item + '"><input type="checkbox" class="item-checkbox" data-group="' + stateKey + '" value="' + item + '" checked> ' + item + '</label>';
      });
      html += '</div>';
      containerDOM.innerHTML = html;
    }

    // Render filter panels
    createFilterGroup('targetFilters', 'Targets', uniqueTargets, 'targets');
    createFilterGroup('categoryFilters', 'Categories', uniqueCategories, 'categories');

    // Event Listeners for Dynamic Checkboxes
    document.querySelectorAll('.toggle-all').forEach(el => {
      el.addEventListener('change', (e) => {
        const target = e.target.dataset.target;
        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll('.item-checkbox[data-group="' + target + '"]');

        if (isChecked) {
          const allItems = Array.from(checkboxes).map(c => c.value);
          state.filters[target] = new Set(allItems);
        } else {
          state.filters[target] = new Set();
        }

        checkboxes.forEach(c => c.checked = isChecked);
        render();
      });
    });

    document.querySelectorAll('.item-checkbox').forEach(el => {
      el.addEventListener('change', (e) => {
        const group = e.target.dataset.group;
        const val = e.target.value;
        if (e.target.checked) {
          state.filters[group].add(val);
        } else {
          state.filters[group].delete(val);
        }

        const allCb = document.querySelector('.toggle-all[data-target="' + group + '"]');
        const total = document.querySelectorAll('.item-checkbox[data-group="' + group + '"]').length;
        allCb.checked = state.filters[group].size === total;
        allCb.indeterminate = state.filters[group].size > 0 && state.filters[group].size < total;

        render();
      });
    });

    // Event Listeners for Static Controls
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value;
      render();
    });

    Object.keys(filterCheckboxes).forEach(severity => {
      filterCheckboxes[severity].addEventListener('change', (e) => {
        state.filters.severity[severity] = e.target.checked;
        render();
      });
    });

    // Render main list
    function render() {
      const query = state.search.toLowerCase();

      const filtered = reportData.findings.filter(f => {
        if (!state.filters.severity[f.severity]) return false;
        if (!state.filters.categories.has(f.category)) return false;

        // Target filter
        if (f._targets.length > 0) {
          if (!f._targets.some(t => state.filters.targets.has(t))) return false;
        }

        // Text search
        if (query) {
          const searchable = (f.api + ' ' + f.message).toLowerCase();
          if (!searchable.includes(query)) return false;
        }

        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No findings match your current filters.</div>';
        return;
      }

      const weight = { CRITICAL: 3, WARNING: 2, INFO: 1 };
      filtered.sort((a, b) => {
        if (weight[a.severity] !== weight[b.severity]) return weight[b.severity] - weight[a.severity];
        return a.api.localeCompare(b.api);
      });

      container.innerHTML = filtered.map(f => {
        const locationHTML = f.location ? '<div class="finding-location">' + esc(f.location).replace(/\\n/g, '<br/>') + '</div>' : '';
        const targetBadges = f._targets.length > 0
          ? f._targets.map(t => '<span class="badge badge-target">' + esc(t) + '</span>').join('')
          : '';
        return '<div class="finding severity-' + esc(f.severity) + '">' +
          '<div class="finding-header">' +
            '<div class="finding-api">' + esc(f.api) + '</div>' +
            '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">' +
              targetBadges +
              '<span class="badge badge-category-' + esc(f.category) + '">' + esc(f.category) + '</span>' +
              '<span class="badge badge-' + esc(f.severity) + '">' + esc(f.severity) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="finding-message">' + esc(f.message) + '</div>' +
          locationHTML +
        '</div>';
      }).join('');
    }

    // Initial render
    render();
  </script>
</body>
</html>`;

export class HtmlReporter {
  static report(input: ReportInput) {
    const { config, findings, scannedApis, targets } = input;
    const outputFileName = input.outputFileName ?? "api-conformance-report.html";
    const report: ConformanceReport = {
      timestamp: new Date().toISOString(),
      targets,
      scannedApis,
      findings,
    };

    const outDir = resolveRepoPath(config.outputDir);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const payload = JSON.stringify(report);

    // Escape "</script>" sequences in the JSON payload to prevent premature
    // script tag termination (standard XSS-safe embedding pattern).
    const safePayload = payload.replace(/<\//g, "<\\/");

    const htmlTemplate = REPORT_TEMPLATE.replace(REPORT_PAYLOAD_TOKEN, safePayload);

    const outputPath = join(outDir, outputFileName);
    writeFileSync(outputPath, htmlTemplate, "utf-8");
    console.log(`\nHTML report successfully written to ${outputPath}`);
  }
}
