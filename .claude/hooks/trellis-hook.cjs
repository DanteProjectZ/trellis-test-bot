#!/usr/bin/env node
"use strict";

// src/hook/bin.ts
var import_node_fs12 = require("node:fs");

// src/hook/main.ts
var import_node_os3 = require("node:os");
var import_node_path11 = require("node:path");

// src/hook/anchor.ts
var import_node_crypto = require("node:crypto");
var import_node_fs3 = require("node:fs");
var import_node_path4 = require("node:path");

// src/hook/gitlite.ts
var import_node_child_process = require("node:child_process");
var import_node_path = require("node:path");

// src/hook/types.ts
var HookFault = class extends Error {
  name = "HookFault";
};

// src/hook/gitlite.ts
var SAFE = [
  "--no-replace-objects",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.pager=cat",
  "-c",
  "core.attributesFile=/dev/null",
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "gpg.program="
];
var TIMEOUT_MS = 3e3;
var MAX_BUFFER = 64 * 1024 * 1024;
var INHERITED = /* @__PURE__ */ new Set(["HOME", "USER", "LOGNAME", "LANG", "TMPDIR", "TERM", "XDG_CONFIG_HOME", "GH_CONFIG_DIR"]);
function absolutePath() {
  return (process.env.PATH ?? "").split(":").filter((d) => (0, import_node_path.isAbsolute)(d));
}
function env() {
  const kept = Object.entries(process.env).filter(([k]) => INHERITED.has(k) || k.startsWith("LC_"));
  return { ...Object.fromEntries(kept), PATH: absolutePath().join(":"), GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1", LC_ALL: "C" };
}
function git(cwd, args, input) {
  const r = (0, import_node_child_process.spawnSync)("git", [...SAFE, ...args], { cwd, env: env(), timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, input, stdio: [input === void 0 ? "ignore" : "pipe", "pipe", "ignore"] });
  if (r.error !== void 0) throw new HookFault(r.error.code === "ENOENT" ? "git_unavailable" : "git_failed");
  if (r.status === null) throw new Error(`git ${args[0] ?? ""} did not finish`);
  return { status: r.status, stdout: r.stdout };
}
function gitText(cwd, args) {
  const r = git(cwd, args);
  return r.status === 0 ? r.stdout.toString("utf8").trim() : null;
}

// src/core/fold.ts
var IGNORABLE = new RegExp("\\p{Default_Ignorable_Code_Point}", "gu");
var strip = (s) => s.replace(IGNORABLE, "");
var foldPath = (path) => strip(strip(path).normalize("NFKC")).toUpperCase().toLowerCase().replaceAll("ß", "ss");
var FoldedRegExp = class extends RegExp {
  test(path) {
    return super.test(foldPath(path));
  }
};

// src/hook/localproj.ts
var isSettingsLocal = (rel) => /(^|\/)\.claude\/settings\.local\.json$/.test(foldPath(rel));
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var NO_CONTEXT = { sandboxedBash: false, excluded: [], servers: /* @__PURE__ */ new Set(), skills: /* @__PURE__ */ new Set() };
var strings = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
var firstWord = (c) => c.trim().split(/\s+/)[0] ?? "";
var baseName = (p) => p.slice(p.lastIndexOf("/") + 1);
function bashReachesOutside(inner, excluded) {
  const t = inner.replace(/(:\*|\*)$/, "").trim();
  if (t === "" || t === "*") return true;
  if (/\.trellis-flow|tr-push|tr-pr/.test(t)) return true;
  return excluded.some((e) => e.includes(t) || t.includes(baseName(firstWord(e))) || t.includes(firstWord(e)));
}
function isNarrowAllow(entry, ctx) {
  if (typeof entry !== "string") return false;
  const mcp = /^mcp__([A-Za-z0-9-]+(?:_[A-Za-z0-9-]+)*)__([\w-]+)$/.exec(entry);
  if (mcp !== null) return ctx.servers.has(mcp[1]);
  const m = /^(Skill|Bash)\(([^)]*)\)$/.exec(entry);
  if (m === null) return false;
  const arg = m[2];
  switch (m[1]) {
    case "Bash":
      return ctx.sandboxedBash && !bashReachesOutside(arg, ctx.excluded);
    default:
      return ctx.skills.has(arg);
  }
}
function projectSettings(text, base = NO_CONTEXT) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(doc)) return null;
  const { enabledMcpjsonServers: enabled, disabledMcpjsonServers: _d, permissions, ...rest } = doc;
  const own = isRecord(doc.sandbox) ? doc.sandbox : {};
  const ctx = { ...base, sandboxedBash: base.sandboxedBash && own.allowUnsandboxedCommands !== true && own.enabled !== false, excluded: [...base.excluded, ...strings(own.excludedCommands)] };
  const out = { ...rest };
  if (enabled !== void 0) {
    const unknown = Array.isArray(enabled) ? enabled.filter((n) => typeof n !== "string" || !ctx.servers.has(n)) : enabled;
    if (!Array.isArray(unknown) || unknown.length > 0) out.enabledMcpjsonServers = unknown;
  }
  if (permissions !== void 0) {
    if (!isRecord(permissions)) out.permissions = permissions;
    else {
      const { allow, ...others } = permissions;
      const kept = Array.isArray(allow) ? allow.filter((a) => !isNarrowAllow(a, ctx)) : allow;
      const perms = { ...others, ...kept === void 0 || Array.isArray(kept) && kept.length === 0 ? {} : { allow: Array.isArray(kept) ? [...kept].sort() : kept } };
      if (Object.keys(perms).length > 0) out.permissions = perms;
    }
  }
  return canonical(out);
}
function settingsContext(project, mcpJson, skills) {
  const sandbox = isRecord(project) && isRecord(project.sandbox) ? project.sandbox : {};
  const servers = isRecord(mcpJson) && isRecord(mcpJson.mcpServers) ? Object.keys(mcpJson.mcpServers) : [];
  return { sandboxedBash: sandbox.enabled === true && sandbox.allowUnsandboxedCommands === false, excluded: strings(sandbox.excludedCommands), servers: new Set(servers), skills: new Set(skills) };
}
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isRecord(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

// src/hook/rules.ts
var import_node_fs = require("node:fs");
var import_node_path2 = require("node:path");
var PROTECTED = new FoldedRegExp(
  "^(([^]*/)?\\.claude(/|$)|([^]*/)?\\.mcp\\.json$|([^]*/)?claude\\.md$|([^]*/)?agents\\.md$|([^]*/)?\\.agents/skills(/|$)|\\.spectex/(config[^/]*\\.json$|memory\\.db|work_log\\.db|vectors/(memories|failures)\\.lance(/|$)|skills(/|$))|skills-lock\\.json$|\\.trellis(/|$)|workflow/(trellis\\.yaml|install-manifest\\.json)$|workflow/bin(/|$))",
  "s"
);
var CLAUDE_RULES = /* @__PURE__ */ new Set(["settings.json", "claude.md", "commands", "agents", "skills", "hooks", "rules", "output-styles", "workflows"]);
var EDITOR_JUNK = /^(\.DS_Store|.*\.sw[po]|.*~)$/;
var RULE_NAMES = /* @__PURE__ */ new Set(["claude.md", "agents.md", ".claude", ".mcp.json", ".agents", ".trellis", "skills-lock.json"]);
var EXACT_RULE_NAMES = /* @__PURE__ */ new Set(["CLAUDE.md", "AGENTS.md", ".claude", ".mcp.json", ".agents", ".trellis", "skills-lock.json"]);
var NAMES_ONLY_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "out", "target", ".next", ".nuxt", ".turbo", ".cache", ".gradle", ".venv", "venv", "__pycache__", "Pods", "coverage"]);
var NAMES_ENTRIES = 2e6;
var WALK_ENTRIES = 2e5;
var SAFE_LINK = /^[A-Za-z0-9._/@+-]{1,120}$/;
var isLocalJson = (rel) => {
  const parts = foldPath(rel).split("/");
  if (parts.length === 2 && parts[0] === ".spectex") return /^config[^/]*\.json$/.test(parts[1]);
  const at = parts.lastIndexOf(".claude");
  return at >= 0 && parts.length === at + 2 && parts[at + 1].endsWith(".local.json");
};
function isMachineOwn(rel, st) {
  if (isLocalJson(rel)) return false;
  if (/^\.spectex\/(memory|work_log|vectors|skills)/.test(foldPath(rel))) return true;
  if (st.isFile() && EDITOR_JUNK.test(rel.slice(rel.lastIndexOf("/") + 1))) return true;
  const parts = foldPath(rel).split("/");
  const at = parts.indexOf(".claude");
  const next = at >= 0 ? parts[at + 1] : void 0;
  return next !== void 0 && !CLAUDE_RULES.has(next);
}
var lstatOrNull = (path) => {
  try {
    return (0, import_node_fs.lstatSync)(path);
  } catch {
    return null;
  }
};
function protectedOnDisk(top, onGitEntry) {
  const topReal = (0, import_node_fs.realpathSync)(top);
  const found = /* @__PURE__ */ new Map();
  let budget = WALK_ENTRIES;
  let nameBudget = NAMES_ENTRIES;
  const followLink = (path, chain) => {
    let target;
    try {
      target = (0, import_node_fs.realpathSync)((0, import_node_path2.join)(top, path));
      if (!(0, import_node_fs.statSync)(target).isDirectory()) return;
    } catch {
      return;
    }
    if (target !== topReal && !target.startsWith(`${topReal}/`)) {
      throw new HookFault(`outside_dir_link ${SAFE_LINK.test(path) ? path : "<unprintable name>"}`);
    }
    if (chain.has(target)) return;
    walk(path, (0, import_node_path2.relative)(topReal, target), /* @__PURE__ */ new Set([...chain, target]));
  };
  const namesOnly = (start) => {
    const stack = [start];
    for (let dir = stack.pop(); dir !== void 0; dir = stack.pop()) {
      for (const e of (0, import_node_fs.readdirSync)((0, import_node_path2.join)(top, dir), { withFileTypes: true })) {
        if (--nameBudget < 0) throw new HookFault("names_walk_too_big");
        const path = `${dir}/${e.name}`;
        const name = foldPath(e.name);
        if (name === ".git") onGitEntry?.(path);
        else if (RULE_NAMES.has(name) && !EXACT_RULE_NAMES.has(e.name)) throw new HookFault(`rule_in_skipped_tree ${SAFE_LINK.test(path) ? path : "<unprintable name>"}`);
        else if (e.isDirectory()) stack.push(path);
      }
    }
  };
  const walk = (rel, realRel, chain) => {
    for (const d of (0, import_node_fs.readdirSync)((0, import_node_path2.join)(top, rel), { withFileTypes: true })) {
      if (--budget < 0) throw new HookFault("link_walk_too_big");
      const path = rel === "" ? d.name : `${rel}/${d.name}`;
      const real = realRel === "" ? d.name : `${realRel}/${d.name}`;
      if (rel !== "" && foldPath(d.name) === ".git") onGitEntry?.(path);
      if (d.isDirectory()) {
        if (d.name === ".git" || foldPath(d.name) === ".git") continue;
        if (NAMES_ONLY_DIRS.has(d.name)) namesOnly(path);
        else walk(path, real, chain);
        continue;
      }
      if (d.isSymbolicLink()) followLink(path, chain);
      if (!PROTECTED.test(path)) continue;
      const st = lstatOrNull((0, import_node_path2.join)(top, path));
      if (st !== null && !st.isDirectory()) found.set(path, { st, real });
    }
  };
  walk("", "", /* @__PURE__ */ new Set([topReal]));
  return found;
}

// src/hook/repo.ts
var import_node_fs2 = require("node:fs");
var import_node_path3 = require("node:path");
function enclosingTrees(start) {
  const trees = [];
  for (let d = (0, import_node_path3.resolve)(start); ; d = (0, import_node_path3.dirname)(d)) {
    if ((0, import_node_fs2.existsSync)((0, import_node_path3.join)(d, ".git"))) trees.push(d);
    if ((0, import_node_path3.dirname)(d) === d) return trees;
  }
}
function workDirs(payload) {
  const given = typeof payload === "object" && payload !== null ? payload.cwd : void 0;
  const dirs = [process.cwd()];
  const project = process.env.CLAUDE_PROJECT_DIR;
  if (typeof project === "string" && (0, import_node_path3.isAbsolute)(project)) dirs.push(project);
  if (typeof given === "string" && (0, import_node_path3.isAbsolute)(given)) dirs.unshift(given);
  return [...new Set(dirs)];
}
var AGENTS_MARKER = "trellis:begin trellis-agents";
var lstatOrNull2 = (path) => {
  try {
    return (0, import_node_fs2.lstatSync)(path);
  } catch {
    return null;
  }
};
function hasTrellisFiles(top) {
  if (lstatOrNull2((0, import_node_path3.join)(top, ".claude", "hooks", "trellis-hook.cjs")) !== null || lstatOrNull2((0, import_node_path3.join)(top, "workflow", "trellis.yaml")) !== null) return true;
  try {
    return (0, import_node_fs2.readFileSync)((0, import_node_path3.join)(top, "AGENTS.md"), "utf8").includes(AGENTS_MARKER);
  } catch {
    return false;
  }
}
function headHasTrellisFiles(top) {
  const names = ["workflow/trellis.yaml", "workflow/install-manifest.json", ".claude/hooks/trellis-hook.cjs", "AGENTS.md"].map((p) => `HEAD:${p}`);
  const r = git(top, ["cat-file", "--batch-check"], Buffer.from(`${names.join("\n")}
`));
  if (r.status !== 0) throw new HookFault("git_cat_file_failed");
  const answers = r.stdout.toString("utf8").split("\n");
  if (answers.slice(0, 3).some((l) => l !== "" && !l.endsWith(" missing"))) return true;
  if ((answers[3] ?? "").endsWith(" missing") || answers[3] === "") return false;
  const agents = git(top, ["cat-file", "blob", "HEAD:AGENTS.md"]);
  return agents.status === 0 && agents.stdout.toString("utf8").includes(AGENTS_MARKER);
}
var hasMarkers = (top) => hasTrellisFiles(top) || headHasTrellisFiles(top);
function installKind(top) {
  let text;
  try {
    text = (0, import_node_fs2.readFileSync)((0, import_node_path3.join)(top, "workflow", "install-manifest.json"), "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return hasMarkers(top) ? "broken" : "none";
    return "broken";
  }
  return versionKind(text);
}
function versionKind(text) {
  try {
    const v = JSON.parse(text)?.schemaVersion;
    return v === 2 ? "v3" : v === 1 ? "v1" : "broken";
  } catch {
    return "broken";
  }
}
function targetBranch(top) {
  let text;
  try {
    text = (0, import_node_fs2.readFileSync)((0, import_node_path3.join)(top, "workflow", "trellis.yaml"), "utf8");
  } catch {
    return null;
  }
  const found = [...text.matchAll(/^target_branch:[ \t]*["']?([^\s"'#]*)["']?[ \t]*(#.*)?\r?$/gm)].map((m) => m[1]);
  if (found.length !== 1) return null;
  const name = found[0];
  return /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,199}$/.test(name) && !name.includes("..") && !name.endsWith("/") ? name : null;
}

// src/hook/anchor.ts
var REPO_DIR = /^(?!\/)(?!.*(^|\/)\.\.?(\/|$))[^\0\\]{1,200}$/;
var SHA = /^[0-9a-f]{64}$/;
var MODES = /* @__PURE__ */ new Set(["100644", "100755", "120000"]);
var sha256 = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var anchorPath = (home, repoId) => (0, import_node_path4.join)(home, ".trellis-flow", repoId, "anchor.json");
function repoIdOf(top) {
  const dotGit = (0, import_node_path4.join)(top, ".git");
  if (lstatOrNull3(dotGit)?.isDirectory() === true && lstatOrNull3((0, import_node_path4.join)(dotGit, "commondir")) === null) return sha256((0, import_node_fs3.realpathSync)(dotGit)).slice(0, 12);
  const common = gitText(top, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (common === null || common === "") throw new HookFault("git_common_dir_failed");
  return sha256((0, import_node_fs3.realpathSync)(common)).slice(0, 12);
}
var kindOf = (st) => st === null ? null : st.isDirectory() ? "directory" : st.isFile() ? "file" : null;
function checkoutOf(top) {
  const own = kindOf(lstatOrNull3((0, import_node_path4.join)(top, ".git")));
  if (own === null) throw new HookFault("no_dot_git");
  let checkout = (0, import_node_fs3.realpathSync)(top);
  if (!(own === "directory" && lstatOrNull3((0, import_node_path4.join)(top, ".git", "commondir")) === null)) {
    const common = gitText(top, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    if (common === null || common === "") throw new HookFault("git_common_dir_failed");
    const real = (0, import_node_fs3.realpathSync)(common);
    if ((0, import_node_path4.basename)(real) === ".git") checkout = (0, import_node_path4.dirname)(real);
  }
  const dotGit = kindOf(lstatOrNull3((0, import_node_path4.join)(checkout, ".git")));
  if (dotGit === null) throw new HookFault("no_dot_git");
  return { checkout, dotGit };
}
function verifyBinding(top, anchor) {
  try {
    const topReal = (0, import_node_fs3.realpathSync)(top);
    const own = kindOf(lstatOrNull3((0, import_node_path4.join)(top, ".git")));
    if (own === null) return "this folder has no usable .git";
    if (topReal === anchor.checkout) {
      if (own !== anchor.dotGit) return "the .git of this checkout is not what it was when anchored";
      if (own === "directory" && lstatOrNull3((0, import_node_path4.join)(top, ".git", "commondir")) !== null) return "the .git folder of this checkout redirects to another repository";
      return null;
    }
    if (own !== "file") return "this folder is not the anchored checkout and has no linked-worktree .git file";
    const gitDir = (0, import_node_fs3.realpathSync)(gitText(top, ["rev-parse", "--path-format=absolute", "--git-dir"]) ?? "");
    const common = (0, import_node_fs3.realpathSync)(gitText(top, ["rev-parse", "--path-format=absolute", "--git-common-dir"]) ?? "");
    if (!gitDir.startsWith(`${common}/worktrees/`)) return "this folder is not a linked worktree of the anchored repository";
    if ((0, import_node_path4.basename)(common) === ".git" && (0, import_node_path4.dirname)(common) !== anchor.checkout) return "this folder belongs to a repository other than the anchored checkout";
    const back = (0, import_node_fs3.readFileSync)((0, import_node_path4.join)(gitDir, "gitdir"), "utf8").trim();
    if ((0, import_node_path4.basename)(back) !== ".git" || (0, import_node_fs3.realpathSync)((0, import_node_path4.dirname)(back)) !== topReal) return "the linked worktree record does not name this folder";
    return null;
  } catch {
    return "the git layout of this folder cannot be verified";
  }
}
function diskDigest(full, st = lstatOrNull3(full)) {
  if (st === null) return null;
  if (st.isSymbolicLink()) return { mode: "120000", sha: sha256((0, import_node_fs3.readlinkSync)(full, "buffer")) };
  if (st.isFile()) return { mode: (st.mode & 73) !== 0 ? "100755" : "100644", sha: sha256((0, import_node_fs3.readFileSync)(full)) };
  return null;
}
function anchorDigest(top, rel, hashes) {
  const full = (0, import_node_path4.join)(top, rel);
  const d = diskDigest(full);
  if (d === null || d.mode === "120000" || !isSettingsLocal(rel)) return d;
  const p = projectSettings((0, import_node_fs3.readFileSync)(full, "utf8"), contextOf(top, rel, hashes));
  return p === null ? d : { mode: d.mode, sha: sha256(p) };
}
var jsonOrNull = (file) => {
  try {
    return JSON.parse((0, import_node_fs3.readFileSync)(file, "utf8"));
  } catch {
    return null;
  }
};
function contextOf(top, rel, hashes) {
  const prefix = rel.slice(0, rel.length - ".claude/settings.local.json".length);
  const skillRoot = `${prefix}.agents/skills/`;
  const skills = new Set(Object.keys(hashes).filter((p) => p.startsWith(skillRoot)).map((p) => p.slice(skillRoot.length).split("/")[0]));
  return settingsContext(jsonOrNull((0, import_node_path4.join)(top, prefix, ".claude/settings.json")), jsonOrNull((0, import_node_path4.join)(top, prefix, ".mcp.json")), skills);
}
function matchesAnchor(top, rel, anchor) {
  try {
    const raw = diskDigest((0, import_node_path4.join)(top, rel));
    const proj = anchorDigest(top, rel, anchor.ruleHashes);
    return raw !== null && proj !== null && raw.mode === anchor.ruleModes[rel] && (proj.sha === anchor.ruleHashes[rel] || raw.sha === anchor.ruleHashes[rel]);
  } catch {
    return false;
  }
}
function lstatOrNull3(path) {
  try {
    return (0, import_node_fs3.lstatSync)(path);
  } catch {
    return null;
  }
}
var isRecord2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function parseAnchor(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new HookFault("anchor_invalid");
  }
  if (!isRecord2(j) || j.schemaVersion !== 1) throw new HookFault("anchor_invalid");
  const { repoId, checkout, dotGit, targetBranch: target, installKind: installKind2, installSchema, targetCommit, ruleHashes, ruleModes } = j;
  if (typeof repoId !== "string" || !/^[0-9a-f]{12}$/.test(repoId)) throw new HookFault("anchor_invalid");
  if (typeof checkout !== "string" || !checkout.startsWith("/") || dotGit !== "directory" && dotGit !== "file") throw new HookFault("anchor_invalid");
  if (typeof target !== "string" || typeof targetCommit !== "string") throw new HookFault("anchor_invalid");
  if (installKind2 !== "v1" && installKind2 !== "v3" || typeof installSchema !== "number") throw new HookFault("anchor_invalid");
  if (!isRecord2(ruleHashes) || !isRecord2(ruleModes)) throw new HookFault("anchor_invalid");
  for (const [p, h] of Object.entries(ruleHashes)) {
    if (typeof h !== "string" || !SHA.test(h) || typeof ruleModes[p] !== "string" || !MODES.has(ruleModes[p])) throw new HookFault("anchor_invalid");
  }
  const repos = j.nestedRepos;
  if (repos !== void 0 && (!Array.isArray(repos) || repos.some((d) => typeof d !== "string" || !REPO_DIR.test(d) || d.endsWith("/")))) throw new HookFault("anchor_invalid");
  return { schemaVersion: 1, repoId, checkout, dotGit, targetBranch: target, installKind: installKind2, installSchema, targetCommit, ruleHashes, ruleModes, ...repos === void 0 ? {} : { nestedRepos: repos } };
}
function readAnchor(home, repoId) {
  const file = anchorPath(home, repoId);
  const st = lstatOrNull3(file);
  if (st === null) return null;
  if (!st.isFile()) throw new HookFault("anchor_not_a_file");
  let text;
  try {
    text = (0, import_node_fs3.readFileSync)(file, "utf8");
  } catch {
    throw new HookFault("anchor_unreadable");
  }
  const anchor = parseAnchor(text);
  if (anchor.repoId !== repoId) throw new HookFault("anchor_repo_mismatch");
  return anchor;
}
function verifyAnchor(anchor, yamlTarget) {
  if (anchor.installKind !== "v3") return null;
  if (yamlTarget === null) return "workflow/trellis.yaml is missing, unreadable, or has no single plain target_branch";
  if (yamlTarget !== anchor.targetBranch) return "workflow/trellis.yaml names a target branch other than the anchored one";
  return null;
}

// src/hook/nestedgit.ts
var import_node_fs4 = require("node:fs");
var import_node_path5 = require("node:path");
var GITFILE_MAX = 4096;
var SAFE_NAME = /^[A-Za-z0-9._/@+-]{1,120}$/;
var shown = (p) => SAFE_NAME.test(p) ? p : "<unprintable name>";
function gitlinks(top) {
  const r = git(top, ["ls-files", "--stage", "-z"]);
  if (r.status !== 0) throw new HookFault("git_ls_files_failed");
  const out = [];
  for (const rec of r.stdout.toString("utf8").split("\0")) {
    if (!rec.startsWith("160000 ")) continue;
    const tab = rec.indexOf("	");
    if (tab > 0) out.push(rec.slice(tab + 1));
  }
  return out;
}
function modulesRoots(top, sub) {
  const r = git(top, ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"]);
  if (r.status !== 0) throw new HookFault("git_rev_parse_failed");
  const roots = /* @__PURE__ */ new Set();
  for (const dir of r.stdout.toString("utf8").split("\n").filter((l) => l !== "")) {
    try {
      if ((0, import_node_fs4.lstatSync)((0, import_node_path5.join)(dir, sub)).isDirectory()) roots.add((0, import_node_fs4.realpathSync)((0, import_node_path5.join)(dir, sub)));
    } catch {
    }
  }
  return [...roots];
}
function problem(top, entry, roots, listed) {
  const file = (0, import_node_path5.join)(top, entry);
  let st;
  try {
    st = (0, import_node_fs4.lstatSync)(file);
  } catch {
    return null;
  }
  if (listed) return st.isDirectory() ? null : "a .git that is not a real folder, in a workspace repo";
  if (!st.isFile()) return "a nested .git folder or link that the workspace anchor does not list";
  if (st.size > GITFILE_MAX) return "an oversized .git file";
  const text = (0, import_node_fs4.readFileSync)(file, "utf8");
  if (!text.startsWith("gitdir: ")) return "a .git file that names no git dir";
  const named = text.slice("gitdir: ".length).replace(/\r?\n$/, "");
  if (named === "" || named !== named.trim() || /[\r\n\0]/.test(named)) return "a .git file with an odd git dir name";
  try {
    const real = (0, import_node_fs4.realpathSync)((0, import_node_path5.resolve)((0, import_node_path5.dirname)(file), named));
    return roots.some((root) => real.startsWith(`${root}/`)) ? null : "a .git file whose git dir is not <common>/modules/<name>";
  } catch {
    return "a .git file whose git dir does not exist";
  }
}
function nestedGitProblem(top, entries, nestedRepos = []) {
  const links = gitlinks(top).map((d) => `${d}/.git`);
  const all = [.../* @__PURE__ */ new Set([...links, ...entries])];
  if (all.length === 0) return null;
  const modules = modulesRoots(top, "modules");
  const withTrees = [...modules, ...modulesRoots(top, "worktrees")];
  const linked = new Set(links);
  const listed = new Set(nestedRepos);
  for (const e of all.sort()) {
    const why = problem(top, e, linked.has(e) ? modules : withTrees, listed.has((0, import_node_path5.dirname)(e)));
    if (why !== null) return `${shown(e)} is ${why}`;
  }
  return null;
}

// src/version.ts
var VERSION = "1.0.0";

// src/core/personcmd.ts
var PERSON_PKG = `github:dante-trinh/trellis-flow#v${VERSION}`;
var SAFE_PATH = /^[A-Za-z0-9_./@+:=-]+$/;
var quoted = (p) => SAFE_PATH.test(p) || /^<[a-z]+>$/.test(p) ? p : `'${p.replaceAll("'", "'\\''")}'`;
var personCmd = (cmd, top = "<top>") => `npx --yes ${PERSON_PKG} ${cmd}${top === null ? "" : ` --cwd ${quoted(top)}`}`;

// src/hook/drift.ts
var MAX_LISTED = 8;
var block = (code2, text) => ({ exit: 2, stderr: `[${code2}] ${text}
` });
var v2Install = (top) => `this repo has a trellis v2 install: a person runs \`${personCmd("init", top)}\` from outside the repository to upgrade. Every tool stays blocked until then.`;
var PERSON = "The person restores it outside Claude; every tool stays blocked until then.";
var safeName = (p) => p.length <= 120 && /^[A-Za-z0-9._/@+-]+$/.test(p) ? p : "<unprintable name>";
function differing(top, anchor, gitfiles) {
  const differ = /* @__PURE__ */ new Set();
  for (const path of Object.keys(anchor.ruleHashes)) if (!matchesAnchor(top, path, anchor)) differ.add(path);
  for (const [path, f] of protectedOnDisk(top, (d) => gitfiles.push(d))) {
    if (path in anchor.ruleHashes || isMachineOwn(path, f.st)) continue;
    if (f.real !== path && f.real in anchor.ruleHashes) continue;
    differ.add(path);
  }
  return [...differ].sort();
}
var driftText = (target, paths) => {
  const shown2 = paths.slice(0, MAX_LISTED).map(safeName).join(", ");
  const more = paths.length > MAX_LISTED ? ` (+${paths.length - MAX_LISTED} more)` : "";
  return `rule files differ from ${target}: ${shown2}${more}. The person checks them outside Claude; every tool stays blocked until they match.`;
};
function classify(top, home) {
  const anchor = readAnchor(home, repoIdOf(top));
  if (anchor === null) {
    return hasMarkers(top) ? { kind: "block", result: block("rule_drift", `trellis files are present but there is no drift anchor for this repository. The person runs trellis init or upgrade outside Claude; every tool stays blocked until then.`) } : { kind: "none" };
  }
  const unbound = verifyBinding(top, anchor);
  if (unbound !== null) return { kind: "block", result: block("rule_drift", `${unbound}. ${PERSON}`) };
  if (anchor.installKind === "v1") return { kind: "v1" };
  const mismatch = verifyAnchor(anchor, targetBranch(top));
  if (mismatch !== null) return { kind: "block", result: block("rule_drift", `${mismatch}. ${PERSON}`) };
  return { kind: "v3", anchor };
}
function checkTree(top, home) {
  const state = classify(top, home);
  if (state.kind === "block") return state.result;
  if (state.kind === "v1") return block("v2_install", v2Install(top));
  if (state.kind !== "v3") return null;
  const { anchor } = state;
  const target = anchor.targetBranch;
  const commit = gitText(top, ["rev-parse", "--verify", "--quiet", `refs/heads/${target}^{commit}`]);
  if (commit === null || commit === "") return block("rule_drift", `target branch ${safeName(target)} is missing, so rule files cannot be compared. ${PERSON}`);
  const gitfiles = [];
  const paths = differing(top, anchor, gitfiles);
  if (paths.length > 0) return block("rule_drift", driftText(safeName(target), paths));
  const nested = nestedGitProblem(top, gitfiles, anchor.nestedRepos);
  return nested === null ? null : block("nested_git", `${nested}. A planted submodule runs its own git config on the person's git commands. The person removes it outside Claude; every tool stays blocked until then.`);
}
function faultCode(e) {
  if (e instanceof HookFault) return e.message;
  const code2 = e?.code;
  if (typeof code2 === "string" && /^[A-Z0-9_]{1,20}$/.test(code2)) return code2;
  return e instanceof Error && e.message.startsWith("git ") ? "git_failed" : "internal";
}
function checkDrift(dirs, home) {
  try {
    const tops = new Set(dirs.flatMap((d) => enclosingTrees(d)));
    for (const top of tops) {
      const r = checkTree(top, home);
      if (r !== null) return r;
    }
    return { exit: 0 };
  } catch (e) {
    return block("hook_internal", `PreToolUse drift check failed: ${faultCode(e)}`);
  }
}

// src/hook/status.ts
var import_node_child_process2 = require("node:child_process");
var import_node_fs5 = require("node:fs");
var import_node_path6 = require("node:path");
var ROUTES = /* @__PURE__ */ new Set(["quick", "fix", "feature", "refactor", "spike", "docs", "chore", "investigate"]);
var REASONS = /* @__PURE__ */ new Set(["plan_wrong", "needs_person", "credential_needed", "destructive_op", "tool_unavailable", "review_unresolved", "review_conflict"]);
var SLUG = /^[a-z0-9][a-z0-9._-]{0,80}$/;
var BRANCH = /^[A-Za-z0-9._/-]{1,100}$/;
var GH_TIMEOUT_MS = 3e3;
var FAILED = /* @__PURE__ */ new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"]);
var PENDING = /* @__PURE__ */ new Set(["PENDING", "EXPECTED", "QUEUED", "IN_PROGRESS", "WAITING", "REQUESTED"]);
function findGh() {
  for (const dir of absolutePath()) {
    const full = (0, import_node_path6.join)(dir, "gh");
    try {
      if (!(0, import_node_fs5.statSync)(full).isFile()) continue;
      (0, import_node_fs5.accessSync)(full, import_node_fs5.constants.X_OK);
      return full;
    } catch {
    }
  }
  return null;
}
var realGh = (cwd) => {
  const gh = findGh();
  if (gh === null) return null;
  const r = (0, import_node_child_process2.spawnSync)(gh, ["pr", "view", "--json", "number,state,reviewDecision,statusCheckRollup"], { cwd, env: env(), encoding: "utf8", timeout: GH_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] });
  if (r.error !== void 0 || r.status === null) return null;
  if (r.status === 0) return r.stdout;
  return /no pull requests? found/i.test(r.stderr) ? "none" : null;
};
function parsePr(text) {
  try {
    const j = JSON.parse(text);
    if (typeof j.number !== "number" || !Number.isInteger(j.number) || j.number < 1) return null;
    if (j.state === "MERGED") return { number: j.number, label: "merged" };
    if (j.state === "CLOSED") return { number: j.number, label: "closed" };
    if (j.reviewDecision === "CHANGES_REQUESTED") return { number: j.number, label: "changes requested" };
    const checks = Array.isArray(j.statusCheckRollup) ? j.statusCheckRollup : [];
    const verdicts = checks.map((c) => String(c.conclusion || c.state || c.status || "").toUpperCase());
    const label = verdicts.some((v) => FAILED.has(v)) ? "CI failing" : checks.length === 0 || verdicts.some((v) => v === "" || PENDING.has(v)) ? "CI pending" : "CI passing";
    return { number: j.number, label };
  } catch {
    return null;
  }
}
var hasGithubRemote = (top) => (gitText(top, ["remote", "-v"]) ?? "").includes("github.com");
function committed(top, rel) {
  const r = git(top, ["cat-file", "blob", `HEAD:${rel}`]);
  return r.status === 0 ? r.stdout.toString("utf8") : null;
}
function readFacts(top, gh = realGh) {
  const target = targetBranch(top) ?? "main";
  const branch = gitText(top, ["symbolic-ref", "--short", "-q", "HEAD"]);
  const slugPart = branch !== null && branch !== target ? branch.slice(branch.indexOf("/") + 1) : "";
  const slug = branch !== null && branch.includes("/") && SLUG.test(slugPart) ? slugPart : null;
  let route = null;
  let blocked = null;
  if (slug !== null) {
    const routeText = committed(top, `workflow/changes/${slug}/route.md`);
    const r = routeText === null ? null : /^route:[ \t]*([a-z]+)[ \t]*$/m.exec(routeText)?.[1];
    route = r !== void 0 && r !== null && ROUTES.has(r) ? r : null;
    const blockedText = committed(top, `workflow/changes/${slug}/blocked.md`);
    if (blockedText !== null) {
      const reason = /^reason:[ \t]*([a-z_]+)[ \t]*$/m.exec(blockedText)?.[1];
      blocked = reason !== void 0 && REASONS.has(reason) ? reason : "unknown";
    }
  }
  let pr = null;
  if (branch !== null && slug !== null && blocked === null && hasGithubRemote(top)) {
    const out = gh(top);
    pr = out === null ? null : out === "none" ? "none" : parsePr(out);
  }
  return { branch, target, slug, route, blocked, pr };
}
function describe(f) {
  const parts = ["trellis"];
  if (f.branch !== null && BRANCH.test(f.branch)) parts.push(f.branch);
  if (f.route !== null) parts.push(`route ${f.route}`);
  const slug = f.slug ?? "";
  let next = null;
  if (f.blocked !== null) {
    parts.push(`blocked: ${f.blocked}`);
    next = `read workflow/changes/${slug}/blocked.md and tell the person`;
  } else if (f.pr !== null && f.pr !== "none") {
    parts.push(`PR #${f.pr.number} ${f.pr.label}`);
    next = f.pr.label === "CI failing" || f.pr.label === "changes requested" ? `/tr:start ${slug} (fix route on this branch)` : null;
  } else if (f.pr === "none") {
    parts.push("no PR yet");
    next = `/tr-ship (${slug})`;
  } else if (f.branch !== null && f.branch === f.target) {
    parts.push(`on ${f.target}: start with /tr:start`);
  }
  return { line: parts.join(" · "), next: next === null ? null : `next: ${next}` };
}

// src/spectex/run.ts
var import_node_child_process3 = require("node:child_process");
var import_node_fs7 = require("node:fs");

// src/core/binpath.ts
var import_node_fs6 = require("node:fs");
var import_node_path7 = require("node:path");
var CONTROL = /[\u0000-\u001f]/;
function executable(path) {
  try {
    (0, import_node_fs6.accessSync)(path, import_node_fs6.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function realOrSelf(path) {
  try {
    return import_node_fs6.realpathSync.native(path);
  } catch {
    return path;
  }
}
function identity(path) {
  try {
    const st = (0, import_node_fs6.statSync)(path);
    return `${st.dev}:${st.ino}`;
  } catch {
    return null;
  }
}
function isInside(path, root) {
  const target = identity(root);
  if (target === null || !(0, import_node_path7.isAbsolute)(path)) return false;
  let dir = path;
  while (!(0, import_node_fs6.existsSync)(dir) && (0, import_node_path7.dirname)(dir) !== dir) dir = (0, import_node_path7.dirname)(dir);
  for (let d = realOrSelf(dir); ; d = (0, import_node_path7.dirname)(d)) {
    if (identity(d) === target) return true;
    if ((0, import_node_path7.dirname)(d) === d) return false;
  }
}
var rootList = (roots) => roots === void 0 ? [] : typeof roots === "string" ? [roots] : roots;
var inRepo = (path, roots) => rootList(roots).some((root) => isInside(path, root));
function safePath(path, roots) {
  return (path ?? "").split(":").filter((dir) => (0, import_node_path7.isAbsolute)(dir) && !CONTROL.test(dir) && !inRepo(dir, roots)).join(":");
}
function resolveBin(name, path, roots) {
  const candidate = safePath(path, roots).split(":").filter((dir) => dir !== "").map((dir) => (0, import_node_path7.join)(dir, name)).find(executable);
  if (candidate === void 0) return null;
  const real = realOrSelf(candidate);
  return inRepo(real, roots) || inRepo((0, import_node_path7.dirname)(candidate), roots) ? null : real;
}

// src/spectex/run.ts
function makeRunSpectex(env2, roots) {
  return (args, input, timeoutMs) => {
    const bin = resolveBin("spectex", env2.PATH, roots);
    if (bin === null) return { status: null, stdout: "", timedOut: false, missing: true };
    const home = env2.HOME ?? "";
    try {
      const r = (0, import_node_child_process3.spawnSync)(bin, [...args], {
        env: { PATH: safePath(env2.PATH, roots), HOME: home, LC_ALL: "C", GIT_NO_REPLACE_OBJECTS: "1", GIT_CONFIG_NOSYSTEM: "1" },
        cwd: (0, import_node_fs7.existsSync)(home) ? home : "/",
        stdio: [input === null ? "ignore" : "pipe", "pipe", "ignore"],
        ...input === null ? {} : { input },
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 1 << 20
      });
      const timedOut = r.error?.code === "ETIMEDOUT";
      const failed = r.error !== void 0;
      return { status: failed ? null : r.status, stdout: failed ? "" : (r.stdout ?? Buffer.alloc(0)).toString("utf8"), timedOut, missing: false };
    } catch {
      return { status: null, stdout: "", timedOut: false, missing: false };
    }
  };
}
function spectexRoots(top) {
  const roots = /* @__PURE__ */ new Set([...enclosingTrees(top), ...enclosingTrees(process.cwd())]);
  for (const tree of [...roots]) {
    try {
      roots.add(checkoutOf(tree).checkout);
    } catch {
    }
  }
  return [...roots];
}

// src/spectex/source.ts
var import_node_child_process4 = require("node:child_process");
var import_node_crypto2 = require("node:crypto");
var import_node_fs8 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path8 = require("node:path");

// src/core/exit.ts
var EXIT = { OK: 0, FAIL: 1, USAGE: 2, PRECONDITION: 3, PARTIAL: 4, CANCELLED: 130 };

// src/core/codes.ts
var CODES = {
  usage_error: { exit: EXIT.USAGE, vi: "Sai cú pháp lệnh `{cmd}`.", en: "Invalid usage of `{cmd}`.", hint_vi: `\`${personCmd("{cmd} --help")}\``, hint_en: `\`${personCmd("{cmd} --help")}\`` },
  human_only: { exit: EXIT.USAGE, vi: "`{cmd}` chỉ người chạy được, trong terminal.", en: "`{cmd}` can only be run by a person, in a terminal.", hint_vi: `Mở terminal ngoài repo và chạy \`${personCmd("{cmd}")}\``, hint_en: `Open a terminal outside the repository and run \`${personCmd("{cmd}")}\`` },
  schema_invalid: { exit: EXIT.USAGE, vi: "`{file}`: trường `{field}` sai hoặc không được phép.", en: "`{file}`: field `{field}` is invalid or not allowed.", hint_vi: "Sửa theo schema `{name}` v{n}", hint_en: "Fix it to match schema `{name}` v{n}" },
  catalog_invalid: { exit: EXIT.USAGE, vi: "Catalog: `{file}` sai ở `{field}`.", en: "Catalog: `{file}` is invalid at `{field}`.", hint_vi: "Sửa file catalog (hoặc file ghi đè trong `.trellis/catalog/`)", hint_en: "Fix the catalog file (or the override in `.trellis/catalog/`)" },
  not_git_repo: { exit: EXIT.PRECONDITION, vi: "`{dir}` không phải repo git.", en: "`{dir}` is not a git repository.", hint_vi: "`git init` hoặc `--cwd`", hint_en: "`git init`, or pass `--cwd`" },
  not_initialized: { exit: EXIT.PRECONDITION, vi: "Repo chưa cài trellis.", en: "trellis is not installed in this repository.", hint_vi: `\`${personCmd("init")}\`, chạy từ ngoài repo (repo private: cần quyền git vào repo); nếu SSH mặc định thuộc tài khoản khác: \`npx -y "git+ssh://git@<host>/dante-trinh/trellis-flow.git#v${VERSION}" init\`, thay \`<host>\` bằng alias SSH của bạn`, hint_en: `\`${personCmd("init")}\`, run from outside the repository (private repo: needs git access to it); if your default SSH key belongs to another account: \`npx -y "git+ssh://git@<host>/dante-trinh/trellis-flow.git#v${VERSION}" init\`, replace \`<host>\` with your SSH alias` },
  schema_newer: { exit: EXIT.PRECONDITION, vi: "`{file}` do trellis mới hơn ghi (v{n}).", en: "`{file}` was written by a newer trellis (v{n}).", hint_vi: "Nâng trellis: chạy `init` của bản mới, ví dụ `npx --yes github:dante-trinh/trellis-flow#<tag mới> init --cwd <top>` (repo private: cần quyền git vào repo)", hint_en: "Upgrade trellis: run `init` of the new version, e.g. `npx --yes github:dante-trinh/trellis-flow#<new tag> init --cwd <top>` (private repo: needs git access to it)" },
  node_too_old: { exit: EXIT.PRECONDITION, vi: "Node {v} < {min}.", en: "Node {v} < {min}.", hint_vi: "Cài Node ≥ {min}", hint_en: "Install Node ≥ {min}" },
  git_too_old: { exit: EXIT.PRECONDITION, vi: "git {v} < {min}.", en: "git {v} < {min}.", hint_vi: "Nâng git", hint_en: "Upgrade git" },
  version_too_old: { exit: EXIT.PRECONDITION, vi: "Claude Code {v} < {min}.", en: "Claude Code {v} < {min}.", hint_vi: "`claude update`", hint_en: "`claude update`" },
  dirty_tree: { exit: EXIT.PRECONDITION, vi: "Working tree có thay đổi chưa commit.", en: "The working tree has uncommitted changes.", hint_vi: "Commit file trellis cần ghi (nếu là file của lần cài trước chưa commit: chạy lệnh git ở màn cuối lần đó), hoặc `--allow-dirty` (cài, không tạo commit)", hint_en: "Commit the file trellis needs to write (files of an earlier uncommitted install: run the git command from that install's last screen), or pass `--allow-dirty` (installs without a commit)" },
  detached_head: { exit: EXIT.PRECONDITION, vi: "HEAD tách rời hoặc đang merge / rebase.", en: "HEAD is detached, or a merge / rebase is in progress.", hint_vi: "Hoàn tất thao tác git đang dở", hint_en: "Finish the git operation in progress" },
  lock_held: { exit: EXIT.PRECONDITION, vi: "Một lệnh trellis khác đang chạy (pid {pid}).", en: "Another trellis command is running (pid {pid}).", hint_vi: "Chờ, hoặc kiểm tiến trình", hint_en: "Wait, or check the process" },
  manifest_invalid: { exit: EXIT.PRECONDITION, vi: "Manifest cài hỏng hoặc thiếu.", en: "The install manifest is missing or broken.", hint_vi: `\`${personCmd("doctor")}\`; cài lại bằng \`init --force\``, hint_en: `\`${personCmd("doctor")}\`; reinstall with \`init --force\`` },
  locally_modified: { exit: EXIT.PRECONDITION, vi: "{n} file của trellis bị sửa tay.", en: "{n} trellis file(s) were edited by hand.", hint_vi: "Xem `git diff -- workflow/bin`; cài lại bằng `init --force`", hint_en: "See `git diff -- workflow/bin`; reinstall with `init --force`" },
  doctor_failed: { exit: EXIT.FAIL, vi: "`doctor`: {n} mục kiểm `fail`.", en: "`doctor`: {n} check(s) failed.", hint_vi: "Xem từng mục; mục ghi `doctor --fix` thì người chạy lệnh đó ở terminal", hint_en: "See each check; for the ones that say `doctor --fix`, a person runs that in a terminal" },
  unborn_head: { exit: EXIT.PRECONDITION, vi: "Repo chưa có commit nào; `{cmd}` cần HEAD.", en: "The repository has no commits; `{cmd}` needs HEAD.", hint_vi: "Tạo commit đầu tiên (commit các file `init` đã ghi), rồi chạy lại", hint_en: "Make the first commit (commit the files `init` wrote), then run it again" },
  os_unsupported: { exit: EXIT.PRECONDITION, vi: "Hệ điều hành `{os}` chưa được hỗ trợ.", en: "Operating system `{os}` is not supported.", hint_vi: "Dùng macOS, Linux, hoặc WSL2 với repo nằm trong filesystem của WSL", hint_en: "Use macOS, Linux, or WSL2 with the repository inside the WSL filesystem" },
  not_yet_supported: { exit: EXIT.PRECONDITION, vi: "`{feature}` chưa có ở trellis {version}.", en: "`{feature}` is not available in trellis {version}.", hint_vi: "Chờ bản trellis có `{feature}`", hint_en: "Wait for a trellis release with `{feature}`" },
  linked_worktree: { exit: EXIT.PRECONDITION, vi: "`{cmd}` chạy ở checkout chính, không ở worktree phụ.", en: "`{cmd}` runs in the main checkout, not in a linked worktree.", hint_vi: "`cd {dir}` rồi chạy lại", hint_en: "`cd {dir}` and run it again" },
  settings_unsafe: { exit: EXIT.PRECONDITION, vi: "`{path}`: `{key}` làm guardrail của trellis vô hiệu; không ghi gì.", en: "`{path}`: `{key}` disables trellis guardrails; nothing was written.", hint_vi: "Sửa `{key}` trong `{path}`, rồi chạy lại", hint_en: "Change `{key}` in `{path}`, then run it again" },
  replace_refs_present: { exit: EXIT.PRECONDITION, vi: "`refs/replace` có mục (đầu tiên: `{ref}`): git của người có thể cho ra nội dung khác với trellis.", en: "`refs/replace` has entries (first: `{ref}`): a person's git can show other bytes than trellis.", hint_vi: "Người xem `git for-each-ref refs/replace` ở terminal (cả `packed-refs`) và xoá mục không phải của mình bằng `git update-ref -d` trước khi chạy lệnh git nào ghi cây làm việc", hint_en: "A person looks at `git for-each-ref refs/replace` in a terminal (`packed-refs` too) and removes entries that are not theirs with `git update-ref -d` before running any git command that writes the work tree" },
  objects_unsafe: { exit: EXIT.PRECONDITION, vi: "Kho object của git không đáng tin ({cause}): {detail}", en: "The git object store cannot be trusted ({cause}): {detail}", hint_vi: "Đừng chạy lệnh git nào ghi cây làm việc (`switch`, `checkout`, `merge`, `rebase`, `pull`). Người chạy `git fsck --no-dangling` ở terminal; object lỏng hỏng: xoá file nó nêu rồi `git fetch origin`; object hỏng trong pack: clone lại repo; index hỏng (sandbox ghi được `.git/index`, `fsck` kiểm cả index): xem `git status`, dựng lại bằng `git read-tree HEAD` ở terminal; chỉ lỗi định dạng của commit cũ (`badTimezone`, `missingEmail`…), không phải `hash-path mismatch` / `corrupt` / `missing`: đặt `fsck.<msg-id>=warn` hay `fsck.skipList` trong config của người. Rồi chạy lại lệnh vừa báo lỗi", hint_en: "Run no git command that writes the work tree (`switch`, `checkout`, `merge`, `rebase`, `pull`). A person runs `git fsck --no-dangling` in a terminal; a bad loose object: delete the file it names, then `git fetch origin`; a bad object in a pack: clone the repository again; a bad index (the sandbox can write `.git/index`, and `fsck` checks the index): look at `git status`, rebuild it with `git read-tree HEAD` in a terminal; only a format error of an old commit (`badTimezone`, `missingEmail`…), not `hash-path mismatch` / `corrupt` / `missing`: set `fsck.<msg-id>=warn` or `fsck.skipList` in your own config. Then run the command that reported the error again" },
  fetch_failed: { exit: EXIT.PRECONDITION, vi: "Không fetch được từ `{remote}`.", en: "Cannot fetch from `{remote}`.", hint_vi: "Kiểm mạng / quyền (credential helper, SSH agent), rồi chạy lại", hint_en: "Check the network and access (credential helper, SSH agent), then run it again" },
  target_diverged: { exit: EXIT.PRECONDITION, vi: "`{branch}` local có commit không có trên `origin/{branch}`.", en: "Local `{branch}` has commits that `origin/{branch}` does not.", hint_vi: "Người push các commit của `{branch}` local, hoặc tự đưa nhánh đó về khớp remote bằng cách của mình (không phải việc của agent), rồi chạy lại", hint_en: "Push the local `{branch}` commits, or bring that branch in line with the remote yourself, your own way (not a job for the agent), then run it again" },
  not_checked: { exit: EXIT.PRECONDITION, vi: "`{slug}` chưa được kiểm trên cây kết quả merge ({cause}).", en: "`{slug}` is not checked on the merge result tree ({cause}).", hint_vi: "Lead chạy lệnh kiểm của feature (`check {slug}`) trong phiên của feature (sandbox; không chạy ở terminal: lệnh kiểm là code của feature), xem `data` và `tr-check.log`, rồi `review seal` lại", hint_en: "The lead runs the feature check (`check {slug}`) in the feature's session (sandboxed; not in a terminal: the checks are the feature's code), reads `data` and `tr-check.log`, then `review seal` again" },
  file_changed: { exit: EXIT.FAIL, vi: "`{path}` đổi trong lúc cài; đã rollback, không ghi gì.", en: "`{path}` changed during the install; rolled back, nothing was written.", hint_vi: "Chạy lại `init`", hint_en: "Run `init` again" },
  file_unparsable: { exit: EXIT.FAIL, vi: "`{path}` không parse được; không ghi gì.", en: "`{path}` cannot be parsed; nothing was written.", hint_vi: "Sửa file cho đúng cú pháp, rồi chạy lại", hint_en: "Fix the file's syntax, then run it again" },
  marker_invalid: { exit: EXIT.FAIL, vi: "Marker `{block}` trong `{path}` bị trùng hoặc hỏng; không ghi gì.", en: "Marker `{block}` in `{path}` is duplicated or broken; nothing was written.", hint_vi: "Sửa tay cho còn đúng một cặp begin / end, rồi chạy lại", hint_en: "Leave exactly one begin / end pair by hand, then run it again" },
  path_conflict: { exit: EXIT.FAIL, vi: "`{path}` đã có và không phải của trellis; không ghi gì.", en: "`{path}` exists and does not belong to trellis; nothing was written.", hint_vi: "Đổi tên / xoá file, hoặc `--force` (có backup)", hint_en: "Rename or remove the file, or pass `--force` (it is backed up)" },
  rollback_incomplete: { exit: EXIT.PARTIAL, vi: "Rollback không trọn; backup ở `{dir}`.", en: "Rollback did not finish; the backup is in `{dir}`.", hint_vi: "Khôi phục tay từ backup", hint_en: "Restore by hand from the backup" },
  disk_full: { exit: EXIT.FAIL, vi: "Hết chỗ trống khi ghi `{path}`.", en: "Out of disk space while writing `{path}`.", hint_vi: "Giải phóng ổ đĩa; xem `data.rolled_back`", hint_en: "Free disk space; see `data.rolled_back`" },
  hook_internal: { exit: EXIT.USAGE, vi: "Hook lỗi nội bộ ({event}).", en: "Internal hook error ({event}).", hint_vi: `Kiểm \`.claude/hooks/trellis-hook.cjs\` và đường dẫn node trong \`.claude/settings.local.json\`; người chạy lại \`${personCmd("init")}\``, hint_en: `Check \`.claude/hooks/trellis-hook.cjs\` and the node path in \`.claude/settings.local.json\`; a person runs \`${personCmd("init")}\` again` },
  worktree_refused: { exit: EXIT.USAGE, vi: "trellis làm việc trên một nhánh ngay ở checkout này, không tạo worktree.", en: "trellis works on a branch in this checkout; it does not create worktrees.", hint_vi: "Làm tiếp trên nhánh hiện tại, trong phiên này", hint_en: "Keep working on the current branch, in this session" },
  cancelled: { exit: EXIT.CANCELLED, vi: "Đã huỷ.", en: "Cancelled.", hint_vi: "", hint_en: "" },
  internal_error: { exit: EXIT.FAIL, vi: "Lỗi nội bộ trong `{cmd}`.", en: "Internal error in `{cmd}`.", hint_vi: "Chạy lại; nếu còn lỗi, gửi stderr cho người bảo trì trellis", hint_en: "Run it again; if it still fails, send stderr to the trellis maintainers" },
  // v3 installer (K1b)
  unknown_pack: { exit: EXIT.USAGE, vi: "Không có pack `{id}` trong catalog.", en: "There is no pack `{id}` in the catalog.", hint_vi: "`init --list packs`", hint_en: "`init --list packs`" },
  unknown_adapter: { exit: EXIT.USAGE, vi: "Không có adapter `{id}` trong catalog.", en: "There is no adapter `{id}` in the catalog.", hint_vi: "`init --list adapters`", hint_en: "`init --list adapters`" },
  unresolved_question: { exit: EXIT.USAGE, vi: "`init` cần một câu trả lời: {question}.", en: "`init` needs an answer: {question}.", hint_vi: "Thêm cờ nêu ở trên, hoặc chạy `init` trong terminal để được hỏi", hint_en: "Add the flag named above, or run `init` in a terminal to be asked" },
  workspace_invalid: { exit: EXIT.USAGE, vi: "`trellis.workspace.yaml` sai: `{field}`.", en: "`trellis.workspace.yaml` is invalid: `{field}`.", hint_vi: "Sửa file rồi chạy lại `init`", hint_en: "Fix the file, then run `init` again" },
  workspace_repo_state: { exit: EXIT.PRECONDITION, vi: "Repo `{dir}` của workspace {why}.", en: "The workspace repo `{dir}` {why}.", hint_vi: "Chuyển nó về nhánh đích, commit hoặc stash thay đổi, rồi chạy lại `init`", hint_en: "Switch it to its target branch, commit or stash its changes, then run `init` again" },
  v1_install_unsupported: { exit: EXIT.PRECONDITION, vi: "Repo có bản cài trellis v1 (0.1.x); bản này không nâng cấp từ v1.", en: "This repository has a trellis v1 (0.1.x) install; this version does not upgrade from v1.", hint_vi: "Nâng lên 0.3.0 trước, rồi chạy `init` của bản này", hint_en: "Upgrade to 0.3.0 first, then run `init` of this version" },
  bot_dir_conflict: { exit: EXIT.PRECONDITION, vi: "`{path}` đã có và không phải thư mục thật.", en: "`{path}` exists and is not a real folder.", hint_vi: "Đổi tên hoặc xoá nó, rồi chạy lại", hint_en: "Rename or remove it, then run it again" },
  anchor_failed: { exit: EXIT.PRECONDITION, vi: "Không ghi được anchor chống trôi luật: {cause}.", en: "The rule-drift anchor could not be written: {cause}.", hint_vi: `Sửa nguyên nhân rồi chạy \`${personCmd("anchor refresh")}\` (người chạy, ở checkout chính, trên nhánh đích, cây sạch)`, hint_en: `Fix the cause, then run \`${personCmd("anchor refresh")}\` (a person, in the main checkout, on the target branch, clean tree)` },
  not_installed_v3: { exit: EXIT.PRECONDITION, vi: "Repo chưa cài trellis v3.", en: "trellis v3 is not installed in this repository.", hint_vi: `\`${personCmd("init")}\``, hint_en: `\`${personCmd("init")}\`` }
};

// src/core/errors.ts
var MAX_VAR_CHARS = 200;
var UNSAFE_VAR = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}`]/u;
function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (whole, name) => {
    const value = vars[name];
    if (value === void 0) return whole;
    const text = String(value);
    return text.length > MAX_VAR_CHARS || UNSAFE_VAR.test(text) ? "?" : text;
  });
}
var INSTALL_HINT = {
  vi: "Đọc `tr-install.log` (`<git-common-dir>/tr-check/{slug}/`; 40 dòng cuối đã in), ghi `blocked.md` (`tool_unavailable`) rồi dừng; không tự gõ lệnh cài của trình quản lý gói",
  en: "Read `tr-install.log` (`<git-common-dir>/tr-check/{slug}/`; its last 40 lines were printed), write `blocked.md` (`tool_unavailable`) and stop; do not type the package manager's install yourself"
};
var ALTERNATES_HINT = {
  vi: "trellis không merge repo dùng alternates: người xem `cat .git/objects/info/alternates` ở terminal, xoá nếu không phải của mình (`git repack -a -d` trước nếu đang dùng thật), rồi chạy lại lệnh vừa báo lỗi",
  en: "trellis does not merge a repository that uses alternates: a person looks at `cat .git/objects/info/alternates` in a terminal and deletes it if it is not theirs (`git repack -a -d` first if it is really used), then runs the command that reported the error again"
};
var REVIEW_V1_HINT = {
  vi: "review v1: làm xong trên trellis v1, hoặc `review seal` lại",
  en: "review v1: finish it on trellis v1, or run `review seal` again"
};
var DECISIONS_HINT = {
  vi: "`decisions.md`: tối đa 3 dòng `ngày · quyết định · vì sao · file`, mỗi dòng tối đa 300 ký tự, ngày `YYYY-MM-DD`, không ký tự điều khiển; sửa rồi commit trước khi `review seal`",
  en: "`decisions.md`: at most 3 lines `date · decision · why · file`, each at most 300 characters, date `YYYY-MM-DD`, no control characters; fix it and commit before `review seal`"
};
var FORM = { vi: "`decisions.md` dòng {line} sai dạng: cần `ngày · quyết định · vì sao · file`, ngày `YYYY-MM-DD`", en: "`decisions.md` line {line} is malformed: need `date · decision · why · file`, date `YYYY-MM-DD`" };
var DECISIONS_CAUSE = {
  decisions_control: { vi: "`decisions.md` dòng {line} có ký tự cấm {cp}: xoá ký tự đó", en: "`decisions.md` line {line} has a forbidden character {cp}: delete it" },
  decisions_lines: { vi: "`decisions.md` dòng {line} là dòng thứ 4: chỉ giữ tối đa 3 dòng", en: "`decisions.md` line {line} is a 4th line: keep at most 3" },
  decisions_length: { vi: "`decisions.md` dòng {line} dài quá 300 ký tự: rút ngắn", en: "`decisions.md` line {line} is over 300 characters: shorten it" },
  decisions_fields: FORM,
  decisions_date: FORM
};
function render(code2, vars, lang) {
  const entry = CODES[code2];
  const viaInstall = code2 === "not_checked" && vars.via === "install";
  const alternates = code2 === "objects_unsafe" && vars.cause === "alternates";
  const reviewV1 = code2 === "schema_invalid" && vars.cause === "review_v1";
  const decisions = code2 === "schema_invalid" && typeof vars.cause === "string" && vars.cause.startsWith("decisions_");
  const hintVi = viaInstall ? INSTALL_HINT.vi : alternates ? ALTERNATES_HINT.vi : reviewV1 ? REVIEW_V1_HINT.vi : decisions ? (DECISIONS_CAUSE[String(vars.cause)] ?? DECISIONS_HINT).vi : entry.hint_vi;
  const hintEn = viaInstall ? INSTALL_HINT.en : alternates ? ALTERNATES_HINT.en : reviewV1 ? REVIEW_V1_HINT.en : decisions ? (DECISIONS_CAUSE[String(vars.cause)] ?? DECISIONS_HINT).en : entry.hint_en;
  return lang === "vi" ? { code: code2, message: fill(entry.vi, vars), hint: fill(hintVi, vars) } : { code: code2, message: fill(entry.en, vars), hint: fill(hintEn, vars) };
}
var TrellisError = class extends Error {
  code;
  vars;
  exit;
  constructor(code2, vars = {}) {
    super(fill(CODES[code2].en, vars));
    this.name = "TrellisError";
    this.code = code2;
    this.vars = Object.freeze({ ...vars });
    this.exit = CODES[code2].exit;
  }
};

// src/spectex/source.ts
var BRANCH2 = /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,199}$/;
var GLOB_SHAPE = /^workflow\/changes\/[^/]+\/decisions\.md$/;
var DECISIONS_NAME = /decisions\.md$/i;
var SLUG2 = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
var SHA2 = /^[0-9a-f]{40,64}$/;
var SAFE2 = ["--no-replace-objects", "-c", "core.commitGraph=false", "-c", "core.fsmonitor=false", "-c", "core.pager=cat", "-c", "core.attributesFile=/dev/null", "-c", "core.hooksPath=/dev/null", "-c", "gpg.program="];
var LOCAL_MS = 3e3;
var REMOTE_MS = 15e3;
function targetOf(top, home) {
  try {
    return readAnchor(home, repoIdOf(top))?.targetBranch ?? null;
  } catch {
    return null;
  }
}
var localOk = () => false;
var REMOTE_URL = /^(https:\/\/[A-Za-z0-9.-]+(:\d+)?\/[\x21-\x7e]+|ssh:\/\/([A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+(:\d+)?\/[\x21-\x7e]+|[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[A-Za-z0-9._~][\x21-\x7e]*)$/;
var transport = () => ["-c", "protocol.allow=never", "-c", "protocol.https.allow=always", "-c", "protocol.ssh.allow=always", ...localOk() ? ["-c", "protocol.file.allow=always"] : [], "-c", "remote.origin.uploadpack=git-upload-pack", "-c", "core.sshCommand=ssh"];
function run(top, args, timeoutMs, input, cwd = top) {
  const sock = process.env.SSH_AUTH_SOCK;
  const e = { ...env(), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_ASKPASS: "/bin/false", GIT_SSH_COMMAND: "ssh -o BatchMode=yes", ...sock === void 0 ? {} : { SSH_AUTH_SOCK: sock } };
  const r = (0, import_node_child_process4.spawnSync)("git", [...SAFE2, ...args], { cwd, env: e, timeout: timeoutMs, maxBuffer: 64 << 20, input, stdio: [input === void 0 ? "ignore" : "pipe", "pipe", "ignore"] });
  if (r.error !== void 0 || r.status === null) throw new TrellisError("fetch_failed", { remote: "origin" });
  return { status: r.status, stdout: r.stdout };
}
var NO_HELPER = (target) => `origin (it could not be read without your credential helper or keys: use an ssh remote, or check the SHA of ${target} on the host yourself and run with --commit <sha>)`;
function lsRemote(top, url, target, ms) {
  const empty = (0, import_node_fs8.mkdtempSync)((0, import_node_path8.join)((0, import_node_os.tmpdir)(), "trellis-lsremote-"));
  try {
    const ls = run(top, [...transport(), "ls-remote", "--", url, `refs/heads/${target}`], ms, void 0, empty);
    const row = ls.status === 0 ? ls.stdout.toString("utf8").split("\n").map((x) => x.split("	")).find((f) => f[1] === `refs/heads/${target}`) : void 0;
    return row?.[0] ?? "";
  } finally {
    (0, import_node_fs8.rmSync)(empty, { recursive: true, force: true });
  }
}
function resolveTarget(top, target, explicit = null, remoteMs = REMOTE_MS) {
  if (!BRANCH2.test(target) || target.includes("..")) throw new TrellisError("not_installed_v3");
  const replace = run(top, ["for-each-ref", "--format=%(refname)", "refs/replace"], LOCAL_MS).stdout.toString("utf8").trim();
  if (replace !== "") throw new TrellisError("replace_refs_present", { ref: replace.split("\n")[0] });
  const l = run(top, ["rev-parse", "--verify", "--quiet", `refs/heads/${target}^{commit}`], LOCAL_MS);
  const local = l.status === 0 && SHA2.test(l.stdout.toString("utf8").trim()) ? l.stdout.toString("utf8").trim() : null;
  if (explicit !== null && explicit !== local) throw new TrellisError("usage_error", { cmd: "decisions --commit" });
  const url = run(top, ["config", "--local", "--get", "remote.origin.url"], LOCAL_MS).stdout.toString("utf8").trim();
  const urlOk = url !== "" && (REMOTE_URL.test(url) || localOk() && (url.startsWith("/") || url.startsWith("file://")));
  const rewritten = url !== "" && run(top, ["config", "--local", "--get-regexp", "^url\\."], LOCAL_MS).status === 0;
  if (explicit !== null && (!urlOk || rewritten)) return { commit: explicit, source: "person", url: null, why: url === "" ? "no_origin" : "unreadable" };
  if (url === "") throw new TrellisError("fetch_failed", { remote: "origin (none: check the SHA of the target yourself and pass --commit <sha>)" });
  if (!urlOk) throw new TrellisError("fetch_failed", { remote: "origin (its URL is not https://, ssh:// or user@host:path)" });
  if (rewritten) throw new TrellisError("fetch_failed", { remote: "origin (the repository config rewrites URLs with url.<base>.insteadOf)" });
  const sha = lsRemote(top, url, target, remoteMs);
  if (!SHA2.test(sha)) {
    if (explicit !== null) return { commit: explicit, source: "person", url, why: "unreadable" };
    throw new TrellisError("fetch_failed", { remote: NO_HELPER(target) });
  }
  if (explicit !== null && explicit !== sha) throw new TrellisError("target_diverged", { branch: target });
  if (local !== null && local !== sha) throw new TrellisError("target_diverged", { branch: target });
  if (run(top, ["cat-file", "-e", `${sha}^{commit}`], LOCAL_MS).status !== 0) throw new TrellisError("fetch_failed", { remote: "origin (git fetch it first)" });
  return { commit: sha, source: "origin", url, why: null };
}
function readVerified(top, ids) {
  const out = new Map(ids.map((id) => [id, null]));
  if (ids.length === 0) return out;
  const r = run(top, ["cat-file", "--batch"], LOCAL_MS * 3, Buffer.from(`${ids.join("\n")}
`));
  const buf = r.stdout;
  let at = 0;
  while (at < buf.length) {
    const eol = buf.indexOf(10, at);
    if (eol < 0) break;
    const head2 = buf.subarray(at, eol).toString("latin1").split(" ");
    at = eol + 1;
    if (head2.length !== 3) continue;
    const size = Number(head2[2]);
    if (!Number.isInteger(size) || size < 0 || at + size > buf.length) break;
    const bytes = buf.subarray(at, at + size);
    at += size + 1;
    const id = head2[0];
    const sum = (0, import_node_crypto2.createHash)(id.length === 64 ? "sha256" : "sha1").update(`${head2[1]} ${size}\0`).update(bytes).digest("hex");
    if (out.has(id) && sum === id) out.set(id, { type: head2[1], bytes });
  }
  return out;
}
var safeName2 = (path) => /^[\x20-\x7e]{1,100}$/.test(path) ? path : "(unsafe name)";
var MAX_DEPTH = 12;
var MAX_TREES = 5e3;
function treeEntries(bytes, idLen) {
  const out = [];
  let at = 0;
  while (at < bytes.length) {
    const sp = bytes.indexOf(32, at);
    const nul = sp < 0 ? -1 : bytes.indexOf(0, sp);
    if (nul < 0 || nul + 1 + idLen > bytes.length) throw new TrellisError("objects_unsafe", { cause: "hash", detail: "tree entries" });
    out.push({ mode: bytes.subarray(at, sp).toString("latin1"), name: bytes.subarray(sp + 1, nul).toString("utf8"), id: bytes.subarray(nul + 1, nul + 1 + idLen).toString("hex") });
    at = nul + 1 + idLen;
  }
  return out;
}
function listDecisionBlobs(top, commit, opts = {}) {
  if (!SHA2.test(commit)) return [];
  if (run(top, ["cat-file", "-e", commit], LOCAL_MS).status !== 0) return [];
  const bad = (detail) => new TrellisError("objects_unsafe", { cause: "hash", detail });
  const common = run(top, ["rev-parse", "--git-common-dir"], LOCAL_MS).stdout.toString("utf8").trim();
  try {
    (0, import_node_fs8.lstatSync)((0, import_node_path8.join)((0, import_node_path8.isAbsolute)(common) ? common : (0, import_node_path8.join)(top, common), "objects", "info", "alternates"));
    throw new TrellisError("objects_unsafe", { cause: "alternates", detail: "objects/info/alternates" });
  } catch (e) {
    if (e instanceof TrellisError) throw e;
  }
  const idLen = commit.length / 2;
  const tree = (id, what) => {
    const o = readVerified(top, [id]).get(id);
    if (o?.type !== "tree") throw bad(what);
    return o.bytes;
  };
  const c = readVerified(top, [commit]).get(commit);
  const rootId = c?.type === "commit" ? /^tree ([0-9a-f]+)\n/.exec(c.bytes.toString("latin1"))?.[1] : void 0;
  if (rootId === void 0 || rootId.length !== commit.length) throw bad(`commit ${commit}`);
  const child = (entries, name) => entries.find((e) => e.name === name);
  const root = treeEntries(tree(rootId, "tree (root)"), idLen);
  const wf = child(root, "workflow");
  if (wf === void 0 || wf.mode !== "40000") return [];
  const ch = child(treeEntries(tree(wf.id, "tree workflow"), idLen), "changes");
  if (ch === void 0 || ch.mode !== "40000") return [];
  const found = [];
  let level = [{ path: "workflow/changes", id: ch.id }];
  let seen = 0;
  for (let depth = 0; level.length > 0 && depth < MAX_DEPTH; depth += 1) {
    seen += level.length;
    if (seen > MAX_TREES) throw bad("too many trees");
    const read = readVerified(top, level.map((t) => t.id));
    const next = [];
    for (const t of level) {
      const o = read.get(t.id);
      if (o?.type !== "tree") throw bad(`tree ${t.path}`);
      for (const e of treeEntries(o.bytes, idLen)) {
        const path = `${t.path}/${e.name}`;
        if (e.mode === "40000") next.push({ path, id: e.id });
        else if (e.mode !== "160000" && DECISIONS_NAME.test(e.name)) found.push({ mode: e.mode, path, id: e.id });
      }
    }
    level = next;
  }
  const wantBlobs = opts.withBytes !== false;
  const exactIds = found.filter((f) => GLOB_SHAPE.test(f.path)).map((f) => f.id);
  const blobs = wantBlobs ? readVerified(top, [...new Set(exactIds)]) : /* @__PURE__ */ new Map();
  const out = [];
  const none = Buffer.alloc(0);
  for (const f of found) {
    const exact = GLOB_SHAPE.test(f.path);
    const slug = exact ? f.path.split("/")[2] : safeName2(f.path);
    const plain = exact && (f.mode === "100644" || f.mode === "100755") && SLUG2.test(slug);
    const item = (bytes, invalid) => ({ slug: exact && !SLUG2.test(slug) ? safeName2(slug) : slug, path: f.path, blob: f.id, bytes, invalid });
    if (!plain) out.push(item(none, "not_plain_file"));
    else if (!wantBlobs) out.push(item(none, null));
    else if (opts.deadline !== void 0 && Date.now() >= opts.deadline) break;
    else {
      const o = blobs.get(f.id);
      out.push(o?.type === "blob" ? item(o.bytes, null) : item(none, "hash_mismatch"));
    }
  }
  return out.sort((x, y) => x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0);
}
var savedPath = (home, repoId) => (0, import_node_path8.join)(home, ".trellis-flow", repoId, "spectex-saved.json");
function readState(home, repoId) {
  const ids = (v) => new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  try {
    if (!(0, import_node_fs8.lstatSync)(savedPath(home, repoId)).isFile()) return { saved: /* @__PURE__ */ new Set(), rejected: /* @__PURE__ */ new Set() };
    const j = JSON.parse((0, import_node_fs8.readFileSync)(savedPath(home, repoId), "utf8"));
    return { saved: ids(j.blobs), rejected: ids(j.rejected) };
  } catch {
    return { saved: /* @__PURE__ */ new Set(), rejected: /* @__PURE__ */ new Set() };
  }
}
function readSaved(home, repoId) {
  const s = readState(home, repoId);
  return /* @__PURE__ */ new Set([...s.saved, ...s.rejected]);
}

// src/installer/paths.ts
var import_node_fs9 = require("node:fs");
var import_node_os2 = require("node:os");
function realHome(env2) {
  const home = env2.HOME !== void 0 && env2.HOME.startsWith("/") ? env2.HOME : (0, import_node_os2.homedir)();
  try {
    return (0, import_node_fs9.realpathSync)(home);
  } catch {
    return home;
  }
}

// src/hook/spectex.ts
var BUDGET_MS = 1500;
var NUMBER_KEYS = ["commits_behind", "behind", "stale_commits"];
function behindOf(j, depth = 0) {
  if (typeof j !== "object" || j === null || Array.isArray(j) || depth > 1) return null;
  const o = j;
  for (const k of NUMBER_KEYS) if (typeof o[k] === "number" && Number.isInteger(o[k]) && o[k] > 0) return o[k];
  for (const v of Object.values(o)) {
    const n = behindOf(v, depth + 1);
    if (n !== null) return n;
  }
  return null;
}
function spectexLines(top) {
  const start = Date.now();
  try {
    const home = realHome(process.env);
    const run2 = makeRunSpectex({ PATH: process.env.PATH, HOME: home }, spectexRoots(top));
    const st = run2(["--root", top, "status", "--json"], null, BUDGET_MS);
    if (st.missing || st.timedOut) return [];
    const lines = [];
    let behind = null;
    try {
      behind = st.status === 0 ? behindOf(JSON.parse(st.stdout)) : null;
    } catch {
      behind = null;
    }
    if (behind !== null) lines.push(`spectex: index stale (${behind} commits behind)`);
    try {
      const target = targetOf(top, home);
      const left = () => BUDGET_MS - (Date.now() - start);
      const commit = target === null || left() <= 0 ? null : resolveTarget(top, target, null, left()).commit;
      if (commit !== null && left() > 0) {
        const saved = readSaved(home, repoIdOf(top));
        const unsaved = listDecisionBlobs(top, commit, { withBytes: false, deadline: start + BUDGET_MS }).filter((b) => b.invalid === null && !saved.has(b.blob)).length;
        if (unsaved > 0 && left() > 0) lines.push(`spectex: ${unsaved} merged decisions not saved; a person runs, from outside this repository: ${personCmd("decisions", top)}`);
      }
    } catch {
    }
    return lines;
  } catch {
    return [];
  }
}

// src/hook/session.ts
function sessionStart(payload, gh = realGh) {
  try {
    const top = enclosingTrees(workDirs(payload)[0])[0];
    if (top === void 0 || installKind(top) === "none") return { exit: 0 };
    const { line, next } = describe(readFacts(top, gh));
    let extra = [];
    try {
      extra = spectexLines(top);
    } catch {
    }
    const context = [line, ...next === null ? [] : [next], ...extra].join("\n");
    return { exit: 0, stdout: `${JSON.stringify({ systemMessage: [line, ...extra].join("\n"), hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })}
` };
  } catch {
    return { exit: 0, stderr: "[hook_internal] SessionStart\n" };
  }
}

// src/cli/lang.ts
var import_node_fs10 = require("node:fs");
var import_node_path9 = require("node:path");
var HEAD_BYTES = 64 * 1024;
function head(path) {
  let fd;
  try {
    fd = (0, import_node_fs10.openSync)(path, "r");
  } catch {
    return null;
  }
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    return buf.subarray(0, (0, import_node_fs10.readSync)(fd, buf, 0, HEAD_BYTES, 0)).toString("utf8");
  } catch {
    return null;
  } finally {
    (0, import_node_fs10.closeSync)(fd);
  }
}
function repoYamlHead(cwd) {
  for (let d = cwd; ; d = (0, import_node_path9.dirname)(d)) {
    if ((0, import_node_fs10.existsSync)((0, import_node_path9.join)(d, ".git"))) return head((0, import_node_path9.join)(d, "workflow", "trellis.yaml"));
    if ((0, import_node_path9.dirname)(d) === d) return null;
  }
}
function repoLanguage(cwd) {
  const text = repoYamlHead(cwd);
  const m = text === null ? null : /^language:[ \t]*["']?(vi|en)["']?[ \t]*(#.*)?\r?$/m.exec(text);
  return m === null ? null : m[1];
}

// src/core/lang.ts
function detectLang(env2) {
  const locale = env2.LC_ALL || env2.LC_MESSAGES || env2.LANG || "";
  return locale.toLowerCase().startsWith("vi") ? "vi" : "en";
}

// src/hook/notify.ts
var import_node_child_process5 = require("node:child_process");
var import_node_fs11 = require("node:fs");
var import_node_path10 = require("node:path");

// src/core/notify.ts
var NOTIFY_TYPES = ["permission_prompt", "worker_permission_prompt", "elicitation_dialog", "elicitation_url_dialog", "agent_needs_input"];
var NOTIFY_TEXT = {
  permission_prompt: { vi: "đang chờ bạn cho phép", en: "waiting for your permission" },
  worker_permission_prompt: { vi: "một worker đang chờ bạn cho phép", en: "a worker is waiting for your permission" },
  elicitation_dialog: { vi: "đang chờ bạn trả lời", en: "waiting for your answer" },
  elicitation_url_dialog: { vi: "đang chờ bạn mở một liên kết", en: "waiting for you to open a link" },
  agent_needs_input: { vi: "đang chờ bạn nhập", en: "waiting for your input" }
};

// src/hook/notify.ts
var OSASCRIPT_TIMEOUT_MS = 2e3;
var NAME_MAX = 40;
var TITLE = "trellis";
var OSASCRIPT = "/usr/bin/osascript";
var OSC_TERMINALS = ["ghostty", "kitty", "iTerm.app", "WezTerm"];
var realDeps = (env2) => ({
  platform: process.platform,
  env: env2,
  exists: import_node_fs11.existsSync,
  spawn: (cmd, args, opts) => (0, import_node_child_process5.spawnSync)(cmd, [...args], { timeout: opts.timeout, stdio: "ignore" })
});
function desktopEnabled(selfDir) {
  const text = repoYamlHead(selfDir);
  const m = text === null ? null : /^notifications:[ \t]*(?:\{[^}\n]*\bdesktop:[ \t]*["']?(true|false)["']?|(?:[ \t]*#[^\n]*)?\r?\n[ \t]+desktop:[ \t]*["']?(true|false)["']?)/m.exec(text);
  return (m?.[1] ?? m?.[2]) !== "false";
}
function notify(payload, selfDir, deps = realDeps(process.env)) {
  const type = typeof payload === "object" && payload !== null ? payload.notification_type : void 0;
  if (typeof type !== "string" || !NOTIFY_TYPES.includes(type)) return { exit: 0 };
  if (!desktopEnabled(selfDir)) return { exit: 0 };
  const repo = (0, import_node_path10.basename)((0, import_node_path10.resolve)(selfDir, "..", "..")).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, NAME_MAX) || "repo";
  const body = `${repo}: ${NOTIFY_TEXT[type][repoLanguage(selfDir) ?? detectLang(deps.env)]}`;
  if (deps.platform === "darwin" && !OSC_TERMINALS.includes(deps.env.TERM_PROGRAM ?? "") && deps.exists(OSASCRIPT)) {
    try {
      deps.spawn(OSASCRIPT, ["-e", "on run argv", "-e", "display notification (item 2 of argv) with title (item 1 of argv)", "-e", "end run", TITLE, body], { timeout: OSASCRIPT_TIMEOUT_MS });
    } catch {
    }
  }
  return { exit: 0, stdout: `${JSON.stringify({ terminalSequence: `\x1B]777;notify;${TITLE};${body}\x07` })}
` };
}

// src/hook/worktree.ts
function worktreeCreate(lang) {
  const r = render("worktree_refused", {}, lang());
  return { exit: 2, stderr: `[${r.code}] ${r.message} ${r.hint}
` };
}

// src/hook/main.ts
var parse = (stdin) => {
  try {
    return JSON.parse(stdin);
  } catch {
    return null;
  }
};
var homeOf = (io) => typeof io.env.HOME === "string" && (0, import_node_path11.isAbsolute)(io.env.HOME) ? io.env.HOME : (0, import_node_os3.homedir)();
function runHook(io) {
  const payload = io.event === "PreToolUse" ? parse(io.stdin) : io.event === "SessionStart" ? parse(io.stdin) : null;
  const dirs = workDirs(payload);
  switch (io.event) {
    case "PreToolUse":
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return { exit: 2, stderr: "[hook_internal] PreToolUse payload is not JSON; every tool stays blocked.\n" };
      return checkDrift(dirs, homeOf(io));
    case "SessionStart":
      return sessionStart(payload);
    case "Notification":
      try {
        return notify(parse(io.stdin), io.selfDir, realDeps(io.env));
      } catch {
        return { exit: 0 };
      }
    case "WorktreeCreate":
      return worktreeCreate(() => repoLanguage(io.selfDir) ?? detectLang(io.env));
    default:
      return { exit: 0 };
  }
}

// src/hook/bin.ts
var event = process.argv[2];
var code;
try {
  let stdin = "";
  try {
    stdin = (0, import_node_fs12.readFileSync)(0, "utf8");
  } catch {
  }
  const r = runHook({ event, stdin, env: process.env, selfDir: __dirname });
  if (r.stdout !== void 0) process.stdout.write(r.stdout);
  if (r.stderr !== void 0) process.stderr.write(r.stderr);
  code = r.exit;
} catch (e) {
  process.stderr.write(`[hook_internal] ${e instanceof Error ? e.message : String(e)}
`);
  code = event === "PreToolUse" || event === "WorktreeCreate" ? 2 : 0;
}
process.exitCode = code;
