import { Suspense } from "react";
import { Phone } from "./phone";

export const metadata = { title: "NABD relay" };

export default function RelayPage() {
  return (
    <Suspense>
      <Phone />
    </Suspense>
  );
}
