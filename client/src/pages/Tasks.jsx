import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar.jsx";
import RoleGate from "../components/RoleGate.jsx";
import { useRBAC } from "../hooks/useRBAC.js";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  GitMerge,
} from "lucide-react";
import useTasks from "../hooks/useTasks";
import TaskFilterPanel from "../components/tasks/TaskFilterPanel";
import TaskSortBar from "../components/tasks/TaskSortBar";
import TaskCard from "../components/tasks/TaskCard";
import TaskDetailsModal from "../components/tasks/TaskDetailsModal";
import ActionItemDependencyGraph from "../components/tasks/ActionItemDependencyGraph.jsx";
import Pagination from "../components/meetings/Pagination";

const Tasks = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const taskState = useTasks();
  const { hasPermission } = useRBAC();
  const canCreateMeeting = hasPermission("meetings", "create");

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8 fade-in-up flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {t("tasks.actionItemsTitle")}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t("tasks.description")}
            </p>
          </div>
          <button
            onClick={() => navigate("/knowledge/consolidate")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <GitMerge className="w-4 h-4" />
            {t("tasks.consolidateMemories")}
          </button>
        </div>

        <ActionItemDependencyGraph
          taskItems={taskState.sortedTasks}
          onSelectTask={taskState.setSelectedTask}
          className="mb-8"
        />

        <TaskFilterPanel {...taskState} />
        <TaskSortBar
          sortBy={taskState.sortBy}
          sortOrder={taskState.sortOrder}
          handleSort={taskState.handleSort}
        />

        {/* Tasks List */}
        {taskState.loading ? (
          <div className="flex flex-col items-center justify-center py-20 fade-in-up">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              {t("tasks.loading")}
            </p>
          </div>
        ) : taskState.error ? (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl p-8 text-center fade-in-up">
            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
              {t("tasks.errorLoading")}
            </h3>
            <p className="text-red-700 dark:text-red-300">{taskState.error}</p>
            <button
              onClick={() => taskState.refetch()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {t("tasks.retry")}
            </button>
          </div>
        ) : taskState.sortedTasks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center fade-in-up">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {taskState.hasActiveFilters
                ? t("tasks.noTasksMatchFilters")
                : t("tasks.noActionItems")}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {taskState.hasActiveFilters
                ? t("tasks.adjustFilters")
                : canCreateMeeting
                  ? t("tasks.uploadGenerate")
                  : t("tasks.actionItemsAppear")}
            </p>
            {!taskState.hasActiveFilters && (
              <RoleGate resource="meetings" action="create">
                <button
                  onClick={() => navigate("/upload-meeting")}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  {t("tasks.uploadMeeting")}
                </button>
              </RoleGate>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 fade-in-up stagger-3">
              {taskState.sortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  setSelectedTask={taskState.setSelectedTask}
                  navigate={navigate}
                  updateTaskStatus={taskState.updateTaskStatus}
                  toggleTaskReminder={taskState.toggleTaskReminder}
                />
              ))}
            </div>

            <Pagination
              currentPage={taskState.page}
              totalPages={taskState.totalPages}
              onPageChange={taskState.setPage}
            />
          </>
        )}

        <TaskDetailsModal
          selectedTask={taskState.selectedTask}
          setSelectedTask={taskState.setSelectedTask}
          navigate={navigate}
        />
      </div>
    </div>
  );
};

export default Tasks;
