import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { aboutSchema, DEFAULT_ABOUT, readAboutContent } from "@/lib/content/about";
import { moveTeamMember, readTeam, saveTeamMember } from "@/lib/content/team";
import { resetDatabase } from "../support/db";

beforeEach(resetDatabase);

describe("About page content", () => {
  it("keeps About text saved before vision and years of experience existed", async () => {
    const { vision: _v, yearsExperience: _y, ...older } = { ...DEFAULT_ABOUT, ownerName: "Aqib" };
    await prisma.siteContent.create({ data: { key: "about", value: older } });
    expect(await readAboutContent()).toMatchObject({ ownerName: "Aqib", vision: "", yearsExperience: "" });
    expect(aboutSchema.parse({ ...older, vision: "Be the best", yearsExperience: "10+" })).toMatchObject({ yearsExperience: "10+" });
  });
});

describe("team members", () => {
  it("adds, updates, hides and reorders members without removing anyone", async () => {
    const a = await saveTeamMember({ name: "Ali Raza", designation: "Designer", photoUrl: "", isVisible: true });
    const b = await saveTeamMember({ name: "Sara Khan", designation: "Sales", photoUrl: "", isVisible: true });
    await saveTeamMember({ id: a.id, name: "Ali Raza", designation: "Senior Designer", photoUrl: "", isVisible: false });
    await moveTeamMember(b.id, "up");

    const team = await readTeam();
    expect(team.map((m) => m.name)).toEqual(["Sara Khan", "Ali Raza"]);
    expect(team[1]).toMatchObject({ designation: "Senior Designer", isVisible: false });
  });
});
