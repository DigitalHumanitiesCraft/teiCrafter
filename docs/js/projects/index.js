/** Installed project workspaces. A derived tool adds its project entry files here. */
import { wenzelsbibel } from "./wenzelsbibel/index.js";

export function registerInstalledWorkspaces(register) {
  register(wenzelsbibel);
}
