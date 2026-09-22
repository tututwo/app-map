import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("publishes eligible files, retries uploads and fails on invalid inputs or commands", () => {
  const root = mkdtempSync(join(tmpdir(), "publish-metrics-"));
  const bin = join(root, "node_modules/.bin");
  const tiles = join(root, "static/tiles");
  const log = join(root, "uploads.log");
  const executable = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
  try {
    for (const path of [bin, join(root, "scripts"), join(tiles, "metrics"), join(tiles, "empty")])
      mkdirSync(path, { recursive: true });
    copyFileSync("scripts/publish-metrics.sh", join(root, "scripts/publish-metrics.sh"));
    writeFileSync(join(tiles, "metrics/rows.bin"), "row");
    writeFileSync(join(tiles, "metrics/a file.gz"), "matrix");
    writeFileSync(join(tiles, "metrics/ignore.txt"), "ignored");
    executable("sleep", "exit 0");
    executable(
      "wrangler",
      'printf "%s\\n" "$4" >> "$MOCK_LOG"\n' +
        'case "$MOCK_MODE" in fail) exit 1 ;; retry) [ "$(wc -l < "$MOCK_LOG")" -gt 2 ] ;; esac'
    );
    const run = (dir: string | string[], mode = "ok") => {
      writeFileSync(log, "");
      return spawnSync("bash", [join(root, "scripts/publish-metrics.sh"), ...[dir].flat()], {
        encoding: "utf8",
        env: { ...process.env, MOCK_LOG: log, MOCK_MODE: mode },
      });
    };
    expect(run("missing").status).toBe(1);
    expect(run("empty").status).toBe(1);
    if (process.getuid?.() !== 0) {
      chmodSync(join(tiles, "metrics"), 0);
      const unreadable = run("metrics");
      chmodSync(join(tiles, "metrics"), 0o755);
      expect(unreadable.status).toBe(1);
      expect(unreadable.stderr).toContain("Cannot read input directory");
    }
    expect(readFileSync(log, "utf8")).toBe("");

    expect(run("metrics").status).toBe(0);
    expect(readFileSync(log, "utf8").trim().split("\n").sort()).toEqual([
      "worship-closures-tiles/metrics/a file.gz",
      "worship-closures-tiles/metrics/rows.bin",
    ]);
    mkdirSync(join(tiles, "sdoh"));
    writeFileSync(join(tiles, "sdoh/us.json.gz"), "context");
    writeFileSync(join(tiles, "metrics/geoids.json.gz"), "index");
    rmSync(join(tiles, "metrics/rows.bin"));
    const incomplete = run(["sdoh", "metrics"]);
    expect(incomplete.status).toBe(1);
    expect(incomplete.stderr).toContain("Missing rows.bin");
    expect(readFileSync(log, "utf8")).toBe("");
    writeFileSync(join(tiles, "metrics/rows.bin"), "row");
    expect(run(["sdoh", "metrics"]).status).toBe(0);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(4);
    rmSync(join(tiles, "metrics/geoids.json.gz"));
    rmSync(join(tiles, "metrics/a file.gz"));
    expect(run("metrics", "retry").status).toBe(0);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(3);
    expect(run("metrics", "fail").status).toBe(1);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(4);

    for (const command of ["find", "xargs"]) {
      executable(command, "exit 2");
      expect(run("metrics").status).not.toBe(0);
      expect(readFileSync(log, "utf8")).toBe("");
      rmSync(join(bin, command));
    }
    rmSync(tiles, { recursive: true });
    expect(run("metrics").status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
