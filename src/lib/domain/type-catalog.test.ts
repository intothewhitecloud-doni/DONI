import assert from "node:assert/strict";
import test from "node:test";
import { defaultDomainTypeColor, normalizeDomainTypeCatalog } from "./type-catalog";

test("workflow data-stage type colors use stable semantic defaults", () => {
  assert.equal(defaultDomainTypeColor("workflow", "원천 기록", 0), "slate");
  assert.equal(defaultDomainTypeColor("workflow", "정보 보정", 1), "orange");
  assert.equal(defaultDomainTypeColor("workflow", "현재 기준 반영", 2), "emerald");
});

test("workflow data-stage type colors migrate legacy generated defaults", () => {
  assert.deepEqual(
    normalizeDomainTypeCatalog(
      [
        { id: "workflow-type-source", scope: "workflow", label: "원천 기록", color: "blue" },
        { id: "workflow-type-correction", scope: "workflow", label: "정보 보정", color: "orange" },
        { id: "workflow-type-current", scope: "workflow", label: "현재 기준 반영", color: "pink" }
      ],
      "workflow"
    ).map((type) => ({ label: type.label, color: type.color })),
    [
      { label: "원천 기록", color: "slate" },
      { label: "정보 보정", color: "orange" },
      { label: "현재 기준 반영", color: "emerald" }
    ]
  );
});

test("workflow data-stage type colors preserve explicit custom colors", () => {
  assert.deepEqual(
    normalizeDomainTypeCatalog(
      [
        { id: "workflow-type-source", scope: "workflow", label: "원천 기록", color: "#0f766e" },
        { id: "workflow-type-current", scope: "workflow", label: "현재 기준 반영", color: "violet" }
      ],
      "workflow"
    ).map((type) => ({ label: type.label, color: type.color })),
    [
      { label: "원천 기록", color: "#0f766e" },
      { label: "현재 기준 반영", color: "violet" }
    ]
  );
});
