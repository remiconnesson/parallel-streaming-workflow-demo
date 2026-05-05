import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

describe("Card", () => {
  it("renders title and content with slot data attributes", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );

    const title = screen.getByText("Hello");
    expect(title).toBeInTheDocument();
    expect(title).toHaveAttribute("data-slot", "card-title");
    expect(screen.getByText("Body")).toHaveAttribute(
      "data-slot",
      "card-content",
    );
  });

  it("merges custom classNames onto the card root", () => {
    const { container } = render(<Card className="custom-class" />);
    const root = container.querySelector('[data-slot="card"]');
    expect(root).toHaveClass("custom-class");
  });
});
