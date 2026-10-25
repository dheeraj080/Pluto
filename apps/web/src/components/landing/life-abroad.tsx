import {
  IconShoppingCart,
  IconCoffee,
  IconTrain,
  IconHome,
  IconBookOpen,
  IconCompass,
} from "@/components/icons";
import { Reveal } from "@/components/reveal";

const situations = [
  {
    icon: IconShoppingCart,
    title: "The First Grocery Run in a New Country",
    description: "Unfamiliar supermarket aisles, foreign packaging, and prices in euros or yen. Log your olive oil and oats without second-guessing your budget.",
    route: "SUPERMARKET · WEEK 1",
  },
  {
    icon: IconCoffee,
    title: "Flat Whites & Student Courtyard Chats",
    description: "Socializing in a new city without constantly worrying if €4.50 is breaking your savings. Reference currency translation gives you clear intuition.",
    route: "CAMPUS CAFE · DAILY",
  },
  {
    icon: IconTrain,
    title: "Subway Passes & Monthly Student Commutes",
    description: "Whether it is a contactless pass or a monthly ticket, know what your mobility costs in your reporting currency.",
    route: "TRANSIT NETWORK · MONTHLY",
  },
  {
    icon: IconHome,
    title: "Shared Flat Dinners & Roommate Bills",
    description: "Splitting groceries, internet, and electricity with flatmates who use local banking while your savings sit in home currency.",
    route: "STUDENT FLAT · BILL SPLIT",
  },
  {
    icon: IconBookOpen,
    title: "Campus Books, Workbooks & Guild Dues",
    description: "Course packets, printing cards, and registrations recorded in a couple of taps before your lecture begins.",
    route: "SEMINAR ROOM · ACADEMICS",
  },
  {
    icon: IconCompass,
    title: "Spontaneous Weekend Border Trains",
    description: "Hopping across borders. Record spending in local currency and see what it means in the currency you think in.",
    route: "WEEKEND HOP · MULTI-CURRENCY",
  },
];

export function LifeAbroadSection() {
  return (
    <section id="life-abroad" className="scroll-mt-24 py-10 md:py-14 relative bg-desk transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted mb-3">
            <span className="w-6 h-[1px] bg-border-strong" />
            <span>Everyday Situations</span>
            <span className="w-6 h-[1px] bg-border-strong" />
          </div>

          <div className="max-w-2xl mx-auto text-center space-y-3 mb-8 md:mb-10">
            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-ink tracking-tight leading-tight"
              style={{ textWrap: "balance", fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
            >
              Made for the life you actually live abroad.
            </h2>
            <p className="text-base sm:text-lg text-muted leading-relaxed" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
              You are learning a new transit system, making new friends, and adapting to a new culture. Your expense tracker shouldn&apos;t add to your cognitive load.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {situations.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={index} delay={index * 60}>
                <div className="bg-paper rounded-[var(--radius-card,8px)] p-6 sm:p-7 border border-border shadow-[var(--edge-stock),var(--cast-stock)] hover:border-strong transition-colors flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-9 h-9 rounded-[var(--radius-stock,8px)] bg-paper border border-border flex items-center justify-center text-accent">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold font-mono text-muted">
                        {item.route}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-ink mb-2" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-muted leading-relaxed" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
