/** Resolve paths only within a directory explicitly granted by the editor. */
export function projectPath(path, decoded = false) {
  const value = String(path || "").replace(/\\/g, "/");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject NUL in external filenames.
  if (/^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(value) || /[?#\x00]/.test(value)) throw new Error("Use a relative path inside the project folder.");
  const parts = [];
  for (const encoded of value.split("/")) {
    const part = decoded ? encoded : decodeURIComponent(encoded);
    if (!part || part === ".") continue;
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Decoded path segments must reject control characters.
    if (/[\\/\x00-\x1f]/.test(part)) throw new Error("The project path contains an ambiguous separator.");
    if (part === "..") {
      if (!parts.length) throw new Error("The path leaves the granted project folder.");
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length) throw new Error("The project path must identify a file.");
  return parts.join("/");
}

export async function projectFile(root, path, decoded = false) {
  const parts = projectPath(path, decoded).split("/");
  const name = parts.pop();
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part);
  return dir.getFileHandle(name);
}

export async function projectFiles(root) {
  const result = [];
  const visit = async (dir, prefix, depth) => {
    if (depth > 32) throw new Error("This folder exceeds the supported project directory depth.");
    for await (const entry of dir.values()) {
      const name = prefix + entry.name;
      if (entry.kind === "directory") {
        if (![".git", "node_modules"].includes(entry.name)) await visit(entry, name + "/", depth + 1);
      } else if (entry.kind === "file") {
        result.push({ name, handle: entry, directory: dir, prefix });
        if (result.length > 10000) throw new Error("Choose a project folder containing at most 10,000 files.");
      }
    }
  };
  await visit(root, "", 0);
  return result;
}
