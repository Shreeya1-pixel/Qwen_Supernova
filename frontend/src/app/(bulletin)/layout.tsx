import { NabdProvider } from "@/lib/store";

export default function BulletinLayout({ children }: { children: React.ReactNode }) {
  return <NabdProvider>{children}</NabdProvider>;
}
