import { Link } from "react-router-dom";
import { Camera, Pencil } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";

interface ProfileHeroProps {
  name: string;
  email?: string;
  phone?: string;
  /** Uploaded photo (data URL); initials are shown when there is none. */
  avatarUrl?: string;
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

/** Mobile profile header: one flat light lavender card with the animated avatar ring, name, contact lines and Edit profile. */
export default function ProfileHero({ name, email, phone, avatarUrl }: ProfileHeroProps) {
  const contact = [email, phone].filter(Boolean);
  return (
    <section
      aria-labelledby="profile-name"
      className="profile-rise relative overflow-hidden rounded-[28px] border border-[#D9DCF7] bg-[#E9EBFF] p-5 text-ink md:hidden"
    >
      <div className="relative flex items-center gap-4">
        <div className="relative shrink-0">
          <span className="profile-avatar-ring relative flex h-[72px] w-[72px] items-center justify-center rounded-full" aria-hidden="true">
            <span className="relative z-[1] flex h-[66px] w-[66px] items-center justify-center rounded-full border-[3px] border-white bg-brand text-2xl font-bold text-white">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : initialsOf(name)}
            </span>
          </span>
          <Link
            to={customerPath("/profile/edit")}
            aria-label="Change profile photo"
            className={clsx("absolute -bottom-1 -right-1 z-[2] flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-brand shadow-md motion-safe:active:scale-90", FOCUS_RING)}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="min-w-0">
          <h1 id="profile-name" className="truncate text-xl font-bold leading-tight">
            {name}
          </h1>
          {contact.length > 0 ? (
            contact.map((c) => (
              <p key={c} className="truncate text-[13px] leading-snug text-muted">
                {c}
              </p>
            ))
          ) : (
            <p className="text-[13px] text-muted">HomeCareX customer</p>
          )}
          <Link
            to={customerPath("/profile/edit")}
            className={clsx(
              "group mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] border-[#B9BFF2] bg-[#E9EBFF] py-1 pl-3 pr-3.5 text-[13px] font-semibold text-brand transition-all duration-200 hover:bg-white motion-safe:active:scale-95",
              FOCUS_RING,
            )}
          >
            <Pencil className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-rotate-12" aria-hidden="true" />
            <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat pb-px transition-[background-size] duration-300 group-hover:bg-[length:100%_1.5px]">
              Edit profile
            </span>
          </Link>
        </div>
      </div>

    </section>
  );
}
