import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AlertCircle, Loader2, RefreshCw, Shield } from "lucide-react";
import { sanitizeHtml } from "../utils/sanitizeHtml";

export const SANDBOX_PREVIEW_POLICY = "";
export const SANDBOX_POLICY_DESCRIPTION =
  "Sandboxed preview — scripts, forms, navigation, and popups are blocked.";

const SIZE_STYLES = {
  sm: { minHeight: "240px", height: "320px" },
  md: { minHeight: "400px", height: "480px" },
  lg: { minHeight: "480px", height: "60vh" },
};

const LOAD_TIMEOUT_MS = 10000;

const buildThemedSrcDoc = (html, { theme, printStylesheet }) => {
  const baseStyles = `
    html, body { margin: 0; padding: 16px; box-sizing: border-box; }
    *, *::before, *::after { box-sizing: inherit; }
    img { max-width: 100%; height: auto; }
  `;

  let themeStyles;
  if (theme === "dark") {
    themeStyles = "body { background: #0f172a; color: #e2e8f0; }";
  } else if (theme === "light") {
    themeStyles = "body { background: #ffffff; color: #0f172a; }";
  } else {
    themeStyles = `
      body { background: #ffffff; color: #0f172a; }
      @media (prefers-color-scheme: dark) {
        body { background: #0f172a; color: #e2e8f0; }
      }
    `;
  }

  const printStyles = printStylesheet
    ? `@media print { ${printStylesheet} }`
    : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${baseStyles}${themeStyles}${printStyles}</style></head><body>${html}</body></html>`;
};

/**
 * SandboxedHtmlPreview
 * Securely renders raw HTML (such as email digests or generated previews)
 * by sanitizing first, then isolating the result in an iframe with a
 * restrictive sandbox policy. Scripts, same-origin access, top navigation,
 * and form submissions are all disallowed.
 */
const SandboxedHtmlPreview = ({
  htmlContent,
  className = "",
  title = "Digest Preview",
  theme = "auto",
  size = "md",
  height,
  loading = false,
  error = "",
  onRetry,
  printStylesheet = "",
  showSandboxPolicy = true,
}) => {
  const [iframeLoadError, setIframeLoadError] = useState("");
  const loadTimeoutRef = useRef(null);
  const statusId = useId();

  const sanitizedHtml = useMemo(() => sanitizeHtml(htmlContent), [htmlContent]);
  const srcDoc = useMemo(() => {
    if (!sanitizedHtml) return "";
    return buildThemedSrcDoc(sanitizedHtml, { theme, printStylesheet });
  }, [sanitizedHtml, theme, printStylesheet]);

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    clearLoadTimeout();
    setIframeLoadError("");

    if (!srcDoc || loading || error) {
      return undefined;
    }

    loadTimeoutRef.current = window.setTimeout(() => {
      setIframeLoadError("Preview failed to load.");
    }, LOAD_TIMEOUT_MS);

    return clearLoadTimeout;
  }, [srcDoc, loading, error]);

  const displayError = error || iframeLoadError;
  const sizeStyle = height
    ? { minHeight: height, height }
    : SIZE_STYLES[size] || SIZE_STYLES.md;

  if (!loading && !displayError && !sanitizedHtml) {
    return null;
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${className}`}
      data-testid="sandboxed-html-preview"
    >
      {showSandboxPolicy && (
        <div
          className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          data-testid="sandbox-policy-notice"
        >
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{SANDBOX_POLICY_DESCRIPTION}</span>
        </div>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400"
          style={sizeStyle}
          role="status"
          aria-live="polite"
          aria-labelledby={statusId}
          data-testid="sandboxed-html-preview-loading"
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span id={statusId}>Loading preview...</span>
        </div>
      ) : displayError ? (
        <div
          className="flex flex-col items-center justify-center gap-3 px-4 text-center text-rose-600 dark:text-rose-400"
          style={sizeStyle}
          role="alert"
          data-testid="sandboxed-html-preview-error"
        >
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{displayError}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      ) : (
        <iframe
          title={title}
          srcDoc={srcDoc}
          className="w-full border-none"
          style={sizeStyle}
          sandbox={SANDBOX_PREVIEW_POLICY}
          referrerPolicy="no-referrer"
          onLoad={() => {
            clearLoadTimeout();
            setIframeLoadError("");
          }}
        />
      )}
    </div>
  );
};

SandboxedHtmlPreview.propTypes = {
  htmlContent: PropTypes.string,
  className: PropTypes.string,
  title: PropTypes.string,
  theme: PropTypes.oneOf(["light", "dark", "auto"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  height: PropTypes.string,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
  printStylesheet: PropTypes.string,
  showSandboxPolicy: PropTypes.bool,
};

export default SandboxedHtmlPreview;
