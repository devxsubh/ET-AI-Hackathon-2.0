import type { Metadata } from "next";
import { Inter, EB_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
    variable: "--font-eb-garamond",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
    metadataBase: new URL("https://engram.app"),
    title: "Engram — Industrial Knowledge Intelligence",
    description:
        "Auto-generated knowledge graph for Indian heavy industry. Capture what engineers know before they retire.",
    icons: {
        icon: [
            {
                url: "/favicon.ico",
            },
        ],
        apple: "/apple-touch-icon.png",
    },
    openGraph: {
        type: "website",
        url: "https://engram.app",
        siteName: "Engram",
        title: "Engram — Industrial Knowledge Intelligence",
        description:
            "Drop in documents. Engram builds the graph. Ask anything.",
        images: [
            {
                url: "/link-image.jpg",
                width: 1200,
                height: 651,
                alt: "Engram",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Engram — Industrial Knowledge Intelligence",
        description:
            "Drop in documents. Engram builds the graph. Ask anything.",
        images: ["/link-image.jpg"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${inter.variable} ${ebGaramond.variable} font-sans antialiased`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
