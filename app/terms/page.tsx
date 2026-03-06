import Link from "next/link";
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30 overflow-y-auto w-full relative">
      <header className="fixed top-0 w-full z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm pointer-events-none">
        <Link href="/" className="pointer-events-auto flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft size={20} className="text-zinc-400" />
            <span className="text-sm font-medium text-zinc-400">Back</span>
        </Link>
      </header>

      <main className="w-full max-w-4xl mx-auto px-6 py-32 space-y-8 relative z-10">
        <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-2">
                Terms of Service
            </h1>
            <p className="text-zinc-500 text-sm">Last updated: March 2026</p>
            <div className="h-[1px] w-full bg-zinc-800 my-8"></div>
        </div>

        <div className="prose prose-invert prose-zinc max-w-none text-zinc-300 leading-relaxed font-light">
            {/* 여기에 내용을 붙여넣어주세요 / Paste your content here */}
            <p className="text-zinc-500 italic">Terms of Service

Last updated: ${new Date().toISOString().split("T")[0]}

Welcome to Unlisted.

These Terms of Service ("Terms") govern your use of the website unlisted.music and related services.

By using the platform, you agree to these Terms.

1. Use of the Service

Unlisted provides a platform where creators can upload music and related media content and optionally publish or share that content to other platforms.

You agree to use the service only for lawful purposes.

2. User Content

Users may upload audio, artwork, and related content to the platform.

By uploading content, you represent and warrant that:

• You own the rights to the content, or
• You have the necessary permission to upload and distribute the content.

You retain ownership of your content.

However, by uploading content to Unlisted, you grant us a non-exclusive license to host, store, process, and display the content as necessary to operate the platform.

3. Publishing to Third-Party Platforms

Users may choose to publish content to external platforms such as YouTube or TikTok.

When doing so, users authorize Unlisted to transmit the content to those services using the respective platform APIs.

Unlisted is not responsible for the policies or actions of third-party platforms.

4. Prohibited Use

Users may not upload content that:

• Violates intellectual property rights
• Is unlawful, harmful, or abusive
• Violates the terms of third-party platforms

We reserve the right to remove content that violates these rules.

5. Service Availability

We may modify or discontinue parts of the service at any time without prior notice.

6. Limitation of Liability

Unlisted is provided "as is" without warranties of any kind.

To the maximum extent permitted by law, we are not liable for damages arising from the use of the platform.

7. Changes to the Terms

We may update these Terms from time to time. Continued use of the platform constitutes acceptance of the updated Terms.

8. Contact

If you have questions about these Terms, please contact:

contact@unlisted.music</p>
        </div>
      </main>
    </div>
  );
}
