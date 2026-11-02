import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { Preloader } from "@/components/ui/preloader";
import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { Ticker } from "@/components/sections/ticker";
import { Land } from "@/components/sections/land";
import { Reading } from "@/components/sections/reading";
import { Tipping } from "@/components/sections/tipping";
import { Reach } from "@/components/sections/reach";
import { Crew } from "@/components/sections/crew";
import { Words } from "@/components/sections/words";
import { Trust } from "@/components/sections/trust";
import { Act } from "@/components/sections/act";
import { Offline } from "@/components/sections/offline";
import { Footer } from "@/components/sections/footer";

export const metadata = { title: "NABD نبض — the story" };

export default function Story() {
  return (
    <SmoothScroll>
      <Preloader />
      <Header />
      <main>
        <Hero />
        <Ticker />
        <Land />
        <Reading />
        <Tipping />
        <Reach />
        <Crew />
        <Words />
        <Trust />
        <Act />
        <Offline />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
