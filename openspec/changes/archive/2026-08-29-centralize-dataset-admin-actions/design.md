## Context

The dataset-detail toolbar currently receives an administrator-only Partner exports button from the server page and places it beside the Table/Map switch. The Current filtered table component separately exposes an administrator-only derived-view action using the label Assign to dataset. Dataset editing, replacement, history, visibility, and deletion already live behind the administrator-only edit route.

The change must preserve the server-owned `isDatasetAdmin` boundary, the partner-export component's existing manager/editor sheets, the current filtered-view payload, and the responsive Filters sheet. It affects only React UI composition and UI smoke coverage; it does not require Supabase, RLS, auth metadata, API, migration, or Vercel runtime changes.

## Goals / Non-Goals

**Goals:**

- Present one administrator-only Dataset actions menu for dataset-level administration.
- Include Edit dataset and Partner exports in that menu.
- Rename the filter-dependent action to Create dataset from current view and leave it beside the filter state it consumes.
- Keep Table/Map visually and semantically separate as a view switch.
- Preserve accessible keyboard behavior and smoke-testable menu and sheet surfaces.

**Non-Goals:**

- Duplicating replacement, version history, revert, visibility, tag, field, or deletion controls outside the existing edit page.
- Changing role definitions, server authorization, export APIs, export profile behavior, or derived-view persistence.
- Moving ordinary user actions such as Download or Save to dashboard into the administrator menu.

## Decisions

1. **Use one dedicated Dataset admin actions component.** The server page will render it only when `identity.isDatasetAdmin` is true and will pass the dataset identifier and source-column context already used by Partner exports. This keeps the permission decision server-owned and gives future dataset-level administrator actions one deliberate home. The alternative of leaving independent buttons in the toolbar would preserve the current scope ambiguity.

2. **Centralize Edit dataset and Partner exports only.** Edit dataset is the entry to configuration, replacement, history, visibility, and destructive controls, so those controls remain on that focused page instead of being duplicated in a menu. Assigning the filtered view is excluded because it depends on active filters rather than the dataset as a whole.

3. **Control the Partner exports manager from the new menu.** The existing export component will support a controlled, triggerless manager mode while retaining its default standalone trigger for component compatibility. The Dataset actions component can close the menu and open the manager sheet without nesting a stateful sheet inside transient menu content.

4. **Keep Table/Map as its own grouped control.** The toolbar will contain the Dataset actions menu and a separately bordered Table/Map group. Sharing a row provides compact placement without implying that an administrator workflow changes the current visualization.

5. **Add literal smoke markers to the new menu.** The Dataset actions trigger, menu surface, and ready state will be browser-smoked, while the existing Partner exports sheet markers remain authoritative for the export flow.

## Risks / Trade-offs

- **[Risk] A controlled export-manager state could regress the editor-to-manager return flow.** → Keep the export component's current internal editor state and test opening from the menu, handing off to the editor, and returning to management.
- **[Risk] Moving Edit dataset from the dashboard-only discovery path could create duplicate navigation.** → Retain the dashboard Edit link; the new menu adds contextual access rather than removing existing navigation.
- **[Risk] A generic menu could accumulate unrelated actions.** → Document that only dataset-level administrator actions belong there; filtered-view actions and ordinary user actions stay in their contextual components.
