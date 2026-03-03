"use client";

import { useEffect } from "react";

export function ThemeSync() {
  useEffect(() => {
    const saved = window.localStorage.getItem("bug_theme");
    const theme = saved === "gray" || saved === "green" || saved === "orange" ? saved : "orange";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
