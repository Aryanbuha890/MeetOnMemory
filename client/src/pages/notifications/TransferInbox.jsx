import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Check, X, ShieldAlert, ArrowRight } from "lucide-react";
import { transferApi } from "../../services";

const TransferInbox = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const { data } = await transferApi.getTransferInbox();
      if (data.success) {
        setTransfers(data.transfers);
      }
    } catch (error) {
      console.error("Error fetching transfer inbox:", error);
      toast.error("Failed to load transfer requests");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (transferId, action) => {
    try {
      let res;
      if (action === "accept") {
        res = await transferApi.acceptTransfer(transferId);
      } else {
        res = await transferApi.rejectTransfer(transferId);
      }

      if (res.data.success) {
        toast.success(`Transfer ${action}ed successfully.`);
        setTransfers((prev) => prev.filter((t) => t._id !== transferId));
      }
    } catch (error) {
      console.error(`Error ${action}ing transfer:`, error);
      toast.error(
        error.response?.data?.message || `Failed to ${action} transfer`,
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No Pending Transfers
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          You don't have any pending meeting ownership transfer requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transfers.map((transfer) => (
        <div
          key={transfer._id}
          className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/50 p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Ownership Transfer Request
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {transfer.fromUser?.name}
                </span>{" "}
                wants to transfer ownership of{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {transfer.meeting?.title}
                </span>{" "}
                to you.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Expires on {new Date(transfer.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleAction(transfer._id, "reject")}
              className="flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" /> Reject
            </button>
            <button
              onClick={() => handleAction(transfer._id, "accept")}
              className="flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Accept
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransferInbox;
