import { describe, it, expect } from "vitest";
import {
  validateJson,
  validateYaml,
  validateTypeScript,
  validatePython,
  dispatchValidator,
} from "../staticValidators";

describe("validateJson", () => {
  it("accepts valid object", () => {
    expect(validateJson('{"a": 1, "b": [2, 3]}').ok).toBe(true);
  });

  it("accepts valid array", () => {
    expect(validateJson('[1, 2, 3]').ok).toBe(true);
  });

  it("rejects unbalanced braces with line number", () => {
    const r = validateJson('{"a": 1, "b": 2');
    expect(r.ok).toBe(false);
    expect(r.failures[0].kind).toBe("json_parse_error");
  });

  it("rejects empty file", () => {
    const r = validateJson("");
    expect(r.ok).toBe(false);
    expect(r.failures[0].kind).toBe("empty_file");
  });

  it("rejects trailing comma (strict JSON)", () => {
    expect(validateJson('{"a": 1,}').ok).toBe(false);
  });
});

describe("validateYaml — structural", () => {
  it("accepts clean YAML", () => {
    const r = validateYaml("name: foo\nversion: 1.0\nnested:\n  key: value");
    expect(r.ok).toBe(true);
  });

  it("rejects tab in indentation", () => {
    const r = validateYaml("a:\n\tb: c");
    expect(r.ok).toBe(false);
    expect(r.failures[0].kind).toBe("yaml_structure_error");
    expect(r.failures[0].message).toContain("tab");
  });

  it("rejects duplicate top-level keys", () => {
    const r = validateYaml("foo: 1\nbar: 2\nfoo: 3");
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.message.includes("Duplicate"))).toBe(true);
  });

  it("ignores blank lines + comments", () => {
    const r = validateYaml("# a comment\n\nname: foo\n\n# another\nversion: 1\n");
    expect(r.ok).toBe(true);
  });

  it("rejects empty file", () => {
    expect(validateYaml("").ok).toBe(false);
  });
});

describe("validateTypeScript", () => {
  it("accepts a balanced function", () => {
    const code = "function f() { return 1; }";
    expect(validateTypeScript(code).ok).toBe(true);
  });

  it("rejects unbalanced braces", () => {
    const r = validateTypeScript("function f() { return 1;");
    expect(r.ok).toBe(false);
    expect(r.failures[0].kind).toBe("unbalanced_braces");
  });

  it("rejects unbalanced parens", () => {
    const r = validateTypeScript("function f(arg { return 1; }");
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.kind === "unbalanced_parens")).toBe(true);
  });

  it("rejects unterminated single-quote string", () => {
    const r = validateTypeScript("const x = 'unterminated;");
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.kind === "unbalanced_quotes")).toBe(true);
  });

  it("rejects unterminated template literal", () => {
    const r = validateTypeScript("const x = `unterminated");
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.kind === "unbalanced_quotes")).toBe(true);
  });

  it("rejects unterminated /* */ block comment", () => {
    const r = validateTypeScript("/* unterminated");
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.message.includes("block comment"))).toBe(true);
  });

  it("accepts braces inside strings (string parser working)", () => {
    expect(validateTypeScript('const x = "{ ( [ ";').ok).toBe(true);
  });

  it("accepts braces inside line comment", () => {
    expect(validateTypeScript("// { ( [\nconst x = 1;").ok).toBe(true);
  });

  it("accepts braces inside block comment", () => {
    expect(validateTypeScript("/* { ( [ */\nconst x = 1;").ok).toBe(true);
  });

  it("accepts template literal interpolation", () => {
    expect(validateTypeScript("const x = `${1 + 1}`;").ok).toBe(true);
  });

  it("accepts a real-ish TS module", () => {
    const code = `
      import { foo } from "./foo";
      export function bar(x: number): string {
        if (x > 0) {
          return \`positive: \${x}\`;
        }
        return "non-positive";
      }
    `;
    expect(validateTypeScript(code).ok).toBe(true);
  });
});

describe("validatePython", () => {
  it("accepts clean Python", () => {
    const code = "def hello():\n    return 1\n";
    expect(validatePython(code).ok).toBe(true);
  });

  it("rejects mixed tabs+spaces in indent", () => {
    const code = "def hello():\n \treturn 1\n";  // space + tab
    const r = validatePython(code);
    expect(r.ok).toBe(false);
    expect(r.failures[0].kind).toBe("python_indent_error");
  });

  it("rejects empty file", () => {
    expect(validatePython("").ok).toBe(false);
  });
});

describe("dispatchValidator", () => {
  it(".json → validateJson", () => {
    const fn = dispatchValidator("foo.json");
    expect(fn).not.toBeNull();
    expect(fn!('{"a":1}').ok).toBe(true);
  });

  it(".yaml + .yml → validateYaml", () => {
    expect(dispatchValidator("foo.yaml")).not.toBeNull();
    expect(dispatchValidator("foo.yml")).not.toBeNull();
  });

  it(".ts + .tsx → validateTypeScript", () => {
    expect(dispatchValidator("a.ts")).not.toBeNull();
    expect(dispatchValidator("a.tsx")).not.toBeNull();
  });

  it(".js / .mjs / .cjs / .jsx", () => {
    for (const ext of ["a.js", "a.mjs", "a.cjs", "a.jsx"]) {
      expect(dispatchValidator(ext)).not.toBeNull();
    }
  });

  it(".py → validatePython", () => {
    expect(dispatchValidator("a.py")).not.toBeNull();
  });

  it("unknown ext → null (skipped)", () => {
    expect(dispatchValidator("README.md")).toBeNull();
    expect(dispatchValidator("foo.bin")).toBeNull();
    expect(dispatchValidator("Makefile")).toBeNull();
  });

  it("case-insensitive extension matching", () => {
    expect(dispatchValidator("Foo.JSON")).not.toBeNull();
    expect(dispatchValidator("Bar.TSX")).not.toBeNull();
  });
});
