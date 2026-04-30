import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const templateDir = path.join(process.cwd(), "supabase", "templates");

async function readTemplate(name: "invite" | "recovery") {
  return readFile(path.join(templateDir, `${name}.html`), "utf8");
}

describe("Supabase auth email templates", () => {
  it("keeps invite and recovery CTAs on the token-hash callback contract", async () => {
    const [invite, recovery] = await Promise.all([
      readTemplate("invite"),
      readTemplate("recovery"),
    ]);

    expect(invite).toContain(
      "{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=invite",
    );
    expect(recovery).toContain(
      "{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery",
    );
    expect(invite).not.toContain("{{ .ConfirmationURL }}");
    expect(recovery).not.toContain("{{ .ConfirmationURL }}");
  });

  it("uses the shared application branding tokens in both templates", async () => {
    const templates = await Promise.all([
      readTemplate("invite"),
      readTemplate("recovery"),
    ]);

    for (const template of templates) {
      expect(template).toContain("https://data.accelerateglobal.org/ag-logo.svg");
      expect(template).toContain("alt=\"Accelerate Global\"");
      expect(template).toContain("padding: 30px 68px 82px");
      expect(template).toContain("padding-left: 220px");
      expect(template).toContain("background: #f7f6ef");
      expect(template).toContain("background: #262531");
      expect(template).toContain("color: #f7f6ef");
      expect(template).toContain("background: #181720");
      expect(template).toContain("color: #f5f1e8");
      expect(template).toContain("rgba(245, 241, 232, 0.72)");
      expect(template).toContain("border-radius: 6px");
    }
  });

  it("does not use the old centered marketing-card layout", async () => {
    const templates = await Promise.all([
      readTemplate("invite"),
      readTemplate("recovery"),
    ]);

    for (const template of templates) {
      expect(template).not.toContain("box-shadow");
      expect(template).not.toContain("radial-gradient");
      expect(template).not.toContain("background: #fbfaf6");
      expect(template).not.toContain("background: #cad3b8; line-height: 6px");
      expect(template).not.toContain("border-radius: 10px");
      expect(template).not.toContain("letter-spacing: 0.12em");
      expect(template).not.toContain("{{ .Email }}");
    }
  });

  it("does not render the removed recovery site-url footer", async () => {
    const recovery = await readTemplate("recovery");

    expect(recovery).not.toContain(
      "This link will open the password reset flow",
    );
    expect(recovery).not.toContain("{{ .SiteURL }}");
  });
});
