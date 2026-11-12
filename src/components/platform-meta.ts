import type { Platform } from "@prisma/client";
import { FacebookIcon, InstagramIcon, LinkedInIcon } from "@/components/icons/brand-icons";

export const PLATFORM_META: Record<
  Platform,
  { label: string; icon: (props: { className?: string }) => React.JSX.Element; textLimit: number }
> = {
  FACEBOOK: { label: "Facebook", icon: FacebookIcon, textLimit: 63206 },
  INSTAGRAM: { label: "Instagram", icon: InstagramIcon, textLimit: 2200 },
  LINKEDIN: { label: "LinkedIn", icon: LinkedInIcon, textLimit: 3000 },
};
