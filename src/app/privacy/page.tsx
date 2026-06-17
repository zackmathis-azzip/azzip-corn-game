import Link from "next/link";

export default function PrivacyPage() {
  return (
    <article className="legal-page">
      <h1>Privacy Policy — Azzip Corn Kernel Game</h1>

      <h2>Information We Collect</h2>
      <p>
        When you play the Corn Kernel Game and win a prize, we collect your email address and phone
        number to fulfill your prize. We also collect technical data such as IP address, browser
        type, and session identifiers for fraud prevention and analytics.
      </p>

      <h2>How We Use Information</h2>
      <p>
        Contact information is used to deliver prizes and communicate about your win. We do not sell
        your personal information. With your consent, we may send promotional communications
        subject to CAN-SPAM and TCPA requirements.
      </p>

      <h2>Data Retention</h2>
      <p>
        Claim records are retained for the duration of the promotion and a reasonable period
        thereafter for legal and accounting purposes, then deleted or anonymized.
      </p>

      <h2>Your Rights</h2>
      <p>
        You may request access to or deletion of your data by contacting{" "}
        <a href="mailto:zack.mathis@azzippizza.com">zack.mathis@azzippizza.com</a>.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard measures to protect your data. Game outcomes are determined
        server-side; never share your session or attempt to manipulate results.
      </p>

      <p>
        <Link href="/">← Back to game</Link>
      </p>
    </article>
  );
}
