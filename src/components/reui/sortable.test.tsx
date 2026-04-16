// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

type SortableModule = typeof import("./sortable")
type ReactModule = typeof import("react")

function createExampleTree(
  React: ReactModule,
  sortableModule: SortableModule
) {
  const items = [
    { id: "dataset-a", label: "Dataset A" },
    { id: "dataset-b", label: "Dataset B" },
  ]

  const { Sortable, SortableItem, SortableItemHandle } = sortableModule
  const SortableRoot = Sortable as unknown as React.ElementType
  const SortableEntry = SortableItem as unknown as React.ElementType
  const SortableHandle = SortableItemHandle as unknown as React.ElementType

  function Example() {
    return React.createElement(
      SortableRoot,
      {
        value: items,
        onValueChange: () => undefined,
        getItemValue: (item: unknown) => (item as (typeof items)[number]).id,
        className: "divide-y divide-border",
      },
      items.map((item) =>
        React.createElement(
          SortableEntry,
          {
            key: item.id,
            value: item.id,
          },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(
              SortableHandle,
              { className: "text-muted-foreground" },
              "Drag"
            ),
            React.createElement("span", null, item.label)
          )
        )
      )
    )
  }

  return Example
}

describe("Sortable", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("hydrates without aria-describedby mismatches when dnd counters diverge", async () => {
    vi.resetModules()

    const serverReact = await import("react")
    const { renderToString } = await import("react-dom/server")
    const { DndContext } = await import("@dnd-kit/core")
    const serverSortableModule = await import("./sortable")
    const ServerExample = createExampleTree(serverReact, serverSortableModule)

    renderToString(
      serverReact.createElement(
        DndContext,
        null,
        serverReact.createElement("div", null, "counter-primer")
      )
    )

    const serverMarkup = renderToString(serverReact.createElement(ServerExample))

    vi.resetModules()

    const clientReact = await import("react")
    const { act } = clientReact
    const { hydrateRoot } = await import("react-dom/client")
    const clientSortableModule = await import("./sortable")
    const ClientExample = createExampleTree(clientReact, clientSortableModule)

    const container = document.createElement("div")
    container.innerHTML = serverMarkup
    document.body.appendChild(container)

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    let root!: { unmount: () => void }

    await act(async () => {
      root = hydrateRoot(container, clientReact.createElement(ClientExample))
      await Promise.resolve()
    })

    const firstSortableItem = container.querySelector(
      '[data-slot="sortable-item"][data-value="dataset-a"]'
    )

    expect(firstSortableItem?.getAttribute("aria-describedby")).toBeTruthy()

    const loggedErrors = consoleError.mock.calls
      .flatMap((call) => call.map(String))
      .join("\n")

    expect(loggedErrors).not.toContain("A tree hydrated")
    expect(loggedErrors).not.toContain("aria-describedby")

    root.unmount()
  })
})
