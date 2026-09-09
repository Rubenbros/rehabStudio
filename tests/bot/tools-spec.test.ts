import { describe, expect, it } from "vitest";
import { toToolSpecs, toolsFor } from "@/lib/bot/tools";

describe("toToolSpecs", () => {
  it("mapea cada herramienta al formato de function calling que consume el adaptador", () => {
    const specs = toToolSpecs(toolsFor("patient"));

    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) {
      expect(spec.type).toBe("function");
      expect(typeof spec.function.name).toBe("string");
      expect(spec.function.name).not.toBe("");
      expect(typeof spec.function.description).toBe("string");
      // Gemini exige que `parameters` sea un JSON Schema de tipo object.
      expect(spec.function.parameters).toMatchObject({ type: "object" });
    }
  });

  it("no expone las herramientas de owner al paciente", () => {
    const patientNames = toToolSpecs(toolsFor("patient")).map((s) => s.function.name);
    const ownerNames = toToolSpecs(toolsFor("owner")).map((s) => s.function.name);

    expect(ownerNames).toContain("set_working_hours");
    expect(patientNames).not.toContain("set_working_hours");
  });
});
