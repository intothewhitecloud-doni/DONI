# Design QA: 구조맵 그래프 중심 레이아웃

final result: passed

## Source

- Reference image: `/tmp/codex-remote-attachments/019ee827-06f8-7e10-8b64-0c825205497b/92919638-D5FE-433F-A398-FC4B048F56BE/1-사진-1.jpg`
- Prototype capture: `.omx/qa/org-structure-map/screenshots/structure-map-1280.png`
- Compared viewport: 1280px desktop

## Checks

- Passed: graph is the primary work surface, with search, filters, node filters, legend, minimap, and right inspector reading as graph controls.
- Passed: bottom KPI area is reduced to a single summary strip instead of competing with the graph.
- Passed: right inspector is hidden by default, appears only after graph node selection, and closes through both the `x` and bottom close control.
- Passed: AI proposal toggle and unexplained DB/API/AI floating controls are removed.
- Passed: top duplicate company information block is removed from the structure map surface.
- Passed: duplicate global navigation / help / sync row is removed from the structure map surface.
- Passed: search keeps the whole graph visible while highlighting matched nodes and nearby relationships.
- Passed: relationship depth changes the search focus range and selected-node relationship highlight range.
- Passed: relationship depth also changes the default visible graph when there is no search or selected node, using the core relation as the directional root.
- Passed: bottom-right minimap navigation has a stronger border, shadow, and label so it reads as a navigational control.
- Passed: minimap navigation is moved to the bottom-right, with zoom/fit controls placed above it and outside the legend hit area.
- Passed: node/edge filters and the legend are layout rows rather than graph overlays, so fit view is not hidden under those controls.
- Passed: page overflow is zero horizontally and vertically at 1024x820, 1280x900, and 1440x900 captures.
- Passed: horizontal overflow is zero at 1024, 1280, and 1440 captures.
- Passed: graph and right inspector do not overlap in automated capture QA.

## Remaining Visual Difference

- The reference contains a denser sample graph than the current prototype data set. The current implementation preserves the existing 20-node / 39-edge prototype data and behavior.
