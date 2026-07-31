import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders the status text so meaning never rests on color alone", () => {
    render(<StatusPill status="MATCHED" />);
    expect(screen.getByText("MATCHED")).toBeInTheDocument();
  });

  it("falls back gracefully for an unrecognized status", () => {
    render(<StatusPill status="SOMETHING_NEW" />);
    expect(screen.getByText("SOMETHING_NEW")).toBeInTheDocument();
  });
});
