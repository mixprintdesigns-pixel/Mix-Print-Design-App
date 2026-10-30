import "server-only";
import { randomBytes } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CONTENT_TAG } from "./about";

// Team members shown on the About page. Managed in Admin → About page → Team; hidden instead of deleted.

export const teamMemberSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(2, "Enter the team member's name.").max(80),
  designation: z.string().trim().max(80),
  photoUrl: z.string().trim().max(500),
  isVisible: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

const KEY = "team";

export async function readTeam(): Promise<TeamMember[]> {
  const row = await prisma.siteContent.findUnique({ where: { key: KEY } });
  const parsed = z.array(teamMemberSchema).safeParse(row?.value ?? []);
  return (parsed.success ? parsed.data : []).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Visible team members, for the About page. */
export async function getVisibleTeam(): Promise<TeamMember[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  return (await readTeam()).filter((m) => m.isVisible);
}

/** Adds a member (no id) or updates an existing one. Members are never removed, only hidden. */
export async function saveTeamMember(member: Omit<TeamMember, "id" | "sortOrder"> & { id?: string }): Promise<TeamMember> {
  const team = await readTeam();
  const existing = member.id ? team.find((m) => m.id === member.id) : undefined;
  const saved: TeamMember = existing
    ? { ...existing, ...member, id: existing.id }
    : { ...member, id: randomBytes(8).toString("hex"), sortOrder: team.length };
  const next = existing ? team.map((m) => (m.id === saved.id ? saved : m)) : [...team, saved];
  await prisma.siteContent.upsert({ where: { key: KEY }, create: { key: KEY, value: next }, update: { value: next } });
  return saved;
}

export async function moveTeamMember(id: string, direction: "up" | "down"): Promise<void> {
  const team = await readTeam();
  const from = team.findIndex((m) => m.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= team.length) return;
  [team[from], team[to]] = [team[to], team[from]];
  const next = team.map((m, i) => ({ ...m, sortOrder: i }));
  await prisma.siteContent.update({ where: { key: KEY }, data: { value: next } });
}
