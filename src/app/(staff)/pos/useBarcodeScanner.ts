import { useEffect, useRef } from "react";

// Keyboard-wedge scanners type a fast burst followed by Enter.
export function isScannerBurst(code: string, gapMs: number) {
  return code.length >= 6 && gapMs <= 50;
}

export function useBarcodeScanner(onScan: (code: string) => void) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let code = "";
    let lastKeyAt = 0;
    let focusedInput: HTMLInputElement | HTMLTextAreaElement | null = null;
    let originalValue = "";

    function reset() {
      code = "";
      focusedInput = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        reset();
        return;
      }

      if (event.key === "Enter") {
        if (isScannerBurst(code, event.timeStamp - lastKeyAt)) {
          event.preventDefault();
          if (focusedInput?.isConnected) {
            const prototype = focusedInput instanceof HTMLInputElement
              ? HTMLInputElement.prototype
              : HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
            setter?.call(focusedInput, originalValue);
            focusedInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
          onScanRef.current(code);
        }
        reset();
        return;
      }

      if (event.key.length !== 1) {
        reset();
        return;
      }

      if (code && event.timeStamp - lastKeyAt > 50) reset();
      if (!code) {
        const target = event.target;
        focusedInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target
          : null;
        originalValue = focusedInput?.value ?? "";
      }
      code += event.key;
      lastKeyAt = event.timeStamp;
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
