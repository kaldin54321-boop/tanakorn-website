import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ViewTracker from "./components/ViewTracker";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <ViewTracker />
        {children}
        <Footer />
      </body>
    </html>
  );
}