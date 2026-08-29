import React, { useCallback, useEffect, useRef, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { History, X, Globe, Mic, FileText } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import SearchBar from "../components/ai-search/SearchBar.jsx";
import SearchFilters from "../components/ai-search/SearchFilters.jsx";
import SearchResultCard from "../components/ai-search/SearchResultCard.jsx";
import HybridResultCard from "../components/ai-search/HybridResultCard.jsx";
import HybridSearchToggle from "../components/ai-search/HybridSearchToggle.jsx";
import SearchSkeleton from "../components/ai-search/SearchSkeleton.jsx";
import SearchEmptyState from "../components/ai-search/SearchEmptyState.jsx";
import VoiceSearchBar from "../components/VoiceSearchBar.jsx";
import { searchApi } from "../services";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import {
  clearSearchHistory,
  loadSearchHistory,
  paramsToSearchState,
  saveSearchHistoryEntry,
  searchStateToParams,
} from "../utils/searchHistory.js";
import { toast } from "react-toastify";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DEFAULT_FILTERS = {
  resultType: "all",
  dateFrom: "",
  dateTo: "",
  sortBy: "relevance",
  meetingType: "",
  speaker: "",
  tag: "",
  organizer: "",
  department: "",
};

const CitationRenderer = ({ text, onCitationClick }) => {
  if (!text) return null;

  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const label = match[1];
    const url = match[2];

    parts.push(
      <button
        key={matchIndex}
        type="button"
        onClick={() => onCitationClick(url)}
        className="mx-1 px-2.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-450 font-black hover:underline text-xs inline-flex items-center gap-1 cursor-pointer transition border border-indigo-500/10"
      >
        🔗 {label}
      </button>,
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return (
    <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
      {parts}
    </div>
  );
};

const ResultModal = ({ result, onClose }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!result) return;

    previouslyFocusedRef.current = document.activeElement;
    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusables = [
        ...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ];
      if (!focusables.length) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [result, onClose]);

  if (!result) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2
            id={titleId}
            className="text-2xl font-bold text-gray-900 dark:text-gray-100"
          >
            {result.title || t("aiSearch.untitledMeeting")}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          {(result.organizationName || result.workspaceName) && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold">
              <Globe className="w-3.5 h-3.5" />
              Workspace: {result.organizationName || result.workspaceName}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {t("aiSearch.summary")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
              {result.summary || result.transcript || t("aiSearch.noSummary")}
            </p>
          </div>

          {result.transcript && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">
                {t("aiSearch.transcript")}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 leading-relaxed max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                {result.transcript}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t("aiSearch.date")}</span>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {result.createdAt
                  ? new Date(result.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : t("aiSearch.unknown")}
              </p>
            </div>
            <div>
              <span className="text-gray-500">
                {t("aiSearch.similarityScore")}
              </span>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {result.similarityScore || result.score || "N/A"}
              </p>
            </div>
          </div>

          {result.tags && result.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">
                {t("aiSearch.tags")}
              </h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          {t("aiSearch.close")}
        </button>
      </div>
    </div>
  );
};

const AiSearch = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const bootstrapped = useRef(false);

  const initial = paramsToSearchState(searchParams);

  const [query, setQuery] = useState(initial.query);
  const [results, setResults] = useState([]);
  const [aiAnswer, setAiAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showVoiceBar, setShowVoiceBar] = useState(false);
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
    ...initial.filters,
  });
  const [searchMode, setSearchMode] = useState(initial.mode || "standard");
  const [hybridWeights, setHybridWeights] = useState(initial.weights);
  const [history, setHistory] = useState(() => loadSearchHistory());

  const syncUrl = useCallback(
    (next) => {
      const params = searchStateToParams(next);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const runSearch = useCallback(
    async ({
      nextQuery = query,
      nextMode = searchMode,
      nextFilters = filters,
      nextWeights = hybridWeights,
      persistHistory = true,
    } = {}) => {
      if (!nextQuery.trim()) {
        setError(t("aiSearch.enterQuery"));
        return;
      }

      setLoading(true);
      setError("");
      setResults([]);
      setHasSearched(true);
      syncUrl({
        query: nextQuery,
        mode: nextMode,
        filters: nextFilters,
        weights: nextWeights,
      });

      try {
        if (nextMode === "federated") {
          const res = await searchApi.federatedSearch({
            query: nextQuery,
            dateFrom: nextFilters.dateFrom || undefined,
            dateTo: nextFilters.dateTo || undefined,
            meetingType: nextFilters.meetingType || undefined,
            speaker: nextFilters.speaker || undefined,
            tag: nextFilters.tag || undefined,
            organizer: nextFilters.organizer || undefined,
            department: nextFilters.department || undefined,
          });
          const data = res?.data || res || {};
          setResults(data.results || []);
          setAiAnswer(data.aiAnswer || "");
        } else if (nextMode === "hybrid") {
          const res = await searchApi.hybridSearch({
            query: nextQuery,
            ...nextWeights,
            dateFrom: nextFilters.dateFrom || undefined,
            dateTo: nextFilters.dateTo || undefined,
            meetingType: nextFilters.meetingType || undefined,
            speaker: nextFilters.speaker || undefined,
            tag: nextFilters.tag || undefined,
            organizer: nextFilters.organizer || undefined,
            department: nextFilters.department || undefined,
          });
          const data = res?.data || res || {};
          setResults(data.results || []);
          setAiAnswer(data.aiAnswer || "");
        } else {
          const res = await searchApi.semanticSearch({
            query: nextQuery,
            filters: nextFilters,
          });
          let sortedResults = res.results || res.data?.results || [];

          if (nextFilters.sortBy === "date-desc") {
            sortedResults = [...sortedResults].sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            );
          } else if (nextFilters.sortBy === "date-asc") {
            sortedResults = [...sortedResults].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            );
          }

          setResults(sortedResults);
          setAiAnswer("");
        }

        if (persistHistory) {
          setHistory(
            saveSearchHistoryEntry({
              query: nextQuery,
              mode: nextMode,
              filters: nextFilters,
              weights: nextWeights,
            }),
          );
        }
      } catch (err) {
        console.error("❌ Search error:", err);
        const message =
          err?.response?.data?.message ||
          err?.message ||
          t("aiSearch.fetchFailed");

        if (message === "Failed to fetch" || err?.code === "ERR_NETWORK") {
          setError(t("aiSearch.unableToConnect"));
        } else {
          setError(message);
        }
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [query, searchMode, filters, hybridWeights, syncUrl, t],
  );

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (initial.query.trim().length >= 3) {
      runSearch({ persistHistory: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once from URL
  }, []);

  const handleSearch = () => runSearch();

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError("");
    setHasSearched(false);
    setFilters({ ...DEFAULT_FILTERS });
    setSearchParams({}, { replace: true });
  };

  const handleClearFilters = () => {
    const cleared = { ...DEFAULT_FILTERS };
    setFilters(cleared);
    if (query.trim()) {
      runSearch({ nextFilters: cleared });
    }
  };

  const handleRerunHistory = (entry) => {
    setQuery(entry.query);
    setSearchMode(entry.mode);
    setFilters({ ...DEFAULT_FILTERS, ...(entry.filters || {}) });
    if (entry.weights) setHybridWeights(entry.weights);
    runSearch({
      nextQuery: entry.query,
      nextMode: entry.mode,
      nextFilters: { ...DEFAULT_FILTERS, ...(entry.filters || {}) },
      nextWeights: entry.weights || hybridWeights,
    });
  };

  const handleViewDetails = (result) => setSelectedResult(result);
  const handleOpenMeeting = (result) => {
    window.open(`/meeting/${result.meetingId || result._id}`, "_blank");
  };
  const handleCopySummary = async (result) => {
    const textToCopy = result.summary || result.transcript || "";
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        toast.success(t("aiSearch.copiedToClipboard"));
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  const handleOpenMeetingById = (meetingId) => {
    if (meetingId) window.open(`/meeting/${meetingId}`, "_blank");
  };

  const handleCitationClick = (url) => {
    const [meetingId, timeHash] = url.split("#");
    const seconds = timeHash ? timeHash.replace("t=", "") : "0";
    window.open(`/meeting/${meetingId}?t=${seconds}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <Navbar />

      <div className="max-w-4xl mx-auto pt-28 px-6 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
          {t("aiSearch.title")}
        </h1>
        <p
          className="text-gray-600 dark:text-gray-400 mb-6 text-sm md:text-base max-w-2xl"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(t("aiSearch.subtitle")),
          }}
        />

        {/* Voice Search Toggle Header Action */}
        <div className="w-full flex justify-end gap-2 mb-3">
          <a
            href="/transcript-search"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Transcript Exact Match Search
          </a>
          <button
            type="button"
            onClick={() => setShowVoiceBar((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            {showVoiceBar ? "Hide Voice Search" : "🎙️ Use Voice Search Bar"}
          </button>
        </div>

        {/* Voice Search Bar Component Mounting (#2010) */}
        {showVoiceBar ? (
          <div className="w-full mb-4">
            <VoiceSearchBar
              onQueryChange={(q) => setQuery(q)}
              onResults={(voiceResults) => {
                setResults(voiceResults || []);
                setHasSearched(true);
              }}
            />
          </div>
        ) : (
          <SearchBar
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            loading={loading}
            onClear={handleClear}
          />
        )}

        <HybridSearchToggle
          mode={searchMode}
          setMode={setSearchMode}
          weights={hybridWeights}
          setWeights={setHybridWeights}
        />

        <div className="mt-4 w-full">
          <SearchFilters
            filters={filters}
            setFilters={setFilters}
            resultCount={results.length}
            advanced={searchMode === "hybrid" || searchMode === "federated"}
          />
        </div>

        {history.length > 0 && (
          <div className="w-full text-left mb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Recent searches
              </p>
              <button
                type="button"
                onClick={() => setHistory(clearSearchHistory())}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Clear history
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 6).map((entry) => (
                <button
                  key={`${entry.at}-${entry.query}-${entry.mode}`}
                  type="button"
                  onClick={() => handleRerunHistory(entry)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-blue-400 cursor-pointer"
                  title={entry.mode}
                >
                  {entry.query.length > 40
                    ? `${entry.query.slice(0, 37)}…`
                    : entry.query}
                  {entry.mode === "hybrid"
                    ? " · hybrid"
                    : entry.mode === "federated"
                      ? " · federated"
                      : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm text-left w-full">
            <span className="font-semibold">
              ⚠️{" "}
              {error.includes("Unable to connect") ||
              error.includes(t("aiSearch.unableToConnect").substring(0, 10))
                ? t("aiSearch.connectionError")
                : t("aiSearch.error")}
            </span>
            <p className="mt-1">{error}</p>
          </div>
        )}

        <div className="mt-10 w-full text-left">
          {loading && <SearchSkeleton />}

          {!loading && aiAnswer && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-800/40 dark:to-indigo-950/20 border border-blue-100 dark:border-indigo-900/50 rounded-2xl shadow-sm">
              <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-300 mb-3 flex items-center gap-2">
                ✨ AI Assistant Answer
              </h3>
              <CitationRenderer
                text={aiAnswer}
                onCitationClick={handleCitationClick}
              />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-5">
              {searchMode === "hybrid" || searchMode === "federated"
                ? results.map((result, index) => (
                    <div
                      key={result.key || result._id || index}
                      className="relative"
                    >
                      {(result.organizationName || result.workspaceName) && (
                        <div className="mb-1 inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-full">
                          <Globe className="w-3 h-3" />
                          {result.organizationName || result.workspaceName}
                        </div>
                      )}
                      <HybridResultCard
                        result={result}
                        onOpenMeeting={handleOpenMeetingById}
                      />
                    </div>
                  ))
                : results.map((result, index) => (
                    <SearchResultCard
                      key={result.meetingId || result._id || index}
                      result={result}
                      onViewDetails={handleViewDetails}
                      onOpenMeeting={handleOpenMeeting}
                      onCopySummary={handleCopySummary}
                    />
                  ))}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <SearchEmptyState
              hasSearched={hasSearched}
              onClearFilters={handleClearFilters}
            />
          )}
        </div>
      </div>

      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};

export default AiSearch;
