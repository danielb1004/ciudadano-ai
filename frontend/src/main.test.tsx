import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
function TestLanding() { return <h1>Encuentra el camino para tu trámite</h1>; }
describe("citizen interface", () => { it("communicates scope clearly", () => { render(<MemoryRouter><TestLanding /></MemoryRouter>); expect(screen.getByText(/camino para tu trámite/i)).toBeInTheDocument(); }); });
