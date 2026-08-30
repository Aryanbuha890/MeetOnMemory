import React, { useState, useRef } from "react";
import { useMindMap } from "../../hooks/useMindMap";
import {
  Plus,
  Trash2,
  GitCommit,
  CheckSquare,
  Sparkles,
  RefreshCw,
  Palette,
  CheckCircle,
} from "lucide-react";
import { toast } from "react-toastify";

const MindMapBoard = ({ meetingId, participants }) => {
  const {
    nodes,
    connections,
    loading,
    addNode,
    updateNodeText,
    updateNodeColor,
    updateNodePosition,
    persistNodePosition,
    connectNodes,
    deleteNode,
    convertNodeToActionItem,
  } = useMindMap(meetingId);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [connectingNodeId, setConnectingNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Convert to Action Item Modal state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  const boardRef = useRef(null);
  const draggingNodeRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Map participants list
  const usersList =
    participants?.map((p) => ({
      _id: p.user?._id || p.user || p._id,
      name: p.name || p.email || "Unknown User",
    })) || [];

  const handleBoardClick = (e) => {
    // Check if clicked directly on board background (not on a node)
    if (e.target === boardRef.current || e.target.tagName === "svg") {
      setSelectedNodeId(null);
      setConnectingNodeId(null);
      setEditingNodeId(null);
      setShowColorPicker(false);
    }
  };

  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setShowColorPicker(false);

    if (connectingNodeId) {
      if (connectingNodeId !== node.id) {
        connectNodes(connectingNodeId, node.id);
        toast.success("Nodes connected successfully!");
      }
      setConnectingNodeId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();

    // Exact offset inside the node
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    draggingNodeRef.current = node.id;
  };

  const handleMouseMove = (e) => {
    if (!draggingNodeRef.current) return;

    const svgRect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left - dragOffsetRef.current.x;
    const y = e.clientY - svgRect.top - dragOffsetRef.current.y;

    // Boundary constraints (0 to board width/height)
    const boundedX = Math.max(10, Math.min(x, svgRect.width - 150));
    const boundedY = Math.max(10, Math.min(y, svgRect.height - 60));

    updateNodePosition(draggingNodeRef.current, boundedX, boundedY);
  };

  const handleMouseUp = () => {
    if (draggingNodeRef.current) {
      const node = nodes.find((n) => n.id === draggingNodeRef.current);
      if (node) {
        persistNodePosition(node.id, node.x, node.y);
      }
      draggingNodeRef.current = null;
    }
  };

  const handleDoubleClickNode = (node) => {
    setEditingNodeId(node.id);
    setEditText(node.text);
  };

  const handleSaveText = () => {
    if (editingNodeId && editText.trim()) {
      updateNodeText(editingNodeId, editText.trim());
    }
    setEditingNodeId(null);
  };

  const triggerConvertToActionItem = () => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node?.isActionItem) {
      toast.info("This node is already an action item");
      return;
    }
    setShowConvertModal(true);
  };

  const handleConvertConfirm = async () => {
    try {
      const options = {
        assignee: assigneeId || undefined,
        dueDate: dueDate || undefined,
        priority,
      };
      await convertNodeToActionItem(selectedNodeId, options);
      toast.success("Converted brain node to action item!");
      setShowConvertModal(false);
      // Reset inputs
      setAssigneeId("");
      setDueDate("");
      setPriority("medium");
    } catch {
      toast.error("Failed to convert node to action item");
    }
  };

  // Find connections coordinates
  const getLineCoords = (conn) => {
    const sourceNode = nodes.find((n) => n.id === conn.source);
    const targetNode = nodes.find((n) => n.id === conn.target);
    if (!sourceNode || !targetNode) return null;

    // Connect from center of nodes (width ~140, height ~50)
    return {
      x1: sourceNode.x + 70,
      y1: sourceNode.y + 25,
      x2: targetNode.x + 70,
      y2: targetNode.y + 25,
    };
  };

  if (loading) {
    return (
      <div className="h-96 w-full bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-slate-400">Loading live mind map...</span>
      </div>
    );
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col h-[650px] relative overflow-hidden backdrop-blur-md">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 z-10">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Live Brainstorming Mind Map
          </h3>
          <p className="text-xs text-slate-400">
            Double click nodes to edit text. Connect nodes to draw relationships
            in real-time.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
          <button
            onClick={() =>
              addNode(
                "New Idea",
                100 + Math.random() * 200,
                100 + Math.random() * 150,
              )
            }
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Idea
          </button>

          {selectedNodeId && (
            <>
              <button
                onClick={() => setConnectingNodeId(selectedNodeId)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  connectingNodeId === selectedNodeId
                    ? "bg-amber-600 text-white animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                }`}
                title="Click this, then click another node to connect them"
              >
                <GitCommit className="w-4 h-4" /> Connect
              </button>

              {!selectedNode?.isActionItem && (
                <button
                  onClick={triggerConvertToActionItem}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4" /> Make Task
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 cursor-pointer"
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && (
                  <div className="absolute right-0 bottom-10 bg-slate-950 border border-slate-800 p-2 rounded-xl flex gap-1.5 z-20 shadow-xl">
                    {[
                      "#4f46e5",
                      "#10b981",
                      "#f59e0b",
                      "#ef4444",
                      "#3b82f6",
                      "#ec4899",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          updateNodeColor(selectedNodeId, color);
                          setShowColorPicker(false);
                        }}
                        className="w-5 h-5 rounded-full border border-slate-700 cursor-pointer"
                        style={{ backgroundColor: color }}
                      ></button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  deleteNode(selectedNodeId);
                  setSelectedNodeId(null);
                }}
                className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* SVG Board Workspace */}
      <div
        ref={boardRef}
        onClick={handleBoardClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 w-full bg-slate-950 border border-slate-850 rounded-2xl relative cursor-crosshair overflow-hidden select-none"
        style={{
          backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Connection lines */}
          {connections.map((conn) => {
            const coords = getLineCoords(conn);
            if (!coords) return null;
            return (
              <line
                key={conn.id}
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke="#475569"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                className="animate-[dash_20s_linear_infinite]"
              />
            );
          })}
        </svg>

        {/* Nodes Canvas layer */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isEditing = editingNodeId === node.id;

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onDoubleClick={() => handleDoubleClickNode(node)}
              className={`absolute px-4 py-2.5 rounded-xl border flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none transition-shadow ${
                isSelected
                  ? "shadow-lg shadow-indigo-500/20 border-white ring-2 ring-indigo-500/30 scale-105"
                  : "border-slate-800 shadow"
              }`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: "140px",
                height: "54px",
                backgroundColor: node.color,
              }}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={handleSaveText}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveText()}
                  autoFocus
                  className="w-full text-center text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs font-black text-white text-center truncate w-full px-1">
                    {node.text}
                  </span>
                  {node.isActionItem && (
                    <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.2 rounded bg-emerald-500/25 border border-emerald-500/40 text-[9px] font-black text-emerald-300 uppercase tracking-wider">
                      <CheckCircle className="w-2.5 h-2.5" /> Action Item
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Convert Node to Action Item Modal */}
      {showConvertModal && (
        <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center z-30 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-400" />
              Convert Idea to Action Item
            </h4>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label
                  htmlFor="assignee-select"
                  className="text-xs text-slate-400 font-semibold"
                >
                  Assignee
                </label>
                <select
                  id="assignee-select"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="">Unassigned</option>
                  {usersList.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="due-date-input"
                  className="text-xs text-slate-400 font-semibold"
                >
                  Due Date
                </label>
                <input
                  id="due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                ></input>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="priority-select"
                  className="text-xs text-slate-400 font-semibold"
                >
                  Priority
                </label>
                <select
                  id="priority-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConvertModal(false)}
                className="flex-1 py-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertConfirm}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold text-white transition shadow cursor-pointer"
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MindMapBoard;
