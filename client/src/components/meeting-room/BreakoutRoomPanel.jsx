import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { breakoutRoomApi } from "../../services/breakoutRoomApi.js";
import {
  Shuffle,
  Radio,
  PowerOff,
  Plus,
  Users,
  Play,
  Square,
  Volume2,
  Loader2,
  X,
} from "lucide-react";

export const BreakoutRoomPanel = ({
  meetingId,
  isHost,
  currentUserId,
  socket,
  activeRooms = [],
  onRefresh,
}) => {
  const [rooms, setRooms] = useState(activeRooms || []);
  const [newRoomName, setNewRoomName] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [broadcastBanner, setBroadcastBanner] = useState(null);

  const fetchRooms = useCallback(async () => {
    if (!meetingId) return;
    try {
      setLoading(true);
      const response = await breakoutRoomApi.getRooms(meetingId);
      if (response?.success && Array.isArray(response.data)) {
        setRooms(response.data);
      } else if (Array.isArray(response)) {
        setRooms(response);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to fetch breakout rooms", err);
    } finally {
      setLoading(false);
    }
  }, [meetingId, onRefresh]);

  useEffect(() => {
    if (activeRooms && activeRooms.length > 0) {
      setRooms(activeRooms);
    } else {
      fetchRooms();
    }
  }, [activeRooms, fetchRooms]);

  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => {
      fetchRooms();
    };

    const handleBroadcastReceived = (payload) => {
      setBroadcastBanner(payload);
      toast.info(`📢 Host Broadcast: ${payload.message}`, {
        autoClose: 8000,
      });
    };

    const handleCloseAll = () => {
      fetchRooms();
      toast.warn(
        "All breakout rooms have been closed. Returning to main room.",
      );
    };

    socket.on("breakout:created", handleRefresh);
    socket.on("breakout:started", handleRefresh);
    socket.on("breakout:closed", handleRefresh);
    socket.on("breakout:user-joined", handleRefresh);
    socket.on("breakout:user-left", handleRefresh);
    socket.on("breakout:timer-sync", handleRefresh);
    socket.on("breakout:shuffled", handleRefresh);
    socket.on("breakout_shuffled", handleRefresh);
    socket.on("breakout:broadcast", handleBroadcastReceived);
    socket.on("breakout_broadcast_received", handleBroadcastReceived);
    socket.on("breakout:closed-all", handleCloseAll);
    socket.on("breakout_closed_all", handleCloseAll);

    return () => {
      socket.off("breakout:created", handleRefresh);
      socket.off("breakout:started", handleRefresh);
      socket.off("breakout:closed", handleRefresh);
      socket.off("breakout:user-joined", handleRefresh);
      socket.off("breakout:user-left", handleRefresh);
      socket.off("breakout:timer-sync", handleRefresh);
      socket.off("breakout:shuffled", handleRefresh);
      socket.off("breakout_shuffled", handleRefresh);
      socket.off("breakout:broadcast", handleBroadcastReceived);
      socket.off("breakout_broadcast_received", handleBroadcastReceived);
      socket.off("breakout:closed-all", handleCloseAll);
      socket.off("breakout_closed_all", handleCloseAll);
    };
  }, [socket, fetchRooms]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      setProcessing(true);
      await breakoutRoomApi.createRoom(meetingId, newRoomName.trim());
      setNewRoomName("");
      toast.success("Breakout room created");
      if (socket) {
        socket.emit("breakout:created", { roomId: meetingId });
      }
      fetchRooms();
    } catch (err) {
      console.error("Failed to create breakout room", err);
      toast.error("Failed to create breakout room");
    } finally {
      setProcessing(false);
    }
  };

  const handleRandomize = async () => {
    if (rooms.length === 0) {
      toast.error("No breakout rooms provisioned to assign.");
      return;
    }
    try {
      setProcessing(true);
      const roomIds = rooms.map((r) => r._id || r.id);
      await breakoutRoomApi.randomAssign(meetingId, roomIds);
      toast.success("Participants distributed randomly across breakout rooms!");
      if (socket) {
        socket.emit("breakout:shuffled", { roomId: meetingId, roomIds });
      }
      fetchRooms();
    } catch (err) {
      console.error("Failed to randomly distribute participants", err);
      toast.error("Failed to randomize participants");
    } finally {
      setProcessing(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    try {
      setProcessing(true);
      await breakoutRoomApi.broadcastMessage(meetingId, broadcastText.trim());
      if (socket) {
        socket.emit("breakout:broadcast", {
          roomId: meetingId,
          message: broadcastText.trim(),
        });
      }
      setBroadcastText("");
      toast.success("Broadcast dispatched to all active sub-rooms.");
    } catch (err) {
      console.error("Failed to distribute broadcast payload", err);
      toast.error("Failed to send broadcast");
    } finally {
      setProcessing(false);
    }
  };

  const handleReturnAll = async () => {
    if (
      !window.confirm(
        "Close all active breakouts and force recall participants back to main room?",
      )
    ) {
      return;
    }
    try {
      setProcessing(true);
      await breakoutRoomApi.closeAllRooms(meetingId);
      if (socket) {
        socket.emit("breakout:close-all", { roomId: meetingId });
      }
      toast.success("All breakout rooms closed and participants recalled.");
      fetchRooms();
    } catch (err) {
      console.error("Failed to revoke active breakout namespaces", err);
      toast.error("Failed to recall participants");
    } finally {
      setProcessing(false);
    }
  };

  const handleStartRoom = async (roomId) => {
    try {
      await breakoutRoomApi.startRoom(meetingId, roomId);
      if (socket) {
        socket.emit("breakout:started", {
          roomId: meetingId,
          breakoutRoomId: roomId,
        });
      }
      fetchRooms();
    } catch (err) {
      console.error("Failed to start breakout room", err);
    }
  };

  const handleCloseRoom = async (roomId) => {
    try {
      await breakoutRoomApi.closeRoom(meetingId, roomId);
      if (socket) {
        socket.emit("breakout:closed", {
          roomId: meetingId,
          breakoutRoomId: roomId,
        });
      }
      fetchRooms();
    } catch (err) {
      console.error("Failed to close breakout room", err);
    }
  };

  // Participant view if not host
  if (!isHost) {
    const myRoom = rooms.find((r) =>
      r.participants?.some(
        (p) =>
          (p._id || p.id || p.user || p)?.toString() ===
          currentUserId?.toString(),
      ),
    );

    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-4">
        {broadcastBanner && (
          <div
            data-testid="broadcast-banner"
            className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex justify-between items-start gap-2 animate-pulse"
          >
            <div className="flex items-start gap-2">
              <Volume2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{broadcastBanner.sender}: </span>
                <span>{broadcastBanner.message}</span>
              </div>
            </div>
            <button
              onClick={() => setBroadcastBanner(null)}
              className="text-amber-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {myRoom && myRoom.status === "active" ? (
          <div className="p-4 bg-indigo-950/60 border border-indigo-800 rounded-xl text-white">
            <h3 className="text-base font-semibold text-indigo-300">
              Breakout Room: {myRoom.name}
            </h3>
            <p className="text-xs text-indigo-200 mt-1">
              You are currently in an active breakout room. Audio & notes are
              isolated to your room group.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-slate-900/50 text-slate-400 text-xs text-center border border-slate-800 rounded-xl">
            No active breakout room assigned.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="breakout-room-panel"
      className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-6 text-slate-800 dark:text-slate-200"
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Breakout Orchestration
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage sub-namespace allocations, push global notices, or recall
            active tracks.
          </p>
        </div>
        {loading && (
          <span className="text-xs text-indigo-500 flex items-center gap-1 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" /> Syncing...
          </span>
        )}
      </div>

      {/* Broadcast Banner if active */}
      {broadcastBanner && (
        <div
          data-testid="broadcast-banner"
          className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex justify-between items-start gap-2"
        >
          <div className="flex items-start gap-2">
            <Volume2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Broadcast: </span>
              <span>{broadcastBanner.message}</span>
            </div>
          </div>
          <button
            onClick={() => setBroadcastBanner(null)}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Action Facilitation Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleRandomize}
          disabled={processing || rooms.length === 0}
          data-testid="random-assign-btn"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-50 border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs cursor-pointer"
        >
          <Shuffle className="w-3.5 h-3.5" />
          Distribute Randomly
        </button>

        <button
          onClick={handleReturnAll}
          disabled={processing || rooms.length === 0}
          data-testid="close-all-btn"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition disabled:opacity-50 border border-rose-200/60 dark:border-rose-800/60 shadow-xs cursor-pointer"
        >
          <PowerOff className="w-3.5 h-3.5" />
          Close & Recall All
        </button>
      </div>

      {/* Global Message Broadcast Input Form */}
      <form
        onSubmit={handleBroadcast}
        data-testid="broadcast-form"
        className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4"
      >
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-indigo-500" />
          Global Ticker Broadcast
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="broadcast-input"
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="e.g., '2 minutes left before main session returns...'"
            className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={processing || !broadcastText.trim()}
            data-testid="broadcast-submit-btn"
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
          >
            Transmit
          </button>
        </div>
      </form>

      {/* Create Room Form */}
      <form
        onSubmit={handleCreateRoom}
        data-testid="create-room-form"
        className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4"
      >
        <input
          type="text"
          data-testid="create-room-input"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          placeholder="New Room Name (e.g. Brainstorm A)"
          className="flex-1 px-3 py-2 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={processing || !newRoomName.trim()}
          data-testid="create-room-btn"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Create
        </button>
      </form>

      {/* Active Sub-Namespace Status Roster */}
      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Group Matrices ({rooms.length})
          </h4>
        </div>

        <div className="space-y-2.5">
          {rooms.map((room) => (
            <div
              key={room._id || room.id}
              data-testid={`room-card-${room._id || room.id}`}
              className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {room.name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      room.status === "active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : room.status === "closed"
                          ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    }`}
                  >
                    {room.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>👥 {(room.participants || []).length} joined</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {room.status === "pending" && (
                  <button
                    onClick={() => handleStartRoom(room._id || room.id)}
                    data-testid={`start-room-${room._id || room.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    Start
                  </button>
                )}
                {room.status === "active" && (
                  <button
                    onClick={() => handleCloseRoom(room._id || room.id)}
                    data-testid={`close-room-${room._id || room.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <Square className="w-3 h-3" />
                    Close
                  </button>
                )}
              </div>
            </div>
          ))}

          {rooms.length === 0 && !loading && (
            <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No active breakout rooms provisioned. Create a room above to
              begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BreakoutRoomPanel;
