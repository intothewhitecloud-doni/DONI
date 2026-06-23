import assert from "node:assert/strict";
import test from "node:test";
import { defaultStructureMapEdgeTypes, defaultStructureMapNodeTypes } from "../../domain/types";
import {
  structureMapEdgeMeta as flowEdgeMeta,
  structureMapNodeMeta as flowNodeMeta
} from "./structureMapFlowAdapter";
import {
  structureMapEdgeMeta,
  structureMapNodeMeta
} from "./structureMapLayerMeta";
import {
  structureMapEdgeMeta as reagraphEdgeMeta,
  structureMapNodeMeta as reagraphNodeMeta
} from "./structureMapReagraphAdapter";

test("structure map layers have fixed colors and symbols for every default layer", () => {
  for (const type of defaultStructureMapNodeTypes) {
    const meta = structureMapNodeMeta[type];
    assert.match(meta.accent, /^#[0-9a-f]{6}$/i);
    assert.match(meta.fill, /^#[0-9a-f]{6}$/i);
    assert.ok(meta.icon.length > 0);
    assert.ok(meta.label.length > 0);
  }

  for (const type of defaultStructureMapEdgeTypes) {
    const meta = structureMapEdgeMeta[type];
    assert.match(meta.color, /^#[0-9a-f]{6}$/i);
    assert.ok(meta.label.length > 0);
  }
});

test("structure map renderers share the same layer legend metadata", () => {
  assert.equal(flowNodeMeta, structureMapNodeMeta);
  assert.equal(flowEdgeMeta, structureMapEdgeMeta);
  assert.equal(reagraphNodeMeta, structureMapNodeMeta);
  assert.equal(reagraphEdgeMeta, structureMapEdgeMeta);
});
