#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DOCS_ROOT = path.resolve('docs');
const API_DIR = path.join(DOCS_ROOT, 'api');

function transformLinks(content) {
  const linkPattern = /\[([^\]]+)\]\(((?:\.\.?\/)[^)]+?)\.md\)/g;
  return content.replaceAll(linkPattern, (_match, label, rawTarget) => {
    let target = rawTarget;
    if (target === './index') {
      target = '../index';
    }
    return `<a href="${target}.html">${label}</a>`;
  });
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full);
    } else if (stats.isFile() && entry.endsWith('.md')) {
      const original = readFileSync(full, 'utf8');
      const updated = transformLinks(original);
      if (updated !== original) {
        writeFileSync(full, updated, 'utf8');
      }
    }
  }
}

walk(API_DIR);
