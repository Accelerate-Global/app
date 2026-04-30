// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionsClient } from "@/components/dashboard/api-connections-client";
import type { ApiConnection, ApiConnectionRun } from "@/lib/api-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const SelectContext = React.createContext<{
    value: string;
    onValueChange?: (value: string) => void;
  }>({ value: "" });

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange?: (value: string) => void;
      children?: ReactNode;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectContent: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children?: ReactNode;
    }) => {
      const context = React.useContext(SelectContext);

      return (
        <button type="button" onClick={() => context.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
    SelectTrigger: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectValue: ({
      children,
    }: {
      children?: ReactNode | ((value: string) => ReactNode);
    }) => {
      const context = React.useContext(SelectContext);

      return (
        <span>
          {typeof children === "function" ? children(context.value) : children}
        </span>
      );
    },
  };
});

const pgacConnection: ApiConnection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "People API",
  description: "Imports people data.",
  method: "GET",
  url: "https://api.example.com/people",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json",
  responseDataPath: "data",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "people.csv",
  datasetClassification: "PGAC",
  createdAt: "2026-04-24T12:00:00.000Z",
  updatedAt: "2026-04-24T12:00:00.000Z",
};

const pgicConnection: ApiConnection = {
  ...pgacConnection,
  id: "33333333-3333-4333-8333-333333333333",
  name: "IMB (People Groups)",
  description: "IMB public ArcGIS people groups layer.",
  datasetName: "imb-people-groups.csv",
  datasetClassification: "PGIC",
};

const successfulRun: ApiConnectionRun = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: pgacConnection.id,
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "test",
  status: "success",
  httpStatus: 200,
  durationMs: 33,
  rowCount: 2,
  datasetId: null,
  errorMessage: null,
  responsePreview: "[{\"name\":\"Alpha\"}]",
  startedAt: "2026-04-24T12:00:01.000Z",
  completedAt: "2026-04-24T12:00:02.000Z",
  createdAt: "2026-04-24T12:00:00.000Z",
  logs: [],
  output: null,
};

const queuedRun: ApiConnectionRun = {
  ...successfulRun,
  id: "44444444-4444-4444-8444-444444444444",
  connectionId: pgicConnection.id,
  mode: "import",
  status: "queued",
  httpStatus: null,
  durationMs: 0,
  rowCount: null,
  responsePreview: "",
  startedAt: null,
  completedAt: null,
};

describe("ApiConnectionsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
  });

  it("renders connections in the Users-style table without web profile controls", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[pgacConnection, pgicConnection]}
        initialRuns={[successfulRun, queuedRun]}
      />,
    );

    expect(screen.getByText("Available API Connections")).toBeTruthy();
    expect(screen.getByText("Connection")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Last ingestion")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("People API")).toBeTruthy();
    expect(screen.getByText("IMB (People Groups)")).toBeTruthy();
    expect(screen.getAllByText("Success").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Queued").length).toBeGreaterThan(0);

    expect(screen.queryByRole("button", { name: "New API connection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Test" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
    expect(screen.queryByLabelText("URL")).toBeNull();
    expect(screen.queryByLabelText("Response format")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("supports search and select filters", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[pgacConnection, pgicConnection]}
        initialRuns={[successfulRun, queuedRun]}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search connection, dataset, or classification"),
      { target: { value: "imb" } },
    );

    expect(screen.getByText("IMB (People Groups)")).toBeTruthy();
    expect(screen.queryByText("People API")).toBeNull();

    fireEvent.change(
      screen.getByPlaceholderText("Search connection, dataset, or classification"),
      { target: { value: "" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "PGAC" }));

    expect(screen.getByText("People API")).toBeTruthy();
    expect(screen.queryByText("IMB (People Groups)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All classifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Queued" }));

    expect(screen.queryByText("People API")).toBeNull();
    expect(screen.getByText("IMB (People Groups)")).toBeTruthy();
  });

  it("routes to the detail page when a row is clicked or keyboard-selected", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[pgacConnection]}
        initialRuns={[successfulRun]}
      />,
    );

    fireEvent.click(screen.getByText("People API").closest("tr")!);
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/api-connections/11111111-1111-4111-8111-111111111111",
    );

    pushMock.mockClear();
    fireEvent.keyDown(screen.getByText("People API").closest("tr")!, {
      key: "Enter",
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/api-connections/11111111-1111-4111-8111-111111111111",
    );

    pushMock.mockClear();
    fireEvent.keyDown(screen.getByText("People API").closest("tr")!, {
      key: " ",
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/api-connections/11111111-1111-4111-8111-111111111111",
    );
  });

  it("does not offer web creation when no saved connections exist", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
      />,
    );

    expect(screen.getByText("No API connections are available.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New API connection" })).toBeNull();
  });
});
