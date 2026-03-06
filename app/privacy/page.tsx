import Link from "next/link";
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
                Privacy Policy
            </h1>
            <p className="text-zinc-500 text-sm">Last updated: March 2026</p>
            <div className="h-[1px] w-full bg-zinc-800 my-8"></div>
        </div>

        <div className="prose prose-invert prose-zinc max-w-none text-zinc-300 leading-relaxed font-light">
            {/* 여기에 내용을 붙여넣어주세요 / Paste your content here */}
            <p className="text-zinc-500 italic">Privacy Policy

Last updated: ${new Date().toISOString().split("T")[0]}

Unlisted ("we", "our", "us") operates the website unlisted.music.

This Privacy Policy explains how we collect, use, and protect information when you use our platform.

1. Information We Collect

When you use Unlisted, we may collect the following information:

• Account information (such as email or wallet address)
• Content uploaded by users (audio files, artwork, metadata)
• Basic usage information necessary to operate the platform

We do not sell personal information to third parties.

2. How We Use Information

We use collected information to:

• Operate and maintain the Unlisted platform
• Allow users to upload and manage music content
• Enable publishing and sharing of content to external platforms such as YouTube or TikTok when authorized by the user
• Improve platform functionality and reliability

3. Third-Party Services

Unlisted may integrate with third-party platforms including but not limited to:

• YouTube
• TikTok
• Cloud storage or infrastructure providers

When users choose to connect these services, data may be transmitted to those platforms according to their respective privacy policies.

4. Data Storage

Uploaded content and related metadata may be stored on our servers or cloud infrastructure in order to operate the platform.

We retain data only as long as necessary to provide our services.

5. Security

We implement reasonable technical and organizational measures to protect user data. However, no system can guarantee absolute security.

6. Children's Information

Unlisted is not intended for children under the age of 13.

7. Changes to this Policy

We may update this Privacy Policy from time to time. Updates will be posted on this page.

8. Contact

If you have any questions about this Privacy Policy, please contact us at:

contact@unlisted.music</p>
        </div>
      </main>
    </div>
  );
}
