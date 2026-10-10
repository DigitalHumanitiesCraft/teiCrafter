/**
 * Registry of project workspaces. The generic editor asks it for detection
 * profiles, default schemas, panels, staged modes, examples and flags instead of naming
 * a project. Installed workspaces register lazily on first use, so the module
 * graph may import this registry from any side without an evaluation-order cycle.
 */
import { registerInstalledWorkspaces } from "../projects/index.js";

const registered = new Map();
let installed = false;

function workspaces() {
  if (!installed) {
    installed = true;
    registerInstalledWorkspaces(registerWorkspace);
  }
  return registered;
}

export function registerWorkspace(workspace) {
  if (!workspace || typeof workspace.id !== "string" || !workspace.id) throw new Error("A workspace needs an id.");
  if (registered.has(workspace.id)) throw new Error(`Workspace "${workspace.id}" is already registered.`);
  registered.set(workspace.id, workspace);
}

export const listWorkspaces = () => [...workspaces().values()];

export const workspaceById = (id) => workspaces().get(id) || null;

/** The workspace a project selects: a manifest by `workspace`, a detected profile by `id`. */
export function workspaceFor(project) {
  if (!project) return null;
  return workspaceById(project.workspace) || workspaceById(project.id);
}

/** Built-in detection profiles of the registered workspaces, in registration order. */
export const workspaceProfiles = () => listWorkspaces().map((workspace) => workspace.profile).filter(Boolean);

export const workspaceStagedModes = () => listWorkspaces().map((workspace) => workspace.stagedMode).filter(Boolean);

export const workspaceForStagedMode = (mode) => listWorkspaces().find((workspace) => workspace.stagedMode === mode) || null;

/** Built-in examples of the registered workspaces, keyed for the Load menu and `#example=KEY`. */
export const workspaceExamples = () => Object.assign({}, ...listWorkspaces().map((workspace) => workspace.examples || {}));

/** Model features stay available unless the selected workspace switches them off. */
export const modelFeaturesAllowed = (project) => workspaceFor(project)?.flags?.modelFeatures !== false;

/** A declared project schema wins; otherwise the workspace's default schema set applies. */
export function withWorkspaceDefaults(project) {
  const workspace = workspaceFor(project);
  if (!workspace?.defaultSchemas || project.schema) return project;
  return { ...project, workspace: workspace.id, localSchemas: null,
    schema: { schemas: workspace.defaultSchemas.map((entry) => ({ ...entry })) } };
}
