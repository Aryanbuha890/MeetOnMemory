import apiClient from "../services/apiClient.js";

const GRAPH_BASE_PATH = "/api/action-item-graph";

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

/**
 * Load the dependency topology exposed by the action-item graph backend.
 *
 * The server returns `{ graph: { nodes, edges } }`. Keeping the response
 * normalization here makes the UI independent of axios response objects and
 * gives callers a stable empty graph when the server has no dependencies yet.
 */
export const getActionItemGraph = async (params = {}) => {
  const response = await apiClient.get(`${GRAPH_BASE_PATH}/topology`, {
    params: cleanParams(params),
  });

  return response.data?.graph || { nodes: [], edges: [] };
};

/**
 * Fetch one dependency neighborhood around an action item.
 *
 * The backend currently exposes topology filtering rather than a dedicated
 * neighborhood endpoint. We therefore request the full graph and perform the
 * neighborhood projection in the client. This keeps the UI compatible with
 * the current API while allowing a future server endpoint to be added without
 * changing the graph component contract.
 */
export const getActionItemNeighborhood = async (actionItemId, params = {}) => {
  if (!actionItemId) {
    return { nodes: [], edges: [] };
  }

  const graph = await getActionItemGraph(params);
  const connected = new Set([String(actionItemId)]);
  const edges = graph.edges || [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      const source = String(edge.source);
      const target = String(edge.target);
      if (connected.has(source) || connected.has(target)) {
        if (!connected.has(source) || !connected.has(target)) changed = true;
        connected.add(source);
        connected.add(target);
      }
    }
  }

  return {
    nodes: (graph.nodes || []).filter((node) => connected.has(String(node.id))),
    edges: edges.filter(
      (edge) =>
        connected.has(String(edge.source)) &&
        connected.has(String(edge.target)),
    ),
  };
};

/**
 * Create a dependency through the existing protected graph API.
 * Exported for future graph editing and for API-level tests.
 */
export const createActionItemDependency = async (payload) => {
  const response = await apiClient.post(
    `${GRAPH_BASE_PATH}/dependencies`,
    payload,
  );
  return response.data?.dependency || response.data;
};

/** Remove an existing dependency edge. */
export const deleteActionItemDependency = async (dependencyId) => {
  const response = await apiClient.delete(
    `${GRAPH_BASE_PATH}/dependencies/${dependencyId}`,
  );
  return response.data;
};

/** Resolve blockers for an action item through the backend topology service. */
export const resolveActionItemBlockers = async (actionItemId) => {
  const response = await apiClient.patch(
    `${GRAPH_BASE_PATH}/resolve/${actionItemId}`,
  );
  return response.data;
};

export default {
  getActionItemGraph,
  getActionItemNeighborhood,
  createActionItemDependency,
  deleteActionItemDependency,
  resolveActionItemBlockers,
};
