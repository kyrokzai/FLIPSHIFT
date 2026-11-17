"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Поле ввода растёт вместе с текстом — длинный запрос виден целиком.
 * Высота пересчитывается и при изменении ширины (поворот телефона),
 * и после загрузки шрифта: в обоих случаях текст переносится иначе.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const fit = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight + 2}px`;
    };
    fit();

    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fit();
    });
    observer.observe(element);

    let active = true;
    void document.fonts?.ready.then(() => {
      if (active) fit();
    });

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [ref, value]);
}
