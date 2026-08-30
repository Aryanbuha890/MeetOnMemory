import { useState, useEffect, useCallback } from "react";
import { keyMomentApi } from "../services/keyMomentApi";
import { io } from "socket.io-client";
import { createClerkSocketOptions } from "../services/apiClient";

export const useKeyMoments = (meetingId) => {
  const [moments, setMoments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const fetchMoments = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await keyMomentApi.fetchMoments(meetingId);
      setMoments(data.keyMoments || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      fetchMoments();
    }
  }, [meetingId, fetchMoments]);

  useEffect(() => {
    if (!meetingId) return;

    let socket;
    let cancelled = false;

    const joinRoom = () => {
      if (socket?.connected) {
        socket.emit("join-key-moments-room", { meetingId });
      }
    };

    const initSocket = async () => {
      const opts = await createClerkSocketOptions();
      if (cancelled) return;

      socket = io(backendUrl, opts);

      const handleCreated = (newMoment) => {
        setMoments((prev) => {
          if (prev.some((m) => m._id === newMoment._id)) return prev;
          return [...prev, newMoment].sort((a, b) => a.startTime - b.startTime);
        });
      };

      const handleUpdated = (updatedMoment) => {
        setMoments((prev) =>
          prev
            .map((m) => (m._id === updatedMoment._id ? updatedMoment : m))
            .sort((a, b) => a.startTime - b.startTime),
        );
      };

      const handleDeleted = (deletedId) => {
        const id =
          typeof deletedId === "object" && deletedId !== null
            ? deletedId.id
            : deletedId;
        setMoments((prev) => prev.filter((m) => m._id !== id));
      };

      const handleSocketError = (socketError) => {
        console.warn("Key moments socket error:", socketError?.message);
      };

      socket.on("connect", joinRoom);
      socket.on("keyMoment:created", handleCreated);
      socket.on("keyMoment:updated", handleUpdated);
      socket.on("keyMoment:deleted", handleDeleted);
      socket.on("keyMoment:error", handleSocketError);

      joinRoom();
    };

    initSocket();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit("leave-key-moments-room", { meetingId });
        socket.off("connect", joinRoom);
        socket.disconnect();
      }
    };
  }, [meetingId, backendUrl]);

  const addMoment = async (data) => {
    const response = await keyMomentApi.createMoment({ ...data, meetingId });
    return response.keyMoment;
  };

  const updateMoment = async (id, data) => {
    const response = await keyMomentApi.updateMoment(id, data);
    return response.keyMoment;
  };

  const removeMoment = async (id) => {
    await keyMomentApi.deleteMoment(id);
  };

  const exportMoments = async () => {
    if (!meetingId) return;
    try {
      setIsExporting(true);
      const blobData = await keyMomentApi.exportMoments(meetingId);
      const url = window.URL.createObjectURL(
        new Blob([blobData], { type: "text/csv" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `session-${meetingId}-moments.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    moments,
    isLoading,
    error,
    isExporting,
    addMoment,
    updateMoment,
    removeMoment,
    exportMoments,
    refresh: fetchMoments,
  };
};
