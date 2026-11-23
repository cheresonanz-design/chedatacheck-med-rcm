/**
 * Praxis-Abrechnungs- & PKV-Check (B9) — Deterministic Client-Side & Node.js Engine
 * 100 % local in browser / offline CLI, zero network calls.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CheProjectEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const META = {
  "pid": "B9",
  "brand": "CheDataCheck",
  "short_name": "Praxis-Abrechnungs- & PKV-Check",
  "slug": "med_rcm",
  "default_profile": "Praxis für Orthopädie & Schmerzmedizin",
  "kpi_impact_label": "Abgesichertes Honorarvolumen",
  "annual_multiplier": 12
};
  const SAMPLES = {
  "s1": {
    "profile_name": "Praxis für Orthopädie & Schmerzmedizin",
    "mode": "goae",
    "tone": "streng",
    "items": [
      {
        "id": "GOA-01",
        "label": "GOÄ Nr. 305 mit Faktor 3,2x (Begründung leer)",
        "category": "§ 5 Abs. 2 GOÄ",
        "metric": 90,
        "base_eur": 420,
        "impact_eur": 195,
        "status": "FAIL",
        "note": "Individuelle Begründung (überdurchschnittliche Schwierigkeit/Blutungsneigung) ergänzen"
      },
      {
        "id": "GOA-02",
        "label": "Nr. 1 + Nr. 3 neben operativer Leistung",
        "category": "Zielleistung",
        "metric": 75,
        "base_eur": 180,
        "impact_eur": 62,
        "status": "WARN",
        "note": "Ausschlussbestimmung bei Nr. 3 beachten (separater Kontakt)"
      },
      {
        "id": "GOA-03",
        "label": "GOÄ Nr. 250 + 410 korrekt begründet",
        "category": "Standard",
        "metric": 100,
        "base_eur": 160,
        "impact_eur": 0,
        "status": "PASS",
        "note": "Prüfsicher"
      }
    ]
  },
  "s2": {
    "profile_name": "MVZ Nord (Bereinigte Abrechnung)",
    "mode": "goae",
    "tone": "executive",
    "items": [
      {
        "id": "GOA-10",
        "label": "Alle Faktoren >2,3x patientenindividuell textiert",
        "category": "Compliance",
        "metric": 100,
        "base_eur": 980,
        "impact_eur": 0,
        "status": "PASS",
        "note": "Keine PKV-Kürzung erwartet"
      }
    ]
  },
  "s3": {
    "profile_name": "Zahnmedizinische Tagesklinik (GOZ)",
    "mode": "bema_goz",
    "tone": "streng",
    "items": [
      {
        "id": "GOZ-01",
        "label": "Analogberechnung § 6 Abs. 1 GOZ ohne Vergleichsleistung",
        "category": "Analog § 6",
        "metric": 88,
        "base_eur": 640,
        "impact_eur": 310,
        "status": "FAIL",
        "note": "Selbstständige Leistung + 'entsprechend GOZ Nr. ...' zwingend benennen"
      }
    ]
  }
};

  function r2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function evaluateCase(input = {}) {
    const profileName = String(input.profile_name || SAMPLES.s1.profile_name || META.default_profile);
    const mode = String(input.mode || SAMPLES.s1.mode || "standard");
    const tone = String(input.tone || SAMPLES.s1.tone || "executive");
    const rawItems = Array.isArray(input.items) && input.items.length ? input.items : SAMPLES.s1.items;

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;
    let impactTotal = 0;
    let baseTotal = 0;

    const rows = rawItems.map((it, idx) => {
      const id = String(it.id || `${META.pid}-${String(idx + 1).padStart(2, "0")}`);
      const label = String(it.label || "Position");
      const category = String(it.category || "Prüfpunkt");
      const metric = Number(it.metric) || 0;
      const impact = Number(it.impact_eur) || 0;
      const base = Number(it.base_eur) || 0;
      const statusRaw = String(it.status || "").toUpperCase();
      const status = ["PASS", "WARN", "FAIL"].includes(statusRaw)
        ? statusRaw
        : impact > 0 && metric >= 70
          ? "FAIL"
          : impact > 0
            ? "WARN"
            : "PASS";

      if (status === "PASS") passCount += 1;
      else if (status === "WARN") warnCount += 1;
      else failCount += 1;

      impactTotal += impact;
      baseTotal += base;

      return {
        id,
        label,
        category,
        metric: r2(metric),
        base_eur: r2(base),
        impact_eur: r2(impact),
        status,
        note: String(it.note || (status === "PASS" ? "Regelkonform" : "Maßnahme empfohlen")),
      };
    });

    const totalCount = rows.length || 1;
    const score = r2(Math.max(0, Math.min(100, ((passCount + warnCount * 0.5) / totalCount) * 100)));
    const ok = failCount === 0;
    const annualImpact = r2(impactTotal * (Number(META.annual_multiplier) || 12));

    const headerTone = tone === "streng"
      ? `[FRIST / ESKALATION] ${profileName} (${META.pid} · Modus: ${mode})`
      : `[EXECUTIVE SUMMARY] ${profileName} (${META.pid} · Modus: ${mode})`;

    const actionLines = rows
      .filter((r) => r.status !== "PASS")
      .map((r) => `- [${r.status}] ${r.id} ${r.label}: ${r.note} (Potenzial/Risiko: ${r.impact_eur.toFixed(2)} EUR)`);

    const actionText = [
      headerTone,
      `Readiness-Score: ${score} % | Geprüft: ${rows.length} | PASS: ${passCount} | WARN: ${warnCount} | FAIL: ${failCount}`,
      `${META.kpi_impact_label}: ${impactTotal.toFixed(2)} EUR (Hochgerechnet p.a.: ${annualImpact.toFixed(2)} EUR)`,
      "",
      actionLines.length ? "Priorisierte Maßnahmen:" : "Alle geprüften Punkte erfüllen die DACH-Vorgaben ohne Beanstandung.",
      ...actionLines,
      "",
      `Erstellt lokal mit ${META.brand} ${META.short_name} (by VeriTakt Collective) — 0 Cloud-Upload.`
    ].join("\n");

    const csvHeader = "ID;Kategorie;Position;Kennzahl;Basis_EUR;Effekt_EUR;Status;Hinweis";
    const csvRows = rows.map((r) =>
      [r.id, r.category, r.label, r.metric.toFixed(2), r.base_eur.toFixed(2), r.impact_eur.toFixed(2), r.status, r.note]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";")
    );
    const exportCsv = "\uFEFF" + [csvHeader, ...csvRows].join("\n");

    return {
      ok,
      project_id: META.pid,
      brand: META.brand,
      profile_name: profileName,
      mode,
      tone,
      readiness_percent: score,
      summary: {
        total_count: rows.length,
        pass_count: passCount,
        warn_count: warnCount,
        fail_count: failCount,
      },
      base_total_eur: r2(baseTotal),
      impact_eur: r2(impactTotal),
      annual_impact_eur: annualImpact,
      entries: rows,
      action_text: actionText,
      export_csv: exportCsv,
    };
  }

  function formatAuditReportMarkdown(res) {
    return [
      `# ${META.brand} ${META.short_name} — Audit Report (${res.profile_name})`,
      `- **Score:** ${res.readiness_percent} % | **FAIL:** ${res.summary.fail_count} | **WARN:** ${res.summary.warn_count}`,
      `- **${META.kpi_impact_label}:** ${res.impact_eur.toFixed(2)} EUR (Jahr: ${res.annual_impact_eur.toFixed(2)} EUR)`,
      "",
      "## Maßnahmen & Empfehlung",
      res.action_text,
    ].join("\n");
  }

  function formatAuditReportJson(res) {
    return JSON.stringify(res, null, 2);
  }

  return {
    META,
    SAMPLES,
    evaluateCase,
    formatAuditReportMarkdown,
    formatAuditReportJson,
  };
});
