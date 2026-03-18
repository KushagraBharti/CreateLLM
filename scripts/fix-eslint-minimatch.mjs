import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const minimatchShim = `'use strict';
function escapeRegex(value) {
  return value.replace(/[|\\\\{}()[\\]^$+?.]/g, '\\\\$&');
}

function globToRegExp(pattern) {
  const normalized = String(pattern || '').replace(/\\\\/g, '/');
  let source = '^';

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '*' && next === '*') {
      source += '.*';
      i += 1;
      continue;
    }

    if (char === '*') {
      source += '[^/]*';
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += escapeRegex(char);
  }

  source += '$';
  return new RegExp(source);
}

class Minimatch {
  constructor(pattern, options) {
    this.pattern = pattern;
    this.options = options || {};
    this.regexp = globToRegExp(pattern);
    this.set = [[pattern]];
  }

  makeRe() {
    return this.regexp;
  }

  match(input) {
    const candidate = String(input || '').replace(/\\\\/g, '/');
    return this.regexp.test(candidate);
  }
}

function minimatch(input, pattern, options) {
  return new Minimatch(pattern, options).match(input);
}

minimatch.Minimatch = Minimatch;
minimatch.filter = function filter(pattern, options) {
  return (input) => minimatch(input, pattern, options);
};
minimatch.makeRe = function makeRe(pattern, options) {
  return new Minimatch(pattern, options).makeRe();
};
minimatch.braceExpand = function braceExpand(pattern) {
  return [pattern];
};
minimatch.defaults = function defaults(defaultOptions) {
  return function configuredMinimatch(input, pattern, options) {
    return minimatch(input, pattern, { ...defaultOptions, ...options });
  };
};

module.exports = minimatch;
`;

async function walk(directory, matches = []) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return matches;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "minimatch" && fullPath.includes("node_modules")) {
        matches.push(fullPath);
      }
      await walk(fullPath, matches);
    }
  }

  return matches;
}

async function ensureShim(directory) {
  const target = path.join(directory, "minimatch.js");
  await mkdir(directory, { recursive: true });
  await writeFile(target, minimatchShim, "utf8");
}

const matches = await walk(path.join(process.cwd(), "node_modules"));
await Promise.all(matches.map(ensureShim));
