export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-2xl font-semibold">Terms of Use</h1>
      <p className="mb-10 text-sm text-gray-500">Effective date: May 1, 2026</p>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">1. Acceptance of Terms</h2>
        <p className="text-gray-700">
          By creating an account or using this photo sharing service (the
          &ldquo;Service&rdquo;), you agree to be bound by these Terms of Use.
          If you do not agree, do not use the Service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">2. Eligibility</h2>
        <p className="text-gray-700">
          You must be at least 13 years old to use the Service. By using the
          Service, you represent that you meet this age requirement. If you are
          under 18, you confirm that a parent or legal guardian has reviewed and
          agreed to these terms on your behalf.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">3. Your Account</h2>
        <p className="text-gray-700">
          You are responsible for maintaining the confidentiality of your login
          credentials and for all activity that occurs under your account. Notify
          us immediately of any unauthorized use. We reserve the right to
          terminate accounts that violate these Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">4. Content You Upload</h2>
        <p className="mb-3 text-gray-700">
          You retain ownership of photos and other content you upload
          (&ldquo;Your Content&rdquo;). By uploading, you grant us a
          non-exclusive, worldwide, royalty-free license to store, display, and
          distribute Your Content solely to operate and improve the Service.
        </p>
        <p className="text-gray-700">
          You represent that you own or have the necessary rights to upload Your
          Content, and that it does not infringe the intellectual property,
          privacy, or other rights of any third party.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">5. Prohibited Content</h2>
        <p className="mb-3 text-gray-700">
          You agree not to upload, share, or transmit content that:
        </p>
        <ul className="list-disc space-y-1 pl-6 text-gray-700">
          <li>Is illegal, obscene, or sexually explicit;</li>
          <li>Harasses, threatens, or demeans other individuals;</li>
          <li>
            Infringes any copyright, trademark, or other intellectual property
            right;
          </li>
          <li>Contains malware, spyware, or other malicious code;</li>
          <li>
            Impersonates any person or entity or misrepresents your affiliation;
          </li>
          <li>Violates any applicable law or regulation.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          6. Privacy and Data Collection
        </h2>
        <p className="text-gray-700">
          Our Privacy Policy describes how we collect, use, and share information
          about you when you use the Service. By using the Service, you agree to
          the collection and use of information in accordance with that policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          7. Intellectual Property
        </h2>
        <p className="text-gray-700">
          Except for Your Content, the Service and all materials within it —
          including software, design, logos, and text — are owned by or licensed
          to us and may not be copied, modified, or distributed without our prior
          written consent.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">8. Termination</h2>
        <p className="text-gray-700">
          We may suspend or terminate your access to the Service at any time, for
          any reason, including violation of these Terms. You may delete your
          account at any time from your profile settings. Upon termination, your
          right to use the Service ceases immediately.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          9. Disclaimer of Warranties
        </h2>
        <p className="text-gray-700">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, express or implied,
          including but not limited to warranties of merchantability, fitness for
          a particular purpose, or non-infringement. We do not guarantee that the
          Service will be uninterrupted, error-free, or free of harmful
          components.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          10. Limitation of Liability
        </h2>
        <p className="text-gray-700">
          To the maximum extent permitted by law, we shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages
          arising from your use of or inability to use the Service, even if we
          have been advised of the possibility of such damages.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">11. Changes to These Terms</h2>
        <p className="text-gray-700">
          We may update these Terms from time to time. When we do, we will revise
          the effective date above and, for material changes, notify you by email
          or an in-app notice. Continued use of the Service after changes take
          effect constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">12. Governing Law</h2>
        <p className="text-gray-700">
          These Terms are governed by the laws of the State of Delaware, without
          regard to its conflict-of-law provisions. Any disputes arising from
          these Terms or the Service shall be resolved exclusively in the state or
          federal courts located in Delaware.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">13. Contact</h2>
        <p className="text-gray-700">
          Questions about these Terms? Contact us at{" "}
          <a
            href="mailto:legal@example.com"
            className="underline hover:text-gray-900"
          >
            legal@example.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
