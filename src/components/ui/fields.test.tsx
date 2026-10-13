import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/lib/store/useStore";
import { LengthField } from "./fields";

describe("LengthField", () => {
  beforeEach(() => useStore.setState({ settings: { ...useStore.getState().settings, displayUnit: "in" } }));

  it("shows the stored mm value in the display unit", () => {
    render(<LengthField label="Width" value={914.4} onChange={() => {}} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe('36"');
  });
  it("accepts mixed-unit input and stores millimeters", () => {
    const onChange = vi.fn();
    render(<LengthField label="Width" value={914.4} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1 m" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(1000);
  });
  it("rejects garbage and keeps the old value", () => {
    const onChange = vi.fn();
    render(<LengthField label="Width" value={914.4} onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "wide" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('36"');
  });
  it("re-renders in another unit without changing the stored value", () => {
    render(<LengthField label="Width" value={914.4} onChange={() => {}} />);
    act(() => useStore.setState({ settings: { ...useStore.getState().settings, displayUnit: "mm" } }));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("914.4 mm");
  });
});
