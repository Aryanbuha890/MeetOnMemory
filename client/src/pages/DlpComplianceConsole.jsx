import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  Search,
  Key,
  Mail,
  Phone,
  CreditCard,
  Lock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Loader2,
  Calendar,
  Building2,
  Filter,
} from "lucide-react";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import { complianceApi } from "../services";

const ENTITY_ICONS = {
  API_KEY: Key,
  JWT_TOKEN: Lock,
  CREDIT_CARD: CreditCard,
  SSN: ShieldAlert,
  EMAIL: Mail,
  PHONE: Phone,
  PASSWORD_SECRET: Lock,
};

const ENTITY_SEVERITY = {
  API_KEY: {
    label: "Critical",
    bg: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  JWT_TOKEN: {
    label: "High",
    bg: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  },
  PASSWORD_SECRET: {
    label: "Critical",
    bg: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  CREDIT_CARD: {
    label: "Critical",
    bg: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  SSN: {
    label: "High",
    bg: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  },
  EMAIL: {
    label: "Medium",
    bg: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  PHONE: {
    label: "Medium",
    bg: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
};

const DlpComplianceConsole = () => {
  const [activeTab, setActiveTab] = useState("scan"); // "scan" | "audit"
  const [scanText, setScanText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // Audit Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterType, setFilterType] = useState("ALL");

  // Unmask Request Modal
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [unmaskReason, setUnmaskReason] = useState("");
  const [submittingUnmask, setSubmittingUnmask] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await complianceApi.getAuditLogs();
      setLogs(res.data?.logs || []);
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to fetch compliance audit logs",
      );
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  const handleRunScan = async (e) => {
    e.preventDefault();
    if (!scanText.trim()) {
      toast.warning("Please enter text or transcript content to scan.");
      return;
    }

    try {
      setScanning(true);
      const res = await complianceApi.scanDlp({ text: scanText });
      setScanResult(res.data);
      toast.success(
        res.data.findingsCount > 0
          ? `Scan complete: ${res.data.findingsCount} sensitive entities detected.`
          : "Scan complete: No sensitive PII detected.",
      );
    } catch (err) {
      toast.error(err.response?.data?.error || "DLP scanning failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleOpenUnmask = (audit) => {
    setSelectedAudit(audit);
    setUnmaskReason("");
  };

  const handleCloseUnmask = () => {
    setSelectedAudit(null);
    setUnmaskReason("");
  };

  const handleSubmitUnmask = async (e) => {
    e.preventDefault();
    if (!unmaskReason.trim()) {
      toast.warning("Please provide a business justification reason.");
      return;
    }

    try {
      setSubmittingUnmask(true);
      const res = await complianceApi.requestUnmask(selectedAudit._id, {
        reason: unmaskReason,
      });
      toast.success(
        res.data?.message || "Unmask request submitted successfully",
      );
      handleCloseUnmask();
      fetchAuditLogs();
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to submit unmask request",
      );
    } finally {
      setSubmittingUnmask(false);
    }
  };

  const handleReviewUnmask = async (auditId, requestId, status) => {
    try {
      await complianceApi.reviewUnmask(auditId, requestId, { status });
      toast.success(`Request ${status.toLowerCase()} successfully`);
      fetchAuditLogs();
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to update review status",
      );
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === "ALL") return true;
    return log.entityType === filterType;
  });

  return (
    <div className="min-h-screen bg-slate-50 pt-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Banner */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-indigo-600/10 p-2 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
                <Shield className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                DLP Compliance Console
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Inspect transcripts for sensitive PII/secrets, review redaction
              audits, and manage entity unmasking workflows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("scan")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "scan"
                    ? "bg-white text-indigo-600 shadow dark:bg-slate-900 dark:text-indigo-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Scan & Redact
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "audit"
                    ? "bg-white text-indigo-600 shadow dark:bg-slate-900 dark:text-indigo-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Compliance Audit Logs
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Scan & Redact Console */}
        {activeTab === "scan" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Input Form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                PII & Secret Scanner
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Paste meeting transcript segments or text to run real-time
                pattern detection for API keys, tokens, credentials, and PII.
              </p>

              <form onSubmit={handleRunScan} className="mt-4 space-y-4">
                <div>
                  <textarea
                    rows={8}
                    value={scanText}
                    onChange={(e) => setScanText(e.target.value)}
                    placeholder="Enter transcript snippet... (e.g. Contact me at john.doe@company.com or token = 'sample_secret_token_placeholder')"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {scanText.length} characters
                  </span>
                  <button
                    type="submit"
                    disabled={scanning || !scanText.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        Run DLP Scan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Scan Results */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Scan Findings & Output
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Tokenized masked text and detected sensitive entities.
              </p>

              {scanResult ? (
                <div className="mt-4 space-y-5">
                  {/* Summary badges */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      <span>Total Findings: {scanResult.findingsCount}</span>
                    </div>
                  </div>

                  {/* Findings list */}
                  {scanResult.findings?.length > 0 ? (
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Detected Entities
                      </h3>
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {scanResult.findings.map((f, i) => {
                          const Icon =
                            ENTITY_ICONS[f.entityType] || ShieldAlert;
                          const sev = ENTITY_SEVERITY[f.entityType] || {
                            label: "Medium",
                            bg: "bg-slate-100 text-slate-700",
                          };
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-850"
                            >
                              <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-white p-2 text-slate-700 shadow-xs dark:bg-slate-900 dark:text-slate-200">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                      {f.entityType}
                                    </span>
                                    <span
                                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${sev.bg}`}
                                    >
                                      {sev.label}
                                    </span>
                                  </div>
                                  <code className="text-[11px] text-slate-500 font-mono">
                                    {f.maskedToken}
                                  </code>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                Char {f.charIndexStart}-{f.charIndexEnd}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        No PII or sensitive secrets detected in this text.
                      </span>
                    </div>
                  )}

                  {/* Redacted text preview */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Masked Redacted Text Preview
                    </h3>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {scanResult.redactedText}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8 flex flex-col items-center justify-center py-12 text-center text-slate-400">
                  <Search className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs">
                    Run a scan on the left to view DLP findings and masked text
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Compliance Audit Logs */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter by entity:</span>
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="ALL">All Entity Types</option>
                  <option value="API_KEY">API Key</option>
                  <option value="JWT_TOKEN">JWT Token</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="SSN">SSN</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                  <option value="PASSWORD_SECRET">Password / Secret</option>
                </select>
              </div>

              <button
                type="button"
                onClick={fetchAuditLogs}
                disabled={loadingLogs}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingLogs ? "animate-spin" : ""}`}
                />
                Refresh Logs
              </button>
            </div>

            {loadingLogs ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
                <Shield className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  No Compliance Audit Logs Found
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Redacted entities from meeting scans will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950/50">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500">
                        Entity & Severity
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500">
                        Masked Token
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500">
                        Context Snippet
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500">
                        Date & Time
                      </th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500">
                        Unmask Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredLogs.map((log) => {
                      const Icon = ENTITY_ICONS[log.entityType] || ShieldAlert;
                      const sev = ENTITY_SEVERITY[log.entityType] || {
                        label: "Medium",
                        bg: "bg-slate-100 text-slate-700",
                      };
                      const unmaskCount = log.unmaskRequests?.length || 0;

                      return (
                        <tr
                          key={log._id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="rounded-lg bg-slate-100 p-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                  {log.entityType}
                                </div>
                                <span
                                  className={`rounded-md px-1.5 py-0.2 text-[10px] font-bold ${sev.bg}`}
                                >
                                  {sev.label}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                            {log.maskedToken}
                          </td>
                          <td
                            className="px-6 py-4 max-w-xs text-xs text-slate-500 truncate"
                            title={log.contextSnippet}
                          >
                            {log.contextSnippet || "—"}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {unmaskCount > 0 ? (
                                <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                  {unmaskCount} Request(s)
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleOpenUnmask(log)}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Request Unmask
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Request Unmask */}
        {selectedAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Request Entity Unmask
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseUnmask}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitUnmask} className="mt-4 space-y-4">
                <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                  <div className="text-slate-500">Target Token:</div>
                  <code className="font-mono text-indigo-600 dark:text-indigo-400">
                    {selectedAudit.maskedToken}
                  </code>
                  <div className="mt-1 text-slate-500">Entity Type:</div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedAudit.entityType}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Business Justification / Reason{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={unmaskReason}
                    onChange={(e) => setUnmaskReason(e.target.value)}
                    placeholder="Provide detailed compliance/legal justification for unmasking this sensitive entity..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                {/* Existing requests on this audit item */}
                {selectedAudit.unmaskRequests?.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500">
                      Previous Unmask Requests:
                    </span>
                    <div className="max-h-28 space-y-1.5 overflow-y-auto">
                      {selectedAudit.unmaskRequests.map((req, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/40"
                        >
                          <div>
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                              "{req.reason}"
                            </p>
                            <span className="text-[10px] text-slate-400">
                              Status: {req.status}
                            </span>
                          </div>
                          {req.status === "PENDING" && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleReviewUnmask(
                                    selectedAudit._id,
                                    req._id,
                                    "APPROVED",
                                  )
                                }
                                className="rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleReviewUnmask(
                                    selectedAudit._id,
                                    req._id,
                                    "REJECTED",
                                  )
                                }
                                className="rounded px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-300 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseUnmask}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUnmask || !unmaskReason.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingUnmask ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DlpComplianceConsole;
