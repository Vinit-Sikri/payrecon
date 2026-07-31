import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTile } from "./StatTile";

describe("StatTile", () => {
  it("renders the value and label", () => {
    render(<StatTile label="MATCHED" value={12} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("MATCHED")).toBeInTheDocument();
  });
});
