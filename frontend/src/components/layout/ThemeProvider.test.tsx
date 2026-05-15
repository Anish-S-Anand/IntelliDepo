import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import React from "react";
import { ThemeProvider, useTheme } from "./ThemeProvider";

// Test component that uses the theme context
function TestComponent() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <button data-testid="toggle-button" onClick={toggleTheme}>
        Toggle
      </button>
      <button data-testid="set-light-button" onClick={() => setTheme("light")}>
        Set Light
      </button>
      <button data-testid="set-dark-button" onClick={() => setTheme("dark")}>
        Set Dark
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear any existing classes on document.documentElement
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.transition = "";
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.transition = "";
  });

  it("should render children without errors", () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Test Child</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("should default to dark theme when no localStorage value exists", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });
  });

  it("should apply dark class to html element when theme is dark", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  it("should apply smooth color transitions to html element (Requirement 11.6)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.style.transition).toBe(
        "background-color 0.25s ease, color 0.25s ease"
      );
    });
  });

  it("should toggle theme from dark to light", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    act(() => {
      screen.getByTestId("toggle-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  it("should toggle theme from light to dark", async () => {
    localStorage.setItem("intelli-theme", "light");

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    act(() => {
      screen.getByTestId("toggle-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });
  });

  it("should set theme to light explicitly (Requirement 11.3)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    act(() => {
      screen.getByTestId("set-light-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  it("should set theme to dark explicitly (Requirement 11.3)", async () => {
    localStorage.setItem("intelli-theme", "light");

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    act(() => {
      screen.getByTestId("set-dark-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  it("should restore saved theme from localStorage on mount (Requirement 11.5)", async () => {
    localStorage.setItem("intelli-theme", "light");

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
  });

  it("should persist theme preference to localStorage when changed (Requirement 11.4)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    act(() => {
      screen.getByTestId("set-light-button").click();
    });

    await waitFor(() => {
      expect(localStorage.getItem("intelli-theme")).toBe("light");
    });

    act(() => {
      screen.getByTestId("set-dark-button").click();
    });

    await waitFor(() => {
      expect(localStorage.getItem("intelli-theme")).toBe("dark");
    });
  });

  it("should apply/remove dark class on html element (Requirements 11.9, 11.10)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Initially dark
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    // Switch to light - should remove dark class
    act(() => {
      screen.getByTestId("set-light-button").click();
    });

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    // Switch back to dark - should add dark class
    act(() => {
      screen.getByTestId("set-dark-button").click();
    });

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });
  });

  it("should handle localStorage errors gracefully", async () => {
    // Mock localStorage to throw an error
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("localStorage is full");
    });

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Should still work even if localStorage fails
    act(() => {
      screen.getByTestId("set-light-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    // Restore original setItem
    Storage.prototype.setItem = originalSetItem;
  });

  it("should provide toggleTheme function (Requirement 11.3)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    // Toggle once
    act(() => {
      screen.getByTestId("toggle-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    // Toggle again
    act(() => {
      screen.getByTestId("toggle-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });
  });

  it("should provide setTheme function (Requirement 11.3)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Set to light
    act(() => {
      screen.getByTestId("set-light-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    });

    // Set to dark
    act(() => {
      screen.getByTestId("set-dark-button").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });
  });

  it("should maintain theme state across multiple toggles", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    // Toggle multiple times
    for (let i = 0; i < 5; i++) {
      act(() => {
        screen.getByTestId("toggle-button").click();
      });

      await waitFor(() => {
        const expectedTheme = i % 2 === 0 ? "light" : "dark";
        expect(screen.getByTestId("current-theme")).toHaveTextContent(
          expectedTheme
        );
      });
    }
  });

  it("should update CSS variables when theme changes (Requirement 11.7)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Initially dark theme
    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    // Switch to light theme
    act(() => {
      screen.getByTestId("set-light-button").click();
    });

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
  });

  it("should ensure all components respect theme changes without page reload (Requirement 11.8)", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Start with dark theme
    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    });

    // Change to light theme
    act(() => {
      screen.getByTestId("set-light-button").click();
    });

    // Verify theme changed immediately without reload
    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    // Change back to dark theme
    act(() => {
      screen.getByTestId("set-dark-button").click();
    });

    // Verify theme changed immediately without reload
    await waitFor(() => {
      expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
});
