import Image from "next/image";
import Link from "next/link";
import { saveAboutAction, saveTeamMemberAction, teamCommandAction } from "@/app/admin/site-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { DEFAULT_ABOUT, getAboutContent } from "@/lib/content/about";
import { readTeam, type TeamMember } from "@/lib/content/team";

export const metadata = { title: "About page" };

export default async function AdminAboutPage() {
  await requireStaff(["ADMIN"]);
  const [about, team] = await Promise.all([getAboutContent(), readTeam()]);
  const isPlaceholder = about.ownerName === DEFAULT_ABOUT.ownerName;
  const rows = [...about.highlights, ...Array.from({ length: Math.max(0, 6 - about.highlights.length) }, () => ({ title: "", text: "" }))];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">About page</h1>
        <Link href="/about" target="_blank" className="text-sm font-semibold text-brand">
          View page ↗
        </Link>
      </div>
      {isPlaceholder && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          The About page is showing placeholder text. Replace the CEO details and story below.
        </p>
      )}
      <ActionForm action={saveAboutAction} className="mt-6 space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">Company</h2>
          <label className="block">
            <span className="label">Our story</span>
            <textarea name="story" rows={6} className="input" defaultValue={about.story} maxLength={4000} />
          </label>
          <label className="block">
            <span className="label">Our mission</span>
            <textarea name="mission" rows={2} className="input" defaultValue={about.mission} maxLength={1000} />
          </label>
          <label className="block">
            <span className="label">Our vision</span>
            <textarea name="vision" rows={2} className="input" defaultValue={about.vision} maxLength={1000} />
          </label>
          <label className="block max-w-xs">
            <span className="label">Years of experience</span>
            <input name="yearsExperience" className="input" defaultValue={about.yearsExperience} maxLength={20} placeholder="e.g. 10+" />
            <span className="mt-1 block text-xs text-muted">Leave empty to hide it.</span>
          </label>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">CEO</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">CEO name</span>
              <input name="ownerName" className="input" defaultValue={about.ownerName} />
            </label>
            <label className="block">
              <span className="label">Designation</span>
              <input name="ownerTitle" className="input" defaultValue={about.ownerTitle} />
            </label>
          </div>
          <label className="block">
            <span className="label">Message from the CEO</span>
            <textarea name="ownerBio" rows={3} className="input" defaultValue={about.ownerBio} maxLength={1500} />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            {about.ownerPhotoUrl && (
              <span className="relative h-20 w-20 overflow-hidden rounded-full ring-1 ring-border">
                <Image src={about.ownerPhotoUrl} alt="" fill sizes="80px" className="object-cover" />
              </span>
            )}
            <label className="block">
              <span className="label">CEO photo (JPG, PNG or WebP, up to 4 MB)</span>
              <input type="file" name="ownerPhoto" accept="image/jpeg,image/png,image/webp" className="text-sm" />
            </label>
            {about.ownerPhotoUrl && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="removePhoto" /> Remove photo
              </label>
            )}
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-lg font-bold">Why choose us</h2>
          <p className="text-sm text-muted">Up to 6 highlights. Leave a row empty to remove it.</p>
          {rows.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <input name="highlightTitle" className="input" defaultValue={h.title} placeholder="Title" aria-label={`Highlight ${i + 1} title`} />
              <input name="highlightText" className="input" defaultValue={h.text} placeholder="Description" aria-label={`Highlight ${i + 1} text`} />
            </div>
          ))}
        </section>

        <SubmitButton className="btn-primary">Save About page</SubmitButton>
      </ActionForm>

      <section className="mt-10" aria-labelledby="team-heading">
        <h2 id="team-heading" className="text-xl font-bold">
          Team
        </h2>
        <p className="mt-1 text-sm text-muted">Shown as a grid on the About page. Hide a member instead of deleting them.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {team.map((m, i) => (
            <TeamMemberForm key={m.id} member={m} first={i === 0} last={i === team.length - 1} />
          ))}
          <TeamMemberForm />
        </div>
      </section>
    </>
  );
}

function TeamMemberForm({ member, first, last }: { member?: TeamMember; first?: boolean; last?: boolean }) {
  return (
    <div className="card space-y-3 p-5" data-testid="admin-team-member">
      <ActionForm action={saveTeamMemberAction} className="space-y-3">
        <h3 className="font-bold">{member ? member.name : "Add a team member"}</h3>
        {member && <input type="hidden" name="id" value={member.id} />}
        <div className="flex items-center gap-4">
          {member?.photoUrl ? (
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
              <Image src={member.photoUrl} alt="" fill sizes="64px" className="object-cover" />
            </span>
          ) : (
            <span className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-brand/30 to-accent/30" aria-hidden />
          )}
          <label className="block text-sm">
            <span className="label">Photo</span>
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="text-sm" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Name</span>
            <input name="name" className="input" defaultValue={member?.name} maxLength={80} />
          </label>
          <label className="block">
            <span className="label">Designation</span>
            <input name="designation" className="input" defaultValue={member?.designation} maxLength={80} />
          </label>
        </div>
        {member && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isVisible" defaultChecked={member.isVisible} /> Show on the About page
          </label>
        )}
        <SubmitButton className="btn-primary">{member ? "Save" : "Add team member"}</SubmitButton>
      </ActionForm>
      {member && (
        <div className="flex gap-2 text-sm">
          {!first && (
            <ActionForm action={teamCommandAction}>
              <input type="hidden" name="id" value={member.id} />
              <SubmitButton name="command" value="up">
                ↑ Move up
              </SubmitButton>
            </ActionForm>
          )}
          {!last && (
            <ActionForm action={teamCommandAction}>
              <input type="hidden" name="id" value={member.id} />
              <SubmitButton name="command" value="down">
                ↓ Move down
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      )}
    </div>
  );
}
