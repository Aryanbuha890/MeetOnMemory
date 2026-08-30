import React, { useState } from "react";
import { X } from "lucide-react";
import { useMeetingClone } from "../hooks/useMeetingClone";
import { useNavigate } from "react-router-dom";

const CloneMeetingModal = ({
  isOpen,
  onClose,
  meetingId,
  templateId = null,
}) => {
  const [includeAgenda, setIncludeAgenda] = useState(true);
  const [includeParticipants, setIncludeParticipants] = useState(true);
  const [includeCustomFields, setIncludeCustomFields] = useState(true);
  const { cloneMeeting, instantiateTemplate, isCloning, isInstantiating } =
    useMeetingClone();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let newMeeting;
      if (templateId) {
        // If instantiated from template, we just call the API
        const data = await instantiateTemplate(templateId, {
          newDate: new Date(),
        });
        newMeeting = data.meeting || data.data;
      } else {
        const options = {
          includeAgenda,
          includeParticipants,
          includeCustomFields,
          newDate: new Date(),
        };
        const data = await cloneMeeting(meetingId, options);
        newMeeting = data.meeting || data.data;
      }

      onClose();
      if (newMeeting && newMeeting._id) {
        navigate(`/meetings/${newMeeting._id}`);
      }
    } catch (e) {
      console.error(e);
      // Error is handled by the hook
    }
  };

  const isWorking = isCloning || isInstantiating;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    {templateId ? "Use Template" : "Clone Meeting"}
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  {!templateId && (
                    <div className="mt-4 space-y-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Select which details you'd like to copy to the new
                        meeting draft. Transcripts, summaries, and analytics are
                        never copied.
                      </p>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="includeAgenda"
                            name="includeAgenda"
                            type="checkbox"
                            checked={includeAgenda}
                            onChange={(e) => setIncludeAgenda(e.target.checked)}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label
                            htmlFor="includeAgenda"
                            className="font-medium text-gray-700 dark:text-gray-300"
                          >
                            Agenda Items
                          </label>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="includeParticipants"
                            name="includeParticipants"
                            type="checkbox"
                            checked={includeParticipants}
                            onChange={(e) =>
                              setIncludeParticipants(e.target.checked)
                            }
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label
                            htmlFor="includeParticipants"
                            className="font-medium text-gray-700 dark:text-gray-300"
                          >
                            Participants
                          </label>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="includeCustomFields"
                            name="includeCustomFields"
                            type="checkbox"
                            checked={includeCustomFields}
                            onChange={(e) =>
                              setIncludeCustomFields(e.target.checked)
                            }
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label
                            htmlFor="includeCustomFields"
                            className="font-medium text-gray-700 dark:text-gray-300"
                          >
                            Custom Fields
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {templateId && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      This will create a new meeting draft based on this
                      template.
                    </p>
                  )}

                  <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={isWorking}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {isWorking
                        ? "Processing..."
                        : templateId
                          ? "Create Draft"
                          : "Clone"}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloneMeetingModal;
