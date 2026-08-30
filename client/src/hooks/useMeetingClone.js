import { useState } from "react";
import {
  cloneMeetingApi,
  instantiateTemplateApi,
} from "../services/meetingCloneApi";
import { toast } from "react-toastify";

export const useMeetingClone = () => {
  const [isCloning, setIsCloning] = useState(false);
  const [isInstantiating, setIsInstantiating] = useState(false);
  const [error, setError] = useState(null);

  const cloneMeeting = async (meetingId, options) => {
    setIsCloning(true);
    setError(null);
    try {
      const data = await cloneMeetingApi(meetingId, options);
      toast.success("Meeting cloned successfully!");
      return data;
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to clone meeting";
      setError(errMsg);
      toast.error(errMsg);
      throw err;
    } finally {
      setIsCloning(false);
    }
  };

  const instantiateTemplate = async (templateId, options) => {
    setIsInstantiating(true);
    setError(null);
    try {
      const data = await instantiateTemplateApi(templateId, options);
      toast.success("Meeting instantiated successfully!");
      return data;
    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Failed to instantiate template";
      setError(errMsg);
      toast.error(errMsg);
      throw err;
    } finally {
      setIsInstantiating(false);
    }
  };

  return {
    cloneMeeting,
    instantiateTemplate,
    isCloning,
    isInstantiating,
    error,
  };
};
