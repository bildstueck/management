export type PreviewMedia = { id: string; type: "IMAGE" | "VIDEO"; url: string };

export type PreviewProps = {
  accountName: string;
  avatarUrl?: string | null;
  text: string;
  media: PreviewMedia[];
  mode: "desktop" | "mobile";
};

export function previewInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}
