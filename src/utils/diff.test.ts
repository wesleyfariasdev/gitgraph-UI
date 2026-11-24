import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./diff";

describe("parseUnifiedDiff", () => {
  it("numbers added, removed and context lines per hunk", () => {
    // Arrange
    const raw = [
      "diff --git a/f.txt b/f.txt",
      "index 1..2 100644",
      "--- a/f.txt",
      "+++ b/f.txt",
      "@@ -10,3 +10,3 @@ fn main()",
      " keep",
      "-old",
      "+new",
      " tail",
      "\\ No newline at end of file",
    ].join("\n");

    // Act
    const diff = parseUnifiedDiff(raw);

    // Assert
    expect(diff.hunks).toHaveLength(1);
    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    const [keep, del, add, tail, meta] = diff.hunks[0].lines;
    expect(keep).toMatchObject({ type: "context", oldNumber: 10, newNumber: 10 });
    expect(del).toMatchObject({ type: "del", text: "old", oldNumber: 11, newNumber: null });
    expect(add).toMatchObject({ type: "add", text: "new", oldNumber: null, newNumber: 11 });
    expect(tail).toMatchObject({ oldNumber: 12, newNumber: 12 });
    expect(meta.type).toBe("meta");
  });

  it("flags binary files", () => {
    const diff = parseUnifiedDiff("diff --git a/x.png b/x.png\nBinary files a/x.png and b/x.png differ\n");

    expect(diff.isBinary).toBe(true);
    expect(diff.hunks).toHaveLength(0);
  });
});
