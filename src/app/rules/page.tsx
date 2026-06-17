import Link from "next/link";

export default function RulesPage() {
  return (
    <article className="legal-page">
      <h1>Official Rules — Azzip Corn Kernel Game</h1>
      <p>
        <strong>Sponsor:</strong> Azzip Pizza. <strong>No purchase necessary.</strong> Void where
        prohibited.
      </p>

      <h2>Eligibility</h2>
      <p>
        Open to legal residents of the United States who are 18 years of age or older at time of
        entry. Employees of Azzip Pizza and immediate family members are not eligible.
      </p>

      <h2>How to Play</h2>
      <p>
        Visit the promotion website during the campaign period. Select one corn kernel on the game
        board. Each person may play once per promotion period, verified by session, email, and/or
        phone number.
      </p>

      <h2>Prizes</h2>
      <p>
        Fifty (50) instant-win prizes are available: twenty-five (25) &quot;Free Love It Elote&quot;
        offers and twenty-five (25) &quot;$5 Off&quot; offers, randomly assigned to kernels at
        campaign launch. Approximate retail value varies by location. Prizes are non-transferable and
        not redeemable for cash.
      </p>

      <h2>Odds</h2>
      <p>
        Odds of winning depend on the number of eligible entries and remaining prizes at time of
        play. Prizes are awarded while supplies last.
      </p>

      <h2>Winner Notification</h2>
      <p>
        Winners must provide a valid email address and phone number to claim. Duplicate entries using
        the same email or phone number will be disqualified.
      </p>

      <h2>Campaign Period</h2>
      <p>
        Begins and ends on dates published on the promotion homepage. Azzip Pizza reserves the right
        to modify or terminate the promotion at any time.
      </p>

      <p>
        <Link href="/">← Back to game</Link>
      </p>
    </article>
  );
}
