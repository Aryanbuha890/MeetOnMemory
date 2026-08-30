import apiClient from "./apiClient";

export const getPolicies = async (organizationId) => {
  const { data } = await apiClient.get(`/api/escalations`, {
    params: { organizationId },
  });
  return data.data;
};

export const createPolicy = async (policyData) => {
  const { data } = await apiClient.post(`/api/escalations`, policyData);
  return data.data;
};

export const updatePolicy = async (policyId, policyData) => {
  const { data } = await apiClient.put(
    `/api/escalations/${policyId}`,
    policyData,
  );
  return data.data;
};

export const deletePolicy = async (policyId) => {
  const { data } = await apiClient.delete(`/api/escalations/${policyId}`);
  return data.data;
};

export const getEscalationDashboardMetrics = async (organizationId) => {
  const { data } = await apiClient.get(`/api/escalations/dashboard`, {
    params: { organizationId },
  });
  return data.dashboard || data.data;
};

export const getEscalationHistory = async (organizationId) => {
  const { data } = await apiClient.get(`/api/escalations/history`, {
    params: { organizationId },
  });
  return data.events || data.data || [];
};

export const triggerManualEscalation = async (payload = {}) => {
  const { data } = await apiClient.post(`/api/escalations/trigger`, payload);
  return data;
};
